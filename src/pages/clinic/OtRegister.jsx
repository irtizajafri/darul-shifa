import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { useAuthStore } from '../../store/useAuthStore';
import { useClinicStore } from '../../store/useClinicStore';
import './OtRegister.scss';

const API = 'http://localhost:5001/api/clinic';

const BLOOD_TYPES = ['Whole Blood', 'Plasma', 'FFP', 'C/S', 'Platlets'];

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

// A doctor "is" a given OT role purely by which Staff Category was assigned
// to them in Doctor parameters — matched here by keyword so exact spelling
// of the category name doesn't have to be pinned down ("Anaesthesiologist",
// "Anesthesiologist", etc. all match).
function normCat(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }
const ROLE_KEYWORDS = {
  anaesthesiologist: ['anaesth', 'anesth'],
  surgeon: ['surgeon'],
  tech: ['tech'],
};
function doctorsForRole(doctors, role) {
  const keywords = ROLE_KEYWORDS[role];
  return doctors.filter(d => {
    const cat = normCat(d.staffCategory?.name);
    return keywords.some(k => cat.includes(k));
  });
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
    <div className="otr-overlay">
      <div className="otr-modal">
        <div className="otr-modal-hdr">
          <span>Select Admission</span>
          <button className="otr-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="otr-modal-search">
          <Search size={13} className="otr-modal-search-icon" />
          <input
            autoFocus
            className="otr-modal-search-input"
            placeholder="Search Admission # or Patient Name…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="otr-modal-body">
          {loading ? (
            <div className="otr-modal-loading">Loading…</div>
          ) : (
            <table className="otr-modal-tbl">
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
                  <tr><td colSpan={3} className="otr-td-empty">Koi admission nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Doctor Picker Modal (filtered by role's Staff Category) ───────────────────
function DoctorPickerModal({ title, doctors, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const filtered = doctors.filter(d =>
    !q.trim() ||
    d.name?.toLowerCase().includes(q.trim().toLowerCase()) ||
    d.code?.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="otr-overlay">
      <div className="otr-modal">
        <div className="otr-modal-hdr">
          <span>{title}</span>
          <button className="otr-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="otr-modal-search">
          <Search size={13} className="otr-modal-search-icon" />
          <input
            autoFocus
            className="otr-modal-search-input"
            placeholder="Search doctor name or code…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="otr-modal-body">
          <table className="otr-modal-tbl">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Staff Category</th></tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} onClick={() => onSelect(d)}>
                  <td>{d.code}</td>
                  <td>{d.name}</td>
                  <td>{d.staffCategory?.name || '—'}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={3} className="otr-td-empty">
                  Is Staff Category ka koi doctor nahi mila — pehle Parameters {'>'} Doctors mein
                  is role ke doctor ki Staff Category set karein.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Doctor Field (readonly display + search icon + On Call checkbox) ──────────
function DoctorField({ label, doctorId, onCall, doctors, role, onPick, onOnCallChange }) {
  const [showPicker, setShowPicker] = useState(false);
  const selected = doctors.find(d => d.id === doctorId);
  const roleDoctors = useMemo(() => doctorsForRole(doctors, role), [doctors, role]);

  return (
    <div className="otr-form-row">
      <label className="otr-label">{label}</label>
      <input className="otr-input otr-input--doc" value={selected ? `${selected.code} — ${selected.name}` : ''} readOnly />
      <button className="otr-lookup-btn" onClick={() => setShowPicker(true)} title={`Search ${label}`}>
        <Search size={13} />
      </button>
      <label className="otr-check-label">
        <input type="checkbox" checked={onCall} onChange={e => onOnCallChange(e.target.checked)} />
        On Call
      </label>

      {showPicker && (
        <DoctorPickerModal
          title={`Select ${label}`}
          doctors={roleDoctors}
          onSelect={(d) => { onPick(d.id); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

const EMPTY_OT = {
  id: null,
  surgeryDateTime: toDatetimeLocal(),
  anaesthesiologistId: null, anaesthesiologistOnCall: false,
  surgeon1Id: null, surgeon1OnCall: false,
  surgeon2Id: null, surgeon2OnCall: false,
  tech1Id: null, tech1OnCall: false,
  tech2Id: null, tech2OnCall: false,
  surgeryTypeId: '',
  useBlood: false, bloodType: BLOOD_TYPES[0], bloodQty: '',
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OtRegister() {
  const { user } = useAuthStore();
  const { doctors, fetchDoctors, surgeryTypes, fetchSurgeryTypes } = useClinicStore();

  const [showLookup, setShowLookup] = useState(false);
  const [admission, setAdmission] = useState(null);
  const [form, setForm] = useState(EMPTY_OT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDoctors();
    fetchSurgeryTypes();
  }, [fetchDoctors, fetchSurgeryTypes]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSelect(row) {
    setShowLookup(false);
    try {
      const res = await fetch(`${API}/admission/ot-register/by-number/${encodeURIComponent(row.admissionNo)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Load failed');
      setAdmission(json.data.admission);
      const ot = json.data.otRegister;
      setForm(ot ? {
        id: ot.id,
        surgeryDateTime: toDatetimeLocal(ot.surgeryDateTime),
        anaesthesiologistId: ot.anaesthesiologistId, anaesthesiologistOnCall: ot.anaesthesiologistOnCall,
        surgeon1Id: ot.surgeon1Id, surgeon1OnCall: ot.surgeon1OnCall,
        surgeon2Id: ot.surgeon2Id, surgeon2OnCall: ot.surgeon2OnCall,
        tech1Id: ot.tech1Id, tech1OnCall: ot.tech1OnCall,
        tech2Id: ot.tech2Id, tech2OnCall: ot.tech2OnCall,
        surgeryTypeId: ot.surgeryTypeId || '',
        useBlood: ot.useBlood, bloodType: ot.bloodType || BLOOD_TYPES[0], bloodQty: ot.bloodQty || '',
      } : EMPTY_OT);
    } catch (e) {
      toast.error(e.message || 'Admission load nahi hui');
    }
  }

  function resetForm() {
    setAdmission(null);
    setForm(EMPTY_OT);
  }

  async function handleSave() {
    if (!admission) { toast.error('Pehle admission select karein'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admission/ot-register/${admission.id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          createdByUserId: user?.id != null ? String(user.id) : null,
          createdByName: user?.name || user?.username || user?.email || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Save nahi hui');
      toast.success('OT Register save ho gaya');
      resetForm();
    } catch (e) {
      toast.error(e.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="otr-page">
      <ClinicMenuBar />

      <div className="otr-title-bar">
        <span className="otr-title-text">OT Register</span>
      </div>

      <div className="otr-content">
        <div className="otr-form-card">

          <div className="otr-form-row">
            <label className="otr-label">Admission #</label>
            <input className="otr-input otr-input--serial" value={admission?.admissionNo || ''} readOnly />
            <button className="otr-lookup-btn" onClick={() => setShowLookup(true)} title="Search admissions">
              <Search size={13} />
            </button>
            {admission && (
              <span className="otr-inline-patient">{admission.patientTitle} {admission.patientName}</span>
            )}
          </div>

          {admission && (
            <>
              <div className="otr-separator" />

              <div className="otr-form-row">
                <label className="otr-label">Surgery Date and Time</label>
                <input
                  className="otr-input"
                  type="datetime-local"
                  value={form.surgeryDateTime}
                  onChange={e => set('surgeryDateTime', e.target.value)}
                />
              </div>

              <div className="otr-separator" />

              <DoctorField
                label="Anaesthesiologist" role="anaesthesiologist" doctors={doctors}
                doctorId={form.anaesthesiologistId} onCall={form.anaesthesiologistOnCall}
                onPick={id => set('anaesthesiologistId', id)}
                onOnCallChange={v => set('anaesthesiologistOnCall', v)}
              />
              <DoctorField
                label="Surgeon 1" role="surgeon" doctors={doctors}
                doctorId={form.surgeon1Id} onCall={form.surgeon1OnCall}
                onPick={id => set('surgeon1Id', id)}
                onOnCallChange={v => set('surgeon1OnCall', v)}
              />
              <DoctorField
                label="Surgeon 2" role="surgeon" doctors={doctors}
                doctorId={form.surgeon2Id} onCall={form.surgeon2OnCall}
                onPick={id => set('surgeon2Id', id)}
                onOnCallChange={v => set('surgeon2OnCall', v)}
              />
              <DoctorField
                label="Tech 1" role="tech" doctors={doctors}
                doctorId={form.tech1Id} onCall={form.tech1OnCall}
                onPick={id => set('tech1Id', id)}
                onOnCallChange={v => set('tech1OnCall', v)}
              />
              <DoctorField
                label="Tech 2" role="tech" doctors={doctors}
                doctorId={form.tech2Id} onCall={form.tech2OnCall}
                onPick={id => set('tech2Id', id)}
                onOnCallChange={v => set('tech2OnCall', v)}
              />

              <div className="otr-form-row">
                <label className="otr-label">Surgery Type</label>
                <select className="otr-input otr-input--wide" value={form.surgeryTypeId} onChange={e => set('surgeryTypeId', e.target.value)}>
                  <option value="">— Select —</option>
                  {surgeryTypes.map(s => (
                    <option key={s.id} value={s.id}>{s.code ? `${s.code} — ${s.name}` : s.name}</option>
                  ))}
                </select>
              </div>

              <div className="otr-separator" />

              <div className="otr-form-row">
                <label className="otr-check-label otr-check-label--blood">
                  <input type="checkbox" checked={form.useBlood} onChange={e => set('useBlood', e.target.checked)} />
                  USE ANY KIND OF BLOOD
                </label>
                {form.useBlood && (
                  <>
                    <select className="otr-input" value={form.bloodType} onChange={e => set('bloodType', e.target.value)}>
                      {BLOOD_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <label className="otr-label otr-label--right">Qty:</label>
                    <input
                      className="otr-input otr-input--amount"
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.bloodQty}
                      onChange={e => set('bloodQty', e.target.value)}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="otr-footer">
          <button className="otr-save-btn" onClick={handleSave} disabled={saving || !admission}>Save</button>
        </div>
      </div>

      {showLookup && (
        <AdmissionLookupModal onSelect={handleSelect} onClose={() => setShowLookup(false)} />
      )}
    </div>
  );
}
