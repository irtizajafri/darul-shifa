import { useState, useEffect, useCallback } from 'react';
import { Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { useAuthStore } from '../../store/useAuthStore';
import { useClinicStore } from '../../store/useClinicStore';
import './SurgeryInformation.scss';

const API = 'http://localhost:5001/api/clinic';

// ── Staff category keyword matching (same pattern as OtRegister) ─────────────
function normCat(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }
const CAT_KEYWORDS = {
  consultant:   ['consultant'],
  rmo:          ['rmo'],
  tech:         ['tech'],
  anesthesist:  ['anaesth', 'anesth'],
};
function doctorsForRole(doctors, role) {
  const keywords = CAT_KEYWORDS[role];
  return doctors.filter(d => {
    const cat = normCat(d.staffCategory?.name);
    return keywords.some(k => cat.includes(k));
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  return `${day}/${month}/${year}`;
}

function toDatetimeLocal(d) {
  const dt = d ? new Date(d) : new Date();
  const pad = n => String(n).padStart(2, '0');
  return (
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` +
    `T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  );
}

// ── Admission Lookup Modal ─────────────────────────────────────────────────────
function AdmissionLookupModal({ onSelect, onClose }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState('');

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
    <div className="si-overlay">
      <div className="si-modal">
        <div className="si-modal-hdr">
          <span>Select Admission</span>
          <button className="si-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="si-modal-search">
          <Search size={13} className="si-modal-icon" />
          <input
            autoFocus
            className="si-modal-input"
            placeholder="Search by Admission # or Patient Name…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>
        <div className="si-modal-body">
          {loading
            ? <div className="si-modal-empty">Loading…</div>
            : (
              <table className="si-tbl">
                <thead>
                  <tr>
                    <th>Admission #</th><th>Patient</th>
                    <th>Gender</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} onClick={() => onSelect(r)}>
                      <td>{r.admissionNo}</td>
                      <td>{r.patientTitle} {r.patientName}</td>
                      <td>{r.gender || '—'}</td>
                      <td>{fmtDate(r.createdAt)}</td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr><td colSpan={4} className="si-td-empty">Koi admitted patient nahi mila</td></tr>
                  )}
                </tbody>
              </table>
            )
          }
        </div>
      </div>
    </div>
  );
}

// ── Patient Info Bar ──────────────────────────────────────────────────────────
function PatientInfoBar({ admission }) {
  return (
    <div className="si-patient-bar">
      <div className="si-pi"><span className="si-pi-lbl">Patient</span>
        <span className="si-pi-val si-pi-name">{admission.patientTitle} {admission.patientName}</span></div>
      <div className="si-pi"><span className="si-pi-lbl">Gender</span>
        <span className="si-pi-val">{admission.gender || '—'}</span></div>
      <div className="si-pi"><span className="si-pi-lbl">Age</span>
        <span className="si-pi-val">{admission.ageYears}y {admission.ageMonths}m {admission.ageDays}d</span></div>
      {admission.mrNo && (
        <div className="si-pi"><span className="si-pi-lbl">MR #</span>
          <span className="si-pi-val">{admission.mrNo}</span></div>
      )}
      <div className="si-pi"><span className="si-pi-lbl">Category</span>
        <span className="si-pi-val si-pi-cat">{admission.patientCategory}</span></div>
    </div>
  );
}

// ── Staff Checkbox Column ─────────────────────────────────────────────────────
function StaffColumn({ title, doctors, selectedIds, onToggle, headerExtra }) {
  return (
    <div className="si-staff-col">
      <div className="si-staff-title">
        <span>{title}</span>
        {headerExtra}
      </div>
      <div className="si-staff-list-hdr">
        <span className="si-staff-c">C.</span>
        <span>Name</span>
      </div>
      <div className="si-staff-list">
        {doctors.length === 0
          ? <div className="si-staff-empty">—</div>
          : doctors.map(d => (
            <label key={d.id} className="si-staff-row">
              <input
                type="checkbox"
                checked={selectedIds.includes(d.id)}
                onChange={() => onToggle(d.id)}
              />
              <span className="si-staff-name">{d.name}</span>
            </label>
          ))
        }
      </div>
    </div>
  );
}

// ── Toggle helper ─────────────────────────────────────────────────────────────
function toggleId(arr, id) {
  return arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];
}

// ── Empty form state ──────────────────────────────────────────────────────────
const emptyForm = () => ({
  operationDateTime: toDatetimeLocal(),
  surgeryTypeId:     '',
  anesthesistId:     '',
  anesthesiaType:    'None',
  consultantIds:     [],
  rmoIds:            [],
  techIds:           [],
  techOnCall:        false,
  itemsJson:         [],       // [{itemCode, description, quantity}]
});

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SurgeryInformation() {
  const { user }                          = useAuthStore();
  const { surgeryTypes, fetchSurgeryTypes } = useClinicStore();

  const [showLookup, setShowLookup] = useState(false);
  const [admission, setAdmission]   = useState(null);
  const [allDoctors, setAllDoctors] = useState([]);   // from API (include staffCategory)
  const [form, setForm]             = useState(emptyForm());
  const [saving, setSaving]         = useState(false);

  // ── New item row state ──
  const [newItem, setNewItem] = useState({ itemCode: '', description: '', quantity: '' });

  useEffect(() => { fetchSurgeryTypes(); }, [fetchSurgeryTypes]);

  // Filtered doctor lists by role
  const consultants   = doctorsForRole(allDoctors, 'consultant');
  const rmos          = doctorsForRole(allDoctors, 'rmo');
  const techs         = doctorsForRole(allDoctors, 'tech');
  const anesthesists  = doctorsForRole(allDoctors, 'anesthesist');

  const set = useCallback((k, v) => setForm(f => ({ ...f, [k]: v })), []);

  // ── Load admission ──
  async function handleSelect(row) {
    setShowLookup(false);
    try {
      const res  = await fetch(`${API}/admission/surgery-information/by-number/${encodeURIComponent(row.admissionNo)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Load failed');

      const { admission: adm, surgeryInformation: si, doctors } = json.data;
      setAdmission(adm);
      setAllDoctors(doctors || []);

      setForm(si ? {
        operationDateTime: si.operationDateTime ? toDatetimeLocal(si.operationDateTime) : toDatetimeLocal(),
        surgeryTypeId:     si.surgeryTypeId ? String(si.surgeryTypeId) : '',
        anesthesistId:     si.anesthesistId ? String(si.anesthesistId) : '',
        anesthesiaType:    si.anesthesiaType || 'None',
        consultantIds:     si.consultantIds  || [],
        rmoIds:            si.rmoIds         || [],
        techIds:           si.techIds        || [],
        techOnCall:        si.techOnCall     || false,
        itemsJson:         Array.isArray(si.itemsJson) ? si.itemsJson : [],
      } : emptyForm());
    } catch (e) {
      toast.error(e.message || 'Admission load nahi hui');
    }
  }

  function resetForm() {
    setAdmission(null);
    setAllDoctors([]);
    setForm(emptyForm());
    setNewItem({ itemCode: '', description: '', quantity: '' });
  }

  // ── Items helpers ──
  function addItem() {
    if (!newItem.description.trim()) { toast.error('Description zaroor darain'); return; }
    if (!newItem.quantity || Number(newItem.quantity) <= 0) { toast.error('Quantity valid honi chahiye'); return; }
    set('itemsJson', [
      ...form.itemsJson,
      { itemCode: newItem.itemCode.trim(), description: newItem.description.trim(), quantity: Number(newItem.quantity) },
    ]);
    setNewItem({ itemCode: '', description: '', quantity: '' });
  }

  function removeItem(idx) {
    set('itemsJson', form.itemsJson.filter((_, i) => i !== idx));
  }

  // ── Save ──
  async function handleSave() {
    if (!admission) { toast.error('Pehle admission select karein'); return; }
    setSaving(true);
    try {
      const res  = await fetch(`${API}/admission/surgery-information/${admission.id}/save`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          surgeryTypeId:   form.surgeryTypeId  ? Number(form.surgeryTypeId)  : null,
          anesthesistId:   form.anesthesistId  ? Number(form.anesthesistId)  : null,
          createdByUserId: user?.id != null ? String(user.id) : null,
          createdByName:   user?.name || user?.username || user?.email || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Save nahi hui');
      toast.success('Surgery Information save ho gayi');
      resetForm();
    } catch (e) {
      toast.error(e.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="si-page">
      <ClinicMenuBar />

      <div className="si-title-bar">
        <span className="si-title-text">Procedure / Surgery Information</span>
      </div>

      <div className="si-content">
        {/* ── Admission # row ── */}
        <div className="si-top-card">
          <div className="si-adm-row">
            <label className="si-adm-lbl">Admission #</label>
            <input
              className="si-adm-input"
              value={admission ? `${admission.admissionNo} / ${admission.patientName}` : ''}
              readOnly
              placeholder="Click 🔍 to select admitted patient"
            />
            <button className="si-lookup-btn" onClick={() => setShowLookup(true)} title="Search admitted patients">
              <Search size={13} />
            </button>
            {admission && (
              <button className="si-clear-btn" onClick={resetForm} title="Clear">✕</button>
            )}
          </div>

          {admission && <PatientInfoBar admission={admission} />}
        </div>

        {admission && (
          <>
            {/* ── Operation Data + Procedure + Anesthesia row ── */}
            <div className="si-form-card si-form-card--top">

              <div className="si-field-row">
                {/* Left: Operation Data + Anesthesist */}
                <div className="si-field-group">
                  <div className="si-field">
                    <label className="si-lbl">Operation Data</label>
                    <input
                      type="datetime-local"
                      className="si-input si-input--dt"
                      value={form.operationDateTime}
                      onChange={e => set('operationDateTime', e.target.value)}
                    />
                  </div>
                  <div className="si-field">
                    <label className="si-lbl">Anesthesist</label>
                    <select
                      className="si-input si-input--select"
                      value={form.anesthesistId}
                      onChange={e => set('anesthesistId', e.target.value)}
                    >
                      <option value="">— Select —</option>
                      {anesthesists.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Right: Procedure + Anesthesia radios */}
                <div className="si-field-group">
                  <div className="si-field">
                    <label className="si-lbl">Procedure</label>
                    <select
                      className="si-input si-input--select"
                      value={form.surgeryTypeId}
                      onChange={e => set('surgeryTypeId', e.target.value)}
                    >
                      <option value="">— Select —</option>
                      {surgeryTypes.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.code ? `${s.code} — ${s.name}` : s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="si-field si-field--anesthesia">
                    <label className="si-lbl">Anesthesia</label>
                    <div className="si-radios">
                      {['General', 'Spinal', 'Local', 'None'].map(opt => (
                        <label key={opt} className="si-radio-lbl">
                          <input
                            type="radio"
                            name="anesthesiaType"
                            value={opt}
                            checked={form.anesthesiaType === opt}
                            onChange={() => set('anesthesiaType', opt)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Staff Columns ── */}
            <div className="si-staff-card">
              <StaffColumn
                title="Consultant"
                doctors={consultants}
                selectedIds={form.consultantIds}
                onToggle={id => set('consultantIds', toggleId(form.consultantIds, id))}
              />
              <div className="si-staff-divider" />
              <StaffColumn
                title="RMO Name"
                doctors={rmos}
                selectedIds={form.rmoIds}
                onToggle={id => set('rmoIds', toggleId(form.rmoIds, id))}
              />
              <div className="si-staff-divider" />
              <StaffColumn
                title="OT Technician"
                doctors={techs}
                selectedIds={form.techIds}
                onToggle={id => set('techIds', toggleId(form.techIds, id))}
                headerExtra={
                  <label className="si-oncall-lbl">
                    <input
                      type="checkbox"
                      checked={form.techOnCall}
                      onChange={e => set('techOnCall', e.target.checked)}
                    />
                    On Call
                  </label>
                }
              />
            </div>

            {/* ── Items Used ── */}
            <div className="si-items-card">
              <div className="si-items-title">Items Used</div>

              {/* Add row */}
              <div className="si-items-add-row">
                <input
                  className="si-input si-input--code"
                  placeholder="Item Code"
                  value={newItem.itemCode}
                  onChange={e => setNewItem(n => ({ ...n, itemCode: e.target.value }))}
                />
                <input
                  className="si-input si-input--desc"
                  placeholder="Description"
                  value={newItem.description}
                  onChange={e => setNewItem(n => ({ ...n, description: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                />
                <label className="si-items-qty-lbl">Quantity</label>
                <input
                  className="si-input si-input--qty"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={newItem.quantity}
                  onChange={e => setNewItem(n => ({ ...n, quantity: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addItem()}
                />
                <button className="si-add-btn" onClick={addItem}>Add Items</button>
              </div>

              {/* Items table */}
              <table className="si-items-tbl">
                <thead>
                  <tr>
                    <th className="si-items-th--code">Item Code</th>
                    <th className="si-items-th--desc">Description</th>
                    <th className="si-items-th--qty">Quantity</th>
                    <th className="si-items-th--del" />
                  </tr>
                </thead>
                <tbody>
                  {form.itemsJson.length === 0
                    ? (
                      <tr>
                        <td colSpan={4} className="si-items-empty">No items added yet</td>
                      </tr>
                    )
                    : form.itemsJson.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.itemCode || '—'}</td>
                        <td>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>
                          <button className="si-del-btn" onClick={() => removeItem(idx)} title="Remove">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>

            {/* ── Footer ── */}
            <div className="si-footer">
              <button className="si-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>

      {showLookup && (
        <AdmissionLookupModal
          onSelect={handleSelect}
          onClose={() => setShowLookup(false)}
        />
      )}
    </div>
  );
}
