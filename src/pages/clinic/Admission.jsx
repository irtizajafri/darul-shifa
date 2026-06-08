import { useState, useEffect, useRef, useCallback } from 'react';
import { Printer, Save, Search, X, User, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import './Admission.scss';
import './Antenatal.scss';

function fullName(emp) {
  return [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
}

// ── Employee Modal ─────────────────────────────────────────────────────────────
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

// ── Panel Modal ────────────────────────────────────────────────────────────────
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
              <select value={companyId} onChange={e => { setCompanyId(e.target.value); setEmployeeId(''); setDependentIdx(''); }}>
                <option value="">— Select Company —</option>
                {panelCompanies.filter(c => c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div className="ant-panel-field">
              <label>Employee</label>
              <select value={employeeId} onChange={e => { setEmployeeId(e.target.value); setDependentIdx(''); }} disabled={!companyId}>
                <option value="">— Select Employee —</option>
                {companyEmps.map(e => <option key={e.id} value={e.id}>{e.empCode} — {e.title} {e.name}</option>)}
              </select>
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

// ── Constants ──────────────────────────────────────────────────────────────────
const TITLES = ['Mr', 'Ms', 'Mrs', 'Master', 'Baby'];
const CATEGORIES = [
  { value: 'staff',         label: 'Staff' },
  { value: 'panel',         label: 'Panel' },
  { value: 'complementary', label: 'Compl.' },
  { value: 'private',       label: 'Private' },
  { value: 'cc',            label: 'CC' },
];

const EMPTY = {
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
  employeeId: null,
  panelCompanyId: null,
  panelEmployeeId: null,
  panelDependentId: null,
  panelLabel: '',
};

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Admission() {
  const {
    doctors, fetchDoctors,
    roomCategories, fetchRoomCategories,
    surgeryTypes, fetchSurgeryTypes,
    searchEmployees,
    fetchOpdPatientByMrNo,
    fetchOpdVisitBySerial,
    fetchAvailableBeds,
    createAdmission,
  } = useClinicStore();

  const [form, setForm] = useState(EMPTY);
  const [availableBeds, setAvailableBeds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showPanelModal, setShowPanelModal] = useState(false);
  const mrRef = useRef(null);

  useEffect(() => {
    fetchDoctors();
    fetchRoomCategories();
    fetchSurgeryTypes();
    mrRef.current?.focus();
  }, [fetchDoctors, fetchRoomCategories, fetchSurgeryTypes]);

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

  async function handleMrLookup() {
    const mrNo = form.mrNo?.trim();
    if (!mrNo) return;
    try {
      const rec = await fetchOpdPatientByMrNo(mrNo);
      setForm(f => ({
        ...f,
        arrivedSlipNo:    rec.serialNo       || f.arrivedSlipNo,
        patientName:      rec.patientName    || f.patientName,
        ageYears:         rec.age != null       ? String(rec.age)       : f.ageYears,
        ageMonths:        rec.ageMonths != null  ? String(rec.ageMonths) : f.ageMonths,
        ageDays:          rec.ageDays != null    ? String(rec.ageDays)   : f.ageDays,
        gender:           rec.gender         || f.gender,
        phoneNo:          rec.phoneNo        || f.phoneNo,
        referredBy:       rec.referredBy     || f.referredBy,
        patientCategory:  rec.patientCategory || f.patientCategory,
        employeeId:       rec.employeeId     || f.employeeId,
        panelCompanyId:   rec.panelCompanyId  || f.panelCompanyId,
        panelEmployeeId:  rec.panelEmployeeId || f.panelEmployeeId,
        panelDependentId: rec.panelDependentId || f.panelDependentId,
        panelLabel:       rec.panelLabel      || f.panelLabel,
      }));
    } catch {
      toast.error('No patient found with this MR number');
    }
  }

  async function handleSlipLookup() {
    const slip = form.arrivedSlipNo?.trim();
    if (!slip) return;
    try {
      const rec = await fetchOpdVisitBySerial(slip);
      setForm(f => ({
        ...f,
        mrNo:             rec.mrNo != null ? String(rec.mrNo) : f.mrNo,
        patientName:      rec.patientName   || f.patientName,
        ageYears:         rec.age != null       ? String(rec.age)       : f.ageYears,
        ageMonths:        rec.ageMonths != null  ? String(rec.ageMonths) : f.ageMonths,
        ageDays:          rec.ageDays != null    ? String(rec.ageDays)   : f.ageDays,
        gender:           rec.gender        || f.gender,
        phoneNo:          rec.phoneNo       || f.phoneNo,
        referredBy:       rec.referredBy    || f.referredBy,
        patientCategory:  rec.patientCategory || f.patientCategory,
        employeeId:       rec.employeeId     || f.employeeId,
        panelCompanyId:   rec.panelCompanyId  || f.panelCompanyId,
        panelEmployeeId:  rec.panelEmployeeId || f.panelEmployeeId,
        panelDependentId: rec.panelDependentId || f.panelDependentId,
        panelLabel:       rec.panelLabel      || f.panelLabel,
      }));
    } catch {
      toast.error('No OPD visit found with this slip number');
    }
  }

  async function handleRoomChange(roomCategoryId) {
    setForm(f => ({ ...f, roomCategoryId, bedId: '' }));
    if (!roomCategoryId) { setAvailableBeds([]); return; }
    try {
      const beds = await fetchAvailableBeds(roomCategoryId);
      setAvailableBeds(beds);
    } catch {
      setAvailableBeds([]);
    }
  }

  async function handleSave() {
    if (!form.admissionNo.trim()) return toast.error('Admission # is required');
    if (!form.patientName.trim()) return toast.error('Patient Name is required');
    setSaving(true);
    try {
      await createAdmission({ ...form, referralPatient: form.referralPatient === 'yes' });
      toast.success('Admission saved successfully');
      setForm(EMPTY);
      setAvailableBeds([]);
    } catch (err) {
      toast.error(err.message || 'Failed to save admission');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {showEmpModal && (
        <EmployeeModal searchEmployees={searchEmployees} onSelect={handleEmpSelect} onClose={() => setShowEmpModal(false)} />
      )}
      {showPanelModal && (
        <PanelModal onSelect={handlePanelSelect} onClose={() => setShowPanelModal(false)} />
      )}

      <div className="adm-page">
        <ClinicMenuBar />

        <div className="adm-body">
          <div className="adm-header-bar">
            <span className="adm-title">Admission</span>
          </div>

          <div className="adm-form">
            {/* Row 1 — Admission # + MR # */}
            <div className="adm-row">
              <div className="adm-field">
                <label>Admission #</label>
                <input
                  type="text"
                  value={form.admissionNo}
                  onChange={e => set('admissionNo', e.target.value)}
                  placeholder="e.g. 173380"
                />
              </div>
              <div className="adm-field">
                <label>MR #</label>
                <div className="adm-lookup-row">
                  <input
                    ref={mrRef}
                    type="text"
                    value={form.mrNo}
                    onChange={e => set('mrNo', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleMrLookup()}
                    placeholder="Enter MR number"
                  />
                  <button className="adm-lookup-btn" onClick={handleMrLookup} title="Lookup">↵</button>
                </div>
              </div>
            </div>

            {/* Row 2 — Arrived Slip # + Antenatal */}
            <div className="adm-row">
              <div className="adm-field">
                <label>Arrived Slip #</label>
                <div className="adm-lookup-row">
                  <input
                    type="text"
                    value={form.arrivedSlipNo}
                    onChange={e => set('arrivedSlipNo', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSlipLookup()}
                    placeholder="OPD serial number"
                  />
                  <button className="adm-lookup-btn" onClick={handleSlipLookup} title="Lookup">↵</button>
                </div>
              </div>
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

            {/* Patient Category */}
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

            {/* Row 3 — Patient Name + Ward */}
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

            {/* Row 4 — Age + Bed */}
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

            {/* Row 5 — Address + right col */}
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
                  <select value={form.consultantId} onChange={e => set('consultantId', e.target.value)}>
                    <option value="">— Select Consultant —</option>
                    {doctors.filter(d =>
                      d.status === 'active' &&
                      d.subDepts?.some(s =>
                        s.subDept?.department?.name?.toLowerCase().includes('consultant')
                      )
                    ).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 6 — RMO + Referred By */}
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

            {/* Row 7 — Responsible Party + Authority Letter */}
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

            {/* Row 8 — Previous Admission + Advance Payment */}
            <div className="adm-row">
              <div className="adm-field">
                <label>Previous Admission</label>
                <input type="text" value={form.previousAdmission} onChange={e => set('previousAdmission', e.target.value)} placeholder="Previous admission #" />
              </div>
              <div className="adm-field">
                <label>Advance Payment</label>
                <input type="number" min="0" value={form.advancePayment} onChange={e => set('advancePayment', e.target.value)} placeholder="0.00" />
              </div>
            </div>

            {/* Row 9 — Surgery + Referral Patient */}
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

            {/* Actions */}
            <div className="adm-actions">
              <button className="adm-btn adm-btn--print" onClick={() => toast('Print feature coming soon')}>
                <Printer size={16} />
                Print Form
              </button>
              <button className="adm-btn adm-btn--save" onClick={handleSave} disabled={saving}>
                <Save size={16} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
