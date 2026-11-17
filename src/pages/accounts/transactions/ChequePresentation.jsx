import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, RefreshCw, Search, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../../components/ui/Modal';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import { useAuthStore } from '../../../store/useAuthStore';
import { API_BASE_URL } from '../../../config';
import './DraftExpenses.scss';
import './ChequePresentation.scss';

// Accounts → Transactions → Presented / Unpresented Cheques (owner,
// 2026-11-17), after the old system's screen. Lists this book's cheques
// (cheque-mode Voucher Expense lines — Cash GL and Panel stay apart). Tick a
// cheque to mark it presented with its Present Date; untick to undo. A cheque
// matched to the Bank Statement is presented already and stays ticked.
// Unpresented rows are coloured by cheque date: this month or later (red),
// last month (blue), before that (purple).

const API = `${API_BASE_URL}/api/accounts`;
const PKT_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
const pktToday = () => PKT_DAY.format(new Date());
// Cheque / clear dates are calendar dates (stored at midnight UTC).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d) => {
  if (!d) return '';
  const t = new Date(d);
  return `${String(t.getUTCDate()).padStart(2, '0')}-${MONTHS[t.getUTCMonth()]}-${t.getUTCFullYear()}`;
};
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

// 'current' (this month or later) | 'last' (last month) | 'older'
function ageOf(chequeDate) {
  const today = pktToday();
  const thisMonth = today.slice(0, 7);
  const [y, m] = thisMonth.split('-').map(Number);
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const month = new Date(chequeDate).toISOString().slice(0, 7);
  if (month >= thisMonth) return 'current';
  if (month === lastMonth) return 'last';
  return 'older';
}

export default function ChequePresentation() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userName = user?.name || user?.username || user?.email || '';
  const book = entityType === 'corporate' ? 'Panel (Corporate)' : 'Cash GL';

  const [data, setData] = useState({ rows: [], unpresentedCount: 0, unpresentedAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [find, setFind] = useState('');
  const [show, setShow] = useState('all'); // all | unpresented | presented
  const [presenting, setPresenting] = useState(null); // row being ticked
  const [presentDate, setPresentDate] = useState(pktToday());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await call(`/cheques?entityType=${entityType}`));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const term = find.trim().toLowerCase();
    return data.rows.filter((r) => (!term || String(r.chequeNo || '').toLowerCase().includes(term))
      && (show === 'all' || (show === 'presented' ? r.presented : !r.presented)));
  }, [data.rows, find, show]);

  const tick = async (r) => {
    if (r.clearedBy === 'bank') { toast('Presented by the Bank Statement match', { icon: 'ℹ️' }); return; }
    if (!r.presented) {
      setPresentDate(pktToday());
      setPresenting(r);
      return;
    }
    const ok = await confirmDialog({
      title: 'Untick this cheque?',
      message: `Cheque ${r.chequeNo} — ${r.payeeName} — PKR ${fmtAmt(r.amount)} will go back to Unpresented (Clear Date ${fmtDate(r.clearDate)} removed).`,
      confirmLabel: 'Untick', danger: true,
    });
    if (!ok) return;
    try {
      await call(`/cheques/${r.id}/unpresent`, { method: 'POST' });
      toast.success(`Cheque ${r.chequeNo} unpresented`);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const savePresent = async () => {
    if (!presentDate) { toast.error('Select the Present Date'); return; }
    setBusy(true);
    try {
      await call(`/cheques/${presenting.id}/present`, { method: 'POST', body: { date: presentDate, userName } });
      toast.success(`Cheque ${presenting.chequeNo} presented on ${fmtDate(`${presentDate}T00:00:00Z`)}`);
      setPresenting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="drafts cheques">
      <div className="drafts__breadcrumb">
        <button type="button" className="drafts__back" onClick={() => navigate(`/accounts/${entityType}/transactions`)}>
          <ArrowLeft size={14} /> Back
        </button>
        <ChevronRight size={13} className="drafts__bc-sep" />
        <span>Transactions</span>
        <ChevronRight size={13} className="drafts__bc-sep" />
        <span className="drafts__bc-active">Presented / Unpresented Cheques</span>
      </div>

      <div className="drafts__header">
        <div className="drafts__header-left">
          <h2 className="drafts__title"><CheckSquare size={18} /> Presented / Unpresented Cheques</h2>
          <p className="drafts__sub">{book} — cheques from Voucher Expense. Tick a cheque to mark it presented with its Present Date.</p>
        </div>
        <div className="drafts__header-right">
          <button type="button" className="drafts__refresh" onClick={load} title="Refresh" aria-label="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="cheques__toolbar">
        <label className="cheques__find">
          <span>Find Cheque #</span>
          <div className="cheques__find-box">
            <Search size={14} />
            <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Cheque #" aria-label="Find cheque number" />
          </div>
        </label>
        <div className="cheques__show" role="radiogroup" aria-label="Show">
          {[['all', 'All'], ['unpresented', 'Unpresented'], ['presented', 'Presented']].map(([k, l]) => (
            <button type="button" key={k} className={show === k ? 'is-on' : ''} onClick={() => setShow(k)} aria-pressed={show === k}>{l}</button>
          ))}
        </div>
        <span className="cheques__count">{rows.length} cheque{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="drafts__group">
        <div className="drafts__table-wrap">
          {loading ? (
            <div className="drafts__loading">Loading cheques…</div>
          ) : !rows.length ? (
            <div className="drafts__loading">{data.rows.length ? 'No cheque matches.' : 'No cheques in this book yet — they come from Voucher Expense (Cheque mode).'}</div>
          ) : (
            <table className="drafts__table cheques__table">
              <thead>
                <tr>
                  <th style={{ width: 36 }} aria-label="Presented" />
                  <th>Cheque Date</th>
                  <th>Chq. #</th>
                  <th>Supplier</th>
                  <th>Voucher #</th>
                  <th className="drafts__th-r">Amount</th>
                  <th>Clear Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.presented ? 'is-presented' : `is-${ageOf(r.chequeDate)}`}>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.presented}
                        disabled={r.clearedBy === 'bank'}
                        onChange={() => tick(r)}
                        title={r.clearedBy === 'bank' ? 'Presented by the Bank Statement match' : r.presented ? 'Untick to make it Unpresented' : 'Tick to mark presented'}
                        aria-label={`Cheque ${r.chequeNo} presented`}
                      />
                    </td>
                    <td className="nowrap">{fmtDate(r.chequeDate)}</td>
                    <td className="nowrap">{r.chequeNo}</td>
                    <td>{r.payeeName}</td>
                    <td className="nowrap muted">{r.voucherNo}</td>
                    <td className="drafts__td-amt">{fmtAmt(r.amount)}</td>
                    <td className="nowrap">
                      {r.clearDate ? fmtDate(r.clearDate) : ''}
                      {r.clearedBy === 'bank' && <span className="cheques__bank">Bank</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="cheques__footer">
        <div className="cheques__legend">
          <span className="cheques__key is-current">Unpresented Cheques</span>
          <span className="cheques__key is-last">Last month&apos;s payable cheques</span>
          <span className="cheques__key is-older">Before last month&apos;s payable cheques</span>
        </div>
        <div className="cheques__total">
          Amount of Unpresented cheques <b>PKR {fmtAmt(data.unpresentedAmount)}</b>
          <span className="muted"> ({data.unpresentedCount})</span>
        </div>
      </div>

      <Modal isOpen={!!presenting} onClose={() => !busy && setPresenting(null)} title="Present Cheque" size="sm">
        {presenting && (
          <div className="cheques__dialog">
            <p>Cheque <b>{presenting.chequeNo}</b> — {presenting.payeeName} — PKR {fmtAmt(presenting.amount)}</p>
            <label>
              <span>Present Date</span>
              <input type="date" value={presentDate} onChange={(e) => setPresentDate(e.target.value)} autoFocus />
            </label>
            <div className="cheques__dialog-actions">
              <button type="button" className="drafts__move" onClick={() => setPresenting(null)} disabled={busy}>Cancel</button>
              <button type="button" className="drafts__flash-btn" onClick={savePresent} disabled={busy}>{busy ? 'Saving…' : 'OK'}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
