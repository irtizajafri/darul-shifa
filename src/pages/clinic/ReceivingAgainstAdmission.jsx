import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { useAuthStore } from '../../store/useAuthStore';
import { buildAdmissionPaymentReceiptHtml } from './admissionReceivingReceiptUtils';
import './ReceivingAgainstAdmission.scss';

const API = 'http://localhost:5001/api/clinic';

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${day}/${month}/${year} ${time}`;
}

function fmt2(n) { return Number(n || 0).toFixed(2); }

// ── Admission Lookup Modal ─────────────────────────────────────────────────────
function AdmissionLookupModal({ onSelect, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch(`${API}/admission/receiving/search`)
      .then(r => r.json())
      .then(res => setRows(res.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(r =>
    !q.trim() ||
    r.admissionNo?.toLowerCase().includes(q.trim().toLowerCase()) ||
    r.patientName?.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="raa-overlay">
      <div className="raa-modal">
        <div className="raa-modal-hdr">
          <span>Select Admission</span>
          <button className="raa-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="raa-modal-search">
          <Search size={13} className="raa-modal-search-icon" />
          <input
            autoFocus
            className="raa-modal-search-input"
            placeholder="Search Admission # or Patient Name…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="raa-modal-body">
          {loading ? (
            <div className="raa-modal-loading">Loading…</div>
          ) : (
            <table className="raa-modal-tbl">
              <thead>
                <tr>
                  <th>Admission #</th>
                  <th>Patient</th>
                  <th>Admission Date</th>
                  <th>Paid So Far</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} onClick={() => onSelect(r)}>
                    <td>{r.admissionNo}</td>
                    <td>{r.patientName}</td>
                    <td>{fmtDateTime(r.createdAt)}</td>
                    <td className="raa-td-r">{fmt2(r.paidSoFar)}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={4} className="raa-td-empty">Koi admission nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReceivingAgainstAdmission() {
  const { user } = useAuthStore();
  const printedBy = user?.name || user?.username || user?.email || '';

  const [serialNo, setSerialNo] = useState('');
  const [showLookup, setShowLookup] = useState(false);
  const [admission, setAdmission] = useState(null);
  const [receivingDate, setReceivingDate] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState('cash');
  const [saving, setSaving] = useState(false);

  function loadNextSerial() {
    fetch(`${API}/opd/next-serial`).then(r => r.json()).then(j => setSerialNo(j.data?.serialNo || '')).catch(() => {});
  }

  useEffect(() => { loadNextSerial(); }, []);

  async function handleSelect(row) {
    setShowLookup(false);
    try {
      const res = await fetch(`${API}/admission/receiving/by-number/${encodeURIComponent(row.admissionNo)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Load failed');
      setAdmission(json.data);
      setReceivingDate(fmtDateTime(new Date()));
    } catch (e) {
      toast.error(e.message || 'Admission load nahi hui');
    }
  }

  function resetForm() {
    setAdmission(null);
    setAmount('');
    setPaymentType('cash');
    setReceivingDate('');
    loadNextSerial();
  }

  async function submitPayment() {
    if (!admission) { toast.error('Pehle admission select karein'); return null; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error('Amount 0 se zyada honi chahiye'); return null; }

    const res = await fetch(`${API}/admission/receiving/${admission.id}/pay`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ serialNo, amount: amt, paymentType, receivedBy: printedBy }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Payment save nahi hui');
    return json.data;
  }

  async function handleAdd() {
    setSaving(true);
    try {
      const data = await submitPayment();
      if (!data) return;
      toast.success('Payment receive ho gayi');
      resetForm();
    } catch (e) {
      toast.error(e.message || 'Error saving payment');
    } finally {
      setSaving(false);
    }
  }

  async function handlePrintSlip() {
    setSaving(true);
    try {
      const data = await submitPayment();
      if (!data) return;

      const canvas = document.createElement('canvas');
      JsBarcode(canvas, data.payment.serialNo, { format: 'CODE128', width: 2, height: 48, displayValue: true, fontSize: 11, margin: 4 });
      const barcodeDataUrl = canvas.toDataURL('image/png');

      const html = buildAdmissionPaymentReceiptHtml({
        payment: data.payment, admission: data.admission, printedBy, barcodeDataUrl, isDuplicate: false,
      });
      const w = window.open('', '_blank', 'width=420,height=680');
      if (!w) { toast.error('Popup blocked — please allow popups for this site'); return; }
      w.document.write(html);
      w.document.close();

      toast.success('Payment receive ho gayi');
      resetForm();
    } catch (e) {
      toast.error(e.message || 'Error saving payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="raa-page">
      <ClinicMenuBar />

      <div className="raa-title-bar">
        <span className="raa-title-text">Receiving against Admission</span>
      </div>

      <div className="raa-content">
        <div className="raa-form-card">

          <div className="raa-form-row">
            <label className="raa-label raa-label--serial">Serial #</label>
            <input className="raa-input raa-input--serial" value={serialNo} readOnly />
          </div>

          <div className="raa-separator" />

          <div className="raa-form-row">
            <label className="raa-label">Admission #</label>
            <input
              className="raa-input raa-input--serial"
              value={admission?.admissionNo || ''}
              readOnly
              placeholder=""
            />
            <button className="raa-lookup-btn" onClick={() => setShowLookup(true)} title="Search admissions">
              <Search size={13} />
            </button>
            {admission && (
              <span className="raa-inline-patient">
                {admission.patientTitle} {admission.patientName}
              </span>
            )}
            <label className="raa-check-label raa-check-label--closed">
              <input type="checkbox" disabled />
              Closed Files
            </label>
          </div>

          {admission && (
            <>
              <div className="raa-separator" />

              <div className="raa-form-row">
                <label className="raa-label">Admission Date &amp; Time</label>
                <span className="raa-value">{fmtDateTime(admission.createdAt)}</span>
              </div>

              <div className="raa-form-row">
                <label className="raa-label">Patient Name</label>
                <span className="raa-value">{admission.patientTitle} {admission.patientName}</span>
              </div>

              <div className="raa-form-row">
                <label className="raa-label">Receiving Date &amp; Time</label>
                <span className="raa-value">{receivingDate}</span>
              </div>

              <div className="raa-form-row raa-form-row--amount">
                <label className="raa-label">Amount</label>
                <input
                  className="raa-input raa-input--amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
                <label className={`raa-radio-btn ${paymentType === 'cash' ? 'raa-radio-btn--active' : ''}`}>
                  <input type="radio" name="paymentType" checked={paymentType === 'cash'} onChange={() => setPaymentType('cash')} />
                  Cash
                </label>
                <label className={`raa-radio-btn ${paymentType === 'cc' ? 'raa-radio-btn--active' : ''}`}>
                  <input type="radio" name="paymentType" checked={paymentType === 'cc'} onChange={() => setPaymentType('cc')} />
                  Credit Card
                </label>
              </div>

              <div className="raa-paid-box">
                Paid Amount <span>Rs. {fmt2(admission.paidSoFar)}</span>
              </div>
            </>
          )}
        </div>

        <div className="raa-footer">
          <button className="raa-add-btn" onClick={handleAdd} disabled={saving || !admission}>Add</button>
          <button className="raa-print-btn" onClick={handlePrintSlip} disabled={saving || !admission}>Print Slip</button>
        </div>
      </div>

      {showLookup && (
        <AdmissionLookupModal onSelect={handleSelect} onClose={() => setShowLookup(false)} />
      )}
    </div>
  );
}
