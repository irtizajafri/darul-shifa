import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { RefreshCw, Upload, Printer, FileDown, ArrowLeft, BedDouble } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import hospitalLogo from '../../../assets/download.png';
import './PatientsListReport.scss';

const API = 'http://localhost:5001/api/clinic';

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
  // Find header row — look for row containing 'S.No.'
  for (let i = 0; i < Math.min(raw.length, 15); i++) {
    const row = raw[i];
    if (String(row[0] || '').trim() === 'S.No.') {
      // Check if SUB Department column exists (new format)
      const hasSubDept = row.some(c => String(c || '').trim() === 'SUB Department');
      return { headerRow: i, newFormat: hasSubDept };
    }
  }
  return { headerRow: 6, newFormat: true };
}

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        const { newFormat } = detectFormat(raw);

        // Column positions
        // Old: [0]S.No [1]AdmitNo [2]Date [3]Time [4]Name [5]Dept [6]Doctor [7]Type [8]empty [9]Received [10]Bal [11]Dis
        // New: [0]S.No [1]AdmitNo [2]Date [3]Time [4]Name [5]Dept [6]SubDept [7]Doctor [8]Type  [9]Received [10]Bal [11]Dis
        const COL = newFormat
          ? { dept:5, subDept:6, doctor:7, type:8, received:9, bal:10, dis:11 }
          : { dept:5, subDept:null, doctor:6, type:7, received:9, bal:10, dis:11 };

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

const fmt = (n) => Number(n || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';

export default function PatientsListReport() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const fromDate = searchParams.get('fromDate') || new Date().toISOString().split('T')[0];
  const toDate   = searchParams.get('toDate')   || fromDate;
  const fromTime = searchParams.get('fromTime') || '08:00:00';
  const toTime   = searchParams.get('toTime')   || '07:59:59';
  const types    = searchParams.get('types')?.split(',').filter(Boolean) || [];

  const [visits, setVisits]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const fileInputRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ fromDate, toDate, fromTime, toTime });
      if (types.length) params.set('paymentTypes', types.join(','));
      const res  = await fetch(`${API}/patient-visits?${params}`);
      const json = await res.json();
      setVisits(Array.isArray(json.data) ? json.data : []);
      setLastRefresh(new Date());
    } catch {
      toast.error('Data load error');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, fromTime, toTime, types.join(',')]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls'].includes(ext)) {
      toast.error('Sirf Excel file upload karo (.xlsx / .xls)');
      e.target.value = ''; return;
    }
    setUploading(true);
    try {
      const rows = await parseExcelFile(file);
      if (!rows.length) { toast.error('File mein valid data nahi mila'); return; }
      const res  = await fetch(`${API}/patient-visits/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success(`${json.data.inserted} records imported`);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleGenerateAdmissions = async () => {
    setGenerating(true);
    try {
      const res  = await fetch(`${API}/admission/generate-from-visits`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success(`${json.data.created} admission(s) created, ${json.data.skipped} already existed`);
    } catch (err) {
      toast.error(err.message || 'Generate failed');
    } finally {
      setGenerating(false);
    }
  };

  const totalReceived = visits.reduce((s, v) => s + Number(v.received || 0), 0);
  const totalDiscount = visits.reduce((s, v) => s + Number(v.discount  || 0), 0);

  const fmtDisplayDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';

  const handleExportExcel = () => {
    if (!visits.length) { toast.error('Koi data nahi export karne ke liye'); return; }

    const header = [
      ['DARUL SHIFA IMAM KHOMEINI (q.s.)'],
      [''],
      ['Date:', fmtDisplayDate(fromDate), '', 'To:', fmtDisplayDate(toDate)],
      ['Time:', fromTime, '', 'To:', toTime],
      types.length ? ['Type:', types.join(', ')] : [],
      [''],
      ['S.No.', 'Admit No', 'Date', 'Time', 'Patient Name', 'Department', 'Sub Department', 'Doctor / Consultant', 'Type', 'Received', 'Bal.', 'Dis.'],
    ];

    const dataRows = visits.map((v) => [
      v.serialNo,
      v.admitNo || '',
      fmtDate(v.visitDate),
      v.visitTime || '',
      v.patientName,
      v.department || '',
      v.subDepartment || '',
      v.doctor || '',
      v.paymentType || '',
      Number(v.received),
      Number(v.balance),
      Number(v.discount),
    ]);

    const footer = [
      [],
      ['Total Patients:', visits.length, '', '', '', '', 'Grand Total:', '', totalReceived, '', totalDiscount],
    ];

    const ws = XLSX.utils.aoa_to_sheet([...header, ...dataRows, ...footer]);

    // Column widths
    ws['!cols'] = [
      { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 8 },
      { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 10 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patients List');
    XLSX.writeFile(wb, `Patients_List_${fromDate}_to_${toDate}.xlsx`);
    toast.success('Excel file downloaded');
  };

  const handlePrint = () => {
    // Print sirf .plr-report-page wala hissa
    const content = document.querySelector('.plr-report-page');
    if (!content) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
      <html><head><title>Patients List</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 11px; padding: 20px; }
        .plr-rpt-header { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
        .plr-rpt-logo { height: 50px; }
        .plr-rpt-hospital h1 { font-size: 14px; font-weight: 700; text-transform: uppercase; }
        .plr-rpt-hospital p { font-size: 11px; color: #555; }
        .plr-rpt-divider { border-top: 2px solid #1a3c6e; margin: 6px 0 10px; }
        .plr-rpt-meta { display: flex; justify-content: space-between; margin-bottom: 12px; }
        .plr-rpt-title { font-size: 13px; font-weight: 700; color: #1a3c6e; text-decoration: underline; }
        .plr-rpt-dates { text-align: right; font-size: 10px; color: #444; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #1a3c6e; color: #fff; padding: 4px 5px; text-align: left; font-weight: 600; }
        td { padding: 3px 5px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) td { background: #f7f9fc; }
        tfoot td { background: #eef2f8; font-weight: 700; border-top: 2px solid #1a3c6e; }
        .plr-td-num, .plr-tf-val { text-align: right; }
        .plr-td-name { font-weight: 500; }
        .plr-rpt-footer { display: flex; justify-content: space-between; margin-top: 12px; font-size: 9px; color: #777; border-top: 1px solid #ccc; padding-top: 6px; }
        .plr-badge { font-size: 9px; padding: 1px 4px; border-radius: 8px; }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div className="plr-page">
      <ClinicMenuBar />

      {/* ── Toolbar ── */}
      <div className="plr-toolbar no-print">
        <div className="plr-toolbar-left">
          <button className="plr-tool-btn plr-tool-btn--back" onClick={() => navigate(-1)} title="Back to Filters">
            <ArrowLeft size={14} /> <span>Back</span>
          </button>
          <div className="plr-tool-sep" />
          <button className="plr-tool-btn" onClick={handlePrint} title="Print / PDF">
            <Printer size={14} /> <span>Print / PDF</span>
          </button>
          <button className="plr-tool-btn plr-tool-btn--excel" onClick={handleExportExcel} title="Export Excel">
            <FileDown size={14} /> <span>Export Excel</span>
          </button>
          <div className="plr-tool-sep" />
          <button className="plr-tool-btn" onClick={fetchData} disabled={loading} title="Refresh">
            <RefreshCw size={14} className={loading ? 'plr-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="plr-tool-btn plr-tool-btn--upload" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Import Excel">
            <Upload size={14} />
            <span>{uploading ? 'Importing...' : 'Import Excel'}</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleUpload} />
          <button className="plr-tool-btn plr-tool-btn--upload" onClick={handleGenerateAdmissions} disabled={generating} title="Create Admission records from imported Admission visits">
            <BedDouble size={14} />
            <span>{generating ? 'Generating...' : 'Generate Admissions'}</span>
          </button>
        </div>
        <div className="plr-toolbar-right">
          {lastRefresh && <span className="plr-last-refresh">Refreshed: {lastRefresh.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* ── Report content (Crystal Reports style page) ── */}
      <div className="plr-report-area">
        <div className="plr-report-page">

          {/* Hospital header */}
          <div className="plr-rpt-header">
            <img src={hospitalLogo} alt="logo" className="plr-rpt-logo" />
            <div className="plr-rpt-hospital">
              <h1>DARUL SHIFA IMAM KHOMEINI (q.s.)</h1>
              <p>Karachi, Pakistan</p>
            </div>
          </div>
          <div className="plr-rpt-divider" />

          {/* Report title + meta */}
          <div className="plr-rpt-meta">
            <h2 className="plr-rpt-title">Patients List</h2>
            <div className="plr-rpt-dates">
              <span>Date: {fmtDisplayDate(fromDate)} — {fmtDisplayDate(toDate)}</span>
              <span>Time: {fromTime} — {toTime}</span>
              {types.length > 0 && <span>Type: {types.join(', ')}</span>}
            </div>
          </div>

          {/* Table */}
          {visits.length === 0 ? (
            <div className="plr-empty">
              {loading ? 'Loading data...' : 'No data — upload Excel or apply filters and click Refresh'}
            </div>
          ) : (
            <table className="plr-rpt-table">
              <thead>
                <tr>
                  <th className="plr-col-sno">S.No.</th>
                  <th className="plr-col-admit">Admit No</th>
                  <th className="plr-col-date">Date</th>
                  <th className="plr-col-time">Time</th>
                  <th className="plr-col-name">Patient Name</th>
                  <th className="plr-col-dept">Department</th>
                  <th className="plr-col-subdept">Sub Department</th>
                  <th className="plr-col-doc">Doctor / Consultant</th>
                  <th className="plr-col-type">Type</th>
                  <th className="plr-col-num">Received</th>
                  <th className="plr-col-num">Bal.</th>
                  <th className="plr-col-num">Dis.</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v, i) => (
                  <tr key={v.id} className={i % 2 === 0 ? 'plr-row-even' : ''}>
                    <td>{v.serialNo}</td>
                    <td>{v.admitNo || ''}</td>
                    <td>{fmtDate(v.visitDate)}</td>
                    <td>{v.visitTime || ''}</td>
                    <td className="plr-td-name">{v.patientName}</td>
                    <td>{v.department || ''}</td>
                    <td>{v.subDepartment || ''}</td>
                    <td>{v.doctor || ''}</td>
                    <td><span className={`plr-badge plr-badge--${(v.paymentType||'').toLowerCase().replace('.','')}`}>{v.paymentType}</span></td>
                    <td className="plr-td-num">{fmt(v.received)}</td>
                    <td className="plr-td-num">{fmt(v.balance)}</td>
                    <td className="plr-td-num">{fmt(v.discount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="plr-tf-label">Total Patients: {visits.length}</td>
                  <td colSpan={6} className="plr-tf-label">Grand Total:</td>
                  <td className="plr-td-num plr-tf-val">{fmt(totalReceived)}</td>
                  <td className="plr-td-num" />
                  <td className="plr-td-num plr-tf-val">{fmt(totalDiscount)}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* Report footer */}
          {visits.length > 0 && (
            <div className="plr-rpt-footer">
              <span>Printed: {new Date().toLocaleString()}</span>
              <span>Page 1 of 1</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
