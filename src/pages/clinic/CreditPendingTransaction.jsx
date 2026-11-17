import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, RefreshCw, Search, Undo2, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { useAuthStore } from '../../store/useAuthStore';
import { API_BASE_URL } from '../../config';
import './PendingTx.scss';

// Clinic → Transactions → Credit Pending Transaction (owner, 2026-11-17): CC
// (credit card) OPD slips wait until the bank pays (usually ~2 days). Tick
// the slips the bank has paid, enter what it credited — the rest of those
// slips' pending is the bank's charges. Tracking only: the slips' revenue is
// counted as before.

const API = `${API_BASE_URL}/api/clinic`;
const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDT = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
const PKT_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
const pktToday = () => PKT_DAY.format(new Date());

export default function CreditPendingTransaction() {
  const { user } = useAuthStore();
  const userName = user?.name || user?.username || user?.email || '';
  const [show, setShow] = useState('pending');
  const [q, setQ] = useState('');
  const [data, setData] = useState({ rows: [], totalPending: 0, pendingCount: 0 });
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState([]);
  const [openRow, setOpenRow] = useState(null);
  const [settling, setSettling] = useState(false);
  const [form, setForm] = useState({ receivedDate: pktToday(), receivedAmount: '', remarks: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (s = show, term = q) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ show: s });
      if (term.trim()) p.set('q', term.trim());
      const res = await fetch(`${API}/transactions/credit-pending?${p}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.message || 'List did not load');
      setData(j.data);
      setPicked([]);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [show, q]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const pickedRows = useMemo(() => data.rows.filter((r) => picked.includes(r.visitId)), [data.rows, picked]);
  const pickedTotal = pickedRows.reduce((s, r) => s + r.pending, 0);
  const charges = Math.max(0, pickedTotal - (Number(form.receivedAmount) || 0));
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const openRows = data.rows.filter((r) => r.pending > 0);
  const allPicked = openRows.length > 0 && openRows.every((r) => picked.includes(r.visitId));

  const openSettle = () => {
    if (!pickedRows.length) { toast.error('Tick the slips the bank has paid'); return; }
    setForm({ receivedDate: pktToday(), receivedAmount: String(Math.round(pickedTotal * 100) / 100), remarks: '' });
    setSettling(true);
  };

  const settle = async () => {
    const got = Number(form.receivedAmount);
    if (!(got > 0)) { toast.error('Enter the amount the bank paid'); return; }
    if (got > pickedTotal + 0.005) { toast.error(`More than the ticked slips' pending (Rs. ${fmt2(pickedTotal)})`); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/transactions/credit-pending/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitIds: picked, receivedDate: form.receivedDate, receivedAmount: got, remarks: form.remarks, createdByName: userName }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Not saved');
      toast.success(`${j.data.slips} slip(s) settled — received Rs. ${fmt2(j.data.received)}, bank charges Rs. ${fmt2(j.data.bankCharges)}`);
      setSettling(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const undo = async (s, r) => {
    const ok = await confirmDialog({ title: 'Undo this bank receipt?', message: `Slip # ${r.serialNo}: received Rs. ${fmt2(s.receivedAmount)} + charges Rs. ${fmt2(s.bankCharges)} on ${fmtDay(s.receivedDate)} will be removed and the slip will be pending again.`, confirmLabel: 'Undo', danger: true });
    if (!ok) return;
    try {
      const res = await fetch(`${API}/transactions/credit-pending/settlement/${s.id}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Not undone');
      toast.success('Undone');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="ptx-page">
      <ClinicMenuBar />
      <div className="ptx-body">
        <div className="ptx-head">
          <div>
            <h1><CreditCard size={20} /> Credit Pending Transaction</h1>
            <p>CC (credit card) slips waiting for the bank. Tick the slips the bank has paid, then enter what it credited.</p>
          </div>
          <div className="ptx-kpis">
            <div><span>Slips pending</span><b>{data.pendingCount}</b></div>
            <div><span>Total pending</span><b>Rs. {fmt2(data.totalPending)}</b></div>
          </div>
        </div>

        <div className="ptx-toolbar">
          <div className="ptx-seg" role="radiogroup" aria-label="Show">
            {[['pending', 'Pending'], ['settled', 'Received'], ['all', 'All']].map(([k, l]) => (
              <button type="button" key={k} className={show === k ? 'is-on' : ''} aria-pressed={show === k} onClick={() => { setShow(k); load(k, q); }}>{l}</button>
            ))}
          </div>
          <label className="ptx-search">
            <Search size={14} />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Slip # or patient name" aria-label="Search" />
          </label>
          <button type="button" className="ptx-btn" onClick={() => load()} disabled={loading}><RefreshCw size={14} /> Show</button>
          <span className="ptx-grow" />
          <span className="ptx-picked">{picked.length ? `${picked.length} ticked · Rs. ${fmt2(pickedTotal)}` : ''}</span>
          <button type="button" className="ptx-btn ptx-btn--primary" onClick={openSettle} disabled={!picked.length}>Bank Received</button>
        </div>

        <div className="ptx-card table-wrap">
          <table className="ptx-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}><input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? [] : openRows.map((r) => r.visitId))} aria-label="Tick all pending slips" /></th>
                <th>Slip #</th><th>Date</th><th>Patient</th><th>Department</th><th className="r">Amount</th><th className="r">Received</th><th className="r">Bank Charges</th><th className="r">Pending</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="ptx-empty">Loading…</td></tr>}
              {!loading && !data.rows.length && <tr><td colSpan={9} className="ptx-empty">{show === 'pending' ? 'No CC slip waiting for the bank.' : 'Nothing to show.'}</td></tr>}
              {!loading && data.rows.map((r) => (
                <Fragment key={r.visitId}>
                  <tr className="ptx-click" onClick={() => setOpenRow(openRow === r.visitId ? null : r.visitId)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      {r.pending > 0 && <input type="checkbox" checked={picked.includes(r.visitId)} onChange={() => toggle(r.visitId)} aria-label={`Tick slip ${r.serialNo}`} />}
                    </td>
                    <td><b>{r.serialNo}</b></td>
                    <td className="nowrap">{fmtDT(r.createdAt)}</td>
                    <td>{r.patientName}</td>
                    <td className="muted">{r.department}</td>
                    <td className="r">{fmt2(r.amount)}</td>
                    <td className="r">{r.received ? fmt2(r.received) : ''}</td>
                    <td className="r">{r.bankCharges ? fmt2(r.bankCharges) : ''}</td>
                    <td className="r"><b className={r.pending > 0 ? 'ptx-due' : 'ptx-clear'}>{fmt2(r.pending)}</b></td>
                  </tr>
                  {openRow === r.visitId && (
                    <tr className="ptx-sub"><td colSpan={9}>
                      {r.balancePaid > 0 && <p className="muted">Rs. {fmt2(r.balancePaid)} taken through Receive Balance against Slip.</p>}
                      {r.settlements.length ? (
                        <table className="ptx-table ptx-table--inner">
                          <thead><tr><th>Bank Paid On</th><th className="r">Received</th><th className="r">Charges</th><th>Remarks</th><th>By</th><th /></tr></thead>
                          <tbody>{r.settlements.map((s) => (
                            <tr key={s.id}>
                              <td>{fmtDay(s.receivedDate)}</td><td className="r">{fmt2(s.receivedAmount)}</td><td className="r">{fmt2(s.bankCharges)}</td>
                              <td>{s.remarks || ''}</td><td className="muted">{s.createdByName || ''}</td>
                              <td className="r"><button type="button" className="ptx-icon" title="Undo" aria-label="Undo bank receipt" onClick={() => undo(s, r)}><Undo2 size={14} /></button></td>
                            </tr>
                          ))}</tbody>
                        </table>
                      ) : <span className="muted">The bank hasn&apos;t paid for this slip yet.</span>}
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {settling && (
        <div className="ptx-modal" role="dialog" aria-modal="true" aria-label="Bank received">
          <div className="ptx-modal__box">
            <div className="ptx-modal__head">
              <h2>Bank Received — {pickedRows.length} slip{pickedRows.length === 1 ? '' : 's'}</h2>
              <button type="button" className="ptx-icon" onClick={() => !saving && setSettling(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="ptx-modal__body">
              <div className="ptx-facts">
                <span>Slips <b>{pickedRows.map((r) => r.serialNo).join(', ')}</b></span>
                <span>Pending total <b>{fmt2(pickedTotal)}</b></span>
              </div>
              <label className="ptx-field"><span>Bank Paid On</span>
                <input type="date" value={form.receivedDate} max={pktToday()} onChange={(e) => setForm((f) => ({ ...f, receivedDate: e.target.value }))} />
              </label>
              <label className="ptx-field"><span>Amount Credited by Bank</span>
                <input inputMode="decimal" value={form.receivedAmount} onChange={(e) => setForm((f) => ({ ...f, receivedAmount: e.target.value }))} autoFocus />
              </label>
              <div className="ptx-facts"><span>Bank Charges <b>{fmt2(charges)}</b></span></div>
              <label className="ptx-field"><span>Remarks</span>
                <input value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="e.g. bank, batch #" />
              </label>
            </div>
            <div className="ptx-modal__foot">
              <button type="button" className="ptx-btn" onClick={() => setSettling(false)} disabled={saving}>Cancel</button>
              <button type="button" className="ptx-btn ptx-btn--primary" onClick={settle} disabled={saving}><Save size={14} /> Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
