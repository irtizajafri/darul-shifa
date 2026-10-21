import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { importBillingExcel, isExcelFile } from './panelBillingDetailImport';
import '../reports/ConsultantWiseFilter.scss';
import './PanelBillingDetailReport.scss';

const API = 'http://localhost:5001/api/clinic';

const pad2 = (n) => String(n).padStart(2, '0');
const monthStartIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`; };
const monthEndIso = () => { const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0); return `${last.getFullYear()}-${pad2(last.getMonth() + 1)}-${pad2(last.getDate())}`; };

// Panels > Reports > Billing Detail Report — filter step (owner's report
// format: filter screen first, then the preview). Same fields/defaults the
// old in-page filter bar had — Organisation / Person-Emp. / Consultant and
// Month From/To (this month). OK opens PanelBillingDetailReport at
// /view. Upload Excel is offered here too, as before.
export default function PanelBillingDetailFilter() {
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [companyId, setCompanyId] = useState('ALL');
  const [employeeId, setEmployeeId] = useState('ALL');
  const [consultantId, setConsultantId] = useState('ALL');
  const [fromDate, setFromDate] = useState(monthStartIso());
  const [toDate, setToDate] = useState(monthEndIso());
  const [uploading, setUploading] = useState(false);

  const loadCompanies = () => fetch(`${API}/panel-companies`).then((r) => r.json()).then((j) => setCompanies(j.data || [])).catch((err) => toast.error(err?.message || 'Failed to load panel companies'));

  useEffect(() => {
    loadCompanies();
    fetch(`${API}/panel-employees`).then((r) => r.json()).then((j) => setEmployees(j.data || [])).catch((err) => toast.error(err?.message || 'Failed to load panel employees'));
    fetch(`${API}/doctors?minimal=true`).then((r) => r.json()).then((j) => setDoctors(j.data || [])).catch((err) => toast.error(err?.message || 'Failed to load consultants'));
  }, []);

  // Person/Emp. list narrows to the picked Organisation
  const employeeOptions = companyId === 'ALL' ? employees : employees.filter((e) => String(e.companyId) === String(companyId));

  function handleShow() {
    if (!fromDate || !toDate) { toast.error('Month From aur To dono chunein'); return; }
    if (fromDate > toDate) { toast.error('From date, To date se pehle honi chahiye'); return; }
    const q = new URLSearchParams({ from: fromDate, to: toDate, companyId, employeeId, consultantId });
    navigate(`/clinic/panels/billing-detail/view?${q}`);
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!isExcelFile(file)) {
      toast.error('Sirf Excel file (.xlsx / .xls)'); e.target.value = ''; return;
    }
    setUploading(true);
    try {
      const msg = await importBillingExcel(file);
      if (msg === null) { toast.error('Excel mein valid data nahi mila'); return; }
      toast.success(msg);
      loadCompanies();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const selStyle = { width: 300 };

  return (
    <div className="cwf-page pbd-filter-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Billing Detail Report</span>
            <span className="cwf-title-right">Billing Detail Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl">Organisation</label>
              <SearchableSelect
                options={[{ id: 'ALL' }, ...companies]}
                value={companyId}
                onChange={(v) => { setCompanyId(v || 'ALL'); setEmployeeId('ALL'); }}
                getKey={(c) => c.id}
                getLabel={(c) => (c.id === 'ALL' ? 'ALL' : `${c.code} — ${c.name}`)}
                clearable={false}
                size="sm"
                style={selStyle}
              />
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Person / Emp.</label>
              <SearchableSelect
                options={[{ id: 'ALL' }, ...employeeOptions]}
                value={employeeId}
                onChange={(v) => setEmployeeId(v || 'ALL')}
                getKey={(e) => e.id}
                getLabel={(e) => (e.id === 'ALL' ? 'ALL' : `${e.empCode} — ${e.name}`)}
                clearable={false}
                size="sm"
                style={selStyle}
              />
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Consultant</label>
              <SearchableSelect
                options={[{ id: 'ALL' }, ...doctors]}
                value={consultantId}
                onChange={(v) => setConsultantId(v || 'ALL')}
                getKey={(d) => d.id}
                getLabel={(d) => (d.id === 'ALL' ? 'ALL' : `${d.code} — ${d.name}`)}
                clearable={false}
                size="sm"
                style={selStyle}
              />
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Month</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input type="date" className="cwf-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input type="date" className="cwf-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>

            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleUpload} />

            <div className="cwf-actions">
              <button type="button" className="cwf-btn cwf-btn--icon" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload Excel'}
              </button>
              <button type="button" className="cwf-btn cwf-btn--ok" onClick={handleShow}>OK</button>
              <button type="button" className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
