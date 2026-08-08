import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { useAuthStore } from '../../store/useAuthStore';
import './BirthCertificate.scss';

const API = 'http://localhost:5001/api/clinic';
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${day}/${month}/${year} ${time}`;
}

function toDatetimeLocal(d) {
  const dt = d ? new Date(d) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

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
    <div className="bc-overlay">
      <div className="bc-modal">
        <div className="bc-modal-hdr">
          <span>Select Admission</span>
          <button className="bc-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="bc-modal-search">
          <Search size={13} className="bc-modal-search-icon" />
          <input
            autoFocus
            className="bc-modal-search-input"
            placeholder="Search Admission # or Patient Name…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="bc-modal-body">
          {loading ? (
            <div className="bc-modal-loading">Loading…</div>
          ) : (
            <table className="bc-modal-tbl">
              <thead>
                <tr><th>Admission #</th><th>Patient</th><th>Admission Date</th></tr>
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
                  <tr><td colSpan={3} className="bc-td-empty">Koi admission nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const EMPTY_BC = {
  id: null,
  motherName: '',
  fatherName: '',
  address: '',
  bloodGroup: '',
  birthTime: toDatetimeLocal(),
  weight: '',
  gender: 'baba',
  remarks: '',
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BirthCertificate() {
  const { user } = useAuthStore();

  const [showLookup, setShowLookup] = useState(false);
  const [admission, setAdmission] = useState(null);
  const [form, setForm] = useState(EMPTY_BC);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function loadCertificate(admissionNo) {
    try {
      const res = await fetch(`${API}/admission/birth-certificate/by-number/${encodeURIComponent(admissionNo)}?sequenceNo=1`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Load failed');
      setAdmission(json.data.admission);
      const bc = json.data.birthCertificate;
      const adm = json.data.admission;
      if (bc) {
        setForm({
          id: bc.id,
          motherName: bc.motherName || '',
          fatherName: bc.fatherName || '',
          address: bc.address || '',
          bloodGroup: bc.bloodGroup || '',
          birthTime: toDatetimeLocal(bc.birthTime),
          weight: bc.weight ?? '',
          gender: bc.gender || 'baba',
          remarks: bc.remarks || '',
        });
      } else {
        // Auto-fill from the admission: Patient Name -> Mother Name, the
        // relation name -> Father Name only when relation is "W/o" (wife of),
        // Address -> Address.
        setForm({
          ...EMPTY_BC,
          motherName: `${adm.patientTitle || ''} ${adm.patientName || ''}`.trim(),
          fatherName: adm.relationType === 'W/o' ? (adm.relationName || '') : '',
          address: adm.address || '',
        });
      }
    } catch (e) {
      toast.error(e.message || 'Admission load nahi hui');
    }
  }

  async function handleSelect(row) {
    setShowLookup(false);
    await loadCertificate(row.admissionNo);
  }

  function resetForm() {
    setAdmission(null);
    setForm(EMPTY_BC);
  }

  async function handleSave() {
    if (!admission) { toast.error('Pehle admission select karein'); return; }
    if (!form.motherName.trim()) { toast.error('Mother Name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admission/birth-certificate/${admission.id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          sequenceNo: 1,
          createdByUserId: user?.id != null ? String(user.id) : null,
          createdByName: user?.name || user?.username || user?.email || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Save nahi hui');
      toast.success('Birth Certificate save ho gaya');
      resetForm();
    } catch (e) {
      toast.error(e.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bc-page">
      <ClinicMenuBar />

      <div className="bc-title-bar">
        <span className="bc-title-text">Birth Certificate</span>
      </div>

      <div className="bc-content">
        <div className="bc-form-card">

          <div className="bc-form-row">
            <label className="bc-label">Admission #</label>
            <input className="bc-input bc-input--serial" value={admission?.admissionNo || ''} readOnly />
            <button className="bc-lookup-btn" onClick={() => setShowLookup(true)} title="Search admissions">
              <Search size={13} />
            </button>
            {admission && (
              <span className="bc-inline-patient">{admission.patientTitle} {admission.patientName}</span>
            )}
          </div>

          {admission && (
            <>
              <div className="bc-separator" />

              <div className="bc-form-row">
                <label className="bc-label">Mother Name</label>
                <input className="bc-input bc-input--wide" value={form.motherName} onChange={e => set('motherName', e.target.value)} />
              </div>

              <div className="bc-form-row">
                <label className="bc-label">Father Name</label>
                <input className="bc-input bc-input--wide" value={form.fatherName} onChange={e => set('fatherName', e.target.value)} />
              </div>

              <div className="bc-form-row">
                <label className="bc-label">Address</label>
                <input className="bc-input bc-input--wide" value={form.address} onChange={e => set('address', e.target.value)} />
              </div>

              <div className="bc-form-row">
                <label className="bc-label">Blood Group</label>
                <select className="bc-input" value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)}>
                  <option value="">—</option>
                  {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="bc-form-row">
                <label className="bc-label">Birth Time</label>
                <input className="bc-input" type="datetime-local" value={form.birthTime} onChange={e => set('birthTime', e.target.value)} />
              </div>

              <div className="bc-form-row">
                <label className="bc-label">Weight</label>
                <input className="bc-input bc-input--num" type="number" min="0" step="0.1" value={form.weight} onChange={e => set('weight', e.target.value)} />
                <span className="bc-unit">kg</span>

                <label className="bc-label bc-label--right">Gender</label>
                <div className="bc-radio-group">
                  <label className={`bc-radio-btn ${form.gender === 'baba' ? 'bc-radio-btn--active' : ''}`}>
                    <input type="radio" name="gender" checked={form.gender === 'baba'} onChange={() => set('gender', 'baba')} />
                    Baba
                  </label>
                  <label className={`bc-radio-btn ${form.gender === 'baby' ? 'bc-radio-btn--active' : ''}`}>
                    <input type="radio" name="gender" checked={form.gender === 'baby'} onChange={() => set('gender', 'baby')} />
                    Baby
                  </label>
                </div>
              </div>

              <div className="bc-form-row">
                <label className="bc-label">Remarks</label>
                <input className="bc-input bc-input--wide" value={form.remarks} onChange={e => set('remarks', e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="bc-footer">
          <button className="bc-save-btn" onClick={handleSave} disabled={saving || !admission}>
            {form.id ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      {showLookup && (
        <AdmissionLookupModal onSelect={handleSelect} onClose={() => setShowLookup(false)} />
      )}
    </div>
  );
}
