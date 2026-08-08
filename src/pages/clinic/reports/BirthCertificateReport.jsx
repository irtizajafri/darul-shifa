import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw, Upload } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './DepartmentDoctorPerformanceReport.scss';

const API = 'http://localhost:5001/api/clinic';
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS_SHORT[dt.getMonth()]}-${dt.getFullYear()}`;
};
const fmtDateTimeShort = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${fmtDate(d)} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
};
const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  const h = dt.getHours() % 12 || 12;
  const ampm = dt.getHours() >= 12 ? 'PM' : 'AM';
  return `${fmtDate(d)} ${String(h).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}${ampm}`;
};
const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '—';

// ── Excel import ────────────────────────────────────────────────────────────
function normHeader(s) { return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''); }

function parseExcelDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const utcDays = Math.floor(v - 25569);
    return new Date(utcDays * 86400 * 1000);
  }
  const s = String(v).trim();
  const numeric = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (numeric) {
    return new Date(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]), Number(numeric[4] || 0), Number(numeric[5] || 0));
  }
  const monthNames = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
  const named = s.match(/^(\d{1,2})[-\s](\w{3})[-\s](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (named && monthNames[named[2].toLowerCase()] != null) {
    return new Date(Number(named[3]), monthNames[named[2].toLowerCase()], Number(named[1]), Number(named[4] || 0), Number(named[5] || 0));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBirthCertificateExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb  = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        let colMap = null;
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(raw.length, 25); i++) {
          const row = raw[i];
          const map = {};
          row.forEach((cell, idx) => {
            const h = normHeader(cell);
            if (h === 'reg' || h === 'regno' || h === 'admitno' || h === 'admissionno') map.admitNo = idx;
            else if (h === 'mothername') map.motherName = idx;
            else if (h === 'fathername') map.fatherName = idx;
            else if (h === 'address') map.address = idx;
            else if (h === 'dateofbirth' || h === 'birthdate' || h === 'dob') map.dateOfBirth = idx;
            else if (h === 'gender' || h === 'sex') map.gender = idx;
            else if (h.includes('weight')) map.weight = idx;
            else if (h.includes('bloodgroup')) map.bloodGroup = idx;
          });
          if (map.admitNo != null && map.dateOfBirth != null) { colMap = map; headerRowIdx = i; break; }
        }

        if (!colMap) { reject(new Error('Header row (Reg #, Date of Birth...) Excel mein nahi mila')); return; }

        const rows = [];
        for (let i = headerRowIdx + 1; i < raw.length; i++) {
          const row = raw[i];
          const admitNo = String(row[colMap.admitNo] ?? '').trim();
          if (!admitNo) continue;

          rows.push({
            admitNo,
            motherName: String(row[colMap.motherName] ?? '').trim(),
            fatherName: String(row[colMap.fatherName] ?? '').trim(),
            address: String(row[colMap.address] ?? '').trim(),
            dateOfBirth: parseExcelDate(row[colMap.dateOfBirth]),
            gender: String(row[colMap.gender] ?? '').trim(),
            weight: Number(row[colMap.weight]) || null,
            bloodGroup: String(row[colMap.bloodGroup] ?? '').trim(),
          });
        }

        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function BirthCertificateReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuthStore();
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fromDate = params.get('fromDate') || '';
  const toDate   = params.get('toDate') || '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ fromDate, toDate });
      const res = await fetch(`${API}/reports/birth-certificate?${q}`).then(r => r.json());
      setRows(res.data?.rows || []);
      setTotal(res.data?.total || null);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!['xlsx', 'xls'].includes(file.name.split('.').pop().toLowerCase())) {
      toast.error('Sirf Excel file (.xlsx/.xls) upload karo'); e.target.value = ''; return;
    }
    setUploading(true);
    try {
      const parsed = await parseBirthCertificateExcel(file);
      if (!parsed.length) { toast.error('Excel mein valid rows nahi mile (Reg#/Date of Birth check karein)'); return; }

      const res = await fetch(`${API}/reports/birth-certificate/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);

      const d = json.data;
      toast.success(
        `${d.inserted} rows imported` +
        (d.linkedToExistingAdmission ? ` (${d.linkedToExistingAdmission} linked to existing admissions)` : '') +
        (d.invalidDate ? ` • ${d.invalidDate} rows had invalid Date of Birth` : '') +
        (d.missingAdmitNo ? ` • ${d.missingAdmitNo} rows had no Reg #` : '')
      );
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const printedBy = user?.name || user?.username || 'User';
  const printedAtStr = fmtDateTime(new Date());

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('bcr-rep-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>Birth Certificate Report</title>
      <style>
        *{box-sizing:border-box;}
        body{font-family:Tahoma,sans-serif;font-size:11px;margin:0;padding:12px;}
        table{width:100%;border-collapse:collapse;font-size:10px;}
        th{background:#1a3c6e!important;color:#fff!important;padding:4px 6px;text-align:left;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        td{padding:3px 6px;border-bottom:1px solid #ddd;}
        h1{font-size:13px;margin:0 0 2px;text-transform:uppercase;letter-spacing:.04em;}
        p{font-size:10px;margin:0;color:#555;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    const aoa = [['Birth Certificate Details'], [`Date: ${fmtDate(fromDate)} To ${fmtDate(toDate)}`], []];
    aoa.push(['Reg #', 'Mother Name', 'Father Name', 'Address', 'Date of Birth', 'Gender', 'Weight (kg)', 'Blood Group']);
    for (const r of rows) {
      aoa.push([r.admissionNo, r.motherName, r.fatherName, r.address, fmtDateTimeShort(r.birthTime), capitalize(r.gender), r.weight, r.bloodGroup]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BirthCertificate');
    XLSX.writeFile(wb, `birth_certificate_${fromDate}_${toDate}.xlsx`);
  };

  return (
    <div className="ddp-page">
      <div className="ddp-toolbar no-print">
        <div className="ddp-toolbar-left">
          <button className="ddp-tool-btn" onClick={() => navigate(-1)}><ArrowLeft size={14}/> <span>Back</span></button>
          <div className="ddp-tool-sep"/>
          <button className="ddp-tool-btn" onClick={handlePrint}><Printer size={14}/> <span>Print / PDF</span></button>
          <button className="ddp-tool-btn" onClick={handleExportExcel}><FileDown size={14}/> <span>Export Excel</span></button>
          <div className="ddp-tool-sep"/>
          <button className="ddp-tool-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={14}/> <span>{uploading ? 'Importing...' : 'Import Excel'}</span>
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleUpload} />
          <div className="ddp-tool-sep"/>
          <button className="ddp-tool-btn" onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'ddp-spin' : ''}/> <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="ddp-report-area">
        <div className="ddp-report-page" id="bcr-rep-printable">
          <div className="ddp-print-header">
            <h1>Birth Certificate Details</h1>
            <p>Date &amp; Time: {printedAtStr} | Printed By: {printedBy}</p>
            <p>{fmtDate(fromDate)} to {fmtDate(toDate)}</p>
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !rows.length && <div className="ddp-empty">No records found for the selected filters.</div>}

          {!loading && rows.length > 0 && (
            <table className="ddp-table">
              <thead>
                <tr>
                  <th>Reg #</th>
                  <th>Mother Name</th>
                  <th>Father Name</th>
                  <th>Address</th>
                  <th>Date of Birth</th>
                  <th>Gender</th>
                  <th className="num">Weight (kg)</th>
                  <th>Blood Group</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td>{r.admissionNo}</td>
                    <td>{r.motherName}</td>
                    <td>{r.fatherName || '—'}</td>
                    <td>{r.address || '—'}</td>
                    <td>{fmtDateTimeShort(r.birthTime)}</td>
                    <td>{capitalize(r.gender)}</td>
                    <td className="td-num">{r.weight ?? '—'}</td>
                    <td>{r.bloodGroup || '—'}</td>
                  </tr>
                ))}
              </tbody>
              {total && (
                <tfoot>
                  <tr className="ddp-total-row">
                    <td colSpan={8}>Total: {total.count}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
