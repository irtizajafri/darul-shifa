import { useState, useEffect, useRef, useCallback } from 'react';
import { Printer, Search, X, User, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';
import { useClinicStore } from '../../store/useClinicStore';
import { buildReceiptHtml } from './receiptUtils';
import { buildThermalReceiptHtml } from './thermalReceiptUtils';
import { printClinicalRecordForm, ClinicalRecordPrintTemplate } from './ClinicalRecordForm';
import ECGReportForm from './ECGReportForm';
import { validatePhoneNo, validateAge } from './opdValidation';
import { useAuthStore } from '../../store/useAuthStore';
import { handleSlipKeys } from '../../utils/keyboardNav';
import './GeneralOPD.scss';

// Only these two departments (of the many GeneralOPD.jsx serves) also print the
// A4 Clinical Record Form after the slip — same form Consultant OPD uses.
const CRF_DEPTS = ['General OPD', 'Dental OPD'];

// Miscellaneous-only: collects Quantity and/or Price for an item flagged
// quantityEditable/priceEditable (set in Doctor Parameters > Sub Dept Info).
function MiscQtyPriceModal({ item, onConfirm, onClose }) {
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState(item.priceEditable ? '' : String(item.normalCharges || 0));

  function handleConfirm() {
    if (item.priceEditable && !(Number(price) > 0)) { toast.error('Rate daalo'); return; }
    if (item.quantityEditable && !(Number(quantity) > 0)) { toast.error('Quantity daalo'); return; }
    onConfirm({ quantity, price });
  }

  return (
    <div className="gopd-overlay">
      <div className="gopd-mr-confirm">
        <div className="gopd-mr-confirm-title">{item.subDept?.name}</div>
        <div className="gopd-mr-confirm-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {item.quantityEditable && (
            <div>
              <span className="gopd-total-lbl">Quantity</span>
              <input type="number" className="gopd-total-inp" min="1" autoFocus
                style={{ width: '100%' }}
                value={quantity} onChange={e => setQuantity(e.target.value)} />
            </div>
          )}
          {item.priceEditable ? (
            <div>
              <span className="gopd-total-lbl">Rate</span>
              <input type="number" className="gopd-total-inp" min="0" placeholder="0"
                style={{ width: '100%' }}
                autoFocus={!item.quantityEditable}
                value={price} onChange={e => setPrice(e.target.value)} />
            </div>
          ) : (
            <div>
              <span className="gopd-total-lbl">Rate</span>
              <div>{item.normalCharges || 0}</div>
            </div>
          )}
        </div>
        <div className="gopd-mr-confirm-actions">
          <button className="gopd-mr-confirm-btn gopd-mr-confirm-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="gopd-mr-confirm-btn gopd-mr-confirm-btn--use" onClick={handleConfirm}>Add</button>
        </div>
      </div>
    </div>
  );
}

// Normalize a sub-department name for matching (case/space/punctuation-insensitive) —
// the "E C G" item under Miscellaneous is stored with spaces between letters.
const normDeptName = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const PATIENT_TYPES = ['MAST', 'MR', 'MRS', 'MISS', 'MS', 'BABY', 'INFANT'];
// Admission form uses a different title vocabulary (Mr/Mrs/Ms/Master/Baby) —
// map it onto the OPD slip's patientType options when auto-filling from an
// admitted patient's record.
const ADMISSION_TITLE_MAP = { Mr: 'MR', Mrs: 'MRS', Ms: 'MS', Master: 'MAST', Baby: 'BABY' };
const DAY_MAP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function todayDay() { return DAY_MAP[new Date().getDay()]; }
function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}
function fullName(emp) {
  return [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
}
function formatDob(val) {
  if (!val) return '';
  try { return new Date(val).toISOString().slice(0, 10); } catch { return ''; }
}
function dobToAge(dobStr) {
  if (!dobStr) return { age: '', ageMonths: 0, ageDays: 0 };
  const today = new Date();
  const birth = new Date(dobStr);
  let years  = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth()    - birth.getMonth();
  let days   = today.getDate()     - birth.getDate();
  if (days < 0) {
    months--;
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) { years--; months += 12; }
  return { age: String(Math.max(0, years)), ageMonths: Math.max(0, months), ageDays: Math.max(0, days) };
}

const EMPTY = {
  mrNo: '', serialNo: '', patientType: 'MAST', patientName: '',
  admitPatient: false, admitNo: '', adjustPayment: false, antenatal: false, antenatalNo: 'NA',
  age: '', ageMonths: 0, ageDays: 0, dob: '', gender: 'male',
  phoneNo: '', referredBy: '',
  patientCategory: 'normal',
  paymentMethod: 'cash',
  visitType: 'opd', onCall: false,
  employeeId: null,
  panelCompanyId: null, panelEmployeeId: null, panelDependentId: null,
  panelLabel: '',
};

// ── Employee Select Modal ─────────────────────────────────────────────────────
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
      setSelectedEmp(emp);
      setDependentIdx('');
      setStep(2);
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
      <div className="gopd-modal-overlay" onMouseDown={onClose}>
        <div className="gopd-modal gopd-modal--panel" onMouseDown={e => e.stopPropagation()}>
          <div className="gopd-modal-header">
            <div className="gopd-modal-title"><User size={16} /> Select Patient</div>
            <button className="gopd-modal-close" onClick={onClose}><X size={16} /></button>
          </div>
          <div className="gopd-panel-modal-body">
            <div className="gopd-panel-field">
              <label className="gopd-panel-label">Employee</label>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, padding: '0.4rem 0', color: '#1e293b' }}>
                {fullName(selectedEmp)} ({selectedEmp.empCode || '–'})
              </div>
            </div>
            <div className="gopd-panel-field">
              <label className="gopd-panel-label">Patient</label>
              <select
                className="gopd-panel-select"
                value={dependentIdx}
                onChange={e => setDependentIdx(e.target.value)}
              >
                <option value="">— Employee (Self) —</option>
                {selectedEmp.dependents.map((d, i) => (
                  <option key={i} value={i}>{d.code} — {d.name} ({d.relation})</option>
                ))}
              </select>
            </div>
            <div className="gopd-panel-actions">
              <button className="gopd-panel-cancel" onClick={() => setStep(1)}>Back</button>
              <button className="gopd-panel-confirm" onClick={handleConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gopd-modal-overlay" onMouseDown={onClose}>
      <div className="gopd-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="gopd-modal-header">
          <div className="gopd-modal-title">
            <User size={16} />
            Select Employee
          </div>
          <button className="gopd-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="gopd-modal-search">
          <Search size={14} className="gopd-modal-search-icon" />
          <input
            ref={inputRef}
            className="gopd-modal-search-input"
            placeholder="Search by name or employee code..."
            value={q}
            onChange={e => handleSearch(e.target.value)}
          />
          {loading && <span className="gopd-emp-spinner" />}
        </div>

        <div className="gopd-modal-body">
          {results.length === 0 && !loading && (
            <div className="gopd-modal-empty">
              {q.trim() ? 'No employees found' : 'Type to search employees'}
            </div>
          )}
          {results.length > 0 && (
            <table className="gopd-modal-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {results.map(emp => (
                  <tr key={emp.id} onClick={() => handleEmpClick(emp)} className="gopd-modal-row">
                    <td>
                      <span className="gopd-emp-code">{emp.empCode || '–'}</span>
                    </td>
                    <td>
                      {fullName(emp)}
                      {emp.dependents?.length > 0 && (
                        <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>
                          +{emp.dependents.length} dep
                        </span>
                      )}
                    </td>
                    <td className="gopd-modal-phone">{emp.phone || '–'}</td>
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

// ── Panel Select Modal ────────────────────────────────────────────────────────
function PanelModal({ onSelect, onClose }) {
  const { panelCompanies, panelEmployees, fetchPanelCompanies, fetchPanelEmployees } = useClinicStore();
  const [companyId, setCompanyId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [dependentIdx, setDependentIdx] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchPanelCompanies(), fetchPanelEmployees()])
      .finally(() => setLoading(false));
  }, [fetchPanelCompanies, fetchPanelEmployees]);

  const companyEmployees = panelEmployees.filter(
    (e) => e.companyId === Number(companyId) && e.status === 'active'
  );

  const selectedEmployee = panelEmployees.find((e) => e.id === Number(employeeId));
  const dependents = selectedEmployee?.dependents || [];

  function handleCompanyChange(cid) {
    setCompanyId(cid);
    setEmployeeId('');
    setDependentIdx('');
  }

  function handleEmployeeChange(eid) {
    setEmployeeId(eid);
    setDependentIdx('');
  }

  function handleConfirm() {
    if (!companyId) return toast.error('Select a company');
    if (!employeeId) return toast.error('Select an employee');
    const emp = selectedEmployee;
    const dep = dependentIdx !== '' ? dependents[Number(dependentIdx)] : null;
    const patientName = dep
      ? `${dep.title} ${dep.name}`
      : `${emp.title} ${emp.name}`;
    onSelect({
      panelCompanyId: Number(companyId),
      panelEmployeeId: Number(employeeId),
      panelDependentId: dep?.id || null,
      patientName,
      panelLabel: `${panelCompanies.find(c => c.id === Number(companyId))?.code} / ${emp.empCode}${dep ? ` / ${dep.code}` : ''}`,
      dob: dep ? formatDob(dep.dob) : formatDob(emp.dob),
    });
  }

  return (
    <div className="gopd-modal-overlay" onMouseDown={onClose}>
      <div className="gopd-modal gopd-modal--panel" onMouseDown={e => e.stopPropagation()}>
        <div className="gopd-modal-header">
          <div className="gopd-modal-title"><Building2 size={16} /> Select Panel</div>
          <button className="gopd-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {loading ? (
          <div className="gopd-modal-empty" style={{ padding: '2rem' }}>Loading...</div>
        ) : (
          <div className="gopd-panel-modal-body">
            {/* Company */}
            <div className="gopd-panel-field">
              <label className="gopd-panel-label">Company</label>
              <select className="gopd-panel-select" value={companyId} onChange={e => handleCompanyChange(e.target.value)}>
                <option value="">— Select Company —</option>
                {panelCompanies.filter(c => c.status === 'active').map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>

            {/* Employee */}
            <div className="gopd-panel-field">
              <label className="gopd-panel-label">Employee</label>
              <select
                className="gopd-panel-select"
                value={employeeId}
                onChange={e => handleEmployeeChange(e.target.value)}
                disabled={!companyId}
              >
                <option value="">— Select Employee —</option>
                {companyEmployees.map(e => (
                  <option key={e.id} value={e.id}>{e.empCode} — {e.title} {e.name}</option>
                ))}
              </select>
              {companyId && companyEmployees.length === 0 && (
                <span className="gopd-panel-hint">No active employees for this company</span>
              )}
            </div>

            {/* Dependents (if any) */}
            {selectedEmployee && dependents.length > 0 && (
              <div className="gopd-panel-field">
                <label className="gopd-panel-label">Dependent (optional)</label>
                <select
                  className="gopd-panel-select"
                  value={dependentIdx}
                  onChange={e => setDependentIdx(e.target.value)}
                >
                  <option value="">— Employee (self) —</option>
                  {dependents.map((d, i) => (
                    <option key={i} value={i}>{d.code} — {d.title} {d.name} ({d.relation})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="gopd-panel-actions">
              <button className="gopd-panel-cancel" onClick={onClose}>Cancel</button>
              <button className="gopd-panel-confirm" onClick={handleConfirm}>Confirm</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admit Patient Lookup Modal — pick an admitted patient to fill Admit No ────
function AdmitPatientLookupModal({ onSelect, onClose, searchAdmissionsForAdjustment }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  useEffect(() => {
    searchAdmissionsForAdjustment('')
      .then(data => setResults(data || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [searchAdmissionsForAdjustment]);

  function handleSearch(val) {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      searchAdmissionsForAdjustment(val)
        .then(data => setResults(data || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
  }

  return (
    <div className="gopd-modal-overlay" onMouseDown={onClose}>
      <div className="gopd-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="gopd-modal-header">
          <div className="gopd-modal-title"><User size={16} /> Select Admitted Patient</div>
          <button className="gopd-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="gopd-modal-body">
          <input
            autoFocus
            className="gopd-modal-search"
            placeholder="Admission # ya patient name…"
            value={q}
            onChange={e => handleSearch(e.target.value)}
          />
          {loading && <div className="gopd-modal-loading">Loading…</div>}
          {!loading && (
            <table className="gopd-modal-table">
              <thead>
                <tr>
                  <th>Admission #</th>
                  <th>Patient</th>
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id} onClick={() => onSelect(r)} className="gopd-modal-row">
                    <td>{r.admissionNo}</td>
                    <td>{r.patientName}</td>
                  </tr>
                ))}
                {!results.length && (
                  <tr><td colSpan={2} className="gopd-modal-empty">Koi admit patient nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Doctor Search Input (Referred By) ─────────────────────────────────────────
function DoctorSearchInput({ value, onChange }) {
  const { doctors, fetchDoctors } = useClinicStore();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value || '');
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => { if (doctors.length === 0) fetchDoctors().catch(() => {}); }, []);
  useEffect(() => { setQ(value || ''); }, [value]);

  useEffect(() => {
    const handler = (e) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = q.trim()
    ? doctors.filter(d =>
        d.name?.toLowerCase().includes(q.toLowerCase()) ||
        d.code?.toLowerCase().includes(q.toLowerCase())
      )
    : doctors.filter(d => d.status === 'active');

  function handleSelect(doc) {
    onChange(doc.name);
    setQ(doc.name);
    setOpen(false);
  }

  return (
    <div className="gopd-ref-wrap" ref={inputRef}>
      <input
        className="gopd-inp-ref"
        value={q}
        onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search doctor..."
        autoComplete="off"
      />
      {open && (
        <div className="gopd-ref-dropdown" ref={dropRef}>
          {filtered.length === 0 ? (
            <div className="gopd-ref-empty">{doctors.length === 0 ? 'Loading...' : 'No doctors found'}</div>
          ) : (
            filtered.slice(0, 20).map(d => (
              <div
                key={d.id}
                className="gopd-ref-option"
                onMouseDown={e => { e.preventDefault(); handleSelect(d); }}
              >
                <span className="gopd-ref-code">{d.code}</span>
                <span>{d.name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GeneralOPD({ departmentName = 'General OPD', layout = 'doctor', showDoctorColumn = true }) {
  const { fetchAvailableDoctors, fetchNextSerialNo, fetchNextMrNo, searchEmployees, createOpdVisit, printOpdVisit, fetchAntenatalByNo, fetchOpdPatientByMrNo, fetchOpdPatientsByPhone, searchAdmissionsForAdjustment, fetchAdmissionForAdjustment, ccConfig, fetchCcConfig } = useClinicStore();
  const { user } = useAuthStore();

  const [form, setForm] = useState(EMPTY);
  const [leftDoctors, setLeftDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [checkedLeft, setCheckedLeft] = useState([]);
  const [rightDoctors, setRightDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [receive, setReceive] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState('amount');
  const [busy, setBusy] = useState(false);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showPanelModal, setShowPanelModal] = useState(false);
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneResults, setPhoneResults] = useState([]);
  const [mrConfirm, setMrConfirm] = useState(null);
  const [mrLookupLoading, setMrLookupLoading] = useState(false);
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);

  // Clinical Record Form — printed in-page after the slip (General OPD / Dental
  // OPD only, see CRF_DEPTS); holds the data for whichever visit was just saved.
  const [crfVisit, setCrfVisit] = useState(null);
  const [crfConsultantName, setCrfConsultantName] = useState('');
  const [crfBarcodeDataUrl, setCrfBarcodeDataUrl] = useState('');
  const [crfPrintedBy, setCrfPrintedBy] = useState('');
  const [crfReady, setCrfReady] = useState(false);
  const [crfFormType, setCrfFormType] = useState('crf'); // 'crf' | 'ecg'

  // Temporary manual switch until QZ Tray auto-routing is wired up — staff
  // picks which slip format to print, then picks the matching printer
  // themselves in the OS print dialog.
  const [thermalPrint, setThermalPrint] = useState(false);

  // Miscellaneous-only: items flagged Quantity/Price-editable open this modal
  // instead of the normal checkbox+transfer flow — the entered value(s)
  // compute the final amount right away.
  const [miscModalItem, setMiscModalItem] = useState(null);

  function handleMiscModalConfirm({ quantity, price }) {
    const item = miscModalItem;
    const rate = item.priceEditable ? Number(price) || 0 : (item.normalCharges || 0);
    const qty = item.quantityEditable ? Number(quantity) || 1 : 1;
    setRightDoctors(prev => [...prev, { ...item, normalCharges: rate * qty, quantity: qty }]);
    setMiscModalItem(null);
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetchNextSerialNo().then(s => set('serialNo', s)).catch(() => {});
    fetchNextMrNo().then(n => set('mrNo', String(n).padStart(3, '0'))).catch(() => {});
    loadDoctors(false);
    fetchCcConfig().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wait one render cycle after crfVisit/etc are set so the hidden print area
  // actually has the new data in the DOM before we call window.print().
  useEffect(() => {
    if (!crfReady) return;
    const t = setTimeout(() => { printClinicalRecordForm(); setCrfReady(false); }, 300);
    return () => clearTimeout(t);
  }, [crfReady]);

  useEffect(() => {
    loadDoctors(form.onCall);
    setCheckedLeft([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.onCall]);

  async function loadDoctors(onCall) {
    setLoadingDoctors(true);
    try {
      const rows = await fetchAvailableDoctors({ day: todayDay(), time: currentTime(), onCall, departmentName });
      setLeftDoctors(rows || []);
    } catch { setLeftDoctors([]); }
    finally { setLoadingDoctors(false); }
  }

  function handleCategoryChange(v) {
    if (v === 'staff') {
      setForm(f => ({ ...f, patientCategory: v, panelCompanyId: null, panelEmployeeId: null, panelDependentId: null, panelLabel: '' }));
      setShowEmpModal(true);
    } else if (v === 'panel') {
      setForm(f => ({ ...f, patientCategory: v, employeeId: null }));
      setShowPanelModal(true);
    } else {
      setForm(f => ({ ...f, patientCategory: v, employeeId: null, panelCompanyId: null, panelEmployeeId: null, panelDependentId: null, panelLabel: '', patientName: v === 'normal' ? '' : f.patientName }));
    }
  }

  function handleMethodChange(v) {
    set('paymentMethod', v);
  }

  function handleEmpSelect({ emp, dependent }) {
    const dob = dependent ? formatDob(dependent.dob) : formatDob(emp.dob);
    const patientName = dependent ? dependent.name : fullName(emp);
    setForm(f => ({ ...f, employeeId: emp.id, patientName, dob, phoneNo: emp.phone || f.phoneNo, ...dobToAge(dob) }));
    setShowEmpModal(false);
  }

  function handlePanelSelect({ panelCompanyId, panelEmployeeId, panelDependentId, patientName, panelLabel, dob }) {
    const dobVal = dob || '';
    setForm(f => ({ ...f, panelCompanyId, panelEmployeeId, panelDependentId, patientName, panelLabel, dob: dobVal, ...dobToAge(dobVal) }));
    setShowPanelModal(false);
  }

  function toggleLeft(rowId) {
    setCheckedLeft(p => p.includes(rowId) ? p.filter(id => id !== rowId) : [...p, rowId]);
  }

  function moveRight() {
    if (!checkedLeft.length) return;
    const selected = leftDoctors.filter(r => checkedLeft.includes(r.id));
    setRightDoctors(prev => [...prev, ...selected.filter(s => !prev.some(p => p.id === s.id))]);
    setCheckedLeft([]);
  }

  function moveLeft() { setRightDoctors([]); setCheckedLeft([]); }

  async function handleAntenatalLookup() {
    const no = form.antenatalNo?.trim();
    if (!no || no === 'NA') return;
    try {
      const rec = await fetchAntenatalByNo(no);
      setForm(f => ({
        ...f,
        patientName: rec.patientName || f.patientName,
        age: rec.age != null ? String(rec.age) : f.age,
        phoneNo: rec.phoneNo || f.phoneNo,
        mrNo: rec.mrNo || f.mrNo,
      }));
    } catch {
      toast.error('No antenatal found');
    }
  }

  const isComplementary = form.patientCategory === 'complementary';
  const isPanel = form.patientCategory === 'panel';
  const paymentMethodDisabled = isPanel || isComplementary;
  const effectivePaymentType = form.patientCategory === 'panel' ? 'panel'
    : isComplementary ? 'complementary'
    : form.paymentMethod;

  const grossAmount = rightDoctors.reduce((s, r) => s + (r.normalCharges || 0), 0);
  const discountAmt = discountType === 'percent'
    ? Math.round((grossAmount * (Number(discount) || 0)) / 100)
    : (Number(discount) || 0);
  const totalAmount = isComplementary ? 0 : Math.max(0, grossAmount - discountAmt);

  // Credit Card surcharge — if paying by CC and the slip amount is >= the
  // configured min amount, add the configured percentage on top.
  const isCcMethod = effectivePaymentType === 'cc';
  const ccPercentage = ccConfig?.percentage || 0;
  const ccMinAmount = ccConfig?.minAmount || 0;
  const ccApplicable = !isComplementary && isCcMethod && ccPercentage > 0 && totalAmount >= ccMinAmount;
  const ccCharge = ccApplicable ? Math.round((totalAmount * ccPercentage) / 100) : 0;
  const grandTotal = totalAmount + ccCharge;

  const refundAmt  = Math.max(0, (Number(receive) || 0) - grandTotal);
  const balanceAmt = Math.max(0, grandTotal - (Number(receive) || 0));

  // Received amount auto-follows the selected slip amount (doctor/item +
  // discount + CC surcharge) so it never has to be typed manually. Panel
  // patients don't pay cash at the counter — the company settles later via
  // Panel Cheque Transaction — so Received always stays 0 for them even
  // though the slip's own Amount/Total keep showing the real charge.
  useEffect(() => {
    setReceive(isPanel ? '0' : (isComplementary ? '' : String(grandTotal)));
  }, [grandTotal, isComplementary, isPanel]);

  function applyPatientData(patient, useNewMr) {
    if (useNewMr) {
      // New MR: just close modal, keep form as-is (phone stays, rest is blank)
      setMrConfirm(null);
      setShowPhoneModal(false);
      setPhoneResults([]);
      return;
    }
    setForm(f => ({
      ...f,
      patientName: patient.patientName || '',
      patientType: patient.patientType || 'MAST',
      age: patient.age != null ? String(patient.age) : '',
      ageMonths: Number(patient.ageMonths) || 0,
      ageDays: Number(patient.ageDays) || 0,
      gender: patient.gender || 'male',
      phoneNo: patient.phoneNo || f.phoneNo,
      referredBy: patient.referredBy || '',
      mrNo: patient.mrNo != null ? String(patient.mrNo).padStart(3, '0') : f.mrNo,
    }));
    setMrConfirm(null);
    setShowPhoneModal(false);
    setPhoneResults([]);
  }

  async function handleMrLookup() {
    const mr = form.mrNo?.trim();
    if (!mr) return;
    setMrLookupLoading(true);
    try {
      const patient = await fetchOpdPatientByMrNo(mr);
      applyPatientData(patient, false);
      toast.success(`Patient found: ${patient.patientName}`);
    } catch {
      toast.error('No patient found with MR# ' + mr);
    } finally {
      setMrLookupLoading(false);
    }
  }

  async function handlePhoneLookup() {
    const phone = form.phoneNo?.trim();
    if (!phone || phone.length < 7) return;
    setPhoneLookupLoading(true);
    try {
      const results = await fetchOpdPatientsByPhone(phone);
      if (results.length === 0) return;
      if (results.length === 1) {
        setMrConfirm({ patient: results[0] });
      } else {
        setPhoneResults(results);
        setShowPhoneModal(true);
      }
    } catch {
      // silent — no match is fine
    } finally {
      setPhoneLookupLoading(false);
    }
  }

  // Auto-fill the slip from the admitted patient's own record — the data
  // already exists on their admission, no need to retype it.
  async function handleAdmitSelect(row) {
    set('admitNo', row.admissionNo);
    setShowAdmitModal(false);
    try {
      const adm = await fetchAdmissionForAdjustment(row.id);
      setForm(f => ({
        ...f,
        patientName: adm.patientName || f.patientName,
        patientType: ADMISSION_TITLE_MAP[adm.patientTitle] || f.patientType,
        age: adm.ageYears != null ? String(adm.ageYears) : f.age,
        ageMonths: adm.ageMonths != null ? Number(adm.ageMonths) : f.ageMonths,
        ageDays: adm.ageDays != null ? Number(adm.ageDays) : f.ageDays,
        gender: adm.gender || f.gender,
        phoneNo: adm.phoneNo || f.phoneNo,
        mrNo: adm.mrNo != null ? String(adm.mrNo) : f.mrNo,
      }));
    } catch {
      // admitNo is already set; auto-fill is best-effort
    }
  }

  // Escape (advanced keyboard mode) — back out of whichever lookup/confirm
  // popup happens to be open, without the user needing to know which one.
  function closeAllPopups() {
    setShowEmpModal(false);
    setShowPanelModal(false);
    setShowAdmitModal(false);
    setShowPhoneModal(false);
    setMrConfirm(null);
    setMiscModalItem(null);
  }

  async function handleSaveAndPrint() {
    if (!form.patientName.trim()) { toast.error('Patient Name is required'); return; }
    if (!form.serialNo.trim()) { toast.error('Serial No is required'); return; }
    const phoneErr = validatePhoneNo(form.phoneNo);
    if (phoneErr) { toast.error(phoneErr); return; }
    const ageErr = validateAge(form.age, form.ageMonths, form.ageDays);
    if (ageErr) { toast.error(ageErr); return; }
    if (departmentName !== 'General OPD' && !form.referredBy?.trim()) { toast.error('Refered By (referral doctor) select karo — slip iske bina nahi banegi'); return; }
    if (rightDoctors.length === 0) { toast.error('Kam az kam ek doctor/test select karo — bina selection ke slip nahi banegi'); return; }
    const w = window.open('', '_blank', 'width=420,height=680');
    if (!w) { toast.error('Popup blocked — please allow popups for this site'); return; }
    setBusy(true);
    try {
      const created = await createOpdVisit({
        ...form,
        department: departmentName,
        paymentType: effectivePaymentType,
        totalAmount: grandTotal,
        discount: discountAmt,
        receive: Number(receive) || 0,
        refund: refundAmt,
        ccPercentage: isCcMethod && !isComplementary ? ccPercentage : 0,
        ccMinAmount: isCcMethod && !isComplementary ? ccMinAmount : 0,
        ccCharge,
        doctors: rightDoctors.map(r => ({
          doctorId: r.doctorId,
          subDeptId: r.subDeptId,
          amount: isComplementary ? 0 : (r.normalCharges || 0),
          extAmount: 0,
          quantity: r.quantity || 1,
        })),
      });
      const newId = created?.id;
      toast.success('OPD Visit saved');
      const consultantName = rightDoctors[0]?.doctor?.name || '';
      setForm(EMPTY);
      setRightDoctors([]);
      setCheckedLeft([]);
      setReceive('');
      setDiscount('');
      setDiscountType('amount');
      const [next, nextMr] = await Promise.all([fetchNextSerialNo(), fetchNextMrNo()]);
      set('serialNo', next);
      set('mrNo', String(nextMr).padStart(3, '0'));
      loadDoctors(false);
      if (newId) {
        const { visit, tokenNo, isDuplicate } = await printOpdVisit(newId);
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, visit.serialNo, {
          format: 'CODE128', width: 2, height: 48,
          displayValue: true, fontSize: 11, margin: 4,
        });
        const barcodeDataUrl = canvas.toDataURL('image/png');
        const printedBy = user?.name || user?.username || user?.email || '';
        const html = thermalPrint
          ? buildThermalReceiptHtml({ visit, tokenNo, isDuplicate, barcodeDataUrl, printedBy })
          : buildReceiptHtml({ visit, tokenNo, isDuplicate, barcodeDataUrl, printedBy });
        w.document.write(html);
        w.document.close();

        const isEcg = departmentName === 'Miscellaneous' &&
          rightDoctors.some(r => normDeptName(r.subDept?.name) === 'ecg');

        if (isEcg) {
          setCrfFormType('ecg');
          setCrfVisit(visit);
          setCrfBarcodeDataUrl(barcodeDataUrl);
          setCrfPrintedBy(printedBy);
          setCrfReady(true);
        } else if (CRF_DEPTS.includes(departmentName)) {
          setCrfFormType('crf');
          setCrfVisit(visit);
          setCrfConsultantName(consultantName);
          setCrfBarcodeDataUrl(barcodeDataUrl);
          setCrfReady(true);
        }
      } else {
        w.close();
      }
    } catch (err) {
      w.close();
      toast.error(err.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {showEmpModal && (
        <EmployeeModal
          searchEmployees={searchEmployees}
          onSelect={handleEmpSelect}
          onClose={() => setShowEmpModal(false)}
        />
      )}
      {showPanelModal && (
        <PanelModal
          onSelect={handlePanelSelect}
          onClose={() => setShowPanelModal(false)}
        />
      )}
      {showAdmitModal && (
        <AdmitPatientLookupModal
          searchAdmissionsForAdjustment={searchAdmissionsForAdjustment}
          onSelect={handleAdmitSelect}
          onClose={() => setShowAdmitModal(false)}
        />
      )}

      {/* ── MR Confirm Dialog (1 phone match) ─────────────────────────── */}
      {mrConfirm && (
        <div className="gopd-overlay">
          <div className="gopd-mr-confirm">
            <div className="gopd-mr-confirm-title">Patient Found</div>
            <div className="gopd-mr-confirm-body">
              <strong>{mrConfirm.patient.patientName}</strong>
              {mrConfirm.patient.mrNo != null && (
                <span className="gopd-mr-confirm-mr"> — MR# {String(mrConfirm.patient.mrNo).padStart(3, '0')}</span>
              )}
              {mrConfirm.patient.age != null && (
                <span className="gopd-mr-confirm-age"> | Age: {mrConfirm.patient.age}</span>
              )}
              <span className="gopd-mr-confirm-gender"> | {mrConfirm.patient.gender}</span>
            </div>
            <div className="gopd-mr-confirm-q">Do you want to use the existing MR# or allot a new one?</div>
            <div className="gopd-mr-confirm-actions">
              {mrConfirm.patient.mrNo != null && (
                <button className="gopd-mr-confirm-btn gopd-mr-confirm-btn--use" onClick={() => applyPatientData(mrConfirm.patient, false)}>
                  Use MR# {String(mrConfirm.patient.mrNo).padStart(3, '0')}
                </button>
              )}
              <button className="gopd-mr-confirm-btn gopd-mr-confirm-btn--new" onClick={() => applyPatientData(mrConfirm.patient, true)}>
                Allot New MR
              </button>
              <button className="gopd-mr-confirm-btn gopd-mr-confirm-btn--cancel" onClick={() => setMrConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {miscModalItem && (
        <MiscQtyPriceModal
          item={miscModalItem}
          onConfirm={handleMiscModalConfirm}
          onClose={() => setMiscModalItem(null)}
        />
      )}

      {/* ── Phone Results Modal (multiple matches) ─────────────────────── */}
      {showPhoneModal && (
        <div className="gopd-overlay">
          <div className="gopd-phone-modal">
            <div className="gopd-phone-modal-title">
              Patients with this Phone Number
              <button className="gopd-phone-modal-close" onClick={() => setShowPhoneModal(false)}><X size={14} /></button>
            </div>
            <table className="gopd-phone-modal-table">
              <thead>
                <tr>
                  <th>MR#</th>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Phone</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {phoneResults.map((p, i) => (
                  <tr key={i}>
                    <td>{p.mrNo != null ? String(p.mrNo).padStart(3, '0') : '—'}</td>
                    <td>{p.patientName}</td>
                    <td>{p.age != null ? p.age : '—'}</td>
                    <td>{p.gender}</td>
                    <td>{p.phoneNo}</td>
                    <td className="gopd-phone-modal-actions-cell">
                      {p.mrNo != null && (
                        <button
                          className="gopd-phone-modal-sel"
                          onClick={() => applyPatientData(p, false)}
                        >
                          Use MR# {String(p.mrNo).padStart(3, '0')}
                        </button>
                      )}
                      <button
                        className="gopd-phone-modal-sel gopd-phone-modal-sel--new"
                        onClick={() => applyPatientData(p, true)}
                      >
                        New MR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="gopd" onKeyDown={(e) => handleSlipKeys(e, { onEscape: closeAllPopups })}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="gopd-header">
          <div className="gopd-serial-wrap">
            <span className="gopd-serial-lbl">MR #</span>
            <input
              className="gopd-serial-input gopd-mr-input"
              value={form.mrNo}
              onChange={e => set('mrNo', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleMrLookup()}
            />
            <button
              className="gopd-mr-lookup-btn"
              onClick={handleMrLookup}
              disabled={mrLookupLoading}
              title="Search patient by MR#"
            >
              {mrLookupLoading ? '…' : <Search size={12} />}
            </button>
            <span className="gopd-serial-lbl" style={{ marginLeft: '0.75rem' }}>Serial #</span>
            <input className="gopd-serial-input gopd-mr-input" value={form.serialNo} readOnly />
            <span className="gopd-serial-lbl" style={{ marginLeft: '0.75rem' }}>Phone #</span>
            <input
              className="gopd-serial-input gopd-mr-input"
              value={form.phoneNo}
              onChange={e => set('phoneNo', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePhoneLookup()}
            />
            <button
              className="gopd-mr-lookup-btn"
              onClick={handlePhoneLookup}
              disabled={phoneLookupLoading}
              title="Search patient by Phone#"
            >
              {phoneLookupLoading ? '…' : <Search size={12} />}
            </button>
          </div>
          <div className="gopd-title">{departmentName}</div>
        </div>

        {/* ── Patient section ─────────────────────────────────────────────── */}
        <div className="gopd-patient">
          {/* Row 1 */}
          <div className="gopd-row gopd-row-1">
            <div className="gopd-name-grp">
              <span className="gopd-lbl">Patient Name</span>
              <select className="gopd-sel-type" value={form.patientType} onChange={e => set('patientType', e.target.value)}>
                {PATIENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <input
                className="gopd-inp-name"
                value={form.patientName}
                onChange={e => set('patientName', e.target.value)}
                placeholder={
                  form.patientCategory === 'staff' ? 'Select employee to fill…' :
                  form.patientCategory === 'panel' ? 'Select panel to fill…' : ''
                }
                readOnly={form.patientCategory === 'staff' || form.patientCategory === 'panel'}
              />
              {form.patientCategory === 'staff' && (
                <button className="gopd-emp-change-btn" onClick={() => setShowEmpModal(true)} title="Change employee">
                  <Search size={13} />
                </button>
              )}
              {form.patientCategory === 'panel' && (
                <button className="gopd-emp-change-btn" onClick={() => setShowPanelModal(true)} title="Change panel">
                  <Search size={13} />
                </button>
              )}
              {form.patientCategory === 'panel' && form.panelLabel && (
                <span className="gopd-panel-badge">{form.panelLabel}</span>
              )}
            </div>

            <div className="gopd-admit-grp">
              <label className="gopd-chk-lbl">
                <input type="checkbox" checked={form.admitPatient} onChange={e => set('admitPatient', e.target.checked)} />
                Admit Patient
              </label>
              {form.admitPatient && (
                <>
                  <input
                    className="gopd-inp-antenatal"
                    value={form.admitNo}
                    readOnly
                    placeholder="Admit No"
                  />
                  <button className="gopd-browse-btn" onClick={() => setShowAdmitModal(true)} title="Select admitted patient">···</button>
                </>
              )}
              <label className="gopd-chk-lbl">
                <input type="checkbox" checked={form.antenatal} onChange={e => set('antenatal', e.target.checked)} />
                Antenatal #
              </label>
              <input
                className="gopd-inp-antenatal"
                value={form.antenatalNo}
                onChange={e => set('antenatalNo', e.target.value)}
                onBlur={handleAntenatalLookup}
                onKeyDown={e => e.key === 'Enter' && handleAntenatalLookup()}
                disabled={!form.antenatal}
              />
              <button className="gopd-browse-btn" disabled={!form.antenatal} onClick={handleAntenatalLookup}>···</button>
            </div>

            {form.admitPatient && form.admitNo && (
              <div className="gopd-admit-grp">
                <label className="gopd-chk-lbl">
                  <input type="checkbox" checked={form.adjustPayment} onChange={e => set('adjustPayment', e.target.checked)} />
                  Adjust Payment
                </label>
              </div>
            )}
          </div>

          {/* Row 2 */}
          <div className="gopd-row gopd-row-2">
            <div className="gopd-age-grp">
              <span className="gopd-lbl">Age</span>
              <input className="gopd-inp-age" value={form.age} onChange={e => set('age', e.target.value)} />
              <span className="gopd-lbl">Month(s)</span>
              <select className="gopd-sel-sm" value={form.ageMonths} onChange={e => set('ageMonths', e.target.value)}>
                {Array.from({ length: 13 }, (_, i) => i).map(m => <option key={m}>{m}</option>)}
              </select>
              <span className="gopd-lbl">Days</span>
              <select className="gopd-sel-sm" value={form.ageDays} onChange={e => set('ageDays', e.target.value)}>
                {Array.from({ length: 32 }, (_, i) => i).map(d => <option key={d}>{d}</option>)}
              </select>
              <span className="gopd-lbl" style={{ marginLeft: 8 }}>DOB</span>
              <input
                className="gopd-inp-dob"
                type="date"
                value={form.dob}
                onChange={e => { const v = e.target.value; setForm(f => ({ ...f, dob: v, ...dobToAge(v) })); }}
              />
            </div>
            <div className="gopd-gender-grp">
              <label className="gopd-radio-lbl">
                <input type="radio" name="gender" checked={form.gender === 'male'} onChange={() => set('gender', 'male')} />
                Male
              </label>
              <label className="gopd-radio-lbl">
                <input type="radio" name="gender" checked={form.gender === 'female'} onChange={() => set('gender', 'female')} />
                Female
              </label>
            </div>
            {departmentName !== 'General OPD' && (
              <div className="gopd-contact-grp">
                <span className="gopd-lbl">Refered By</span>
                <DoctorSearchInput
                  value={form.referredBy}
                  onChange={v => set('referredBy', v)}
                />
              </div>
            )}
          </div>

          {/* Row 3 – Patient Category */}
          <div className="gopd-row gopd-row-radio">
            {[['normal','Normal'],['staff','Staff'],['panel','Panel'],['complementary','Complementary']].map(([v,l]) => (
              <label key={v} className="gopd-radio-lbl">
                <input type="radio" name="patientCategory" value={v} checked={form.patientCategory === v} onChange={() => handleCategoryChange(v)} />
                {l}
              </label>
            ))}
          </div>

          {/* Row 4 – Payment Method */}
          <div className="gopd-row gopd-row-radio">
            {[['cash','Cash'],['jazzcash','JazzCash'],['online','Online'],['cc','CC']].map(([v,l]) => (
              <label key={v} className={`gopd-radio-lbl${paymentMethodDisabled ? ' gopd-radio-lbl--dim' : ''}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value={v}
                  checked={form.paymentMethod === v}
                  onChange={() => handleMethodChange(v)}
                  disabled={paymentMethodDisabled}
                />
                {l}
              </label>
            ))}
          </div>

          {/* Row 5 – Visit type */}
          <div className="gopd-row gopd-row-radio">
            {[['procedure','Procedure'],['vaccination','Vaccination'],['opd','OPD']].map(([v,l]) => (
              <label key={v} className="gopd-radio-lbl">
                <input type="radio" name="visitType" value={v} checked={form.visitType === v} onChange={() => set('visitType', v)} />
                {l}
              </label>
            ))}
          </div>
        </div>

        {/* ── ON CALL ─────────────────────────────────────────────────────── */}
        <div className="gopd-oncall-row">
          <label className="gopd-oncall-lbl">
            <input type="checkbox" checked={form.onCall} onChange={e => set('onCall', e.target.checked)} />
            ON CALL
          </label>
        </div>

        {/* ── Two-panel ──────────────────────────────────────────────────── */}
        <div className="gopd-main">
          <div className="gopd-left-panel">
            {layout === 'subdept' && (() => {
              const uniqueDoctors = leftDoctors.reduce((acc, r) => {
                if (r.doctor && !acc.find(d => d.id === r.doctor.id)) acc.push(r.doctor);
                return acc;
              }, []);
              const visibleRows = selectedDoctorId
                ? leftDoctors.filter(r => r.doctor?.id === Number(selectedDoctorId))
                : leftDoctors;
              return (
                <>
                  <div className="gopd-doctor-dropdown-row">
                    <span className="gopd-lbl">Doctor</span>
                    <select
                      className="gopd-doctor-select"
                      value={selectedDoctorId}
                      onChange={e => { setSelectedDoctorId(e.target.value); setCheckedLeft([]); }}
                    >
                      <option value="">— Select Doctor —</option>
                      {uniqueDoctors.map(d => (
                        <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="gopd-table-wrap">
                    {loadingDoctors ? (
                      <div className="gopd-loading">Loading...</div>
                    ) : (
                      <table className="gopd-table">
                        <thead>
                          <tr>
                            <th style={{ width: 28 }}></th>
                            <th style={{ width: 70 }}>Code</th>
                            <th>Sub Department</th>
                            <th style={{ width: 80 }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.length === 0 ? (
                            <tr><td colSpan={4} className="gopd-empty-cell">
                              {selectedDoctorId ? 'No sub-departments for this doctor' : 'Select a doctor to view sub-departments'}
                            </td></tr>
                          ) : visibleRows.map(r => (
                            <tr key={r.id} className={checkedLeft.includes(r.id) ? 'gopd-tr--sel' : ''} onClick={() => toggleLeft(r.id)}>
                              <td><input type="checkbox" checked={checkedLeft.includes(r.id)} onChange={() => toggleLeft(r.id)} onClick={e => e.stopPropagation()} /></td>
                              <td>{r.subDept?.code}</td>
                              <td>{r.subDept?.name}</td>
                              <td>{r.normalCharges}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              );
            })()}

            {layout === 'doctor' && (
              <div className="gopd-table-wrap">
                {loadingDoctors ? (
                  <div className="gopd-loading">Loading doctors...</div>
                ) : (
                  <table className="gopd-table">
                    <thead>
                      <tr>
                        <th style={{ width: 28 }}></th>
                        {showDoctorColumn && <th style={{ width: 52 }}>Code</th>}
                        {showDoctorColumn && <th>Doctor</th>}
                        <th>Sub Department</th>
                        <th style={{ width: 80 }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leftDoctors.length === 0 ? (
                        <tr><td colSpan={showDoctorColumn ? 5 : 3} className="gopd-empty-cell">
                          {form.onCall ? 'No active doctors found' : 'No doctors scheduled for today at this time'}
                        </td></tr>
                      ) : leftDoctors.map(r => {
                        const needsModal = departmentName === 'Miscellaneous' && (r.quantityEditable || r.priceEditable);
                        const rowClick = () => (needsModal ? setMiscModalItem(r) : toggleLeft(r.id));
                        return (
                          <tr key={r.id} className={checkedLeft.includes(r.id) ? 'gopd-tr--sel' : ''} onClick={rowClick}>
                            <td>
                              {needsModal
                                ? <span className="gopd-misc-tag" title="Quantity/Price is set when adding">{[r.quantityEditable && 'Qty', r.priceEditable && 'Price'].filter(Boolean).join('+')}</span>
                                : <input type="checkbox" checked={checkedLeft.includes(r.id)} onChange={() => toggleLeft(r.id)} onClick={e => e.stopPropagation()} />}
                            </td>
                            {showDoctorColumn && <td>{r.doctor?.code}</td>}
                            {showDoctorColumn && <td>{r.doctor?.name}</td>}
                            <td>{r.subDept?.name}</td>
                            <td>{r.normalCharges}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          <div className="gopd-transfer">
            <button className="gopd-xfer-btn" onClick={moveRight}>&gt;&gt;</button>
            <button className="gopd-xfer-btn" onClick={moveLeft}>&lt;&lt;</button>
          </div>

          <div className="gopd-right-panel">
            <div className="gopd-table-wrap gopd-table-wrap--right">
              <table className="gopd-table">
                <thead>
                  <tr>
                    {showDoctorColumn && <th>Doctor Name</th>}
                    <th>Sub Department</th>
                    <th style={{ width: 72 }}>Amount</th>
                    <th style={{ width: 48 }}>Ext.</th>
                  </tr>
                </thead>
                <tbody>
                  {rightDoctors.length === 0 ? (
                    <tr><td colSpan={showDoctorColumn ? 4 : 3} className="gopd-empty-cell">No doctors selected</td></tr>
                  ) : rightDoctors.map(r => (
                    <tr key={r.id}>
                      {showDoctorColumn && <td>{r.doctor?.name}</td>}
                      <td>{r.subDept?.name}</td>
                      <td>{r.normalCharges}</td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="gopd-total">
              <div className="gopd-total-title">Total Amount</div>
              <div className="gopd-total-body">
                <div className="gopd-total-fields">
                  {!isComplementary && (
                    <div className="gopd-total-row">
                      <span className="gopd-total-lbl">Discount</span>
                      <div className="gopd-discount-wrap">
                        <input
                          className="gopd-total-inp"
                          type="number"
                          min={0}
                          max={discountType === 'percent' ? 100 : undefined}
                          value={discount}
                          onChange={e => setDiscount(e.target.value)}
                          placeholder="0"
                        />
                        <div className="gopd-discount-toggle">
                          <button
                            className={`gopd-disc-btn ${discountType === 'amount' ? 'gopd-disc-btn--active' : ''}`}
                            onClick={() => { setDiscountType('amount'); setDiscount(''); }}
                            type="button"
                          >PKR</button>
                          <button
                            className={`gopd-disc-btn ${discountType === 'percent' ? 'gopd-disc-btn--active' : ''}`}
                            onClick={() => { setDiscountType('percent'); setDiscount(''); }}
                            type="button"
                          >%</button>
                        </div>
                      </div>
                      {discountType === 'percent' && discount && (
                        <span className="gopd-disc-calc">= {discountAmt}</span>
                      )}
                    </div>
                  )}
                  <div className="gopd-total-row">
                    <span className="gopd-total-lbl">Receive</span>
                    <input className="gopd-total-inp" value={receive} onChange={e => setReceive(e.target.value)} disabled={isComplementary || isPanel} />
                  </div>
                  <div className="gopd-total-row">
                    <span className="gopd-total-lbl">Refund</span>
                    <span className="gopd-refund-val">{refundAmt > 0 ? refundAmt : '–'}</span>
                  </div>
                  <div className="gopd-total-row">
                    <span className="gopd-total-lbl">Balance</span>
                    <span className="gopd-balance-val" style={{ color: balanceAmt > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                      {balanceAmt > 0 ? balanceAmt : '–'}
                    </span>
                  </div>
                </div>
                <div className="gopd-total-amount">
                  {isComplementary ? (
                    <span style={{ color: '#16a34a', fontSize: '0.78rem', fontWeight: 700 }}>Complementary</span>
                  ) : (
                    <>
                      {discountAmt > 0 && <div style={{ fontSize: '0.7rem', color: '#94a3b8', textDecoration: 'line-through' }}>{grossAmount}</div>}
                      {grandTotal}
                      {ccCharge > 0 && (
                        <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 600 }}>
                          + CC {ccPercentage}% = {ccCharge}
                        </div>
                      )}
                      {!ccCharge && isCcMethod && ccMinAmount > 0 && (
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>
                          CC {ccPercentage}% not applied (min Rs.{ccMinAmount})
                        </div>
                      )}
                    </>
                  )}
                </div>
                <label className="gopd-oncall-lbl" style={{ marginBottom: 6 }}>
                  <input type="checkbox" checked={thermalPrint} onChange={e => setThermalPrint(e.target.checked)} />
                  Thermal Print (80mm)
                </label>
                <div className="gopd-action-btns">
                  <button
                    className="gopd-print-btn" data-enter-submit onClick={handleSaveAndPrint} disabled={busy}
                    title="Ctrl+Enter = Save & Print from anywhere · Esc = close popup"
                  >
                    <Printer size={16} />
                    {busy ? 'Please wait...' : 'Save & Print'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(CRF_DEPTS.includes(departmentName) || departmentName === 'Miscellaneous') && (
        <div className="copd-crf-print-area">
          {crfFormType === 'ecg' ? (
            <ECGReportForm visit={crfVisit} barcodeDataUrl={crfBarcodeDataUrl} printedBy={crfPrintedBy} />
          ) : (
            <ClinicalRecordPrintTemplate
              visit={crfVisit}
              consultantName={crfConsultantName}
              barcodeDataUrl={crfBarcodeDataUrl}
              formTitle={`${departmentName.toUpperCase()} FORM`}
            />
          )}
        </div>
      )}
    </>
  );
}
