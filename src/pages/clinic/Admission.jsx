import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, Save, Search, X, User, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';
import { useClinicStore } from '../../store/useClinicStore';
import { useAuthStore } from '../../store/useAuthStore';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';
import { buildAdmissionPaymentReceiptHtml } from './admissionReceivingReceiptUtils';
import { validatePhoneNo, validateAge } from './opdValidation';
import './Admission.scss';
import './Antenatal.scss';

function fullName(emp) {
  return [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
}

// `@page` is a document-level rule — it can't be scoped to one component, and
// other pages (Panel Billing Report, Death Certificate Report) each declare
// their own `@page { size: A4 landscape }`. Since Vite bundles every page's
// SCSS into one global stylesheet, whichever `@page` rule happens to load last
// wins for the WHOLE app's prints, silently forcing Admission into landscape.
// Fix: inject a highest-priority override right before printing this page, and
// remove it once the print dialog closes so it doesn't leak into other pages.
function printAdmissionForm() {
  const styleId = 'adm-page-size-override';
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = '@page { size: A4 portrait !important; margin: 8mm 10mm !important; }';

  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000); // fallback in case afterprint doesn't fire

  window.print();
}

function numToWords(n) {
  if (n === 0) return 'zero';
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function cvt(num) {
    if (num === 0) return '';
    if (num < 20) return ones[num] + ' ';
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + ones[num % 10] : '') + ' ';
    if (num < 1000) return ones[Math.floor(num / 100)] + ' hundred ' + cvt(num % 100);
    if (num < 100000) return cvt(Math.floor(num / 1000)) + 'thousand ' + cvt(num % 1000);
    return cvt(Math.floor(num / 100000)) + 'lakh ' + cvt(num % 100000);
  }
  return cvt(Math.abs(Math.floor(n))).trim();
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

// ── Arrived Slip Lookup Modal ──────────────────────────────────────────────────
// Search recent OPD visits by patient name or phone and pick one — instead of
// having to already know the exact slip serial number.
function ArrivedSlipModal({ onSelect, onClose, searchOpdVisitsForAdmission }) {
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
      try { setResults((await searchOpdVisitsForAdmission(val)) || []); }
      catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  }, [searchOpdVisitsForAdmission]);

  return (
    <div className="ant-modal-overlay" onMouseDown={onClose}>
      <div className="ant-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="ant-modal-header">
          <div className="ant-modal-title"><Search size={16}/> Find Arrived Slip</div>
          <button className="ant-modal-close" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="ant-modal-search">
          <Search size={14} className="ant-modal-search-icon"/>
          <input ref={inputRef} placeholder="Search by patient name, phone, MR # or Slip #..." value={q} onChange={e => handleSearch(e.target.value)}/>
          {loading && <span className="ant-spinner"/>}
        </div>
        <div className="ant-modal-body">
          {results.length === 0 && !loading && (
            <div className="ant-modal-empty">{q.trim() ? 'No matching OPD slips found' : 'Type patient name or phone to search'}</div>
          )}
          {results.length > 0 && (
            <table className="ant-modal-table">
              <thead><tr><th>Slip #</th><th>Patient</th><th>Phone</th><th>Date</th></tr></thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.serialNo} onClick={() => onSelect(r)}>
                    <td>{r.serialNo}</td>
                    <td>{r.patientType} {r.patientName}</td>
                    <td>{r.phoneNo || '–'}</td>
                    <td>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '–'}</td>
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

// ── Admission Print Template ───────────────────────────────────────────────────
function AdmissionPrintTemplate({ form, doctors, roomCategories, availableBeds, isDuplicate, printedBy, barcodeDataUrl }) {
  const consultant = doctors.find(d => String(d.id) === String(form.consultantId));
  const roomCat    = roomCategories.find(r => String(r.id) === String(form.roomCategoryId));
  const bed        = availableBeds.find(b => String(b.id) === String(form.bedId));

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const admitDateTime = `${dateStr.replace(',', '')} ${timeStr}`;

  const statusLabel = { private: 'Private', staff: 'Staff', panel: 'Panel', cc: 'CC', complementary: 'Complementary' }[form.patientCategory] || 'Private';

  const ageStr = `${form.ageYears || 0} Year(s) ${form.ageMonths || 0} Month(s) ${form.ageDays || 0} Day(s)`;

  const advAmt   = parseFloat(form.advancePayment || 0);
  const advWords = advAmt > 0 ? numToWords(Math.floor(advAmt)) : '';

  return (
    <div className="adm-print">
      {/* Header — logo and hospital info live in their own full-width divs so the
          logo's width always matches the form's content width. */}
      <div className="adm-print-logo-box">
        <img src={RECEIPT_LOGO_DATA_URI} alt="Darul Shifa" className="adm-print-logo" />
      </div>
      <div className="adm-print-info-box">
        <div className="adm-print-hosp-addr">Jafar-e-Tayyar Co-operative Housing Society, Malir Karachi &nbsp; Ph.:4508390-91</div>
        {isDuplicate && <div className="adm-print-duplicate">Duplicate</div>}
      </div>

      {/* Status bar */}
      <div className="adm-print-status-bar">
        <span>Patients Status: <strong>{statusLabel}</strong></span>
        <span className="adm-print-form-title">ADMISSION FORM</span>
        <span>Printed By: <strong>{printedBy || 'SYSTEM'}</strong></span>
      </div>

      {/* Fields table */}
      <table className="adm-print-fields">
        <tbody>
          <tr>
            <td className="apf-lbl">Admission #:</td>
            <td className="apf-val">{form.admissionNo}</td>
            <td className="apf-lbl">Admit Date &amp; Time:</td>
            <td className="apf-val">{admitDateTime}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Patient Name:</td>
            <td className="apf-val">{form.patientTitle} {form.patientName}</td>
            <td className="apf-lbl">{form.gender === 'female' ? 'D/o.' : 'S/o.'}:</td>
            <td className="apf-val">{form.responsibleParty}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Room Category:</td>
            <td className="apf-val">{roomCat?.name || '—'}</td>
            <td className="apf-lbl">Room #:</td>
            <td className="apf-val">{bed?.name || '—'}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Age:</td>
            <td className="apf-val">{ageStr}</td>
            <td className="apf-lbl">Gender:</td>
            <td className="apf-val">{form.gender === 'male' ? 'Male' : 'Female'}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Address:</td>
            <td className="apf-val">{form.address}</td>
            <td className="apf-lbl">Phone / Mobile #:</td>
            <td className="apf-val">{form.phoneNo}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Arrived under RMO:</td>
            <td className="apf-val">{form.arrivedUnderRmo || 'Visiting Doctor (RMO)'}</td>
            <td className="apf-lbl">Consultant:</td>
            <td className="apf-val">{consultant?.name || '—'}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Responsible Party:</td>
            <td className="apf-val">{form.responsibleParty}</td>
            <td className="apf-lbl">Authority Letter:</td>
            <td className="apf-val">{form.authorityLetter ? 'Yes' : 'No'}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Adv. Received:</td>
            <td className="apf-val">{advAmt > 0 ? `Rs. ${advAmt.toFixed(2)}` : ''}</td>
            <td className="apf-lbl">Discharge Date:</td>
            <td className="apf-val"></td>
          </tr>
        </tbody>
      </table>

      {/* Received line */}
      {advAmt > 0 && (
        <div className="adm-print-recv-line">
          Received with thanks from <strong>{form.responsibleParty || form.patientName}</strong> Rupees {advWords} only.
        </div>
      )}

      {/* Room History */}
      <div className="adm-print-section-hdr">ROOM HISTORY</div>
      <table className="adm-print-history">
        <tbody>
          {[0, 1].map(i => (
            <tr key={i}>
              <td>Shifted to <span className="dln dln-md" /></td>
              <td>Category <span className="dln dln-sm" /></td>
              <td>Room # <span className="dln dln-sm" /></td>
              <td>Date &amp; Time <span className="dln dln-md" /></td>
              <td>Sign. <span className="dln dln-sm" /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Payment History */}
      <div className="adm-print-section-hdr">PAYMENT HISTORY</div>
      <table className="adm-print-history">
        <tbody>
          <tr>
            <td>Date: <span>{advAmt > 0 ? admitDateTime : <span className="dln dln-md" />}</span></td>
            <td>Amount: <span>{advAmt > 0 ? advAmt.toFixed(2) : <span className="dln dln-sm" />}</span></td>
            <td>Slip #: <span>{form.admissionNo || <span className="dln dln-sm" />}</span></td>
            <td>Sig. <span className="dln dln-sm" /></td>
          </tr>
          {[1, 2, 3].map(i => (
            <tr key={i}>
              <td>Date: <span className="dln dln-md" /></td>
              <td>Amount: <span className="dln dln-sm" /></td>
              <td>Slip #: <span className="dln dln-sm" /></td>
              <td>Sig. <span className="dln dln-sm" /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Halafnama */}
      <div className="adm-print-oath">
        <div className="adm-print-oath-title">حلف نامہ</div>
        <p className="adm-print-oath-text" dir="rtl">
میں / ہم بخوبی واقف ہوں کہ یہ ایک نجی ہسپتال ہے اور یہ کہ مجھے / ہمیں یہاں جو سہولت (جو مجھے فراہم کی جائے گی) اس کا معاوضہ ادا کرنا ہے۔ میں اللہ تعالیٰ کو حاضر ناظر جان کر کہتا ہوں / کرتی ہوں کہ ہسپتال کے بل کی ادائیگی کروں گا / کروں گی۔کسی بھی قسم کا ریفنڈ صرف صاحب دستخط شخص کو دیا جائے گا.</p>
      </div>

      {/* Signature row */}
      <div className="adm-print-sig-row">
        <span>Name: <span className="dln dln-lg" /></span>
        <span>Signature: <span className="dln dln-lg" /></span>
      </div>
      <div className="adm-print-sig-row">
        <span>Address: <span className="dln dln-lg" /></span>
        <span>Phone #: <span className="dln dln-lg" /></span>
      </div>

      {/* Diagnosis */}
      <table className="adm-print-diag">
        <tbody>
          <tr>
            <td className="apd-lbl">Provisional Diagnosis</td>
            <td className="apd-val"></td>
            <td className="apd-lbl apd-lbl-sm">Code Number</td>
            <td className="apd-val apd-val-sm apd-val--tall"></td>
          </tr>
          <tr>
            <td className="apd-lbl">Final Diagnosis</td>
            <td colSpan={3} className="apd-val"></td>
          </tr>
          <tr>
            <td className="apd-lbl">Operations</td>
            <td colSpan={3} className="apd-val apd-val--tall"></td>
          </tr>
        </tbody>
      </table>

      {/* Footer — form code + barcode */}
      <div className="adm-print-footer">
        <span className="adm-print-form-code">REC/FM/001-05-00</span>
        {barcodeDataUrl && <img src={barcodeDataUrl} alt="" className="adm-print-barcode" />}
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

const API = 'http://localhost:5001/api/clinic';

const PAYMENT_TYPE_MAP = {
  'cash':    'private',
  'Cash':    'private',
  'staff':   'staff',
  'Staff':   'staff',
  'panel':   'panel',
  'Panel':   'panel',
  'cc':      'cc',
  'CC':      'cc',
  'Complem.':'complementary',
  'complem.':'complementary',
  'jazzcash':'private',
  'JazzCash':'private',
};

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
  employeeId: null,
  panelCompanyId: null,
  panelEmployeeId: null,
  panelDependentId: null,
  panelLabel: '',
};

// Every field is required except Referred By and Previous Admission.
// Age/Phone reuse the same rules as the OPD slips (opdValidation.js) for
// consistent messaging across the app.
function validateAdmissionForm(form) {
  const required = [
    ['mrNo', 'MR #'],
    ['arrivedSlipNo', 'Arrived Slip #'],
    ['address', 'Address'],
    ['arrivedUnderRmo', 'Arrived under RMO'],
    ['consultantId', 'Consultant'],
    ['responsibleParty', 'Responsible Party'],
    ['roomCategoryId', 'Ward (Room Category)'],
    ['bedId', 'Bed #'],
  ];
  for (const [key, label] of required) {
    if (!String(form[key] || '').trim()) return `${label} is required`;
  }

  const phoneErr = validatePhoneNo(form.phoneNo);
  if (phoneErr) return phoneErr;

  const ageErr = validateAge(form.ageYears, form.ageMonths, form.ageDays);
  if (ageErr) return ageErr;

  if (form.advancePayment === '' || form.advancePayment == null || Number(form.advancePayment) < 1) {
    return 'Advance Payment kam se kam Rs. 1 honi chahiye';
  }

  if (form.surgery && !form.surgeryTypeId) return 'Surgery Type select karo';
  if (form.referralPatient === 'yes' && !form.referralNote.trim()) return 'Referral note likho (referred by name/hospital)';
  if (form.antenatal && !form.antenatalNo.trim()) return 'Antenatal number likho';

  return null;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Admission() {
  const {
    doctors, fetchDoctors,
    roomCategories, fetchRoomCategories,
    surgeryTypes, fetchSurgeryTypes,
    searchEmployees,
    fetchOpdPatientByMrNo,
    fetchOpdVisitBySerial,
    searchOpdVisitsForAdmission,
    fetchAvailableBeds,
    fetchNextSerialNo,
    createAdmission,
  } = useClinicStore();
  const { user } = useAuthStore();
  const printedBy = user?.name || user?.username || user?.email || '';

  const [form, setForm] = useState(EMPTY);
  const [availableBeds, setAvailableBeds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showPanelModal, setShowPanelModal] = useState(false);
  const [showArrivedSlipModal, setShowArrivedSlipModal] = useState(false);
  const [reprintReady, setReprintReady] = useState(false);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState('');
  const mrRef = useRef(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchDoctors();
    fetchRoomCategories();
    fetchSurgeryTypes();
    fetchNextSerialNo().then(s => setForm(f => ({ ...f, serialNo: s }))).catch(() => {});
    mrRef.current?.focus();
  }, [fetchDoctors, fetchRoomCategories, fetchSurgeryTypes, fetchNextSerialNo]);

  // Barcode on the printed form encodes the Admission # zero-padded to 8 digits
  // (matches the legacy paper form's "*00175640*" style Code 39 barcode).
  useEffect(() => {
    const admNo = form.admissionNo?.trim();
    if (!admNo) { setBarcodeDataUrl(''); return; }
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, admNo.padStart(8, '0'), { format: 'CODE39', width: 1.5, height: 32, displayValue: true, fontSize: 10, margin: 2 });
      setBarcodeDataUrl(canvas.toDataURL('image/png'));
    } catch {
      setBarcodeDataUrl('');
    }
  }, [form.admissionNo]);

  // Reprint (Report > Reprint > Admission): reload an existing admission by its
  // number and print it — does NOT call createAdmission, so no duplicate record.
  useEffect(() => {
    const reprintNo = searchParams.get('reprintNo');
    if (!reprintNo) return;
    (async () => {
      try {
        const res = await fetch(`${API}/admission/by-number/${encodeURIComponent(reprintNo)}`);
        const json = await res.json();
        if (!res.ok) { toast.error(json.message || 'Admission nahi mili'); return; }
        const rec = json.data;
        setForm(f => ({
          ...f,
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
        }));
        if (rec.roomCategoryId) {
          try { setAvailableBeds(await fetchAvailableBeds(rec.roomCategoryId)); } catch { /* ignore */ }
        }
        setReprintReady(true);
      } catch {
        toast.error('Admission reprint lookup failed');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!reprintReady) return;
    const t = setTimeout(() => printAdmissionForm(), 300);
    return () => clearTimeout(t);
  }, [reprintReady]);

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

  async function handleAdmissionLookup() {
    const admitNo = form.admissionNo?.trim();
    if (!admitNo) return;
    try {
      const res = await fetch(`${API}/patient-visits/by-admit/${admitNo}`);
      if (!res.ok) { toast.error('No patient found with this Admission #'); return; }
      const json = await res.json();
      const rec = json.data;
      const category = PAYMENT_TYPE_MAP[rec.paymentType] || 'private';
      const matchedDoctor = doctors.find(
        d => d.name?.toLowerCase() === rec.doctor?.toLowerCase()
      );
      setForm(f => ({
        ...f,
        patientName:     rec.patientName     || f.patientName,
        patientCategory: category,
        consultantId:    matchedDoctor ? String(matchedDoctor.id) : f.consultantId,
      }));
      toast.success('Patient data loaded from visit record');
    } catch {
      toast.error('Lookup failed');
    }
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

  // Shared by both the typed-serial lookup and the search modal's row click —
  // fills the form from whatever OPD visit record was resolved.
  function applyArrivedSlip(rec, serialNo) {
    setForm(f => ({
      ...f,
      arrivedSlipNo:    serialNo || rec.serialNo || f.arrivedSlipNo,
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
  }

  async function handleSlipLookup() {
    const slip = form.arrivedSlipNo?.trim();
    if (!slip) return;
    try {
      const rec = await fetchOpdVisitBySerial(slip);
      applyArrivedSlip(rec, slip);
    } catch {
      toast.error('No OPD visit found with this slip number');
    }
  }

  function handleArrivedSlipSelect(rec) {
    applyArrivedSlip(rec, rec.serialNo);
    setShowArrivedSlipModal(false);
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
    const formErr = validateAdmissionForm(form);
    if (formErr) return toast.error(formErr);
    setSaving(true);
    try {
      await createAdmission({ ...form, referralPatient: form.referralPatient === 'yes' });
      toast.success('Admission saved successfully');
      setForm(EMPTY);
      setAvailableBeds([]);
      fetchNextSerialNo().then(s => setForm(f => ({ ...f, serialNo: s }))).catch(() => {});
    } catch (err) {
      toast.error(err.message || 'Failed to save admission');
    } finally {
      setSaving(false);
    }
  }

  // Advance payment slip (same format as Receiving against Admission) — printed
  // alongside the Admission Form itself, not stored as a separate payment row
  // (the advance already counts once via ClinicAdmission.advancePayment in
  // Revenue Dashboard / Patients List — a duplicate ledger row would double it).
  function printAdvanceSlip(created) {
    const advAmt = parseFloat(form.advancePayment || 0);
    if (!(advAmt > 0)) return;

    const serial = created.serialNo || form.serialNo;
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, serial, { format: 'CODE128', width: 2, height: 48, displayValue: true, fontSize: 11, margin: 4 });
    const barcodeDataUrl = canvas.toDataURL('image/png');

    const html = buildAdmissionPaymentReceiptHtml({
      payment: { serialNo: serial, amount: advAmt, paymentType: 'cash', receivedAt: created.createdAt || new Date() },
      admission: {
        admissionNo: created.admissionNo || form.admissionNo,
        patientTitle: created.patientTitle || form.patientTitle,
        patientName: created.patientName || form.patientName,
        createdAt: created.createdAt || new Date(),
      },
      printedBy,
      barcodeDataUrl,
      isDuplicate: false,
    });

    const w = window.open('', '_blank', 'width=420,height=680');
    if (!w) { toast.error('Popup blocked — slip print skip ho gaya, sirf allow karke dobara try karein'); return; }
    w.document.write(html);
    w.document.close();
  }

  async function handleSaveAndPrint() {
    if (!form.admissionNo.trim()) return toast.error('Admission # is required');
    if (!form.patientName.trim()) return toast.error('Patient Name is required');
    const formErr = validateAdmissionForm(form);
    if (formErr) return toast.error(formErr);
    setSaving(true);
    try {
      const created = await createAdmission({ ...form, referralPatient: form.referralPatient === 'yes' });
      toast.success('Admission saved');
      printAdvanceSlip(created);
      printAdmissionForm();
      setForm(EMPTY);
      setAvailableBeds([]);
      fetchNextSerialNo().then(s => setForm(f => ({ ...f, serialNo: s }))).catch(() => {});
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
      {showArrivedSlipModal && (
        <ArrivedSlipModal
          searchOpdVisitsForAdmission={searchOpdVisitsForAdmission}
          onSelect={handleArrivedSlipSelect}
          onClose={() => setShowArrivedSlipModal(false)}
        />
      )}

      <div className="adm-page">
        <ClinicMenuBar />

        <div className="adm-body">
          <div className="adm-header-bar">
            <span className="adm-title">Admission</span>
          </div>

          <div className="adm-form">

            {/* ── Section: Identification ── */}
            <div className="adm-section">
              <h3 className="adm-section-title">Identification</h3>

              <div className="adm-row">
                <div className="adm-field">
                  <label>Serial #</label>
                  <input type="text" value={form.serialNo} readOnly className="adm-serial-input" title="Auto-generated — same running sequence as OPD slips" />
                </div>
                <div className="adm-field">
                  <label>Admission #</label>
                  <div className="adm-lookup-row">
                    <input
                      type="text"
                      value={form.admissionNo}
                      onChange={e => set('admissionNo', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAdmissionLookup()}
                      placeholder="e.g. 173380"
                    />
                    <button className="adm-lookup-btn" onClick={handleAdmissionLookup} title="Lookup">↵</button>
                  </div>
                </div>
              </div>

              <div className="adm-row">
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
                <div className="adm-field">
                  <label>Arrived Slip #</label>
                  <div className="adm-lookup-row">
                    <input
                      type="text"
                      value={form.arrivedSlipNo}
                      onChange={e => set('arrivedSlipNo', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSlipLookup()}
                      placeholder="OPD or Patients List serial number"
                    />
                    <button className="adm-lookup-btn" onClick={() => setShowArrivedSlipModal(true)} title="Search arrived slips">
                      <Search size={14} />
                    </button>
                  </div>
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
                  <input type="number" min="0" value={form.advancePayment} onChange={e => set('advancePayment', e.target.value)} placeholder="0.00" />
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
              <button className="adm-btn adm-btn--save-print" onClick={handleSaveAndPrint} disabled={saving}>
                <Printer size={16} />
                {saving ? 'Saving...' : 'Save & Print'}
              </button>
              <button className="adm-btn adm-btn--save" onClick={handleSave} disabled={saving}>
                <Save size={16} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Print Area (hidden on screen, shown when printing) ── */}
      <div className="adm-print-area">
        <AdmissionPrintTemplate
          form={form}
          doctors={doctors}
          roomCategories={roomCategories}
          availableBeds={availableBeds}
          isDuplicate={reprintReady}
          printedBy={printedBy}
          barcodeDataUrl={barcodeDataUrl}
        />
      </div>
    </>
  );
}
