import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { RefreshCw, Upload, Printer, FileDown, ArrowLeft, BedDouble, X } from 'lucide-react';
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
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
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

const fmt = (n) => Number(n || 0).toLocaleString('en-PK');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';

// Filter screen ka default bhi "aaj -> kal" hai (08:00 -> 07:59 ke sath
// milke ek poora "hospital business day" banata hai — aadhi raat cross
// karta hua). Yeh screen agar kabhi seedha (bina poore query-params ke)
// khule, tw uska apna fallback bhi WAHI convention follow kare — pehle
// yahan "toDate = fromDate" (same day) tha, jo Time ke 08:00->07:59 ke
// sath combine hoke ek ULTA (from > to) range banata, matlab koi data
// hi nahi milta.
function tomorrowOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

const GROUP_LABELS = {
  without_users:      'Without users',
  user_wise:          'User wise',
  user_shift_wise:    'User shift wise',
  user_shift_summary: 'User shift wise summary',
};

export default function PatientsListReport() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const fromDate = searchParams.get('fromDate') || new Date().toISOString().split('T')[0];
  const toDate   = searchParams.get('toDate')   || tomorrowOf(fromDate);
  const fromTime = searchParams.get('fromTime') || '08:00:00';
  const toTime   = searchParams.get('toTime')   || '07:59:59';
  const types    = searchParams.get('types')?.split(',').filter(Boolean) || [];
  const groupBy  = searchParams.get('groupBy') || 'without_users';

  const [visits, setVisits]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const fileInputRef = useRef(null);

  // Quick client-side search — poora matching set already load ho chuka
  // hota hai (server-side sirf date/time/type filter karta hai), isliye
  // yahan naam/MR#/department/doctor se turant narrow karna bina kisi
  // naye round-trip ke ho sakta hai.
  const [nameSearch, setNameSearch]   = useState('');
  const [mrSearch, setMrSearch]       = useState('');
  const [deptSearch, setDeptSearch]   = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const hasSearch = !!(nameSearch || mrSearch || deptSearch || doctorSearch);
  const clearSearch = () => { setNameSearch(''); setMrSearch(''); setDeptSearch(''); setDoctorSearch(''); };

  const busy = loading || uploading || generating;

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

  const filteredVisits = useMemo(() => {
    if (!hasSearch) return visits;
    const nameQ = nameSearch.trim().toLowerCase();
    const mrQ = mrSearch.trim().toLowerCase();
    const deptQ = deptSearch.trim().toLowerCase();
    const docQ = doctorSearch.trim().toLowerCase();
    return visits.filter((v) => {
      if (nameQ && !String(v.patientName || '').toLowerCase().includes(nameQ)) return false;
      if (mrQ && !String(v.mrNo || '').toLowerCase().includes(mrQ)) return false;
      if (deptQ && !String(v.department || '').toLowerCase().includes(deptQ)) return false;
      if (docQ && !String(v.doctor || '').toLowerCase().includes(docQ)) return false;
      return true;
    });
  }, [visits, hasSearch, nameSearch, mrSearch, deptSearch, doctorSearch]);

  // "User wise" / "User shift wise" / "User shift wise summary" — pehle
  // yeh radio buttons filter screen se URL me "groupBy" bhej dete the
  // lekin yeh screen kabhi padhti hi nahi thi (dead control, koi asar
  // nahi hota tha). Ab groupBy se real grouping ban rahi hai.
  //
  // Data ka reality: "user"/"shift" sirf General/Emergency OPD (ClinicOpdVisit)
  // se aane wale rows ke paas hai (createdByName/shiftName). Legacy Excel
  // import, Admission, Admission-Payment aur Antenatal — in 4 sources me
  // koi user/shift record hi nahi hota, is liye unke rows "Not Recorded"
  // bucket me chale jaate hain — yeh data ki asal limitation hai, banayi
  // hui nahi.
  const groups = useMemo(() => {
    if (groupBy === 'without_users') return null;
    const map = new Map();
    for (const v of filteredVisits) {
      const user = v.createdByName || 'Not Recorded';
      const shift = groupBy === 'user_wise' ? null : (v.shiftName || 'Not Recorded');
      const key = shift === null ? user : `${user} ${shift}`;
      if (!map.has(key)) map.set(key, { user, shift, rows: [] });
      map.get(key).rows.push(v);
    }
    return [...map.values()].sort((a, b) =>
      a.user.localeCompare(b.user) || String(a.shift || '').localeCompare(String(b.shift || ''))
    );
  }, [filteredVisits, groupBy]);

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
      // Import ke turant baad refresh ka apna spinner chalta rahi bina
      // "Importing..." khatam hue — ab dono ek hi "busy" state se chalte
      // hain, isliye button states overlap nahi karte.
      await fetchData();
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

  const totalReceived = filteredVisits.reduce((s, v) => s + Number(v.received || 0), 0);
  const totalDiscount = filteredVisits.reduce((s, v) => s + Number(v.discount  || 0), 0);

  const fmtDisplayDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '';

  // Note: Excel export abhi bhi flat list export karta hai (grouping sirf
  // on-screen/print ke liye hai) — grouped multi-sheet export alag, bara
  // scope hoga, filhal isko chhoda hai.
  const handleExportExcel = () => {
    if (!filteredVisits.length) { toast.error('Koi data nahi export karne ke liye'); return; }

    const header = [
      ['DARUL SHIFA IMAM KHOMEINI (q.s.)'],
      [''],
      ['Date:', fmtDisplayDate(fromDate), '', 'To:', fmtDisplayDate(toDate)],
      ['Time:', fromTime, '', 'To:', toTime],
      types.length ? ['Type:', types.join(', ')] : [],
      [''],
      ['S.No.', 'Admit No', 'Date', 'Time', 'Patient Name', 'Department', 'Sub Department', 'Doctor / Consultant', 'Type', 'Received', 'Bal.', 'Dis.'],
    ];

    const dataRows = filteredVisits.map((v) => [
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
      ['Total Patients:', filteredVisits.length, '', '', '', '', 'Grand Total:', '', totalReceived, '', totalDiscount],
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
        .plr-group-header { background: #eef2f8; font-weight: 700; padding: 6px 4px; color: #1a3c6e; font-size: 11px; margin-top: 10px; }
        .plr-group-subtotal td { background: #f4f6fa; font-weight: 700; border-top: 1px solid #1a3c6e; }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const columns = (
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
  );

  const renderRows = (rows) => rows.map((v, i) => (
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
  ));

  const renderSubtotal = (rows) => {
    const rec = rows.reduce((s, v) => s + Number(v.received || 0), 0);
    const dis = rows.reduce((s, v) => s + Number(v.discount || 0), 0);
    return (
      <tr className="plr-group-subtotal">
        <td colSpan={3} className="plr-tf-label">Patients: {rows.length}</td>
        <td colSpan={6} className="plr-tf-label">Subtotal:</td>
        <td className="plr-td-num plr-tf-val">{fmt(rec)}</td>
        <td className="plr-td-num" />
        <td className="plr-td-num plr-tf-val">{fmt(dis)}</td>
      </tr>
    );
  };

  const noData = filteredVisits.length === 0;

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
          <button className="plr-tool-btn" onClick={fetchData} disabled={busy} title="Refresh">
            <RefreshCw size={14} className={loading ? 'plr-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button className="plr-tool-btn plr-tool-btn--upload" onClick={() => fileInputRef.current?.click()} disabled={busy} title="Import Excel">
            <Upload size={14} />
            <span>{uploading ? 'Importing...' : 'Import Excel'}</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleUpload} />
          <button className="plr-tool-btn plr-tool-btn--upload" onClick={handleGenerateAdmissions} disabled={busy} title="Create Admission records from imported Admission visits">
            <BedDouble size={14} />
            <span>{generating ? 'Generating...' : 'Generate Admissions'}</span>
          </button>
        </div>
        <div className="plr-toolbar-right">
          {groupBy !== 'without_users' && <span className="plr-last-refresh">Grouping: {GROUP_LABELS[groupBy]}</span>}
          {lastRefresh && <span className="plr-last-refresh">Refreshed: {lastRefresh.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* ── Quick search (client-side, sirf abhi laaya hua data narrow karta hai) ── */}
      <div className="plr-filters no-print">
        <div className="plr-filter-row">
          <div className="plr-filter-group">
            <label>Name</label>
            <input type="text" value={nameSearch} onChange={(e) => setNameSearch(e.target.value)} placeholder="Patient name..." />
          </div>
          <div className="plr-filter-group">
            <label>MR#</label>
            <input type="text" value={mrSearch} onChange={(e) => setMrSearch(e.target.value)} placeholder="MR number..." />
          </div>
          <div className="plr-filter-group">
            <label>Department</label>
            <input type="text" value={deptSearch} onChange={(e) => setDeptSearch(e.target.value)} placeholder="Department..." />
          </div>
          <div className="plr-filter-group">
            <label>Doctor</label>
            <input type="text" value={doctorSearch} onChange={(e) => setDoctorSearch(e.target.value)} placeholder="Doctor..." />
          </div>
          {hasSearch && (
            <button className="plr-toggle-btn" onClick={clearSearch} title="Clear search">
              <X size={12} /> Clear
            </button>
          )}
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
              {groupBy !== 'without_users' && <span>Grouping: {GROUP_LABELS[groupBy]}</span>}
            </div>
          </div>

          {/* Table(s) */}
          {noData ? (
            <div className="plr-empty">
              {loading ? 'Loading data...' : hasSearch ? 'Search se koi match nahi mila' : 'No data — upload Excel or apply filters and click Refresh'}
            </div>
          ) : groupBy === 'without_users' ? (
            <table className="plr-rpt-table">
              <thead>{columns}</thead>
              <tbody>{renderRows(filteredVisits)}</tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} className="plr-tf-label">Total Patients: {filteredVisits.length}</td>
                  <td colSpan={6} className="plr-tf-label">Grand Total:</td>
                  <td className="plr-td-num plr-tf-val">{fmt(totalReceived)}</td>
                  <td className="plr-td-num" />
                  <td className="plr-td-num plr-tf-val">{fmt(totalDiscount)}</td>
                </tr>
              </tfoot>
            </table>
          ) : groupBy === 'user_shift_summary' ? (
            // Sirf totals — koi individual patient row nahi.
            <table className="plr-rpt-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Shift</th>
                  <th className="plr-col-num">Patients</th>
                  <th className="plr-col-num">Received</th>
                  <th className="plr-col-num">Dis.</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g, i) => {
                  const rec = g.rows.reduce((s, v) => s + Number(v.received || 0), 0);
                  const dis = g.rows.reduce((s, v) => s + Number(v.discount || 0), 0);
                  return (
                    <tr key={`${g.user}-${g.shift}`} className={i % 2 === 0 ? 'plr-row-even' : ''}>
                      <td className="plr-td-name">{g.user}</td>
                      <td>{g.shift}</td>
                      <td className="plr-td-num">{g.rows.length}</td>
                      <td className="plr-td-num">{fmt(rec)}</td>
                      <td className="plr-td-num">{fmt(dis)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} className="plr-tf-label">Total Patients: {filteredVisits.length}</td>
                  <td className="plr-td-num plr-tf-val">{filteredVisits.length}</td>
                  <td className="plr-td-num plr-tf-val">{fmt(totalReceived)}</td>
                  <td className="plr-td-num plr-tf-val">{fmt(totalDiscount)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            // user_wise / user_shift_wise — har group ki apni mini-table +
            // subtotal, header me group ka naam.
            groups.map((g) => (
              <div key={`${g.user}-${g.shift}`} className="plr-group">
                <div className="plr-group-header">
                  {g.shift ? `${g.user} — Shift: ${g.shift}` : g.user}
                </div>
                <table className="plr-rpt-table">
                  <thead>{columns}</thead>
                  <tbody>{renderRows(g.rows)}</tbody>
                  <tfoot>{renderSubtotal(g.rows)}</tfoot>
                </table>
              </div>
            ))
          )}

          {/* Report footer */}
          {!noData && (
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
