import { useState, useEffect, useRef, useCallback } from 'react';
import { Printer, Search, X, User, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import { buildReceiptHtml } from './receiptUtils';
import { printThermalReceipt, ThermalReceiptPrintTemplate } from './ThermalReceiptPrintTemplate';
import { validatePhoneNo, validateAge } from './opdValidation';
import { useAuthStore } from '../../store/useAuthStore';
import { handleSlipKeys } from '../../utils/keyboardNav';
import './GeneralOPD.scss';

const PATIENT_TYPES = ['MAST', 'MR', 'MRS', 'MISS', 'MS', 'BABY', 'INFANT'];
const ADMISSION_TITLE_MAP = { Mr: 'MR', Mrs: 'MRS', Ms: 'MS', Master: 'MAST', Baby: 'BABY' };

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
function formatDateTime(d) {
  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/');
  const timeStr = d.toLocaleTimeString('en-GB', { hour12: false });
  return `${dateStr} ${timeStr}`;
}

const EMPTY = {
  serialNo: '', patientType: 'MS', patientName: '',
  admitPatient: false, admitNo: '', adjustPayment: false,
  driver: '', location: '',
  age: '', ageMonths: 0, ageDays: 0, dob: '', gender: 'female',
  phoneNo: '', referredBy: '', advisedBy: '',
  hospitalPatient: true,
  billingType: 'cash', // staff | panel | complementary | cash | cc
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
export default function AmbulanceSlip() {
  const { fetchNextSerialNo, searchEmployees, createOpdVisit, printOpdVisit, searchAdmissionsForAdjustment, fetchAdmissionForAdjustment, doctors, fetchDoctors } = useClinicStore();
  const { user } = useAuthStore();

  const [form, setForm] = useState(EMPTY);
  const [dateTime, setDateTime] = useState(() => formatDateTime(new Date()));
  const [receive, setReceive] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showPanelModal, setShowPanelModal] = useState(false);
  const [showAdmitModal, setShowAdmitModal] = useState(false);

  // Thermal (80mm) receipt — printed in-page right after the A6 slip's own
  // popup, so both come out of the same "Save & Print" click.
  const [thermalVisit, setThermalVisit] = useState(null);
  const [thermalTokenNo, setThermalTokenNo] = useState(0);
  const [thermalIsDuplicate, setThermalIsDuplicate] = useState(false);
  const [thermalPrintedBy, setThermalPrintedBy] = useState('');
  const [thermalReady, setThermalReady] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetchNextSerialNo().then(s => set('serialNo', s)).catch(() => {});
    if (doctors.length === 0) fetchDoctors().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wait one render cycle after thermal* state is set so the hidden print
  // area actually has the new data in the DOM before window.print() runs.
  useEffect(() => {
    if (!thermalReady) return;
    const t = setTimeout(() => { printThermalReceipt(); setThermalReady(false); }, 300);
    return () => clearTimeout(t);
  }, [thermalReady]);

  function handleBillingTypeChange(v) {
    if (v === 'staff') {
      setForm(f => ({ ...f, billingType: v, panelCompanyId: null, panelEmployeeId: null, panelDependentId: null, panelLabel: '' }));
      setShowEmpModal(true);
    } else if (v === 'panel') {
      setForm(f => ({ ...f, billingType: v, employeeId: null }));
      setShowPanelModal(true);
    } else {
      setForm(f => ({ ...f, billingType: v, employeeId: null, panelCompanyId: null, panelEmployeeId: null, panelDependentId: null, panelLabel: '' }));
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

  // Auto-fill the slip from the admitted patient's own record.
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

  const isComplementary = form.billingType === 'complementary';
  const totalAmount = isComplementary ? 0 : (Number(amount) || 0);
  const refundAmt = Math.max(0, (Number(receive) || 0) - totalAmount);
  const fieldsDisabled = !form.hospitalPatient;

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
    const w = window.open('', '_blank', 'width=740,height=900');
    if (!w) { toast.error('Popup blocked — please allow popups'); return; }
    setBusy(true);
    try {
      const paymentType = form.billingType === 'staff' ? 'cash' : form.billingType;
      const created = await createOpdVisit({
        ...form,
        mrNo: null,
        department: 'Ambulance',
        paymentType,
        totalAmount,
        discount: 0,
        receive: Number(receive) || 0,
        refund: refundAmt,
        doctors: [],
      });
      const newId = created?.id;
      toast.success('Ambulance Slip saved');
      setForm(EMPTY);
      setReceive('');
      setAmount('');
      const next = await fetchNextSerialNo();
      set('serialNo', next);
      setDateTime(formatDateTime(new Date()));
      if (newId) {
        const { visit, tokenNo, isDuplicate } = await printOpdVisit(newId);
        const printedBy = user?.name || user?.username || user?.email || '';
        const html = buildReceiptHtml({ visit, tokenNo, isDuplicate, printedBy });
        w.document.write(html);
        w.document.close();

        setThermalVisit(visit);
        setThermalTokenNo(tokenNo);
        setThermalIsDuplicate(isDuplicate);
        setThermalPrintedBy(printedBy);
        setThermalReady(true);
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
            <span className="gopd-serial-lbl" style={{ marginLeft: '0.75rem' }}>Date &amp; Time</span>
            <input className="gopd-serial-input gopd-mr-input" style={{ width: 160 }} value={dateTime} readOnly />
          </div>
          <div className="gopd-title">Slip - Ambulance</div>
        </div>

        {/* ── Patient section ── */}
        <div className="gopd-patient">
          {/* Row 1 */}
          <div className="gopd-row gopd-row-1">
            <div className="gopd-admit-grp">
              <label className="gopd-chk-lbl">
                <input type="checkbox" checked={form.admitPatient} onChange={e => set('admitPatient', e.target.checked)} />
                Admit Patient
              </label>
              {form.admitPatient && (
                <>
                  <input className="gopd-inp-antenatal" value={form.admitNo} readOnly placeholder="Admit No" />
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

          {/* Row 2 — Patient Name / Driver / Location */}
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
                placeholder={form.billingType === 'staff' ? 'Select employee…' : form.billingType === 'panel' ? 'Select panel…' : ''}
                readOnly={form.billingType === 'staff' || form.billingType === 'panel'}
              />
              {form.billingType === 'staff' && (
                <button className="gopd-emp-change-btn" onClick={() => setShowEmpModal(true)}><Search size={13} /></button>
              )}
              {form.billingType === 'panel' && (
                <button className="gopd-emp-change-btn" onClick={() => setShowPanelModal(true)}><Search size={13} /></button>
              )}
              {form.billingType === 'panel' && form.panelLabel && (
                <span className="gopd-panel-badge">{form.panelLabel}</span>
              )}
            </div>
          </div>

          <div className="gopd-row gopd-row-1">
            <div className="gopd-name-grp">
              <span className="gopd-lbl">Driver</span>
              <input className="gopd-inp-name" value={form.driver} onChange={e => set('driver', e.target.value)} />
            </div>
            <div className="gopd-name-grp">
              <span className="gopd-lbl">Location</span>
              <input className="gopd-inp-name" value={form.location} onChange={e => set('location', e.target.value)} />
            </div>
          </div>

          {/* Row 3 — Age / DOB / Gender */}
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
              <span className="gopd-lbl" style={{ marginLeft: 8 }}>Phone #</span>
              <input className="gopd-inp-name" style={{ width: 130 }} value={form.phoneNo} onChange={e => set('phoneNo', e.target.value)} />
            </div>
            <div className="gopd-gender-grp">
              <label className="gopd-radio-lbl">
                <input type="radio" name="amb-gender" checked={form.gender === 'male'} onChange={() => set('gender', 'male')} /> Male
              </label>
              <label className="gopd-radio-lbl">
                <input type="radio" name="amb-gender" checked={form.gender === 'female'} onChange={() => set('gender', 'female')} /> Female
              </label>
            </div>
          </div>

          {/* Row 4 — Refered By / Adviced By */}
          <div className="gopd-row gopd-row-1">
            <div className="gopd-name-grp">
              <span className="gopd-lbl">Refered By</span>
              <input
                className="gopd-inp-name"
                value={form.referredBy}
                onChange={e => set('referredBy', e.target.value)}
                disabled={fieldsDisabled}
              />
            </div>
            <div className="gopd-name-grp">
              <span className="gopd-lbl">Adviced By</span>
              <select
                className="gopd-sel-type"
                style={{ width: 170 }}
                value={form.advisedBy}
                onChange={e => set('advisedBy', e.target.value)}
                disabled={fieldsDisabled}
              >
                <option value="">— Select —</option>
                {doctors.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Row 5 — Hospital Patient */}
          <div className="gopd-oncall-row">
            <label className="gopd-oncall-lbl">
              <input type="checkbox" checked={form.hospitalPatient} onChange={e => set('hospitalPatient', e.target.checked)} />
              Hospital Patient
            </label>
          </div>

          {/* Row 6 — Billing Type (combined radio) */}
          <div className="gopd-row gopd-row-radio">
            {[['staff','Staff'],['panel','Panel'],['complementary','Compl.'],['cash','Cash'],['cc','CC']].map(([v,l]) => (
              <label key={v} className="gopd-radio-lbl">
                <input type="radio" name="amb-billing" value={v} checked={form.billingType === v} onChange={() => handleBillingTypeChange(v)} />
                {l}
              </label>
            ))}
          </div>
        </div>

        {/* ── Amount / Receive / Refund + Save & Print ── */}
        <div className="gopd-main">
          <div className="gopd-right-panel" style={{ marginLeft: 'auto' }}>
            <div className="gopd-total">
              <div className="gopd-total-title">Amount</div>
              <div className="gopd-total-body">
                <div className="gopd-total-fields">
                  <div className="gopd-total-row">
                    <span className="gopd-total-lbl">Amount</span>
                    <input className="gopd-total-inp" value={amount} onChange={e => setAmount(e.target.value)} disabled={isComplementary} placeholder="0" />
                  </div>
                  <div className="gopd-total-row">
                    <span className="gopd-total-lbl">Receive</span>
                    <input className="gopd-total-inp" value={receive} onChange={e => setReceive(e.target.value)} disabled={isComplementary} />
                  </div>
                  <div className="gopd-total-row">
                    <span className="gopd-total-lbl">Refund</span>
                    <span className="gopd-refund-val">{refundAmt > 0 ? refundAmt : '–'}</span>
                  </div>
                </div>
                <div className="gopd-total-amount">
                  {isComplementary ? (
                    <span style={{ color: '#16a34a', fontSize: '0.78rem', fontWeight: 700 }}>Complementary</span>
                  ) : totalAmount}
                </div>
                <div className="gopd-action-btns">
                  <button
                    className="gopd-print-btn" data-enter-submit onClick={handleSaveAndPrint} disabled={busy}
                    title="Ctrl+Enter = Save & Print from anywhere · Esc = close popup"
                  >
                    <Printer size={16} />
                    {busy ? 'Please wait...' : 'Print Slip'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="th-print-area">
        <ThermalReceiptPrintTemplate
          visit={thermalVisit}
          tokenNo={thermalTokenNo}
          isDuplicate={thermalIsDuplicate}
          printedBy={thermalPrintedBy}
        />
      </div>
    </>
  );
}
