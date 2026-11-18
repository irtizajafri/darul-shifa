import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Link2, Lock, Plus, RefreshCw, Unlink, Wand2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import { useAuthStore } from '../../../store/useAuthStore';
import useModalKeys from '../../../hooks/useModalKeys';
import { API, bankLabel, fmtDay, getJson, itemTypeLabel, money, moneyOrBlank, postJson, useBanks } from './bankReconUtils';
import './bankRecon.scss';

// Accounts → Transactions → Bank Reconciliation (owner, 2026-11-18). Left: what
// our books show for this bank and the statement doesn't yet; right: what the
// uploaded bank statement shows and our books don't yet. Auto-match pairs
// the sure ones (cheque no. + amount, or one amount within a few days); the
// rest are ticked by hand — one statement line with the book entries that
// make it up. A statement line that isn't in the books at all (bank charges,
// profit) can be added to the books from here.

const sideOfLine = (l) => (l.debit > 0 ? 'out' : 'in');
const amountOfLine = (l) => (l.debit > 0 ? l.debit : l.credit);

export default function BankReconciliation() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.name || user?.username || user?.email || '';
  const book = entityType === 'corporate' ? 'Panel (Corporate)' : 'Cash GL';
  const banks = useBanks(entityType);
  const [bankId, setBankId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState('open');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickedLine, setPickedLine] = useState(null);
  const [pickedItems, setPickedItems] = useState(() => new Set());
  const [addLine, setAddLine] = useState(null);

  useEffect(() => { if (!bankId && banks.length === 1) setBankId(banks[0].id); }, [banks, bankId]);

  const load = useCallback(async (id = bankId) => {
    if (!id) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({ bankAccountId: id });
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      setData(await getJson(`${API}/bank-recon?${p}`));
      setPickedLine(null);
      setPickedItems(new Set());
    } catch (e) {
      toast.error(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [bankId, from, to]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (bankId) load(bankId); }, [bankId]);

  const lock = data?.lockDate || null;
  const locked = (d) => !!lock && d <= lock;

  const openItems = useMemo(() => (data?.items || []).filter((i) => !i.lineId && i.clearedBy !== 'manual'), [data]);
  const openLines = useMemo(() => (data?.lines || []).filter((l) => !l.matched), [data]);
  const matchedLines = useMemo(() => (data?.lines || []).filter((l) => l.matched), [data]);
  const handPresented = useMemo(() => (data?.items || []).filter((i) => i.clearedBy === 'manual'), [data]);
  const itemsOfLine = useMemo(() => {
    const m = new Map();
    (data?.items || []).forEach((i) => { if (i.lineId) m.set(i.lineId, [...(m.get(i.lineId) || []), i]); });
    return m;
  }, [data]);

  const line = pickedLine ? openLines.find((l) => l.id === pickedLine) : null;
  const picked = openItems.filter((i) => pickedItems.has(i.key));
  const pickedTotal = Math.round(picked.reduce((s, i) => s + i.amount, 0) * 100) / 100;
  const lineAmt = line ? amountOfLine(line) : 0;
  const diff = Math.round((lineAmt - pickedTotal) * 100) / 100;
  const sideOk = !line || picked.every((i) => i.side === sideOfLine(line));
  const canMatch = !!line && picked.length > 0 && sideOk && Math.abs(diff) < 0.005;

  const toggleItem = (k) => setPickedItems((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const d = await fn();
      if (okMsg) toast.success(typeof okMsg === 'function' ? okMsg(d) : okMsg);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const autoMatch = () => run(
    () => postJson(`${API}/bank-recon/auto-match`, { bankAccountId: bankId, userName }),
    (d) => (d.matched ? `${d.matched} pair(s) matched automatically` : 'Nothing could be matched for sure — tick the rest by hand'),
  );
  const match = () => run(
    () => postJson(`${API}/bank-recon/match`, { bankAccountId: bankId, lineId: line.id, itemKeys: picked.map((i) => i.key), userName }),
    'Matched',
  );
  const unmatch = async (l) => {
    const ok = await confirmDialog({ title: 'Unmatch this statement line?', message: `${fmtDay(l.date)} · ${l.particulars || l.instrumentNo || ''} · Rs. ${money(amountOfLine(l))} goes back to the open list, with its book entries.`, confirmLabel: 'Unmatch' });
    if (ok) run(() => postJson(`${API}/bank-recon/unmatch`, { bankAccountId: bankId, lineId: l.id }), 'Unmatched');
  };

  const itemRow = (i) => {
    const isLocked = locked(i.date);
    const off = isLocked || (line && i.side !== sideOfLine(line));
    return (
      <tr key={i.key} className={pickedItems.has(i.key) ? 'is-picked' : ''}>
        <td>
          {isLocked ? <Lock size={13} aria-label="Signed off" /> : (
            <input type="checkbox" checked={pickedItems.has(i.key)} disabled={off} onChange={() => toggleItem(i.key)} aria-label={`Pick ${itemTypeLabel(i)} ${i.ref}`} />
          )}
        </td>
        <td className="d">{fmtDay(i.date)}</td>
        <td className="d">{itemTypeLabel(i)}</td>
        <td>{i.ref}<div className="muted">{i.description}</div></td>
        <td className={`n ${i.side === 'in' ? 'in' : 'out'}`}>{i.side === 'in' ? '+' : '−'}{money(i.amount)}</td>
      </tr>
    );
  };

  return (
    <div className="brc">
      <div className="brc__bar">
        <button type="button" className="brc__back" onClick={() => navigate(`/accounts/${entityType}/transactions`)}><ArrowLeft size={14} /> Transactions</button>
        <div className="brc__heading">
          <h1>Bank Reconciliation</h1>
          <span>{book} · match the bank statement with our books</span>
        </div>
        <div className="brc__controls">
          <label className="brc__bank">
            <span>Bank Account</span>
            <SearchableSelect options={banks} value={bankId} onChange={setBankId} placeholder="— Select bank —" getLabel={bankLabel} getKey={(b) => b.id} size="sm" />
          </label>
          <label><span>From (optional)</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span>To (optional)</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button type="button" className="brc__btn" onClick={() => load()} disabled={loading || !bankId}><RefreshCw size={14} /> Show</button>
          <button type="button" className="brc__btn brc__btn--primary" onClick={autoMatch} disabled={busy || !data}><Wand2 size={14} /> Auto-match</button>
        </div>
      </div>

      {!bankId && <p className="brc__empty">Select a bank account. Upload its statement first (Transactions → Upload Bank Statement).</p>}
      {loading && <p className="brc__empty">Loading…</p>}

      {!loading && data && (
        <>
          <div className="brc__kpis">
            <div><span>Book entries to match</span><b>{openItems.length}</b></div>
            <div><span>Statement lines to match</span><b>{openLines.length}</b></div>
            <div><span>Matched lines</span><b>{matchedLines.length}</b></div>
            <div><span>Statement lines in all</span><b>{data.lines.length}</b></div>
          </div>
          {lock && (
            <div className="brc__note"><Lock size={14} /> Signed off up to {fmtDay(lock)} — entries on or before that day can&apos;t be matched or unmatched until the sign-off is reopened (Reports → Bank Reconciliation Statement).</div>
          )}

          <div className="brc__bar" style={{ marginBottom: 10 }}>
            <div className="brc-seg" role="radiogroup" aria-label="Show">
              <button type="button" className={view === 'open' ? 'is-on' : ''} aria-pressed={view === 'open'} onClick={() => setView('open')}>To match</button>
              <button type="button" className={view === 'matched' ? 'is-on' : ''} aria-pressed={view === 'matched'} onClick={() => setView('matched')}>Matched</button>
            </div>
          </div>

          {view === 'open' && (
            <>
              <div className="brc-match">
                <section className="brc__card" aria-label="Our books">
                  <div className="brc__card-head">
                    <h2>In our books, not on the statement</h2>
                    <span>{openItems.length} entr{openItems.length === 1 ? 'y' : 'ies'}</span>
                  </div>
                  <div className="brc__scroll">
                    <table className="brc__table">
                      <thead><tr><th /><th>Date</th><th>Type</th><th>Ref / Details</th><th className="n">Amount</th></tr></thead>
                      <tbody>
                        {!openItems.length && <tr><td colSpan={5} className="muted">Everything in the books is matched.</td></tr>}
                        {[['out', 'Payments (cheque / online)'], ['in', 'Money in (deposits, income, panel cheques, CC)']].map(([side, label]) => {
                          const rows = openItems.filter((i) => i.side === side);
                          return rows.length ? (
                            <Fragment key={side}>
                              <tr className="brc-group-row"><td colSpan={5}>{label} · {rows.length}</td></tr>
                              {rows.map(itemRow)}
                            </Fragment>
                          ) : null;
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="brc__card" aria-label="Bank statement">
                  <div className="brc__card-head">
                    <h2>On the statement, not in our books</h2>
                    <span>{openLines.length} line{openLines.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="brc__scroll">
                    <table className="brc__table">
                      <thead><tr><th /><th>Date</th><th>Instrument / Particulars</th><th className="n">Debit</th><th className="n">Credit</th><th /></tr></thead>
                      <tbody>
                        {!openLines.length && <tr><td colSpan={6} className="muted">{data.lines.length ? 'Every statement line is matched.' : 'No statement uploaded for this bank yet.'}</td></tr>}
                        {openLines.map((l) => (
                          <tr key={l.id} className={pickedLine === l.id ? 'is-picked' : ''}>
                            <td>
                              {locked(l.date) ? <Lock size={13} aria-label="Signed off" /> : (
                                <input type="radio" name="brc-line" checked={pickedLine === l.id} onChange={() => { setPickedLine(l.id); setPickedItems((s) => new Set([...s].filter((k) => openItems.find((i) => i.key === k)?.side === sideOfLine(l)))); }} aria-label={`Pick statement line ${l.particulars}`} />
                              )}
                            </td>
                            <td className="d">{fmtDay(l.date)}</td>
                            <td>{l.instrumentNo ? <b>{l.instrumentNo} </b> : null}{l.particulars}</td>
                            <td className="n out">{moneyOrBlank(l.debit)}</td>
                            <td className="n in">{moneyOrBlank(l.credit)}</td>
                            <td className="n">
                              {!locked(l.date) && (
                                <button type="button" className="brc__btn brc__btn--sm" onClick={() => setAddLine(l)} title="Not in the books — make the voucher for it"><Plus size={12} /> Add to books</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              {(line || picked.length > 0) && (
                <div className="brc-matchbar" aria-live="polite">
                  <span>Statement line: <b>{line ? `${line.debit > 0 ? 'Debit' : 'Credit'} ${money(lineAmt)}` : 'pick one on the right'}</b></span>
                  <span>Book entries picked: <b>{picked.length} · {money(pickedTotal)}</b></span>
                  {line && picked.length > 0 && (
                    <span className={Math.abs(diff) < 0.005 && sideOk ? 'brc-matchbar__diff--ok' : 'brc-matchbar__diff--bad'}>
                      {!sideOk ? 'A debit matches payments, a credit matches money in' : Math.abs(diff) < 0.005 ? 'Totals agree' : `Difference ${money(diff)}`}
                    </span>
                  )}
                  <div className="brc-matchbar__actions">
                    <button type="button" className="brc__btn" onClick={() => { setPickedLine(null); setPickedItems(new Set()); }}>Clear</button>
                    <button type="button" className="brc__btn brc__btn--primary" onClick={match} disabled={!canMatch || busy}><Link2 size={14} /> Match</button>
                  </div>
                </div>
              )}
            </>
          )}

          {view === 'matched' && (
            <section className="brc__card" aria-label="Matched">
              <div className="brc__card-head">
                <h2>Matched statement lines</h2>
                <span>{matchedLines.length} line{matchedLines.length === 1 ? '' : 's'}</span>
              </div>
              <div className="brc__scroll">
                <table className="brc__table">
                  <thead><tr><th>Statement Date</th><th>Instrument / Particulars</th><th className="n">Debit</th><th className="n">Credit</th><th>Book entries</th><th /></tr></thead>
                  <tbody>
                    {!matchedLines.length && <tr><td colSpan={6} className="muted">Nothing matched yet.</td></tr>}
                    {matchedLines.map((l) => {
                      const its = itemsOfLine.get(l.id) || [];
                      return (
                        <tr key={l.id}>
                          <td className="d">{fmtDay(l.date)}</td>
                          <td>{l.instrumentNo ? <b>{l.instrumentNo} </b> : null}{l.particulars}</td>
                          <td className="n out">{moneyOrBlank(l.debit)}</td>
                          <td className="n in">{moneyOrBlank(l.credit)}</td>
                          <td>
                            {its.length ? its.map((i) => (
                              <div key={i.key}>{fmtDay(i.date)} · {itemTypeLabel(i)} {i.ref} · {money(i.amount)} <span className="muted">{i.description}</span></div>
                            )) : <span className="muted">(entries outside this period)</span>}
                          </td>
                          <td className="n">
                            {locked(l.date) ? <span className="brc__tag brc__tag--lock"><Lock size={10} /> Signed off</span> : (
                              <button type="button" className="brc__btn brc__btn--sm brc__btn--danger" onClick={() => unmatch(l)} disabled={busy}><Unlink size={12} /> Unmatch</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {handPresented.length > 0 && (
                <>
                  <div className="brc__card-head" style={{ marginTop: 14 }}>
                    <h2>Cheques ticked presented by hand</h2>
                    <span>Transactions → Presented / Unpresented Cheques</span>
                  </div>
                  <table className="brc__table">
                    <thead><tr><th>Cheque Date</th><th>Cheque #</th><th>Payee</th><th className="n">Amount</th><th>Presented On</th></tr></thead>
                    <tbody>
                      {handPresented.map((i) => (
                        <tr key={i.key}><td className="d">{fmtDay(i.date)}</td><td>{i.ref}</td><td>{i.description}</td><td className="n">{money(i.amount)}</td><td className="d">{fmtDay(i.clearedDate)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </section>
          )}
        </>
      )}

      {addLine && (
        <AddToBooksModal
          line={addLine} bankId={bankId} entityType={entityType} userName={userName}
          onClose={() => setAddLine(null)}
          onSaved={() => { setAddLine(null); load(); }}
        />
      )}
    </div>
  );
}

// A statement line the books don't have: a debit becomes an online Voucher
// Expense on this bank (pick the account), a credit a bank Voucher Income
// (pick the category) — dated the statement day, then matched to the line.
function AddToBooksModal({ line, bankId, entityType, userName, onClose, onSaved }) {
  const isDebit = line.debit > 0;
  const [options, setOptions] = useState([]);
  const [pick, setPick] = useState('');
  const [particulars, setParticulars] = useState(line.particulars || '');
  const [saving, setSaving] = useState(false);
  useModalKeys({ active: true, onEsc: () => !saving && onClose() });

  useEffect(() => {
    const url = isDebit ? `${API}/bank-recon/expense-accounts?entityType=${entityType}` : `${API}/income-categories?entityType=${entityType}`;
    getJson(url).then((d) => setOptions(d || [])).catch((e) => toast.error(e.message));
  }, [isDebit, entityType]);

  const save = async () => {
    if (!pick) { toast.error(isDebit ? 'Pick the expense account' : 'Pick the income category'); return; }
    setSaving(true);
    try {
      const d = await postJson(`${API}/bank-recon/add-to-books`, {
        bankAccountId: bankId, lineId: line.id, particulars, userName,
        ...(isDebit ? { mainAccountId: pick } : { incomeCategoryId: pick }),
      });
      toast.success(`${d.kind === 'expense' ? 'Voucher Expense' : 'Voucher Income'} ${d.voucherNo} made and matched`);
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="brc-modal" role="dialog" aria-modal="true" aria-label="Add to books">
      <div className="brc-modal__box">
        <div className="brc-modal__head">
          <h2>Add to books — {isDebit ? 'bank debit' : 'bank credit'}</h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="brc-modal__body">
          <div className="brc-modal__facts">
            <span>Date</span><b>{fmtDay(line.date)}</b>
            <span>Particulars</span><b>{line.instrumentNo ? `${line.instrumentNo} · ` : ''}{line.particulars}</b>
            <span>Amount</span><b>{money(isDebit ? line.debit : line.credit)}</b>
            <span>Makes</span><b>{isDebit ? 'Voucher Expense (online, this bank)' : 'Voucher Income (bank mode, this bank)'}</b>
          </div>
          <label>
            <span>{isDebit ? 'Expense Account (e.g. Bank Charges)' : 'Income Category (e.g. Bank Profit)'}</span>
            <SearchableSelect
              options={options} value={pick} onChange={setPick}
              placeholder={isDebit ? '— Select account —' : '— Select category —'}
              getLabel={(o) => (isDebit ? `${o.name} (${o.code}) · ${o.path}` : o.name)} getKey={(o) => o.id}
            />
          </label>
          <label>
            <span>Particulars</span>
            <input value={particulars} onChange={(e) => setParticulars(e.target.value)} />
          </label>
        </div>
        <div className="brc-modal__foot">
          <button type="button" className="brc__btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="brc__btn brc__btn--primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save & Match'}</button>
        </div>
      </div>
    </div>
  );
}
