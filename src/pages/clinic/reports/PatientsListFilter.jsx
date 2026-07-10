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

function detectFormat(raw) {
  for (let i = 0; i < Math.min(raw.length, 15); i++) {
    if (String(raw[i][0] || '').trim() === 'S.No.') {
      return { newFormat: raw[i].some(c => String(c || '').trim() === 'SUB Department') };
    }
  }
  return { newFormat: true };
}

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb  = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const { newFormat } = detectFormat(raw);
        const COL = newFormat
          ? { dept:5, subDept:6, doctor:7, type:8, received:9, bal:10, dis:11 }
          : { dept:5, subDept:null, doctor:6, type:7, received:9, bal:10, dis:11 };
        const rows = [];
        for (const row of raw) {
          if (typeof row[0] !== 'number' || row[0] < 1000) continue;
          if (typeof row[2] !== 'number' || row[2] < 40000) continue;
          rows.push({
            serialNo:      row[0],
            admitNo:       row[1] !== '' ? row[1] : null,
            visitDate:     excelSerialToDateStr(row[2]),
            visitTime:     excelFractionToTime(row[2]),
            patientName:   String(row[4]           || '').trim(),
            department:    String(row[COL.dept]    || '').trim() || null,
            subDepartment: COL.subDept != null ? (String(row[COL.subDept] || '').trim() || null) : null,
            doctor:        String(row[COL.doctor]  || '').trim() || null,
            paymentType:   String(row[COL.type]    || '').trim() || null,
            received:      Number(row[COL.received]) || 0,
            balance:       Number(row[COL.bal])      || 0,
            discount:      Number(row[COL.dis])      || 0,
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
  const [fromTime,  setFromTime]  = useState('08:00');
  const [toTime,    setToTime]    = useState('07:59');
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
                <input type="time" className="plf-input plf-input--time" value={fromTime} onChange={e => setFromTime(e.target.value)} />
              </div>
              <div className="plf-field-group">
                <input type="time" className="plf-input plf-input--time" value={toTime} onChange={e => setToTime(e.target.value)} />
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
