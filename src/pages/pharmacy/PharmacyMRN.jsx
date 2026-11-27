import { Fragment, useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, Send, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/shared/PageHeader';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';
import PatientPickerModal from './PatientPickerModal';
import MrnVerifyBox, { MrnItems } from './MrnVerifyBox';
import {
  pharmacyApi, pktToday, daysBefore, fmtDate, fmtDateTime, fmtQty, fmtAmt, patientRef, MRN_CHANGED, MRN_STATUS, mrnChanged,
} from './pharmacyApi';
import './Pharmacy.scss';

// Al Shifa Hospital Pharmacy → Medicine Return (MRN), owner 2026-11-27.
// Medicine issued on a GIN comes back (e.g. one box of Panadol from an
// admission): the ward finds the patient, enters what's coming back and why,
// and sends it. A pharmacy user with "MRN — verify" gets a pop-up and Accepts
// (the medicine is back) or Rejects it; only accepted returns count in the
// reports. A line can't return more than was issued, less what's already
// returned or waiting.

const QTY_EPS = 1e-9;

export default function PharmacyMRN() {
  const { user } = useAuthStore();
  const canRequest = hasPermission(user, 'pharmacy', 'mrn');
  const canVerify = hasPermission(user, 'pharmacy', 'mrn-verify');

  // New return
  const [mode, setMode] = useState('admission'); // admission | slip
  const [num, setNum] = useState('');
  const [picker, setPicker] = useState(false);
  const [found, setFound] = useState(null);
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState('');
  const [finding, setFinding] = useState(false);
  const [sending, setSending] = useState(false);

  // List
  const [f, setF] = useState({ from: daysBefore(pktToday(), 30), to: pktToday(), status: canVerify && !canRequest ? 'pending' : '', q: '' });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);

  const find = async (value = num, m = mode) => {
    const v = String(value || '').trim();
    if (!v) { toast.error(m === 'slip' ? 'Enter the Slip #' : 'Enter the Admission #'); return; }
    setFinding(true);
    try {
      const r = await pharmacyApi(`/mrn/returnable?${m === 'slip' ? 'opdSlipNo' : 'admissionNumber'}=${encodeURIComponent(v)}`);
      setFound(r);
      setQty({});
    } catch (e) {
      setFound(null);
      toast.error(e.message);
    } finally {
      setFinding(false);
    }
  };
  const clearNew = () => { setFound(null); setQty({}); setReason(''); setNum(''); };
  const switchMode = (m) => { if (m !== mode) { setMode(m); clearNew(); } };

  const chosen = found ? found.lines.filter((l) => Number(qty[l.ginItemId]) > 0) : [];
  const overLine = chosen.find((l) => Number(qty[l.ginItemId]) > l.returnable + QTY_EPS);
  const total = chosen.reduce((s, l) => s + Number(qty[l.ginItemId]) * l.rate, 0);

  const send = async () => {
    if (!chosen.length) { toast.error('Enter a return quantity for at least one medicine'); return; }
    if (overLine) { toast.error(`${overLine.medicineName}: at most ${fmtQty(overLine.returnable)} can be returned`); return; }
    if (!reason.trim()) { toast.error('Enter the reason for the return'); return; }
    const ok = await confirmDialog({
      title: 'Send this return to the pharmacy?',
      message: `${chosen.length} medicine${chosen.length > 1 ? 's' : ''}, Rs ${fmtAmt(total)} — ${patientRef(found)} ${found.patientName || ''}. The pharmacy will accept it once the medicine reaches them.`,
      confirmLabel: 'Send',
    });
    if (!ok) return;
    setSending(true);
    try {
      const r = await pharmacyApi('/mrn', {
        method: 'POST',
        body: {
          admissionNumber: found.admissionNumber, opdSlipNo: found.opdSlipNo, reason: reason.trim(),
          items: chosen.map((l) => ({ ginItemId: l.ginItemId, quantity: Number(qty[l.ginItemId]) })),
        },
      });
      toast.success(`MRN ${r.code} sent to the pharmacy`);
      clearNew();
      mrnChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v); });
      setRows(await pharmacyApi(`/mrn?${p}`));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [f]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  useEffect(() => {
    window.addEventListener(MRN_CHANGED, load);
    return () => window.removeEventListener(MRN_CHANGED, load);
  }, [load]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="ph-page">
      <PageHeader breadcrumbs={[{ label: 'Al Shifa Hospital Pharmacy', link: '/pharmacy-module' }, { label: 'Medicine Return (MRN)' }]} title="Medicine Return (MRN)" subtitle="Return issued medicine — the pharmacy verifies it" />

      {canRequest && (
        <section className="ph-card">
          <h2 className="ph-card__title">New Return</h2>
          <div className="ph-mrn-find">
            <div className="ph-seg" role="radiogroup" aria-label="Patient">
              <button type="button" className={mode === 'admission' ? 'is-on' : ''} aria-pressed={mode === 'admission'} onClick={() => switchMode('admission')}>Admission #</button>
              <button type="button" className={mode === 'slip' ? 'is-on' : ''} aria-pressed={mode === 'slip'} onClick={() => switchMode('slip')}>Panel Slip #</button>
            </div>
            <input
              className="ph-input" value={num} aria-label={mode === 'slip' ? 'Slip #' : 'Admission #'}
              placeholder={mode === 'slip' ? 'Slip #' : 'Admission #'}
              onChange={(e) => setNum(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); find(); } }}
            />
            <button type="button" className="ph-btn ph-btn--primary" onClick={() => find()} disabled={finding}><Search size={14} /> {finding ? 'Finding…' : 'Find'}</button>
            <button type="button" className="ph-btn" onClick={() => setPicker(true)}><Users size={14} /> Pick patient</button>
            {found && (
              <>
                <span className="ph-mrn-patient"><b>{patientRef(found)}</b> · {found.patientName || '—'}</span>
                <button type="button" className="ph-icon-btn" onClick={clearNew} aria-label="Clear" title="Clear"><X size={15} /></button>
              </>
            )}
          </div>

          {found && (
            <>
              <div className="table-wrap ph-lines">
                <table className="ph-table">
                  <thead>
                    <tr>
                      <th>GIN #</th><th>GIN Date</th><th>Department</th><th>Medicine</th><th>Pack</th>
                      <th className="r">Issued</th><th className="r">Returned / waiting</th><th className="r">Can return</th>
                      <th className="r">Return Qty</th><th className="r">Rate</th><th className="r">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {found.lines.map((l) => {
                      const q = Number(qty[l.ginItemId]) || 0;
                      const over = q > l.returnable + QTY_EPS;
                      return (
                        <tr key={l.ginItemId} className={l.returnable <= QTY_EPS ? 'ph-row--done' : ''}>
                          <td className="nowrap">{l.ginCode}</td><td className="nowrap">{fmtDate(l.issueDate)}</td><td>{l.departmentName}</td>
                          <td>{l.medicineName}</td><td>{l.packSize || ''}</td>
                          <td className="r">{fmtQty(l.issued)}</td><td className="r">{fmtQty(l.returned)}</td><td className="r">{fmtQty(l.returnable)}</td>
                          <td className="r">
                            <input
                              type="number" min="0" step="any" className="ph-input ph-input--qty" aria-label={`Return qty ${l.medicineName}`}
                              value={qty[l.ginItemId] ?? ''} disabled={l.returnable <= QTY_EPS} aria-invalid={over}
                              style={over ? { borderColor: '#dc2626' } : undefined}
                              onChange={(e) => setQty((x) => ({ ...x, [l.ginItemId]: e.target.value }))}
                            />
                          </td>
                          <td className="r">{fmtAmt(l.rate)}</td><td className="r">{q > 0 ? fmtAmt(q * l.rate) : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot><tr><td colSpan={10}>Total return</td><td className="r">{fmtAmt(total)}</td></tr></tfoot>
                </table>
              </div>
              <label className="ph-field">
                <span>Reason for the return</span>
                <input className="ph-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. 1 box not used — patient discharged" maxLength={300} />
              </label>
              <div className="ph-actions">
                <button type="button" className="ph-btn" onClick={clearNew}>Clear</button>
                <button type="button" className="ph-btn ph-btn--primary" onClick={send} disabled={sending || !chosen.length}><Send size={14} /> {sending ? 'Sending…' : 'Send to Pharmacy'}</button>
              </div>
            </>
          )}
        </section>
      )}

      <section className="ph-card">
        <div className="ph-toolbar">
          <h2 className="ph-card__title">Returns</h2>
          <label className="ph-field ph-field--inline"><span>From</span><input type="date" className="ph-input" value={f.from} onChange={(e) => set('from', e.target.value)} /></label>
          <label className="ph-field ph-field--inline"><span>To</span><input type="date" className="ph-input" value={f.to} min={f.from} onChange={(e) => set('to', e.target.value)} /></label>
          <label className="ph-field ph-field--inline"><span>Status</span>
            <select className="ph-input" value={f.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">All</option><option value="pending">Waiting for pharmacy</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option>
            </select>
          </label>
          <label className="ph-field ph-field--inline"><span>Search</span><input className="ph-input" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="MRN #, Adm #, Slip #, patient" onKeyDown={(e) => { if (e.key === 'Enter') load(); }} /></label>
          <button type="button" className="ph-btn ph-btn--primary" onClick={load} disabled={loading}><RefreshCw size={14} /> Show</button>
        </div>
        <div className="table-wrap">
          {loading && !rows.length ? <p className="ph-empty">Loading…</p> : !rows.length ? <p className="ph-empty">No returns for these filters.</p> : (
            <table className="ph-table ph-table--click">
              <thead>
                <tr>
                  <th>Date</th><th>MRN #</th><th>Adm # / Slip #</th><th>Patient</th><th>Department</th><th>Reason</th>
                  <th className="r">Amount</th><th>Status</th><th>Sent by</th><th>Verified by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <Fragment key={m.id}>
                    <tr onClick={() => setOpenId(openId === m.id ? null : m.id)} aria-expanded={openId === m.id}>
                      <td className="nowrap">{fmtDate(m.returnDate)}</td><td className="nowrap">{m.code}</td><td className="nowrap">{patientRef(m)}</td>
                      <td>{m.patientName || ''}</td><td>{m.departmentName || ''}</td><td>{m.reason || ''}</td>
                      <td className="r">{fmtAmt(m.totalAmount)}</td>
                      <td><span className={`ph-badge ph-badge--${m.status}`}>{MRN_STATUS[m.status] || m.status}</span></td>
                      <td>{m.requestedByName || ''}<div className="muted">{fmtDateTime(m.createdAt)}</div></td>
                      <td>{m.verifiedByName || ''}{m.verifiedAt && <div className="muted">{fmtDateTime(m.verifiedAt)}</div>}</td>
                    </tr>
                    {openId === m.id && (
                      <tr className="ph-sub">
                        <td colSpan={10}>
                          <MrnItems mrn={m} />
                          {m.verifyNote && <p className="ph-sub__note"><b>Pharmacy note:</b> {m.verifyNote}</p>}
                          {canVerify && m.status === 'pending' && <MrnVerifyBox mrn={m} onDone={() => setOpenId(null)} />}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {picker && (
        <PatientPickerModal
          mode={mode}
          onSelect={(r) => { setPicker(false); setNum(r.admissionNo); find(r.admissionNo, mode); }}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}
