import { useState, useEffect, useRef, useCallback } from 'react';
import { Printer, Search, X, User, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import { buildEmergencyReceiptHtml } from './emergencyReceiptUtils';
import { printClinicalRecordForm, ClinicalRecordPrintTemplate } from './ClinicalRecordForm';
import { validatePhoneNo, validateAge } from './opdValidation';
import { useAuthStore } from '../../store/useAuthStore';
import { handleSlipKeys } from '../../utils/keyboardNav';
import './GeneralOPD.scss';

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
  if (days < 0)   { months--; days   += new Date(today.getFullYear(), today.getMonth(), 0).getDate(); }
  if (months < 0) { years--;  months += 12; }
  return { age: String(Math.max(0, years)), ageMonths: Math.max(0, months), ageDays: Math.max(0, days) };
}

const EMPTY = {
  serialNo: '', patientType: 'MAST', patientName: '',
  admitPatient: false, admitNo: '', adjustPayment: false,
  age: '', ageMonths: 0, ageDays: 0, dob: '', gender: 'male',
  phoneNo: '', referredBy: '',
  patientCategory: 'normal',
  paymentMethod: 'cash',
  visitType: 'opd', onCall: false,
  employeeId: null,
  panelCompanyId: null, panelEmployeeId: null, panelDependentId: null,
  panelLabel: '',
};

// ── Employee Modal ────────────────────────────────────────────────────────────
function EmployeeModal({ onSelect, onClose, searchEmployees }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

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

  return (
    <div className="gopd-modal-overlay" onMouseDown={onClose}>
      <div className="gopd-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="gopd-modal-header">
          <div className="gopd-modal-title"><User size={16} /> Search Employee</div>
          <button className="gopd-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="gopd-modal-body">
          <input ref={inputRef} className="gopd-modal-search" placeholder="Name / Code…"
            value={q} onChange={e => handleSearch(e.target.value)} />
          {loading && <div className="gopd-modal-loading">Searching…</div>}
          <table className="gopd-modal-table">
            <thead><tr><th>Code</th><th>Name</th><th>Phone</th></tr></thead>
            <tbody>
              {results.map(emp => (
                <tr key={emp.id} className="gopd-modal-row" onClick={() => onSelect({ emp, dependent: null })}>
                  <td>{emp.empCode}</td>
                  <td>{fullName(emp)}</td>
                  <td className="gopd-modal-phone">{emp.phone || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Panel Modal ───────────────────────────────────────────────────────────────
function PanelModal({ onSelect, onClose }) {
  const { panelCompanies, panelEmployees, fetchPanelCompanies, fetchPanelEmployees } = useClinicStore();
  const [companyId, setCompanyId] = useState('');
  const [empId, setEmpId] = useState('');
  const [depIdx, setDepIdx] = useState('');

  useEffect(() => { fetchPanelCompanies(); fetchPanelEmployees(); }, []);

  const company = panelCompanies.find(c => c.id === Number(companyId));
  const employees = companyId ? panelEmployees.filter(e => e.panelCompanyId === Number(companyId)) : [];
  const employee = employees.find(e => e.id === Number(empId));
  const dependents = employee?.dependents || [];

  function handleOk() {
    if (!companyId) { toast.error('Select a company'); return; }
    const dep = depIdx !== '' ? dependents[Number(depIdx)] : null;
    const patientName = dep ? dep.name : (employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : '');
    const dob = dep ? formatDob(dep.dob) : (employee ? formatDob(employee.dob) : '');
    const panelLabel = [company?.code, employee?.empCode].filter(Boolean).join(' / ');
    onSelect({ panelCompanyId: Number(companyId), panelEmployeeId: empId ? Number(empId) : null, panelDependentId: dep ? dep.id : null, patientName, panelLabel, dob });
  }

  return (
    <div className="gopd-modal-overlay" onMouseDown={onClose}>
      <div className="gopd-modal gopd-modal--panel" onMouseDown={e => e.stopPropagation()}>
        <div className="gopd-modal-header">
          <div className="gopd-modal-title"><Building2 size={16} /> Panel Selection</div>
          <button className="gopd-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="gopd-modal-body">
          <div className="gopd-modal-row-field">
            <label>Company</label>
            <select value={companyId} onChange={e => { setCompanyId(e.target.value); setEmpId(''); setDepIdx(''); }}>
              <option value="">— Select —</option>
              {panelCompanies.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
          {companyId && (
            <div className="gopd-modal-row-field">
              <label>Employee</label>
              <select value={empId} onChange={e => { setEmpId(e.target.value); setDepIdx(''); }}>
                <option value="">— Select (optional) —</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.empCode} — {e.firstName} {e.lastName}</option>)}
              </select>
            </div>
          )}
          {dependents.length > 0 && (
            <div className="gopd-modal-row-field">
              <label>Dependent</label>
              <select value={depIdx} onChange={e => setDepIdx(e.target.value)}>
                <option value="">— Employee (self) —</option>
                {dependents.map((d, i) => <option key={i} value={i}>{d.name}</option>)}
              </select>
            </div>
          )}
          <div className="gopd-modal-actions">
            <button className="gopd-modal-ok" onClick={handleOk}>Select</button>
            <button onClick={onClose}>Cancel</button>
          </div>
        </div>
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EmergencyOPD() {
  const { fetchAvailableDoctors, fetchNextSerialNo, searchEmployees, createOpdVisit, printOpdVisit, searchAdmissionsForAdjustment, fetchAdmissionForAdjustment, ccConfig, fetchCcConfig } = useClinicStore();
  const { user } = useAuthStore();

  const [form, setForm] = useState(EMPTY);
  const [leftDoctors, setLeftDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [checkedLeft, setCheckedLeft] = useState([]);
  const [rightDoctors, setRightDoctors] = useState([]);
  // Free-text filter over the left-panel picker (Doctor/Sub Department name
  // or code).
  const [leftSearch, setLeftSearch] = useState('');
  const [receive, setReceive] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState('amount');
  const [busy, setBusy] = useState(false);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showPanelModal, setShowPanelModal] = useState(false);
  const [showAdmitModal, setShowAdmitModal] = useState(false);

  // Clinical Record Form — printed in-page after the slip; holds the data for
  // whichever visit was just saved.
  const [crfVisit, setCrfVisit] = useState(null);
  const [crfConsultantName, setCrfConsultantName] = useState('');
  const [crfBarcodeDataUrl, setCrfBarcodeDataUrl] = useState('');
  const [crfReady, setCrfReady] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetchNextSerialNo().then(s => set('serialNo', s)).catch(() => {});
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
    setLeftSearch('');
    try {
      const rows = await fetchAvailableDoctors({ day: todayDay(), time: currentTime(), onCall, departmentName: 'Emergency' });
      setLeftDoctors(rows || []);
    } catch { setLeftDoctors([]); }
    finally { setLoadingDoctors(false); }
  }

  // Matches by Doctor name/code or Sub Department name/code.
  function matchesLeftSearch(r) {
    const q = leftSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.doctor?.name || '').toLowerCase().includes(q) ||
      (r.doctor?.code || '').toLowerCase().includes(q) ||
      (r.subDept?.name || '').toLowerCase().includes(q) ||
      (r.subDept?.code || '').toLowerCase().includes(q)
    );
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

  const refundAmt = Math.max(0, (Number(receive) || 0) - grandTotal);

  // Received amount auto-follows the selected slip amount (doctor/item +
  // discount + CC surcharge) so it never has to be typed manually. Panel
  // patients don't pay cash at the counter — the company settles later via
  // Panel Cheque Transaction — so Received always stays 0 for them even
  // though the slip's own Amount/Total keep showing the real charge.
  useEffect(() => {
    setReceive(isPanel ? '0' : (isComplementary ? '' : String(grandTotal)));
  }, [grandTotal, isComplementary, isPanel]);

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
  }

  async function handleSaveAndPrint() {
    if (!form.patientName.trim()) { toast.error('Patient Name is required'); return; }
    if (!form.serialNo.trim()) { toast.error('Serial No is required'); return; }
    const phoneErr = validatePhoneNo(form.phoneNo);
    if (phoneErr) { toast.error(phoneErr); return; }
    const ageErr = validateAge(form.age, form.ageMonths, form.ageDays);
    if (ageErr) { toast.error(ageErr); return; }
    if (rightDoctors.length === 0) { toast.error('Kam az kam ek doctor/test select karo — bina selection ke slip nahi banegi'); return; }
    const w = window.open('', '_blank', 'width=740,height=900');
    if (!w) { toast.error('Popup blocked — please allow popups'); return; }
    setBusy(true);
    try {
      const created = await createOpdVisit({
        ...form,
        mrNo: null,
        department: 'Emergency',
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
        })),
      });
      const newId = created?.id;
      toast.success('Emergency Visit saved');
      const consultantName = rightDoctors[0]?.doctor?.name || '';
      setForm(EMPTY);
      setRightDoctors([]);
      setCheckedLeft([]);
      setReceive('');
      setDiscount('');
      setDiscountType('amount');
      const next = await fetchNextSerialNo();
      set('serialNo', next);
      loadDoctors(false);
      if (newId) {
        const { visit, tokenNo, isDuplicate } = await printOpdVisit(newId);
        const printedBy = user?.name || user?.username || user?.email || '';
        const html = buildEmergencyReceiptHtml({ visit, tokenNo, isDuplicate, printedBy });
        w.document.write(html);
        w.document.close();

        setCrfVisit(visit);
        setCrfConsultantName(consultantName);
        setCrfBarcodeDataUrl('');
        setCrfReady(true);
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
        <EmployeeModal searchEmployees={searchEmployees} onSelect={handleEmpSelect} onClose={() => setShowEmpModal(false)} />
      )}
      {showPanelModal && (
        <PanelModal onSelect={handlePanelSelect} onClose={() => setShowPanelModal(false)} />
      )}
      {showAdmitModal && (
        <AdmitPatientLookupModal
          searchAdmissionsForAdjustment={searchAdmissionsForAdjustment}
          onSelect={handleAdmitSelect}
          onClose={() => setShowAdmitModal(false)}
        />
      )}

      <div className="gopd" onKeyDown={(e) => handleSlipKeys(e, { onEscape: closeAllPopups })}>
        {/* ── Header ── */}
        <div className="gopd-header">
          <div className="gopd-serial-wrap">
            <span className="gopd-serial-lbl">Serial #</span>
            <input className="gopd-serial-input gopd-mr-input" value={form.serialNo} readOnly />
            <span className="gopd-serial-lbl" style={{ marginLeft: '0.75rem' }}>Phone #</span>
            <input className="gopd-serial-input gopd-mr-input" value={form.phoneNo} onChange={e => set('phoneNo', e.target.value)} />
          </div>
          <div className="gopd-title">Emergency OPD</div>
        </div>

        {/* ── Patient section ── */}
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
                placeholder={form.patientCategory === 'staff' ? 'Select employee…' : form.patientCategory === 'panel' ? 'Select panel…' : ''}
                readOnly={form.patientCategory === 'staff' || form.patientCategory === 'panel'}
              />
              {form.patientCategory === 'staff' && (
                <button className="gopd-emp-change-btn" onClick={() => setShowEmpModal(true)}><Search size={13} /></button>
              )}
              {form.patientCategory === 'panel' && (
                <button className="gopd-emp-change-btn" onClick={() => setShowPanelModal(true)}><Search size={13} /></button>
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
                <input type="radio" name="emr-gender" checked={form.gender === 'male'} onChange={() => set('gender', 'male')} /> Male
              </label>
              <label className="gopd-radio-lbl">
                <input type="radio" name="emr-gender" checked={form.gender === 'female'} onChange={() => set('gender', 'female')} /> Female
              </label>
            </div>
          </div>

          {/* Row 3 – Patient Category */}
          <div className="gopd-row gopd-row-radio">
            {[['normal','Normal'],['staff','Staff'],['panel','Panel'],['complementary','Complementary']].map(([v,l]) => (
              <label key={v} className="gopd-radio-lbl">
                <input type="radio" name="emr-category" value={v} checked={form.patientCategory === v} onChange={() => handleCategoryChange(v)} />
                {l}
              </label>
            ))}
          </div>

          {/* Row 4 – Payment Method */}
          <div className="gopd-row gopd-row-radio">
            {[['cash','Cash'],['jazzcash','JazzCash'],['online','Online'],['cc','CC']].map(([v,l]) => (
              <label key={v} className={`gopd-radio-lbl${paymentMethodDisabled ? ' gopd-radio-lbl--dim' : ''}`}>
                <input type="radio" name="emr-payment" value={v} checked={form.paymentMethod === v}
                  onChange={() => set('paymentMethod', v)} disabled={paymentMethodDisabled} />
                {l}
              </label>
            ))}
          </div>
        </div>

        {/* ── ON CALL ── */}
        <div className="gopd-oncall-row">
          <label className="gopd-oncall-lbl">
            <input type="checkbox" checked={form.onCall} onChange={e => set('onCall', e.target.checked)} />
            ON CALL
          </label>
        </div>

        {/* ── Two-panel ── */}
        <div className="gopd-main">
          <div className="gopd-left-panel">
            <div className="gopd-table-wrap">
              <div className="gopd-left-search-row">
                <input
                  className="gopd-left-search-input"
                  value={leftSearch}
                  onChange={e => setLeftSearch(e.target.value)}
                  placeholder="Search Doctor or Sub Department…"
                />
              </div>
              {loadingDoctors ? (
                <div className="gopd-loading">Loading doctors...</div>
              ) : (
                <table className="gopd-table">
                  <thead>
                    <tr>
                      <th style={{ width: 28 }}></th>
                      <th style={{ width: 52 }}>Code</th>
                      <th>Doctor</th>
                      <th style={{ width: 80 }}>Amount</th>
                      <th>Sub Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leftDoctors.filter(matchesLeftSearch).length === 0 ? (
                      <tr><td colSpan={5} className="gopd-empty-cell">{leftDoctors.length === 0 ? 'No doctors scheduled' : 'No match'}</td></tr>
                    ) : leftDoctors.filter(matchesLeftSearch).map(r => (
                      <tr key={r.id} className={checkedLeft.includes(r.id) ? 'gopd-tr--sel' : ''} onClick={() => toggleLeft(r.id)}>
                        <td><input type="checkbox" checked={checkedLeft.includes(r.id)} onChange={() => toggleLeft(r.id)} onClick={e => e.stopPropagation()} /></td>
                        <td>{r.doctor?.code}</td>
                        <td>{r.doctor?.name}</td>
                        <td>{r.normalCharges}</td>
                        <td>{r.subDept?.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
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
                    <th>Doctor Name</th>
                    <th style={{ width: 72 }}>Amount</th>
                    <th>Sub Department</th>
                  </tr>
                </thead>
                <tbody>
                  {rightDoctors.length === 0 ? (
                    <tr><td colSpan={3} className="gopd-empty-cell">No doctors selected</td></tr>
                  ) : rightDoctors.map(r => (
                    <tr key={r.id}>
                      <td>{r.doctor?.name}</td>
                      <td>{r.normalCharges}</td>
                      <td>{r.subDept?.name}</td>
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
                        <input className="gopd-total-inp" type="number" min={0}
                          value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" />
                        <div className="gopd-discount-toggle">
                          <button className={`gopd-disc-btn ${discountType === 'amount' ? 'gopd-disc-btn--active' : ''}`}
                            onClick={() => { setDiscountType('amount'); setDiscount(''); }} type="button">PKR</button>
                          <button className={`gopd-disc-btn ${discountType === 'percent' ? 'gopd-disc-btn--active' : ''}`}
                            onClick={() => { setDiscountType('percent'); setDiscount(''); }} type="button">%</button>
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

      <div className="copd-crf-print-area">
        <ClinicalRecordPrintTemplate
          visit={crfVisit}
          consultantName={crfConsultantName}
          barcodeDataUrl={crfBarcodeDataUrl}
          formTitle="EMERGENCY FORM"
        />
      </div>
    </>
  );
}
