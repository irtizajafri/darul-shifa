import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './PatientsListFilter.scss';

const API = 'http://localhost:5001/api/clinic';

const todayStr    = () => new Date().toISOString().split('T')[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; };

const PATIENT_TYPES = ['Staff', 'Panel', 'Complem.', 'Cash', 'CC', 'JazzCash'];

const GROUP_OPTIONS = [
  { value: 'without_users',     label: 'Without users' },
  { value: 'user_wise',         label: 'User wise' },
  { value: 'user_shift_wise',   label: 'User shift wise' },
  { value: 'user_shift_summary',label: 'User shift wise summary' },
];

function excelSerialToDateStr(serial) {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
function excelFractionToTime(serial) {
  const frac = serial - Math.floor(serial);
  const mins = Math.round(frac * 24 * 60);
  return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
}

// Header text can vary in wording/casing/extra spaces/extra blank spacer columns
// between exports — so columns are located by matching the actual header row
// text instead of assuming fixed positions (a fixed-offset guess broke silently
// whenever the sheet had one extra/missing column).
function normalizeHeader(s) {
  return String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function findHeaderRow(raw) {
  for (let i = 0; i < Math.min(raw.length, 15); i++) {
    if (/^S\.?\s*NO\.?$/.test(normalizeHeader(raw[i][0]))) return raw[i];
  }
  return null;
}

// Best-effort fallback if no recognizable header row is found at all.
const DEFAULT_COL = { dept: 5, subDept: 6, doctor: 7, type: 8, received: 9, bal: 10, dis: 11 };

function buildColumnMap(headerRow) {
  const COL = { subDept: null };
  headerRow.forEach((cell, idx) => {
    const h = normalizeHeader(cell);
    if (!h) return;
    if (h === 'DEPARTMENT') COL.dept = idx;
    else if (h.startsWith('SUB DEPARTMENT') || h === 'SUB DEPT' || h === 'SUB DEPT.') COL.subDept = idx;
    else if (h.startsWith('DOCTOR')) COL.doctor = idx;
    // 'Type' is deliberately NOT read from its own header label: some exports
    // insert a stray blank header cell right after "Doctor/Consultant" that
    // shifts the "Type" label one column right of where the Type data
    // actually lives — the data always sits immediately after Doctor, so
    // it's derived positionally below instead of trusting this header cell.
    else if (h.startsWith('RECEIVED')) COL.received = idx;
    else if (h.startsWith('BAL')) COL.bal = idx;
    else if (h.startsWith('DIS')) COL.dis = idx;
  });
  // subDept genuinely absent in some legacy exports — leave null (not a mis-detection).
  for (const k of Object.keys(DEFAULT_COL)) if (k !== 'subDept' && COL[k] == null) COL[k] = DEFAULT_COL[k];
  COL.type = COL.doctor + 1;
  return COL;
}

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb  = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const headerRow = findHeaderRow(raw);
        const COL = headerRow ? buildColumnMap(headerRow) : { ...DEFAULT_COL, subDept: null };
        const rows = [];
        for (const row of raw) {
          const sNo = Number(row[0]);
          if (!sNo || sNo < 1000) continue;
          // Some rows: col[2]=AdmitNo (large), col[3]=Date, col[4]=Time, col[5]=PatientName
          // Other rows: col[2]=DateTime combined, col[4]=PatientName (string)
          const col2 = Number(row[2]);
          const col3 = Number(row[3]);
          const shifted = col3 >= 40000 && col3 < 65000;
          const dateSerial = shifted ? col3 : col2;
          if (!dateSerial || dateSerial < 40000) continue;
          const s = shifted ? 1 : 0;
          rows.push({
            serialNo:      sNo,
            admitNo:       shifted ? (col2 || null) : (row[1] !== '' ? Number(row[1]) || null : null),
            visitDate:     excelSerialToDateStr(dateSerial),
            visitTime:     shifted ? excelFractionToTime(row[4]) : excelFractionToTime(row[2]),
            patientName:   String(row[4 + s]                || '').trim(),
            department:    String(row[COL.dept    + s]      || '').trim() || null,
            subDepartment: COL.subDept != null ? (String(row[COL.subDept + s] || '').trim() || null) : null,
            doctor:        String(row[COL.doctor  + s]      || '').trim() || null,
            paymentType:   String(row[COL.type    + s]      || '').trim() || null,
            received:      Number(row[COL.received + s])    || 0,
            balance:       Number(row[COL.bal      + s])    || 0,
            discount:      Number(row[COL.dis      + s])    || 0,
          });
        }
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function PatientsListFilter() {
  const navigate     = useNavigate();
  const fileInputRef = useRef(null);

  const [fromDate,  setFromDate]  = useState(todayStr());
  const [toDate,    setToDate]    = useState(tomorrowStr());
  const [fromTime,  setFromTime]  = useState('08:00:00');
  const [toTime,    setToTime]    = useState('07:59:59');
  const [types,     setTypes]     = useState([]);
  const [groupBy,   setGroupBy]   = useState('without_users');
  const [uploading, setUploading] = useState(false);

  const toggleType = (t) =>
    setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const handleOk = () => {
    const params = new URLSearchParams({ fromDate, toDate, fromTime, toTime, groupBy });
    if (types.length) params.set('types', types.join(','));
    navigate(`/clinic/reports/patients-list/view?${params}`);
  };

  const handleClose = () => navigate(-1);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      toast.error('Sirf Excel file upload karo (.xlsx / .xls)');
      e.target.value = ''; return;
    }
    setUploading(true);
    try {
      const rows = await parseExcelFile(file);
      if (!rows.length) { toast.error('File mein valid data nahi mila'); return; }
      const res  = await fetch(`${API}/patient-visits/bulk`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success(`${json.data.inserted} records imported successfully`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="plf-page">
      <ClinicMenuBar />

      <div className="plf-center">
        <div className="plf-window">

          {/* Title bar */}
          <div className="plf-titlebar">
            <span className="plf-title-left">Reports — Patients List</span>
            <span className="plf-title-right">Patients List</span>
          </div>

          {/* Form */}
          <div className="plf-body">

            {/* Date */}
            <div className="plf-row">
              <label className="plf-lbl">Date</label>
              <div className="plf-field-group">
                <span className="plf-sub-lbl">From</span>
                <input type="date" className="plf-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div className="plf-field-group">
                <span className="plf-sub-lbl">To</span>
                <input type="date" className="plf-input" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>

            {/* Time */}
            <div className="plf-row">
              <label className="plf-lbl">Time</label>
              <div className="plf-field-group">
                <input type="time" step="1" className="plf-input plf-input--time" value={fromTime} onChange={e => setFromTime(e.target.value)} />
              </div>
              <div className="plf-field-group">
                <input type="time" step="1" className="plf-input plf-input--time" value={toTime} onChange={e => setToTime(e.target.value)} />
              </div>
            </div>

            {/* Patient Type */}
            <div className="plf-section">
              <fieldset className="plf-fieldset">
                <legend className="plf-legend">Patient Type</legend>
                <div className="plf-checkboxes">
                  {PATIENT_TYPES.map(t => (
                    <label key={t} className="plf-chk-label">
                      <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} />
                      {t}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {/* Grouping */}
            <div className="plf-radios">
              {GROUP_OPTIONS.map(opt => (
                <label key={opt.value} className="plf-radio-label">
                  <input type="radio" name="groupBy" value={opt.value}
                    checked={groupBy === opt.value} onChange={() => setGroupBy(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>

            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleUpload} />

            {/* Buttons */}
            <div className="plf-actions">
              <button className="plf-btn plf-btn--ok" onClick={handleOk}>OK</button>
              <button className="plf-btn plf-btn--close" onClick={handleClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
