import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Lock, LockOpen, Printer, RefreshCw, Stamp } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import { useAuthStore } from '../../../store/useAuthStore';
import { API, bankLabel, fmtDay, getJson, itemTypeLabel, money, pktToday, postJson, printA4, useBanks } from './bankReconUtils';
import './bankRecon.scss';

// Accounts → Reports → Bank Reconciliation Statement (owner, 2026-11-18). For
// one bank on one date: the statement balance, plus deposits in transit,
// less unpresented cheques / payments, less bank credits not in the books,
// plus bank debits not in the books = the Bank Book balance. Difference
// should be 0. Signing it off locks matching on or before that date until a
// Super Admin reopens it.

const amountOfLine = (l) => (l.debit > 0 ? l.debit : l.credit);

export default function BankReconciliationStatement() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.name || user?.username || user?.email || '';
  const book = entityType === 'corporate' ? 'Panel (Corporate)' : 'Cash GL';
  const banks = useBanks(entityType);
  const [bankId, setBankId] = useState('');
  const [asOf, setAsOf] = useState(pktToday());
  const [typed, setTyped] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!bankId && banks.length === 1) setBankId(banks[0].id); }, [banks, bankId]);

  const load = useCallback(async () => {
    if (!bankId) { toast.error('Select the bank account'); return; }
    const t = String(typed).replace(/,/g, '').trim();
    if (t && !Number.isFinite(Number(t))) { toast.error('Statement balance must be a number'); return; }
    setLoading(true);
    try {
      const p = new URLSearchParams({ bankAccountId: bankId, asOf });
      if (t) p.set('statementBalance', t);
      setData(await getJson(`${API}/bank-recon/statement?${p}`));
    } catch (e) {
      toast.error(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [bankId, asOf, typed]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (bankId) load(); }, [bankId]);

  const title = 'Bank Reconciliation Statement';
  const sub = data ? `${bankLabel(data.bank)} · ${book} · as on ${fmtDay(data.asOf)}` : '';
  const ok = data && data.difference !== null && Math.abs(data.difference) < 0.005;
  const signedHere = data?.signoffs.find((s) => !s.reopenedAt && s.asOfDate === data.asOf);

  const handlePrint = () => {
    if (!data) return;
    printA4(`${title} — ${bankLabel(data.bank)} — ${fmtDay(data.asOf)}`, document.getElementById('brs-print')?.innerHTML || '', `
      .brs-head td { font-weight: 700; }
      .brs-item td:first-child, .brs-none td { padding-left: 14px; }
      .brs-none td { font-style: italic; }
      .brs-total td, .brs-diff td { font-weight: 700; border-top: 1.5px solid #000; }
      .brs-sign { display: flex; justify-content: space-between; gap: 18mm; margin-top: 16mm; }
      .brs-sign span { flex: 1; border-top: 1px solid #000; padding-top: 2px; text-align: center; }
      .brs-signed { margin-top: 3mm; }
    `);
  };

  const handleExcel = () => {
    if (!data) return;
    const aoa = [[title], [sub], []];
    const head = (label, amount) => aoa.push([label, '', '', amount]);
    const items = (list) => (list.length ? list : [null]).forEach((i) => aoa.push(i ? [`   ${fmtDay(i.date)}`, i.ref || '', i.description || '', i.amount] : ['   (none)', '', '', '']));
    const lines = (list) => (list.length ? list : [null]).forEach((l) => aoa.push(l ? [`   ${fmtDay(l.date)}`, l.instrumentNo || '', l.particulars || '', amountOfLine(l)] : ['   (none)', '', '', '']));
    head(`Balance as per Bank Statement (${data.statementBalanceFrom || 'not available'})`, data.statementBalance ?? '');
    head('Add: Deposits in transit', data.totals.inTransit); items(data.inTransit);
    head('Less: Unpresented cheques / payments', -data.totals.unpresented); items(data.unpresented);
    head('Less: Bank credits not in books', -data.totals.bankCredits); lines(data.bankCredits);
    head('Add: Bank debits not in books', data.totals.bankDebits); lines(data.bankDebits);
    aoa.push([]);
    head('Adjusted balance', data.adjustedBalance ?? '');
    head('Balance as per Bank Book', data.bookBalance);
    head('Difference', data.difference ?? '');
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 46 }, { wch: 16 }, { wch: 40 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BRS');
    XLSX.writeFile(wb, `brs_${data.bank.bankName.replace(/\W+/g, '_')}_${data.asOf}.xlsx`);
  };

  const signOff = async () => {
    if (!data) return;
    const sure = await confirmDialog({
      title: `Sign off as of ${fmtDay(data.asOf)}?`,
      message: `${ok ? 'The statement agrees with the Bank Book.' : `There is a difference of Rs. ${money(data.difference)}.`}\n\nAfter signing, matching on or before ${fmtDay(data.asOf)} is locked until a Super Admin reopens it.`,
      confirmLabel: 'Sign off', danger: !ok,
    });
    if (!sure) return;
    setBusy(true);
    try {
      const t = String(typed).replace(/,/g, '').trim();
      await postJson(`${API}/bank-recon/signoff`, { bankAccountId: bankId, asOf: data.asOf, statementBalance: t || undefined, userName });
      toast.success('Signed off');
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const reopen = async (s) => {
    const sure = await confirmDialog({ title: `Reopen the sign-off of ${fmtDay(s.asOfDate)}?`, message: 'Matching on or before that date can be changed again. The sign-off stays in the history as reopened.', confirmLabel: 'Reopen' });
    if (!sure) return;
    setBusy(true);
    try {
      await postJson(`${API}/bank-recon/signoff/${s.id}/reopen`, { userName });
      toast.success('Reopened');
      load();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const section = (label, sign, total, count, rows) => (
    <>
      <tr className="brs-head"><td colSpan={3}>{label} <span style={{ fontWeight: 400 }}>({count})</span></td><td className="n">{total ? sign : ''}{money(total)}</td></tr>
      {rows}
    </>
  );
  const itemRows = (list) => (list.length ? list.map((i) => (
    <tr className="brs-item" key={i.key}><td>{fmtDay(i.date)}</td><td>{itemTypeLabel(i)} {i.ref}</td><td>{i.description}</td><td className="n">{money(i.amount)}</td></tr>
  )) : <tr className="brs-none"><td colSpan={4}>None</td></tr>);
  const lineRows = (list) => (list.length ? list.map((l) => (
    <tr className="brs-item" key={l.id}><td>{fmtDay(l.date)}</td><td>{l.instrumentNo}</td><td>{l.particulars}</td><td className="n">{money(amountOfLine(l))}</td></tr>
  )) : <tr className="brs-none"><td colSpan={4}>None</td></tr>);

  return (
    <div className="brc">
      <div className="brc__bar">
        <button type="button" className="brc__back" onClick={() => navigate(`/accounts/${entityType}/reports`)}><ArrowLeft size={14} /> Reports</button>
        <div className="brc__heading">
          <h1>Bank Reconciliation Statement</h1>
          <span>{book}</span>
        </div>
        <div className="brc__controls">
          <label className="brc__bank">
            <span>Bank Account</span>
            <SearchableSelect options={banks} value={bankId} onChange={setBankId} placeholder="— Select bank —" getLabel={bankLabel} getKey={(b) => b.id} size="sm" />
          </label>
          <label><span>As on</span><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></label>
          <label><span>Statement balance (blank = from upload)</span><input inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="from uploaded statement" /></label>
          <button type="button" className="brc__btn brc__btn--primary" onClick={load} disabled={loading || !bankId}><RefreshCw size={14} /> Show</button>
          <button type="button" className="brc__btn" onClick={handlePrint} disabled={!data}><Printer size={14} /> Print</button>
          <button type="button" className="brc__btn" onClick={handleExcel} disabled={!data}><FileSpreadsheet size={14} /> Excel</button>
        </div>
      </div>

      {!bankId && <p className="brc__empty">Select a bank account.</p>}
      {loading && <p className="brc__empty">Loading…</p>}
      {!loading && data && (
        <>
          <div className="brc__kpis">
            <div><span>Statement balance</span><b>{data.statementBalance === null ? '—' : money(data.statementBalance)}</b></div>
            <div><span>Bank Book balance</span><b>{money(data.bookBalance)}</b></div>
            <div><span>Difference</span><b style={{ color: data.difference === null ? undefined : ok ? 'var(--brc-in)' : 'var(--brc-warn)' }}>{data.difference === null ? '—' : money(data.difference)}</b></div>
            <div>
              <span>Status</span>
              <b style={{ fontSize: '0.85rem' }}>
                {signedHere ? <span className="brc__tag brc__tag--lock"><Lock size={10} /> Signed off</span>
                  : ok ? <span className="brc__tag brc__tag--ok">Reconciled</span>
                    : <span className="brc__tag brc__tag--warn">Not reconciled</span>}
              </b>
            </div>
          </div>
          {data.statementBalance === null && (
            <div className="brc__note">No uploaded statement line on or before {fmtDay(data.asOf)} has a balance — upload the statement, or type the statement balance above and press Show.</div>
          )}

          <div className="brc__card brs-sheet" id="brs-print">
            <h1>{title}</h1>
            <p className="brc-print-sub">{sub}</p>
            <table>
              <tbody>
                <tr className="brs-head">
                  <td colSpan={3}>Balance as per Bank Statement <span style={{ fontWeight: 400 }}>{data.statementBalanceFrom ? `(${data.statementBalanceFrom})` : ''}</span></td>
                  <td className="n">{data.statementBalance === null ? '—' : money(data.statementBalance)}</td>
                </tr>
                {section('Add: Deposits in transit (in our books, not yet credited by the bank)', '+', data.totals.inTransit, data.inTransit.length, itemRows(data.inTransit))}
                {section('Less: Unpresented cheques / payments (issued, not yet paid by the bank)', '−', data.totals.unpresented, data.unpresented.length, itemRows(data.unpresented))}
                {section('Less: Bank credits not in our books', '−', data.totals.bankCredits, data.bankCredits.length, lineRows(data.bankCredits))}
                {section('Add: Bank debits not in our books', '+', data.totals.bankDebits, data.bankDebits.length, lineRows(data.bankDebits))}
                <tr className="brs-total"><td colSpan={3}>Adjusted balance</td><td className="n">{data.adjustedBalance === null ? '—' : money(data.adjustedBalance)}</td></tr>
                <tr className="brs-total"><td colSpan={3}>Balance as per Bank Book</td><td className="n">{money(data.bookBalance)}</td></tr>
                <tr className={`brs-diff ${ok ? 'brs-diff--ok' : 'brs-diff--bad'}`}><td colSpan={3}>Difference (Bank Book − adjusted balance)</td><td className="n">{data.difference === null ? '—' : money(data.difference)}</td></tr>
              </tbody>
            </table>
            {signedHere && <p className="brs-signed">Reconciled and signed off by {signedHere.signedByName || '—'} on {new Date(signedHere.signedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
            <div className="brs-sign"><span>Prepared by</span><span>Checked by</span><span>Approved by</span></div>
          </div>

          <div className="brc__card" style={{ marginTop: 12, maxWidth: 900 }}>
            <div className="brc__card-head">
              <h2>Sign-off</h2>
              <button type="button" className="brc__btn brc__btn--primary" onClick={signOff} disabled={busy || data.statementBalance === null || !!signedHere}><Stamp size={14} /> Sign off as of {fmtDay(data.asOf)}</button>
            </div>
            <div className="table-wrap">
              <table className="brc__table">
                <thead><tr><th>As on</th><th className="n">Statement</th><th className="n">Bank Book</th><th className="n">Difference</th><th>Signed by</th><th>Reopened</th><th /></tr></thead>
                <tbody>
                  {!data.signoffs.length && <tr><td colSpan={7} className="muted">Not signed off yet.</td></tr>}
                  {data.signoffs.map((s) => (
                    <Fragment key={s.id}>
                      <tr>
                        <td className="d">{fmtDay(s.asOfDate)}</td>
                        <td className="n">{money(s.statementBalance)}</td>
                        <td className="n">{money(s.bookBalance)}</td>
                        <td className="n">{money(s.difference)}</td>
                        <td>{s.signedByName || '—'} <span className="muted">{new Date(s.signedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></td>
                        <td>{s.reopenedAt ? <>{s.reopenedByName || '—'} <span className="muted">{new Date(s.reopenedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></> : <span className="brc__tag brc__tag--lock"><Lock size={10} /> In force</span>}</td>
                        <td className="n">
                          {!s.reopenedAt && user?.isSuperAdmin && (
                            <button type="button" className="brc__btn brc__btn--sm" onClick={() => reopen(s)} disabled={busy}><LockOpen size={12} /> Reopen</button>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {data.lockDate && !user?.isSuperAdmin && <p className="muted" style={{ fontSize: '0.75rem', margin: '8px 0 0' }}>Only a Super Admin can reopen a sign-off.</p>}
          </div>
        </>
      )}
    </div>
  );
}
