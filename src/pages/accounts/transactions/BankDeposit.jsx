import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Landmark, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import { useAccountsStore } from '../../../store/useAccountsStore';
import { API_BASE_URL } from '../../../config';
import './DraftExpenses.scss';
import './ChequePresentation.scss';
import './BankDeposit.scss';

// Accounts → Transactions → Bank Deposit (owner, 2026-11-24), laid out like
// Presented / Unpresented Cheques. Each day's cash for the last 3 months —
// Cash GL: the Clinic Revenue Dashboard's "Cash" for that day (Corporate:
// the day's income − expense, as the old form) — with the days not yet in
// the bank coloured by age. Tick one
// or more undeposited days and "Deposit" puts them in the bank under one slip
// (bank, deposit date, slip #, deposited by). Untick a deposited day to undo
// it (not once it is matched to the bank statement). Amounts can't be typed.
// Cash GL also shows each day's JazzCash — only shown, never deposited: the
// day's cash is the deposit, and depositing it takes the day (JazzCash too)
// off the undeposited list.

const API = `${API_BASE_URL}/api/accounts`;
const PKT_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
const pktToday = () => PKT_DAY.format(new Date());
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDate = (iso) => (iso ? `${iso.slice(8, 10)}-${MONTHS[Number(iso.slice(5, 7)) - 1]}-${iso.slice(0, 4)}` : '');
const dayName = (iso) => DAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const fmtAmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.message || `Request failed (${res.status})`);
  return json.data;
}

// 'current' (this month) | 'last' (last month) | 'older' — as the cheque screen.
function ageOf(iso) {
  const thisMonth = pktToday().slice(0, 7);
  const [y, m] = thisMonth.split('-').map(Number);
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const month = iso.slice(0, 7);
  if (month >= thisMonth) return 'current';
  if (month === lastMonth) return 'last';
  return 'older';
}

const joinUnique = (list) => [...new Set(list.filter(Boolean))].join(', ');
const empName = (e) => `${e.firstName || ''} ${e.lastName || ''}`.trim();

export default function BankDeposit() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const book = entityType === 'corporate' ? 'Panel (Corporate)' : 'Cash GL';
  const { bankAccounts, fetchBankAccounts, linkedEmployees, fetchLinkedEmployees } = useAccountsStore();

  const [data, setData] = useState({ rows: [], undepositedCount: 0, undepositedAmount: 0, undepositedJazzcash: 0 });
  const showJazz = entityType !== 'corporate';
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState('all'); // all | undeposited | deposited
  const [picked, setPicked] = useState(() => new Set()); // undeposited days ticked
  const [dialog, setDialog] = useState(null); // { bankAccountId, depositDate, depositSlipNo, depositedBy }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await call(`/bank-deposit-days?entityType=${entityType}`));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchBankAccounts(entityType);
    fetchLinkedEmployees();
  }, [entityType, fetchBankAccounts, fetchLinkedEmployees]);

  const rows = useMemo(
    () => data.rows.filter((r) => show === 'all' || (show === 'deposited' ? r.deposited : !r.deposited)),
    [data.rows, show],
  );
  const pickedRows = data.rows.filter((r) => picked.has(r.date) && !r.deposited);
  const pickedTotal = pickedRows.reduce((s, r) => s + r.cash, 0);
  const pickedJazz = pickedRows.reduce((s, r) => s + (r.jazzcash || 0), 0);
  const employees = useMemo(() => linkedEmployees.map((e) => ({ ...e, name: empName(e) })).filter((e) => e.name), [linkedEmployees]);

  const togglePick = (date) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(date)) n.delete(date); else n.add(date);
    return n;
  });

  const undo = async (r) => {
    const dep = r.deposits[0];
    if (r.deposits.some((d) => d.reconciled)) { toast('Bank statement se match ho chuka hai — pehle Bank Reconciliation me unmatch karein', { icon: 'ℹ️' }); return; }
    const ok = await confirmDialog({
      title: 'Untick this day?',
      message: `${fmtDate(r.date)} — PKR ${fmtAmt(r.depositedAmount)} deposited in ${dep.bankName}${dep.depositSlipNo ? ` (slip ${dep.depositSlipNo})` : ''} will go back to Undeposited.`,
      confirmLabel: 'Untick', danger: true,
    });
    if (!ok) return;
    try {
      for (const d of r.deposits) await call(`/bank-deposit-days/${d.id}`, { method: 'DELETE' });
      toast.success(`${fmtDate(r.date)} undeposited`);
      load();
    } catch (e) {
      toast.error(e.message);
      load();
    }
  };

  const openDialog = () => {
    if (!pickedRows.length) { toast.error('Pehle jama karne wale din tick karein'); return; }
    setDialog({ bankAccountId: bankAccounts.length === 1 ? bankAccounts[0].id : null, depositDate: pktToday(), depositSlipNo: '', depositedBy: '' });
  };

  const save = async () => {
    if (!dialog.bankAccountId) { toast.error('Bank chunein'); return; }
    if (!dialog.depositDate) { toast.error('Deposit Date chunein'); return; }
    setBusy(true);
    try {
      const res = await call('/bank-deposit-days', {
        method: 'POST',
        body: { entityType, days: pickedRows.map((r) => r.date), ...dialog },
      });
      toast.success(`${res.count} din — PKR ${fmtAmt(res.amount)} jama ho gaye`);
      setDialog(null);
      setPicked(new Set());
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const setD = (k, v) => setDialog((d) => ({ ...d, [k]: v }));

  return (
    <div className="drafts cheques bdep">
      <div className="drafts__breadcrumb">
        <button type="button" className="drafts__back" onClick={() => navigate(`/accounts/${entityType}/transactions`)}>
          <ArrowLeft size={14} /> Back
        </button>
        <ChevronRight size={13} className="drafts__bc-sep" />
        <span>Transactions</span>
        <ChevronRight size={13} className="drafts__bc-sep" />
        <span className="drafts__bc-active">Bank Deposit</span>
      </div>

      <div className="drafts__header">
        <div className="drafts__header-left">
          <h2 className="drafts__title"><Landmark size={18} /> Bank Deposit</h2>
          <p className="drafts__sub">{book} — each day&apos;s {entityType === 'corporate' ? 'income − expense' : 'Cash from the Revenue Dashboard'}, last 3 months. Tick the days going to the bank, then Deposit.</p>
        </div>
        <div className="drafts__header-right">
          <button type="button" className="drafts__refresh" onClick={load} title="Refresh" aria-label="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="cheques__toolbar">
        <div className="cheques__show" role="radiogroup" aria-label="Show">
          {[['all', 'All'], ['undeposited', 'Undeposited'], ['deposited', 'Deposited']].map(([k, l]) => (
            <button type="button" key={k} className={show === k ? 'is-on' : ''} onClick={() => setShow(k)} aria-pressed={show === k}>{l}</button>
          ))}
        </div>
        <span className="cheques__count">{rows.length} day{rows.length === 1 ? '' : 's'}</span>
        <button type="button" className="drafts__flash-btn bdep__go" onClick={openDialog} disabled={!pickedRows.length}>
          Deposit {pickedRows.length ? `${pickedRows.length} day${pickedRows.length === 1 ? '' : 's'} — PKR ${fmtAmt(pickedTotal)}` : ''}
        </button>
      </div>

      <div className="drafts__group">
        <div className="drafts__table-wrap">
          {loading ? (
            <div className="drafts__loading">Loading days…</div>
          ) : !rows.length ? (
            <div className="drafts__loading">{data.rows.length ? 'No day matches.' : 'No cash to deposit in the last 3 months.'}</div>
          ) : (
            <table className="drafts__table cheques__table">
              <thead>
                <tr>
                  <th style={{ width: 36 }} aria-label="Deposited" />
                  <th>Deposit Of</th>
                  <th>Day</th>
                  <th className="drafts__th-r">Cash</th>
                  {showJazz && <th className="drafts__th-r" title="Shown only — JazzCash is not deposited">JazzCash</th>}
                  <th>Bank</th>
                  <th>Deposit Date</th>
                  <th>Slip #</th>
                  <th>Deposited By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isPicked = !r.deposited && picked.has(r.date);
                  const changed = r.deposited && Math.abs(r.depositedAmount - r.cash) > 0.004;
                  const reconciled = r.deposits.some((d) => d.reconciled);
                  return (
                    <tr key={r.date} className={`${r.deposited ? 'is-presented' : `is-${ageOf(r.date)}`}${isPicked ? ' is-picked' : ''}`}>
                      <td>
                        <input
                          type="checkbox"
                          checked={r.deposited || isPicked}
                          disabled={reconciled}
                          onChange={() => (r.deposited ? undo(r) : togglePick(r.date))}
                          title={reconciled ? 'Matched to the bank statement' : r.deposited ? 'Untick to make it Undeposited' : 'Tick to deposit this day'}
                          aria-label={`${fmtDate(r.date)} deposited`}
                        />
                      </td>
                      <td className="nowrap">{fmtDate(r.date)}</td>
                      <td className="nowrap muted">{dayName(r.date)}</td>
                      <td className="drafts__td-amt">
                        {fmtAmt(r.deposited ? r.depositedAmount : r.cash)}
                        {changed && <span className="bdep__changed" title="The day's cash changed after it was deposited">now {fmtAmt(r.cash)}</span>}
                      </td>
                      {showJazz && <td className="drafts__td-amt bdep__jazz">{r.jazzcash ? fmtAmt(r.jazzcash) : ''}</td>}
                      <td>{joinUnique(r.deposits.map((d) => d.bankName))}</td>
                      <td className="nowrap">{joinUnique(r.deposits.map((d) => fmtDate(d.depositDate)))}</td>
                      <td className="nowrap">
                        {joinUnique(r.deposits.map((d) => d.depositSlipNo))}
                        {reconciled && <span className="cheques__bank">Bank</span>}
                      </td>
                      <td>{joinUnique(r.deposits.map((d) => d.depositedBy))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="cheques__footer">
        <div className="cheques__legend">
          <span className="cheques__key is-current">This month&apos;s undeposited cash</span>
          <span className="cheques__key is-last">Last month&apos;s</span>
          <span className="cheques__key is-older">Before last month</span>
        </div>
        <div className="cheques__total">
          Undeposited cash <b>PKR {fmtAmt(data.undepositedAmount)}</b>
          <span className="muted"> ({data.undepositedCount} day{data.undepositedCount === 1 ? '' : 's'})</span>
          {showJazz && data.undepositedJazzcash > 0 && (
            <span className="bdep__jazz-total"> · JazzCash with them PKR {fmtAmt(data.undepositedJazzcash)}</span>
          )}
        </div>
      </div>

      <Modal isOpen={!!dialog} onClose={() => !busy && setDialog(null)} title="Bank Deposit" size="sm">
        {dialog && (
          <div className="cheques__dialog bdep__dialog">
            <p>
              {pickedRows.length} day{pickedRows.length === 1 ? '' : 's'}: {pickedRows.map((r) => fmtDate(r.date)).join(', ')}
              <br />Cash to deposit <b>PKR {fmtAmt(pickedTotal)}</b>
              {showJazz && pickedJazz > 0 && (
                <><br /><span className="bdep__jazz-total">JazzCash PKR {fmtAmt(pickedJazz)} — not deposited, goes off the list with these days</span></>
              )}
            </p>
            <label className="bdep__field">
              <span>Bank</span>
              <SearchableSelect
                options={bankAccounts}
                value={dialog.bankAccountId}
                onChange={(v) => setD('bankAccountId', v)}
                placeholder="— Select bank —"
                getLabel={(b) => `${b.bankName} (${b.accountNumber})`}
                getKey={(b) => b.id}
                size="sm"
              />
            </label>
            <label className="bdep__field">
              <span>Deposit Date</span>
              <input type="date" value={dialog.depositDate} max={pktToday()} onChange={(e) => setD('depositDate', e.target.value)} />
            </label>
            <label className="bdep__field">
              <span>Deposit Slip #</span>
              <input value={dialog.depositSlipNo} onChange={(e) => setD('depositSlipNo', e.target.value)} placeholder="e.g. DS-001234" />
            </label>
            <label className="bdep__field">
              <span>Deposited By</span>
              <SearchableSelect
                options={employees}
                value={employees.find((e) => e.name === dialog.depositedBy)?.id ?? null}
                onChange={(_id, emp) => setD('depositedBy', emp?.name || '')}
                placeholder="Search employee…"
                getLabel={(e) => e.name}
                getKey={(e) => e.id}
                size="sm"
              />
            </label>
            <div className="cheques__dialog-actions">
              <button type="button" className="drafts__move" onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
              <button type="button" className="drafts__flash-btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Deposit'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
