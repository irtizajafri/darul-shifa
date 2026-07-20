import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import './ReceiveBalanceSlip.scss';

const API = 'http://localhost:5001/api/clinic';

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${day}-${month}-${year} ${time}`;
}

function fmt2(n) { return Number(n || 0).toFixed(2); }

// ── Lookup Modal ──────────────────────────────────────────────────────────────
function BalanceLookupModal({ onSelect, onClose }) {
  const [slips,   setSlips]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [q,       setQ]       = useState('');

  useEffect(() => {
    fetch(`${API}/opd/balance-slips`)
      .then(r => r.json())
      .then(res => setSlips(res.data || []))
      .catch(() => setSlips([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = slips.filter(s =>
    !q.trim() ||
    s.serialNo?.includes(q.trim()) ||
    s.patientName?.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="rbs-overlay">
      <div className="rbs-modal">
        <div className="rbs-modal-hdr">
          <span>Select Slip with Balance</span>
          <button className="rbs-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="rbs-modal-search">
          <Search size={13} className="rbs-modal-search-icon" />
          <input
            autoFocus
            className="rbs-modal-search-input"
            placeholder="Search by serial # or patient name…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="rbs-modal-body">
          {loading ? (
            <div className="rbs-modal-loading">Loading…</div>
          ) : (
            <table className="rbs-modal-tbl">
              <thead>
                <tr>
                  <th>Serial #</th>
                  <th>Patient</th>
                  <th>Total</th>
                  <th>Received</th>
                  <th>Balance</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} onClick={() => onSelect(s)}>
                    <td>{s.serialNo}</td>
                    <td>{s.patientType} {s.patientName}</td>
                    <td className="rbs-td-r">{fmt2(s.totalAmount)}</td>
                    <td className="rbs-td-r">{fmt2(s.receive)}</td>
                    <td className="rbs-td-r rbs-td-red">{fmt2(s.balance)}</td>
                    <td>{fmtDateTime(s.createdAt)}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="rbs-td-empty">
                      No slips with outstanding balance
                    </td>
                  </tr>
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
export default function ReceiveBalanceSlip() {
  const [serial,      setSerial]      = useState('');
  const [showLookup,  setShowLookup]  = useState(false);
  const [slip,        setSlip]        = useState(null);
  const [receiveAmt,  setReceiveAmt]  = useState('');
  const [receiveDate, setReceiveDate] = useState('');
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    fetch(`${API}/opd/next-serial`)
      .then(r => r.json())
      .then(res => setSerial(res.data?.serialNo || res.data || ''))
      .catch(() => {});
    setReceiveDate(fmtDateTime(new Date()));
  }, []);

  function handleSelect(selected) {
    setSlip(selected);
    setReceiveAmt(String(selected.balance));
    setReceiveDate(fmtDateTime(new Date()));
    setShowLookup(false);
  }

  async function handleAdd() {
    if (!slip) return toast.error('Please select a slip first');
    const amt = parseFloat(receiveAmt);
    if (!amt || amt <= 0)          return toast.error('Balance Amount mein amount enter karein (0 nahi)');
    if (amt > slip.balance + 0.01) return toast.error(`Maximum ${fmt2(slip.balance)} receive ho sakta hai`);

    setSaving(true);
    try {
      const res  = await fetch(`${API}/opd/${slip.id}/receive-balance`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      toast.success('Balance received successfully');
      // reset
      setSlip(null);
      setReceiveAmt('');
      setReceiveDate(fmtDateTime(new Date()));
      const sRes = await fetch(`${API}/opd/next-serial`).then(r => r.json());
      setSerial(sRes.data?.serialNo || sRes.data || '');
    } catch (e) {
      toast.error(e.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rbs-page">
      <ClinicMenuBar />

      <div className="rbs-title-bar">
        <span className="rbs-title-text">Receive Balance against Slip</span>
      </div>

      <div className="rbs-content">
        <div className="rbs-form-card">

          {/* Serial # row */}
          <div className="rbs-form-row">
            <label className="rbs-label rbs-label--serial">Serial #</label>
            <input className="rbs-input rbs-input--serial" value={serial} readOnly />
            {slip && (
              <span className="rbs-dept-badge">{(slip.department || 'GENERAL OPD').toUpperCase()}</span>
            )}
          </div>

          <div className="rbs-separator" />

          {/* For Serial # row */}
          <div className="rbs-form-row">
            <label className="rbs-label">For Serial #</label>
            <input
              className="rbs-input rbs-input--serial"
              value={slip?.serialNo || ''}
              readOnly
              placeholder=""
            />
            <button className="rbs-lookup-btn" onClick={() => setShowLookup(true)} title="Search slips with balance">
              <Search size={13} />
            </button>
            {slip && (
              <span className="rbs-inline-patient">{slip.patientType} {slip.patientName}</span>
            )}
          </div>

          {slip && (
            <>
              <div className="rbs-separator" />

              <div className="rbs-form-row">
                <label className="rbs-label">Patient Name</label>
                <span className="rbs-value">{slip.patientType} {slip.patientName}</span>
              </div>

              <div className="rbs-form-row">
                <label className="rbs-label">Actual Amount</label>
                <span className="rbs-value">{fmt2(slip.totalAmount)}</span>
              </div>

              <div className="rbs-form-row">
                <label className="rbs-label">Received Amount</label>
                <span className="rbs-value">{fmt2(slip.receive)}</span>
              </div>

              <div className="rbs-form-row rbs-form-row--balance">
                <label className="rbs-label">Balance Amount</label>
                <input
                  className="rbs-input rbs-input--balance"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={slip.balance}
                  value={receiveAmt}
                  onChange={e => setReceiveAmt(e.target.value)}
                />
                <label className="rbs-label rbs-label--date">Receive Date</label>
                <span className="rbs-date-val">{receiveDate}</span>
              </div>
            </>
          )}

        </div>

        <div className="rbs-footer">
          <button
            className="rbs-add-btn"
            onClick={handleAdd}
            disabled={saving || !slip}
          >
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
      </div>

      {showLookup && (
        <BalanceLookupModal
          onSelect={handleSelect}
          onClose={() => setShowLookup(false)}
        />
      )}
    </div>
  );
}
