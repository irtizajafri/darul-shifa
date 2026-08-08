import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { useAuthStore } from '../../store/useAuthStore';
import './DiscountRefundAdmission.scss';

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
    <div className="dra-overlay">
      <div className="dra-modal">
        <div className="dra-modal-hdr">
          <span>Select Admission</span>
          <button className="dra-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="dra-modal-search">
          <Search size={13} className="dra-modal-search-icon" />
          <input
            autoFocus
            className="dra-modal-search-input"
            placeholder="Search Admission # or Patient Name…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="dra-modal-body">
          {loading ? (
            <div className="dra-modal-loading">Loading…</div>
          ) : (
            <table className="dra-modal-tbl">
              <thead>
                <tr>
                  <th>Admission #</th>
                  <th>Patient</th>
                  <th>Admission Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} onClick={() => onSelect(r)}>
                    <td>{r.admissionNo}</td>
                    <td>{r.patientName}</td>
                    <td>{fmtDateTime(r.createdAt)}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={3} className="dra-td-empty">Koi admission nahi mila</td></tr>
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
export default function DiscountRefundAdmission() {
  const { user } = useAuthStore();

  const [showLookup, setShowLookup] = useState(false);
  const [admission, setAdmission] = useState(null);
  const [billAmount, setBillAmount] = useState(0);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [history, setHistory] = useState([]);

  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState('amount');
  const [permissionBy, setPermissionBy] = useState('');
  const [saving, setSaving] = useState(false);

  const discountAmt = discountType === 'percent'
    ? Math.round((billAmount * (Number(discount) || 0)) / 100)
    : (Number(discount) || 0);
  const netBalance = Math.max(0, billAmount - discountAmt);
  const refundAmt = Math.max(0, receivedAmount - netBalance);

  async function handleSelect(row) {
    setShowLookup(false);
    try {
      const res = await fetch(`${API}/admission/discount-refund/by-number/${encodeURIComponent(row.admissionNo)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Load failed');
      setAdmission(json.data.admission);
      setBillAmount(json.data.billAmount || 0);
      setReceivedAmount(json.data.receivedAmount || 0);
      setHistory(json.data.history || []);
      setDiscount('');
      setDiscountType('amount');
      setPermissionBy('');
    } catch (e) {
      toast.error(e.message || 'Admission load nahi hui');
    }
  }

  function resetForm() {
    setAdmission(null);
    setBillAmount(0);
    setReceivedAmount(0);
    setHistory([]);
    setDiscount('');
    setDiscountType('amount');
    setPermissionBy('');
  }

  async function handleAdd() {
    if (!admission) { toast.error('Pehle admission select karein'); return; }
    if (discountAmt <= 0 && refundAmt <= 0) { toast.error('Discount ya Refund amount daalein'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admission/discount-refund/${admission.id}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billAmount,
          receivedAmount,
          discountAmount: discountAmt,
          discountType,
          permissionBy,
          netBalance,
          refundAmount: refundAmt,
          createdByUserId: user?.id != null ? String(user.id) : null,
          createdByName: user?.name || user?.username || user?.email || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Save nahi hui');
      toast.success('Discount/Refund save ho gaya');
      resetForm();
    } catch (e) {
      toast.error(e.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dra-page">
      <ClinicMenuBar />

      <div className="dra-title-bar">
        <span className="dra-title-text">Discount &amp; Refund Against Admission</span>
      </div>

      <div className="dra-content">
        <div className="dra-form-card">

          <div className="dra-form-row">
            <label className="dra-label">Admission #</label>
            <input
              className="dra-input dra-input--serial"
              value={admission?.admissionNo || ''}
              readOnly
              placeholder=""
            />
            <button className="dra-lookup-btn" onClick={() => setShowLookup(true)} title="Search admissions">
              <Search size={13} />
            </button>
            {admission && (
              <span className="dra-inline-patient">
                {admission.patientTitle} {admission.patientName}
              </span>
            )}
            <label className="dra-check-label dra-check-label--closed">
              <input type="checkbox" disabled />
              Closed Files
            </label>
          </div>

          {admission && (
            <>
              <div className="dra-separator" />

              <div className="dra-form-row">
                <label className="dra-label">Bill Amount</label>
                <input className="dra-input dra-input--amount" value={fmt2(billAmount)} readOnly />
                <label className="dra-label dra-label--right">Received Amount</label>
                <span className="dra-value dra-value--green">{fmt2(receivedAmount)}</span>
              </div>

              <div className="dra-form-row">
                <label className="dra-label">Discount Amount</label>
                <input
                  className="dra-input dra-input--amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                />
                <div className="dra-disc-toggle">
                  <button
                    className={`dra-disc-btn ${discountType === 'amount' ? 'dra-disc-btn--active' : ''}`}
                    onClick={() => { setDiscountType('amount'); setDiscount(''); }}
                    type="button"
                  >PKR</button>
                  <button
                    className={`dra-disc-btn ${discountType === 'percent' ? 'dra-disc-btn--active' : ''}`}
                    onClick={() => { setDiscountType('percent'); setDiscount(''); }}
                    type="button"
                  >%</button>
                </div>
                {discountType === 'percent' && discount && (
                  <span className="dra-disc-calc">= {discountAmt}</span>
                )}
                <label className="dra-label dra-label--right">Net Balance</label>
                <span className="dra-value">{fmt2(netBalance)}</span>
              </div>

              <div className="dra-form-row">
                <label className="dra-label">Permission By</label>
                <input
                  className="dra-input dra-input--wide"
                  value={permissionBy}
                  onChange={e => setPermissionBy(e.target.value)}
                  placeholder="Authorized by…"
                />
                <label className="dra-label dra-label--right">To be Refund</label>
                <span className="dra-value dra-value--red">{fmt2(refundAmt)}</span>
              </div>

              {history.length > 0 && (
                <>
                  <div className="dra-separator" />
                  <div className="dra-history">
                    <div className="dra-history-title">Previous Entries</div>
                    <table className="dra-history-tbl">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Discount</th>
                          <th>Permission By</th>
                          <th>Refund</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(h => (
                          <tr key={h.id}>
                            <td>{fmtDateTime(h.createdAt)}</td>
                            <td className="dra-td-r">{fmt2(h.discountAmount)}{h.discountType === 'percent' ? ' %' : ''}</td>
                            <td>{h.permissionBy || '—'}</td>
                            <td className="dra-td-r">{fmt2(h.refundAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="dra-footer">
          <button className="dra-add-btn" onClick={handleAdd} disabled={saving || !admission}>Add</button>
        </div>
      </div>

      {showLookup && (
        <AdmissionLookupModal onSelect={handleSelect} onClose={() => setShowLookup(false)} />
      )}
    </div>
  );
}
