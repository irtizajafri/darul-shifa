import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, User, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import './Antenatal.scss';

function fullName(emp) {
  return [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
}
function formatDob(val) {
  if (!val) return '';
  try { return new Date(val).toISOString().slice(0, 10); } catch { return ''; }
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
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
      panelCompanyId: Number(companyId),
      panelEmployeeId: Number(employeeId),
      panelDependentId: dep?.id || null,
      patientName: dep ? `${dep.title} ${dep.name}` : `${selEmp.title} ${selEmp.name}`,
      panelLabel: `${panelCompanies.find(c => c.id === Number(companyId))?.code} / ${selEmp.empCode}${dep ? ` / ${dep.code}` : ''}`,
      dob: dep ? formatDob(dep.dob) : formatDob(selEmp.dob),
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

// ── Main Page ──────────────────────────────────────────────────────────────────
const EMPTY = {
  mrNo: '',
  antenatalNo: '',
  registrationDate: todayStr(),
  patientCategory: 'private',
  paymentMethod: 'private',
  patientName: '',
  age: '',
  husbandName: '',
  phoneNo: '',
  address: '',
  lmpDate: '',
  edd: '',
  underTreatmentId: '',
  para: '',
  gravidia: '',
  amount: '',
  employeeId: null,
  panelCompanyId: null, panelEmployeeId: null, panelDependentId: null,
  panelLabel: '',
};

export default function Antenatal() {
  const { doctors, fetchDoctors, searchEmployees, createAntenatal, fetchOpdPatientByMrNo } = useClinicStore();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showPanelModal, setShowPanelModal] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    if (doctors.length === 0) fetchDoctors().catch(() => {});
  }, []);

  // Filter gynecology doctors
  const gynaeDoctors = doctors.filter(d =>
    d.status === 'active' &&
    d.subDepts?.some(s =>
      s.subDept?.department?.name?.toLowerCase().includes('gyn')
    )
  );

  const isComplementary = form.patientCategory === 'complementary';
  const paymentMethodDisabled = form.patientCategory === 'panel' || isComplementary;

  async function handleMrLookup() {
    const mrNo = form.mrNo?.trim();
    if (!mrNo) return;
    try {
      const rec = await fetchOpdPatientByMrNo(mrNo);
      setForm(f => ({
        ...f,
        patientName: rec.patientName || f.patientName,
        age: rec.age != null ? String(rec.age) : f.age,
        phoneNo: rec.phoneNo || f.phoneNo,
      }));
    } catch {
      toast.error('No patient found with this MR number');
    }
  }

  function handleCategoryChange(v) {
    if (v === 'staff') {
      setForm(f => ({ ...f, patientCategory: v, panelCompanyId: null, panelEmployeeId: null, panelDependentId: null, panelLabel: '' }));
      setShowEmpModal(true);
    } else if (v === 'panel') {
      setForm(f => ({ ...f, patientCategory: v, employeeId: null }));
      setShowPanelModal(true);
    } else {
      setForm(f => ({ ...f, patientCategory: v, employeeId: null, panelCompanyId: null, panelEmployeeId: null, panelDependentId: null, panelLabel: '', patientName: v === 'private' ? '' : f.patientName }));
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

  async function handleSave() {
    if (!form.patientName.trim()) { toast.error('Patient Name is required'); return; }
    setSaving(true);
    try {
      const paymentType = form.patientCategory === 'panel' ? 'panel'
        : form.patientCategory === 'complementary' ? 'complementary'
        : form.patientCategory === 'staff' ? 'staff'
        : 'private';
      await createAntenatal({ ...form, paymentType, mrNo: form.mrNo || '' });
      toast.success('Antenatal registration saved');
      setForm({ ...EMPTY, registrationDate: todayStr() });
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally { setSaving(false); }
  }

  return (
    <>
      {showEmpModal && (
        <EmployeeModal searchEmployees={searchEmployees} onSelect={handleEmpSelect} onClose={() => setShowEmpModal(false)} />
      )}
      {showPanelModal && (
        <PanelModal onSelect={handlePanelSelect} onClose={() => setShowPanelModal(false)} />
      )}

      <div className="ant">
        {/* Header */}
        <div className="ant-header">
          <div className="ant-header-left">
            <span className="ant-lbl">MR #</span>
            <input
              className="ant-inp ant-inp--no"
              value={form.mrNo}
              onChange={e => set('mrNo', e.target.value)}
              onBlur={handleMrLookup}
              onKeyDown={e => e.key === 'Enter' && handleMrLookup()}
              placeholder="Enter MR number"
            />
            <span className="ant-lbl" style={{ marginLeft: '1rem' }}>Antenatal #</span>
            <input className="ant-inp ant-inp--no" value={form.antenatalNo} onChange={e => set('antenatalNo', e.target.value)} placeholder="e.g. 2026/00250/6129" />
            <span className="ant-lbl" style={{ marginLeft: '1rem' }}>Date</span>
            <input className="ant-inp ant-inp--date" type="date" value={form.registrationDate} onChange={e => set('registrationDate', e.target.value)} />
          </div>
          <div className="ant-title">Antenatal Registration</div>
        </div>

        {/* Payment type row */}
        <div className="ant-pay-row">
          {[['staff','Staff'],['panel','Panel'],['complementary','Complementary'],['private','Private']].map(([v,l]) => (
            <label key={v} className="ant-radio-lbl">
              <input type="radio" name="patientCategory" value={v} checked={form.patientCategory === v} onChange={() => handleCategoryChange(v)} />
              {l}
            </label>
          ))}

          {form.patientCategory === 'staff' && (
            <button className="ant-change-btn" onClick={() => setShowEmpModal(true)}>
              <Search size={13} /> Change
            </button>
          )}
          {form.patientCategory === 'panel' && (
            <button className="ant-change-btn" onClick={() => setShowPanelModal(true)}>
              <Search size={13} /> Change
            </button>
          )}
          {form.patientCategory === 'panel' && form.panelLabel && (
            <span className="ant-panel-badge">{form.panelLabel}</span>
          )}
        </div>

        {/* Main form grid */}
        <div className="ant-form">
          {/* Left column */}
          <div className="ant-col">
            <div className="ant-field">
              <label>Patient Name</label>
              <input
                className="ant-inp"
                value={form.patientName}
                onChange={e => set('patientName', e.target.value)}
                readOnly={form.patientCategory === 'staff' || form.patientCategory === 'panel'}
                placeholder={form.patientCategory === 'staff' ? 'Select employee…' : form.patientCategory === 'panel' ? 'Select panel…' : ''}
              />
            </div>
            <div className="ant-field">
              <label>Husband Name</label>
              <input className="ant-inp" value={form.husbandName} onChange={e => set('husbandName', e.target.value)} />
            </div>
            <div className="ant-field ant-field--address">
              <label>Address</label>
              <textarea className="ant-textarea" value={form.address} onChange={e => set('address', e.target.value)} rows={3} />
            </div>
            <div className="ant-field">
              <label>Under Treatment</label>
              <select className="ant-inp ant-inp--sel" value={form.underTreatmentId} onChange={e => set('underTreatmentId', e.target.value)}>
                <option value="">— Select Doctor —</option>
                {gynaeDoctors.length === 0 && doctors.length > 0 && (
                  <option disabled>No Gynaecology doctors found</option>
                )}
                {gynaeDoctors.map(d => (
                  <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                ))}
              </select>
            </div>
            <div className="ant-inline-row">
              <div className="ant-field ant-field--sm">
                <label>Para</label>
                <input className="ant-inp ant-inp--sm" type="number" min={0} value={form.para} onChange={e => set('para', e.target.value)} />
              </div>
              <div className="ant-field ant-field--sm">
                <label>Gravidia</label>
                <input className="ant-inp ant-inp--sm" type="number" min={0} value={form.gravidia} onChange={e => set('gravidia', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="ant-col">
            <div className="ant-field">
              <label>Age</label>
              <input className="ant-inp ant-inp--sm" type="number" min={0} value={form.age} onChange={e => set('age', e.target.value)} />
            </div>
            <div className="ant-field">
              <label>Phone #</label>
              <input className="ant-inp" value={form.phoneNo} onChange={e => set('phoneNo', e.target.value)} />
            </div>
            <div className="ant-field">
              <label>LMP Date</label>
              <input className="ant-inp ant-inp--date" type="date" value={form.lmpDate} onChange={e => set('lmpDate', e.target.value)} />
            </div>
            <div className="ant-field">
              <label>EDD</label>
              <input className="ant-inp ant-inp--date" type="date" value={form.edd} onChange={e => set('edd', e.target.value)} />
            </div>
            <div className="ant-field">
              <label>Amount</label>
              <input className="ant-inp ant-inp--sm" type="number" min={0} value={form.amount} onChange={e => set('amount', e.target.value)} disabled={isComplementary} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="ant-footer">
          <button className="ant-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Add'}
          </button>
        </div>
      </div>
    </>
  );
}
