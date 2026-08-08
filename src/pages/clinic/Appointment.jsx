import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import './Appointment.scss';

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

function todayDDMMYYYY() {
  const dt = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`;
}

function toDateInput(d) {
  const dt = d ? new Date(d) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// ── Slip Lookup Modal ──────────────────────────────────────────────────────────
function SlipLookupModal({ onSelect, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch(`${API}/appointment/search`)
      .then(r => r.json())
      .then(res => setRows(res.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(r =>
    !q.trim() ||
    r.serialNo?.toLowerCase().includes(q.trim().toLowerCase()) ||
    r.patientName?.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="apt-overlay">
      <div className="apt-modal">
        <div className="apt-modal-hdr">
          <span>Select Slip</span>
          <button className="apt-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="apt-modal-search">
          <Search size={13} className="apt-modal-search-icon" />
          <input
            autoFocus
            className="apt-modal-search-input"
            placeholder="Search Slip # or Patient Name…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="apt-modal-body">
          {loading ? (
            <div className="apt-modal-loading">Loading…</div>
          ) : (
            <table className="apt-modal-tbl">
              <thead>
                <tr><th>Slip #</th><th>Patient</th><th>Department</th><th>Date</th></tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} onClick={() => onSelect(r)}>
                    <td>{r.serialNo}</td>
                    <td>{r.patientName}</td>
                    <td>{r.department}</td>
                    <td>{fmtDateTime(r.createdAt)}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={4} className="apt-td-empty">Koi slip nahi mila</td></tr>
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
export default function Appointment() {
  const [showLookup, setShowLookup] = useState(false);
  const [visit, setVisit] = useState(null);
  const [existingId, setExistingId] = useState(null);
  const [nextAppointmentDate, setNextAppointmentDate] = useState(toDateInput());
  const [phoneNo, setPhoneNo] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSelect(row) {
    setShowLookup(false);
    try {
      const res = await fetch(`${API}/appointment/by-slip/${encodeURIComponent(row.serialNo)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Load failed');
      setVisit(json.data.visit);
      const appt = json.data.appointment;
      setExistingId(appt?.id || null);
      setNextAppointmentDate(toDateInput(appt?.nextAppointmentDate));
      setPhoneNo(appt?.phoneNo || json.data.visit.phoneNo || '');
    } catch (e) {
      toast.error(e.message || 'Slip load nahi hui');
    }
  }

  function resetForm() {
    setVisit(null);
    setExistingId(null);
    setNextAppointmentDate(toDateInput());
    setPhoneNo('');
  }

  async function handleSave() {
    if (!visit) { toast.error('Pehle slip select karein'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/appointment/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slipNo: visit.serialNo,
          nextAppointmentDate,
          phoneNo,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Save nahi hui');
      toast.success('Appointment save ho gayi');
      resetForm();
    } catch (e) {
      toast.error(e.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="apt-page">
      <ClinicMenuBar />

      <div className="apt-title-bar">
        <span className="apt-title-text">Appointment</span>
        <span className="apt-title-date">{todayDDMMYYYY()}</span>
      </div>

      <div className="apt-content">
        <div className="apt-form-card">

          <div className="apt-form-row">
            <label className="apt-label">Slip #</label>
            <input className="apt-input apt-input--serial" value={visit?.serialNo || ''} readOnly />
            <button className="apt-lookup-btn" onClick={() => setShowLookup(true)} title="Search slips">
              <Search size={13} />
            </button>
            {visit && (
              <span className="apt-inline-patient">{visit.patientName}</span>
            )}
          </div>

          {visit && (
            <>
              <div className="apt-separator" />

              <div className="apt-form-row">
                <label className="apt-label">Antenatal:</label>
                <input className="apt-input" value={visit.antenatalNo || 'NA'} readOnly />

                <label className="apt-label apt-label--right">Next Appointment Date :</label>
                <input className="apt-input" type="date" value={nextAppointmentDate} onChange={e => setNextAppointmentDate(e.target.value)} />
              </div>

              <div className="apt-form-row">
                <label className="apt-label">Consultant</label>
                <input className="apt-input apt-input--wide" value={visit.consultantName || '—'} readOnly />

                <label className="apt-label apt-label--right">Phone No</label>
                <input className="apt-input" value={phoneNo} onChange={e => setPhoneNo(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="apt-footer">
          <button className="apt-save-btn" onClick={handleSave} disabled={saving || !visit}>
            {existingId ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      {showLookup && (
        <SlipLookupModal onSelect={handleSelect} onClose={() => setShowLookup(false)} />
      )}
    </div>
  );
}
