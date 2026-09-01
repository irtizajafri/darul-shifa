import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { useAuthStore } from '../../store/useAuthStore';
import { useClinicStore } from '../../store/useClinicStore';
import { useInventoryStore } from '../../store/useInventoryStore';
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
});

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SurgeryInformation() {
  const { user }                          = useAuthStore();
  const { surgeryTypes, fetchSurgeryTypes } = useClinicStore();
  const {
    masterOptions, fetchMastersOptions,
    items, fetchItems,
    createGDBatch,
    gdHeaders, fetchGDHeaders,
  } = useInventoryStore();

  const [showLookup, setShowLookup] = useState(false);
  const [admission, setAdmission]   = useState(null);
  const [allDoctors, setAllDoctors] = useState([]);   // from API (include staffCategory)
  const [form, setForm]             = useState(emptyForm());
  const [saving, setSaving]         = useState(false);

  // ── Request Items (GD) — same Department + Item-search + Qty flow as
  // Inventory > Goods Issue's own "Create GD" form, just pre-scoped to this
  // admission (admissionNumber) so it lands in the exact same GD table —
  // Store sees it via the normal GD notification/Goods Issue screen, no
  // separate OT-only mechanism.
  const [gdDepartmentId, setGdDepartmentId] = useState('');
  const [gdSelectedItems, setGdSelectedItems] = useState([]); // [{itemId, itemName, itemCode, quantityRequested}]
  const [gdItemSearch, setGdItemSearch] = useState('');
  const [gdDropdownOpen, setGdDropdownOpen] = useState(false);
  const [gdHighlighted, setGdHighlighted] = useState(-1);
  const [gdSubmitting, setGdSubmitting] = useState(false);
  const gdSearchRef = useRef(null);
  const gdListRef = useRef(null);
  const gdQtyRefs = useRef({});

  useEffect(() => {
    fetchSurgeryTypes();
    fetchMastersOptions();
    fetchItems({ status: 'active' });
    // eslint-disable-next-line
  }, [fetchSurgeryTypes]);

  const gdItemSearchResults = useMemo(() => {
    const q = gdItemSearch.trim().toLowerCase();
    const pool = !q ? (items || []) : (items || []).filter((it) =>
      String(it.name || '').toLowerCase().includes(q) || String(it.code || '').toLowerCase().includes(q)
    );
    return pool.slice(0, 20);
  }, [items, gdItemSearch]);

  useEffect(() => {
    if (gdListRef.current && gdHighlighted >= 0) {
      gdListRef.current.children[gdHighlighted]?.scrollIntoView({ block: 'nearest' });
    }
  }, [gdHighlighted]);

  function addGdItem(item) {
    if (gdSelectedItems.find((i) => i.itemId === item.id)) { toast.error('Item pehle se add hai'); return; }
    setGdSelectedItems((prev) => [...prev, { itemId: item.id, itemName: item.name, itemCode: item.code, quantityRequested: '' }]);
    setGdItemSearch('');
    setGdDropdownOpen(false);
    setGdHighlighted(-1);
    setTimeout(() => gdQtyRefs.current[item.id]?.focus(), 0);
  }

  function removeGdItem(itemId) {
    setGdSelectedItems((prev) => prev.filter((i) => i.itemId !== itemId));
  }

  function updateGdItemQty(itemId, qty) {
    setGdSelectedItems((prev) => prev.map((i) => (i.itemId === itemId ? { ...i, quantityRequested: qty } : i)));
  }

  function handleGdItemSearchKeyDown(e) {
    if (!gdDropdownOpen) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setGdDropdownOpen(true); setGdHighlighted(0); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setGdHighlighted((p) => Math.min(p + 1, gdItemSearchResults.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setGdHighlighted((p) => Math.max(p - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (gdHighlighted >= 0 && gdItemSearchResults[gdHighlighted]) addGdItem(gdItemSearchResults[gdHighlighted]); }
    else if (e.key === 'Escape') { setGdDropdownOpen(false); setGdHighlighted(-1); }
  }

  async function handleRequestItems() {
    if (!admission) return;
    if (!gdDepartmentId) { toast.error('Department select karein'); return; }
    if (gdSelectedItems.length === 0) { toast.error('Kam az kam ek item add karein'); return; }
    const badQty = gdSelectedItems.find((i) => !i.quantityRequested || Number(i.quantityRequested) <= 0);
    if (badQty) { toast.error(`Quantity darj karein: ${badQty.itemName}`); return; }
    setGdSubmitting(true);
    try {
      await createGDBatch({
        departmentId: Number(gdDepartmentId),
        requestDate: new Date().toISOString(),
        items: gdSelectedItems.map((i) => ({ itemId: i.itemId, quantityRequested: Number(i.quantityRequested) })),
        admissionNumber: admission.admissionNo,
        comment: `Surgery — ${admission.patientName}`,
      });
      toast.success('Items request ho gayi (GD ban gayi)');
      setGdSelectedItems([]);
      setGdItemSearch('');
      await fetchGDHeaders({ admissionNumber: admission.admissionNo });
    } catch (e) {
      toast.error(e.message || 'GD create nahi hui');
    } finally {
      setGdSubmitting(false);
    }
  }

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
      } : emptyForm());

      setGdSelectedItems([]);
      setGdItemSearch('');
      fetchGDHeaders({ admissionNumber: adm.admissionNo }).catch(() => {});
    } catch (e) {
      toast.error(e.message || 'Admission load nahi hui');
    }
  }

  function resetForm() {
    setAdmission(null);
    setAllDoctors([]);
    setForm(emptyForm());
    setGdDepartmentId('');
    setGdSelectedItems([]);
    setGdItemSearch('');
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

            {/* ── Request Items (GD) — same Department/Item/Qty flow, same GD ── */}
            {/* table as Inventory > Goods Issue's "Create GD" form. Whatever is */}
            {/* requested here shows up there too (GD list, GD Report, Store's */}
            {/* notification popup) — it's the same data, not a copy. */}
            <div className="si-items-card">
              <div className="si-items-title">Request Items (GD)</div>

              <div className="si-gd-top-row">
                <select
                  className="si-input si-input--select"
                  value={gdDepartmentId}
                  onChange={e => setGdDepartmentId(e.target.value)}
                >
                  <option value="">— Select Department —</option>
                  {(masterOptions.departments || []).map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>

                <div className="si-gd-search">
                  <input
                    ref={gdSearchRef}
                    className="si-input si-input--desc"
                    placeholder="Search and add item…"
                    value={gdItemSearch}
                    onChange={e => { setGdItemSearch(e.target.value); setGdDropdownOpen(true); setGdHighlighted(-1); }}
                    onFocus={() => setGdDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setGdDropdownOpen(false), 150)}
                    onKeyDown={handleGdItemSearchKeyDown}
                  />
                  {gdDropdownOpen && gdItemSearchResults.length > 0 && (
                    <div className="si-gd-dropdown" ref={gdListRef}>
                      {gdItemSearchResults.map((it, idx) => (
                        <div
                          key={it.id}
                          className={`si-gd-dropdown-opt ${idx === gdHighlighted ? 'si-gd-dropdown-opt--active' : ''}`}
                          onMouseDown={() => addGdItem(it)}
                          onMouseEnter={() => setGdHighlighted(idx)}
                        >
                          <span className="si-gd-dropdown-name">{it.name}</span>
                          <span className="si-gd-dropdown-code">{it.code}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pending batch (not yet submitted) */}
              <table className="si-items-tbl">
                <thead>
                  <tr>
                    <th className="si-items-th--desc">Item</th>
                    <th className="si-items-th--code">Code</th>
                    <th className="si-items-th--qty">Quantity</th>
                    <th className="si-items-th--del" />
                  </tr>
                </thead>
                <tbody>
                  {gdSelectedItems.length === 0
                    ? (
                      <tr>
                        <td colSpan={4} className="si-items-empty">No items added yet</td>
                      </tr>
                    )
                    : gdSelectedItems.map(row => (
                      <tr key={row.itemId}>
                        <td>{row.itemName}</td>
                        <td>{row.itemCode}</td>
                        <td>
                          <input
                            className="si-input si-input--qty"
                            type="number"
                            min="0.01"
                            step="0.01"
                            placeholder="Qty"
                            value={row.quantityRequested}
                            ref={el => { if (el) gdQtyRefs.current[row.itemId] = el; }}
                            onChange={e => updateGdItemQty(row.itemId, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); gdSearchRef.current?.focus(); } }}
                          />
                        </td>
                        <td>
                          <button className="si-del-btn" onClick={() => removeGdItem(row.itemId)} title="Remove">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>

              {gdSelectedItems.length > 0 && (
                <div className="si-gd-submit-row">
                  <button className="si-add-btn" onClick={handleRequestItems} disabled={gdSubmitting}>
                    <Plus size={13} /> {gdSubmitting ? 'Requesting…' : 'Request Items'}
                  </button>
                </div>
              )}

              {/* Already-requested GDs for this admission — same data Store sees */}
              {gdHeaders.length > 0 && (
                <div className="si-gd-history">
                  <div className="si-gd-history-title">Requested (GD Status)</div>
                  <table className="si-items-tbl">
                    <thead>
                      <tr>
                        <th className="si-items-th--code">GD #</th>
                        <th className="si-items-th--desc">Item</th>
                        <th className="si-items-th--qty">Qty</th>
                        <th className="si-items-th--code">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gdHeaders.flatMap(h => (h.gdItems || []).map(gi => (
                        <tr key={gi.id}>
                          <td>{h.code}</td>
                          <td>{gi.item?.name || '—'}</td>
                          <td>{gi.quantityRequested}</td>
                          <td>
                            <span className={`si-gd-status si-gd-status--${gi.status}`}>{gi.status}</span>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              )}
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
