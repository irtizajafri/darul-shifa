import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, DoorOpen, Save, Copy, RotateCcw, FileText, Printer, User, Building2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../components/ui/SearchableSelect';
import './Admission.scss';
import './Antenatal.scss';
import './AdmissionAdjustment.scss';

function fullName(emp) {
  return [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
}

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${day}-${month}-${year} ${time}`;
}

// Same "Code / Code" label PanelModal builds when you pick fresh — resolved
// from whatever's already saved on the admission, so re-opening one for edit
// shows its existing Panel selection instead of a blank picker.
function resolvePanelLabel(panelCompanyId, panelEmployeeId, panelCompanies, panelEmployees) {
  if (!panelCompanyId) return '';
  const company = panelCompanies.find(c => c.id === panelCompanyId);
  const employee = panelEmployeeId ? panelEmployees.find(e => e.id === panelEmployeeId) : null;
  return [company?.code, employee?.empCode].filter(Boolean).join(' / ');
}

// ── Employee Modal (identical to Admission.jsx) ────────────────────────────────
function EmployeeModal({ onSelect, onClose, searchEmployees }) {
  const [step, setStep] = useState(1);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [dependentIdx, setDependentIdx] = useState('');
  const timer = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (step === 1) inputRef.current?.focus(); }, [step]);

  const handleSearch = useCallback((val) => {
    setQ(val);
    clearTimeout(timer.current);
    if (!val.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try { setResults((await searchEmployees(val)) || []); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }, [searchEmployees]);

  function handleEmpClick(emp) {
    if (emp.dependents?.length > 0) {
      setSelectedEmp(emp); setDependentIdx(''); setStep(2);
    } else {
      onSelect({ emp, dependent: null });
    }
  }

  function handleConfirm() {
    const dep = dependentIdx !== '' ? selectedEmp.dependents[Number(dependentIdx)] : null;
    onSelect({ emp: selectedEmp, dependent: dep });
  }

  if (step === 2 && selectedEmp) {
    return (
      <div className="ant-modal-overlay" onMouseDown={onClose}>
        <div className="ant-modal ant-modal--panel" onMouseDown={e => e.stopPropagation()}>
          <div className="ant-modal-header">
            <div className="ant-modal-title"><User size={16}/> Select Patient</div>
            <button className="ant-modal-close" onClick={onClose}><X size={16}/></button>
          </div>
          <div className="ant-panel-body">
            <div className="ant-panel-field">
              <label>Employee</label>
              <div className="ant-panel-static">{fullName(selectedEmp)} ({selectedEmp.empCode || '–'})</div>
            </div>
            <div className="ant-panel-field">
              <label>Patient</label>
              <select value={dependentIdx} onChange={e => setDependentIdx(e.target.value)}>
                <option value="">— Employee (Self) —</option>
                {selectedEmp.dependents.map((d, i) => (
                  <option key={i} value={i}>{d.code} — {d.name} ({d.relation})</option>
                ))}
              </select>
            </div>
            <div className="ant-panel-actions">
              <button className="ant-btn-cancel" onClick={() => setStep(1)}>Back</button>
              <button className="ant-btn-confirm" onClick={handleConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ant-modal-overlay" onMouseDown={onClose}>
      <div className="ant-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="ant-modal-header">
          <div className="ant-modal-title"><User size={16}/> Select Employee</div>
          <button className="ant-modal-close" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="ant-modal-search">
          <Search size={14} className="ant-modal-search-icon"/>
          <input ref={inputRef} placeholder="Search by name or code..." value={q} onChange={e => handleSearch(e.target.value)}/>
          {loading && <span className="ant-spinner"/>}
        </div>
        <div className="ant-modal-body">
          {results.length === 0 && !loading && (
            <div className="ant-modal-empty">{q.trim() ? 'No employees found' : 'Type to search employees'}</div>
          )}
          {results.length > 0 && (
            <table className="ant-modal-table">
              <thead><tr><th>Code</th><th>Name</th><th>Phone</th></tr></thead>
              <tbody>
                {results.map(emp => (
                  <tr key={emp.id} onClick={() => handleEmpClick(emp)}>
                    <td>{emp.empCode || '–'}</td>
                    <td>
                      {fullName(emp)}
                      {emp.dependents?.length > 0 && (
                        <span className="ant-dep-badge">+{emp.dependents.length} dep</span>
                      )}
                    </td>
                    <td>{emp.phone || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Panel Modal (identical to Admission.jsx) ───────────────────────────────────
function PanelModal({ onSelect, onClose }) {
  const { panelCompanies, panelEmployees, fetchPanelCompanies, fetchPanelEmployees } = useClinicStore();
  const [companyId, setCompanyId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [dependentIdx, setDependentIdx] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchPanelCompanies(), fetchPanelEmployees()]).finally(() => setLoading(false));
  }, [fetchPanelCompanies, fetchPanelEmployees]);

  const companyEmps = panelEmployees.filter(e => e.companyId === Number(companyId) && e.status === 'active');
  const selEmp = panelEmployees.find(e => e.id === Number(employeeId));
  const deps = selEmp?.dependents || [];

  function handleConfirm() {
    if (!companyId) return toast.error('Select a company');
    if (!employeeId) return toast.error('Select an employee');
    const dep = dependentIdx !== '' ? deps[Number(dependentIdx)] : null;
    onSelect({
      panelCompanyId:   Number(companyId),
      panelEmployeeId:  Number(employeeId),
      panelDependentId: dep?.id || null,
      patientName:      dep ? `${dep.title} ${dep.name}` : `${selEmp.title} ${selEmp.name}`,
      panelLabel:       `${panelCompanies.find(c => c.id === Number(companyId))?.code} / ${selEmp.empCode}${dep ? ` / ${dep.code}` : ''}`,
    });
  }

  return (
    <div className="ant-modal-overlay" onMouseDown={onClose}>
      <div className="ant-modal ant-modal--panel" onMouseDown={e => e.stopPropagation()}>
        <div className="ant-modal-header">
          <div className="ant-modal-title"><Building2 size={16}/> Select Panel</div>
          <button className="ant-modal-close" onClick={onClose}><X size={16}/></button>
        </div>
        {loading ? <div className="ant-modal-empty" style={{ padding: '2rem' }}>Loading...</div> : (
          <div className="ant-panel-body">
            <div className="ant-panel-field">
              <label>Company</label>
              <SearchableSelect
                options={panelCompanies.filter(c => c.status === 'active')}
                value={companyId}
                onChange={val => { setCompanyId(val); setEmployeeId(''); setDependentIdx(''); }}
                placeholder="— Select Company —"
                getLabel={c => `${c.code} — ${c.name}`}
                getKey={c => c.id}
              />
            </div>
            <div className="ant-panel-field">
              <label>Employee</label>
              <SearchableSelect
                options={companyEmps}
                value={employeeId}
                onChange={val => { setEmployeeId(val); setDependentIdx(''); }}
                placeholder={companyId ? '— Select Employee —' : '— Select Company First —'}
                getLabel={e => `${e.empCode} — ${e.title} ${e.name}`}
                getKey={e => e.id}
                disabled={!companyId}
              />
            </div>
            {selEmp && deps.length > 0 && (
              <div className="ant-panel-field">
                <label>Dependent (optional)</label>
                <select value={dependentIdx} onChange={e => setDependentIdx(e.target.value)}>
                  <option value="">— Employee (self) —</option>
                  {deps.map((d, i) => <option key={i} value={i}>{d.code} — {d.title} {d.name} ({d.relation})</option>)}
                </select>
              </div>
            )}
            <div className="ant-panel-actions">
              <button className="ant-btn-cancel" onClick={onClose}>Cancel</button>
              <button className="ant-btn-confirm" onClick={handleConfirm}>Confirm</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admission Lookup Modal — active/admitted patients only ────────────────────
function AdmissionLookupModal({ onSelect, onClose, searchAdmissionsForAdjustment }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    searchAdmissionsForAdjustment('')
      .then((data) => setRows(data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [searchAdmissionsForAdjustment]);

  function handleQueryChange(val) {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      searchAdmissionsForAdjustment(val)
        .then((data) => setRows(data || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 300);
  }

  return (
    <div className="aa-overlay">
      <div className="aa-modal">
        <div className="aa-modal-hdr">
          <span>Select Admitted Patient</span>
          <button className="aa-modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="aa-modal-search">
          <Search size={13} className="aa-modal-search-icon" />
          <input
            autoFocus
            className="aa-modal-search-input"
            placeholder="Search Admission # or Patient Name…"
            value={q}
            onChange={e => handleQueryChange(e.target.value)}
          />
        </div>
        <div className="aa-modal-body">
          {loading ? (
            <div className="aa-modal-loading">Loading…</div>
          ) : (
            <table className="aa-modal-tbl">
              <thead>
                <tr>
                  <th>Admission #</th>
                  <th>Patient</th>
                  <th>Admission Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} onClick={() => onSelect(r)}>
                    <td>{r.admissionNo}</td>
                    <td>{r.patientName}</td>
                    <td>{fmtDateTime(r.createdAt)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={3} className="aa-td-empty">Koi admit patient nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const TITLES = ['Mr', 'Ms', 'Mrs', 'Master', 'Baby'];
const CATEGORIES = [
  { value: 'staff',         label: 'Staff' },
  { value: 'panel',         label: 'Panel' },
  { value: 'complementary', label: 'Compl.' },
  { value: 'private',       label: 'Private' },
  { value: 'cc',            label: 'CC' },
];

const EMPTY = {
  serialNo: '',
  admissionNo: '',
  mrNo: '',
  arrivedSlipNo: '',
  patientTitle: 'Mr',
  patientCategory: 'private',
  patientName: '',
  ageYears: '',
  ageMonths: '',
  ageDays: '',
  gender: 'male',
  address: '',
  phoneNo: '',
  arrivedUnderRmo: '',
  consultantId: '',
  referredBy: '',
  authorityLetter: false,
  responsibleParty: '',
  previousAdmission: '',
  advancePayment: '',
  roomCategoryId: '',
  bedId: '',
  surgery: false,
  surgeryTypeId: '',
  referralPatient: 'no',
  referralNote: '',
  antenatal: false,
  antenatalNo: '',
  panelLabel: '',
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdmissionAdjustment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    doctors, fetchDoctors,
    roomCategories, fetchRoomCategories,
    surgeryTypes, fetchSurgeryTypes,
    searchEmployees,
    fetchAvailableBeds,
    searchAdmissionsForAdjustment,
    fetchAdmissionForAdjustment,
    updateAdmissionAdjustment,
    panelCompanies, panelEmployees, fetchPanelCompanies, fetchPanelEmployees,
  } = useClinicStore();

  useEffect(() => { fetchPanelCompanies(); fetchPanelEmployees(); }, [fetchPanelCompanies, fetchPanelEmployees]);

  const [admissionId, setAdmissionId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [availableBeds, setAvailableBeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLookup, setShowLookup] = useState(true);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showPanelModal, setShowPanelModal] = useState(false);

  useEffect(() => {
    fetchDoctors();
    fetchRoomCategories();
    fetchSurgeryTypes();
  }, [fetchDoctors, fetchRoomCategories, fetchSurgeryTypes]);

  // Deep-link from Bed parameter page (or anywhere else): ?admissionNo=... skips
  // the lookup and jumps straight to this admission's adjustment screen.
  useEffect(() => {
    const admissionNo = searchParams.get('admissionNo');
    if (!admissionNo) return;
    (async () => {
      try {
        const rows = await searchAdmissionsForAdjustment(admissionNo);
        const match = rows.find(r => r.admissionNo === admissionNo) || rows[0];
        if (match) await handleSelect(match);
      } catch { /* deep-link is best-effort */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleSelect(row) {
    setLoading(true);
    setShowLookup(false);
    try {
      const rec = await fetchAdmissionForAdjustment(row.id);
      setAdmissionId(rec.id);
      setForm({
        serialNo:          rec.serialNo || '',
        admissionNo:       rec.admissionNo || '',
        mrNo:              rec.mrNo != null ? String(rec.mrNo) : '',
        arrivedSlipNo:     rec.arrivedSlipNo || '',
        patientTitle:      rec.patientTitle || 'Mr',
        patientCategory:   rec.patientCategory || 'private',
        patientName:       rec.patientName || '',
        ageYears:          rec.ageYears != null ? String(rec.ageYears) : '',
        ageMonths:         rec.ageMonths != null ? String(rec.ageMonths) : '',
        ageDays:           rec.ageDays != null ? String(rec.ageDays) : '',
        gender:            rec.gender || 'male',
        address:           rec.address || '',
        phoneNo:           rec.phoneNo || '',
        arrivedUnderRmo:   rec.arrivedUnderRmo || '',
        consultantId:      rec.consultantId != null ? String(rec.consultantId) : '',
        referredBy:        rec.referredBy || '',
        authorityLetter:   !!rec.authorityLetter,
        responsibleParty:  rec.responsibleParty || '',
        previousAdmission: rec.previousAdmission || '',
        advancePayment:    rec.advancePayment != null ? String(rec.advancePayment) : '',
        roomCategoryId:    rec.roomCategoryId != null ? String(rec.roomCategoryId) : '',
        bedId:             rec.bedId != null ? String(rec.bedId) : '',
        surgery:           !!rec.surgery,
        surgeryTypeId:     rec.surgeryTypeId != null ? String(rec.surgeryTypeId) : '',
        referralPatient:   rec.referralPatient ? 'yes' : 'no',
        referralNote:      rec.referralNote || '',
        antenatal:         !!rec.antenatal,
        antenatalNo:       rec.antenatalNo || '',
        panelCompanyId:    rec.panelCompanyId || null,
        panelEmployeeId:   rec.panelEmployeeId || null,
        panelDependentId:  rec.panelDependentId || null,
        panelLabel:        resolvePanelLabel(rec.panelCompanyId, rec.panelEmployeeId, panelCompanies, panelEmployees),
      });
      if (rec.roomCategoryId) {
        try { setAvailableBeds(await fetchAvailableBeds(rec.roomCategoryId, rec.id)); } catch { setAvailableBeds([]); }
      } else {
        setAvailableBeds([]);
      }
    } catch (e) {
      toast.error(e.message || 'Admission load nahi hui');
      setShowLookup(true);
    } finally {
      setLoading(false);
    }
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleCategoryChange(v) {
    if (v === 'staff') {
      setForm(f => ({ ...f, patientCategory: v, panelCompanyId: null, panelEmployeeId: null, panelDependentId: null, panelLabel: '' }));
      setShowEmpModal(true);
    } else if (v === 'panel') {
      setForm(f => ({ ...f, patientCategory: v, employeeId: null }));
      setShowPanelModal(true);
    } else {
      setForm(f => ({ ...f, patientCategory: v, employeeId: null, panelCompanyId: null, panelEmployeeId: null, panelDependentId: null, panelLabel: '' }));
    }
  }

  function handleEmpSelect({ emp, dependent }) {
    const patientName = dependent ? dependent.name : fullName(emp);
    setForm(f => ({ ...f, employeeId: emp.id, patientName, phoneNo: emp.phone || f.phoneNo }));
    setShowEmpModal(false);
  }

  function handlePanelSelect({ panelCompanyId, panelEmployeeId, panelDependentId, patientName, panelLabel }) {
    setForm(f => ({ ...f, panelCompanyId, panelEmployeeId, panelDependentId, patientName, panelLabel }));
    setShowPanelModal(false);
  }

  async function handleRoomChange(roomCategoryId) {
    setForm(f => ({ ...f, roomCategoryId, bedId: '' }));
    if (!roomCategoryId) { setAvailableBeds([]); return; }
    try {
      const beds = await fetchAvailableBeds(roomCategoryId, admissionId);
      setAvailableBeds(beds);
    } catch {
      setAvailableBeds([]);
    }
  }

  function resetToLookup() {
    setAdmissionId(null);
    setForm(EMPTY);
    setAvailableBeds([]);
    setShowLookup(true);
  }

  async function handleSave() {
    if (!form.admissionNo.trim()) return toast.error('Admission # is required');
    if (!form.patientName.trim()) return toast.error('Patient Name is required');
    setSaving(true);
    try {
      const updated = await updateAdmissionAdjustment(admissionId, { ...form, referralPatient: form.referralPatient === 'yes' });
      toast.success('Admission updated');
      setForm(f => ({ ...f, advancePayment: updated.advancePayment != null ? String(updated.advancePayment) : f.advancePayment }));
    } catch (err) {
      toast.error(err.message || 'Failed to update admission');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {showLookup && (
        <AdmissionLookupModal
          onSelect={handleSelect}
          onClose={() => navigate(-1)}
          searchAdmissionsForAdjustment={searchAdmissionsForAdjustment}
        />
      )}
      {showEmpModal && (
        <EmployeeModal searchEmployees={searchEmployees} onSelect={handleEmpSelect} onClose={() => setShowEmpModal(false)} />
      )}
      {showPanelModal && (
        <PanelModal onSelect={handlePanelSelect} onClose={() => setShowPanelModal(false)} />
      )}

      <div className="adm-page">
        <ClinicMenuBar />

        <div className="aa-toolbar">
          <div className="aa-toolbar-icons">
            <span className="aa-tbtn aa-tbtn--disabled"><Save size={16} /></span>
            <span className="aa-tbtn aa-tbtn--disabled"><Copy size={16} /></span>
            <span className="aa-tbtn aa-tbtn--disabled"><RotateCcw size={16} /></span>
            <button className="aa-tbtn aa-tbtn--exit" onClick={() => navigate(-1)} title="Exit">
              <DoorOpen size={16} />
            </button>
            <span className="aa-tbtn aa-tbtn--disabled"><FileText size={16} /></span>
            <span className="aa-tbtn aa-tbtn--disabled"><Printer size={16} /></span>
          </div>
          <span className="aa-toolbar-title">Admission Adjustment</span>
        </div>

        {loading && <div className="aa-loading">Loading…</div>}

        {!loading && admissionId && (
          <div className="adm-body">
            <div className="adm-form">

              {/* ── Section: Identification ── */}
              <div className="adm-section">
                <h3 className="adm-section-title">Identification</h3>

                <div className="adm-row">
                  <div className="adm-field">
                    <label>Serial #</label>
                    <input type="text" value={form.serialNo} onChange={e => set('serialNo', e.target.value)} />
                  </div>
                  <div className="adm-field">
                    <label>Admission #</label>
                    <input type="text" value={form.admissionNo} onChange={e => set('admissionNo', e.target.value)} />
                  </div>
                </div>

                <div className="adm-row">
                  <div className="adm-field">
                    <label>MR #</label>
                    <input type="text" value={form.mrNo} onChange={e => set('mrNo', e.target.value)} placeholder="MR number" />
                  </div>
                  <div className="adm-field">
                    <label>Arrived Slip #</label>
                    <input type="text" value={form.arrivedSlipNo} onChange={e => set('arrivedSlipNo', e.target.value)} placeholder="OPD or Patients List serial number" />
                  </div>
                </div>

                <div className="adm-row">
                  <div className="adm-field adm-field--antenatal">
                    <label className="adm-check-label">
                      <input
                        type="checkbox"
                        checked={form.antenatal}
                        onChange={e => set('antenatal', e.target.checked)}
                      />
                      Antenatal #
                    </label>
                    {form.antenatal && (
                      <input
                        type="text"
                        value={form.antenatalNo}
                        onChange={e => set('antenatalNo', e.target.value)}
                        placeholder="Antenatal number"
                        className="adm-antenatal-input"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* ── Section: Patient & Admission Details ── */}
              <div className="adm-section">
                <h3 className="adm-section-title">Patient &amp; Admission Details</h3>

                <div className="adm-row adm-row--category">
                  <label className="adm-category-label">Patient Category</label>
                  <div className="adm-radio-group">
                    {CATEGORIES.map(c => (
                      <label key={c.value} className={`adm-radio-btn ${form.patientCategory === c.value ? 'adm-radio-btn--active' : ''}`}>
                        <input
                          type="radio"
                          name="patientCategory"
                          value={c.value}
                          checked={form.patientCategory === c.value}
                          onChange={() => handleCategoryChange(c.value)}
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                  {form.panelLabel && (
                    <span className="adm-panel-badge">{form.panelLabel}</span>
                  )}
                </div>

                <div className="adm-row">
                  <div className="adm-field adm-field--name">
                    <label>Patient Name</label>
                    <div className="adm-name-row">
                      <select
                        value={form.patientTitle}
                        onChange={e => set('patientTitle', e.target.value)}
                        className="adm-title-select"
                      >
                        {TITLES.map(t => <option key={t} value={t}>{t}.</option>)}
                      </select>
                      <input
                        type="text"
                        value={form.patientName}
                        onChange={e => set('patientName', e.target.value)}
                        placeholder="Full name"
                        className="adm-name-input"
                      />
                    </div>
                  </div>
                  <div className="adm-field">
                    <label>Ward (Room Category)</label>
                    <select value={form.roomCategoryId} onChange={e => handleRoomChange(e.target.value)}>
                      <option value="">— Select Ward —</option>
                      {roomCategories.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="adm-row">
                  <div className="adm-field">
                    <label>Age</label>
                    <div className="adm-age-row">
                      <input type="number" min="0" value={form.ageYears}  onChange={e => set('ageYears',  e.target.value)} placeholder="Yrs" />
                      <span>Yr</span>
                      <input type="number" min="0" value={form.ageMonths} onChange={e => set('ageMonths', e.target.value)} placeholder="Mo" />
                      <span>Mo</span>
                      <input type="number" min="0" value={form.ageDays}   onChange={e => set('ageDays',   e.target.value)} placeholder="D" />
                      <span>Days</span>
                    </div>
                  </div>
                  <div className="adm-field">
                    <label>Bed #</label>
                    <select value={form.bedId} onChange={e => set('bedId', e.target.value)} disabled={!form.roomCategoryId}>
                      <option value="">— Select Bed —</option>
                      {availableBeds.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    {form.roomCategoryId && availableBeds.length === 0 && (
                      <span className="adm-no-beds">No available beds</span>
                    )}
                  </div>
                </div>

                <div className="adm-row">
                  <div className="adm-field">
                    <label>Address</label>
                    <textarea
                      value={form.address}
                      onChange={e => set('address', e.target.value)}
                      rows={3}
                      placeholder="Patient address"
                    />
                  </div>
                  <div className="adm-field adm-field--right-col">
                    <div className="adm-field">
                      <label>Sex</label>
                      <div className="adm-radio-group">
                        <label className={`adm-radio-btn ${form.gender === 'male' ? 'adm-radio-btn--active' : ''}`}>
                          <input type="radio" name="gender" value="male" checked={form.gender === 'male'} onChange={() => set('gender', 'male')} />
                          Male
                        </label>
                        <label className={`adm-radio-btn ${form.gender === 'female' ? 'adm-radio-btn--active' : ''}`}>
                          <input type="radio" name="gender" value="female" checked={form.gender === 'female'} onChange={() => set('gender', 'female')} />
                          Female
                        </label>
                      </div>
                    </div>
                    <div className="adm-field">
                      <label>Phone #</label>
                      <input type="text" value={form.phoneNo} onChange={e => set('phoneNo', e.target.value)} placeholder="Phone number" />
                    </div>
                    <div className="adm-field">
                      <label>Consultant</label>
                      <SearchableSelect
                        options={doctors.filter(d => d.status === 'active')}
                        value={form.consultantId}
                        onChange={val => set('consultantId', val)}
                        placeholder="— Select Consultant —"
                        getLabel={d => d.name}
                        getKey={d => d.id}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Section: Referral & Care Team ── */}
              <div className="adm-section">
                <h3 className="adm-section-title">Referral &amp; Care Team</h3>

                <div className="adm-row">
                  <div className="adm-field">
                    <label>Arrived under RMO</label>
                    <input type="text" value={form.arrivedUnderRmo} onChange={e => set('arrivedUnderRmo', e.target.value)} placeholder="NA - Not Applicable" />
                  </div>
                  <div className="adm-field">
                    <label>Referred By</label>
                    <input type="text" value={form.referredBy} onChange={e => set('referredBy', e.target.value)} placeholder="Referral source" />
                  </div>
                </div>
              </div>

              {/* ── Section: Billing & Authorization ── */}
              <div className="adm-section">
                <h3 className="adm-section-title">Billing &amp; Authorization</h3>

                <div className="adm-row">
                  <div className="adm-field">
                    <label>Responsible Party</label>
                    <input type="text" value={form.responsibleParty} onChange={e => set('responsibleParty', e.target.value)} placeholder="Responsible person" />
                  </div>
                  <div className="adm-field adm-field--check-inline">
                    <label className="adm-check-label">
                      <input type="checkbox" checked={form.authorityLetter} onChange={e => set('authorityLetter', e.target.checked)} />
                      Authority Letter
                    </label>
                  </div>
                </div>

                <div className="adm-row">
                  <div className="adm-field">
                    <label>Previous Admission</label>
                    <input type="text" value={form.previousAdmission} onChange={e => set('previousAdmission', e.target.value)} placeholder="Previous admission #" />
                  </div>
                  <div className="adm-field">
                    <label>Advance Payment</label>
                    <input type="number" value={form.advancePayment} readOnly disabled className="aa-locked-input" title="Advance Payment is not editable here" />
                    <span className="aa-locked-note">Yahan edit nahi ho sakti</span>
                  </div>
                </div>
              </div>

              {/* ── Section: Additional Flags ── */}
              <div className="adm-section adm-section--last">
                <h3 className="adm-section-title">Additional Flags</h3>

                <div className="adm-row adm-row--flags">
                  <label className={`adm-flag-btn ${form.surgery ? 'adm-flag-btn--active' : ''}`}>
                    <input type="checkbox" checked={form.surgery} onChange={e => set('surgery', e.target.checked)} />
                    Surgery
                  </label>
                  {form.surgery && (
                    <select
                      value={form.surgeryTypeId}
                      onChange={e => set('surgeryTypeId', e.target.value)}
                      className="adm-surgery-select"
                    >
                      <option value="">— Select Surgery Type —</option>
                      {surgeryTypes.map(s => (
                        <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                      ))}
                    </select>
                  )}
                  <div className="adm-referral-group">
                    <span className="adm-referral-label">Referral Patient</span>
                    <label className={`adm-radio-btn ${form.referralPatient === 'yes' ? 'adm-radio-btn--active' : ''}`}>
                      <input type="radio" name="referralPatient" value="yes" checked={form.referralPatient === 'yes'} onChange={() => set('referralPatient', 'yes')} />
                      Yes
                    </label>
                    <label className={`adm-radio-btn ${form.referralPatient === 'no' ? 'adm-radio-btn--active' : ''}`}>
                      <input type="radio" name="referralPatient" value="no" checked={form.referralPatient === 'no'} onChange={() => set('referralPatient', 'no')} />
                      No
                    </label>
                    {form.referralPatient === 'yes' && (
                      <input
                        type="text"
                        className="adm-referral-input"
                        value={form.referralNote}
                        onChange={e => set('referralNote', e.target.value)}
                        placeholder="Referred by (name / hospital)"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="adm-actions">
                <button className="adm-btn adm-btn--save" onClick={handleSave} disabled={saving}>
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="adm-btn" onClick={resetToLookup} disabled={saving}>
                  Select Another Admission
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
