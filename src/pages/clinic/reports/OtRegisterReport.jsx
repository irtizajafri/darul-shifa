import { useState, useEffect, useRef, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw, Upload } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './DepartmentDoctorPerformanceReport.scss';

const API = 'http://localhost:5001/api/clinic';
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAT_LABEL = { private: 'Cash', panel: 'Panel', staff: 'Staff', cc: 'CC', complementary: 'Complementary' };

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS_SHORT[dt.getMonth()]}-${dt.getFullYear()}`;
};
const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  const h = dt.getHours() % 12 || 12;
  const ampm = dt.getHours() >= 12 ? 'PM' : 'AM';
  return `${fmtDate(d)} ${String(h).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}${ampm}`;
};

// ── Excel import ────────────────────────────────────────────────────────────
function normHeader(s) { return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''); }

// Handles Excel date serials, native Date objects (cellDates:true), and text
// dates in DD-MM-YYYY, DD/MM/YYYY or DD-Mon-YYYY (matches this report's own
// Export Excel output too, so an exported file can be edited and re-imported).
function parseExcelDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') {
    const utcDays = Math.floor(v - 25569);
    return new Date(utcDays * 86400 * 1000);
  }
  const s = String(v).trim();
  const numeric = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (numeric) return new Date(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]));
  const monthNames = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
  const named = s.match(/^(\d{1,2})[-\s](\w{3})[-\s](\d{4})/);
  if (named && monthNames[named[2].toLowerCase()] != null) {
    return new Date(Number(named[3]), monthNames[named[2].toLowerCase()], Number(named[1]));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseOtRegisterExcel(file) {
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
            if (h === 'admitno' || h === 'admissionno' || h === 'admitnumber') map.admitNo = idx;
            else if (h === 'patname' || h === 'patientname') map.patName = idx;
            else if (h === 'description' || h === 'surgerytype') map.description = idx;
            else if (h === 'opdate' || h === 'surgerydate' || h.includes('sergdate') || h.includes('surgdate')) map.opDate = idx;
            else if (h.includes('anaesth') || h.includes('anesth')) map.anaesthetic = idx;
            else if (h.includes('surgeon1') || h.includes('surgen1')) map.surgeon1 = idx;
            else if (h.includes('surgeon2') || h.includes('surgen2')) map.surgeon2 = idx;
            else if (h === 'tech1') map.tech1 = idx;
            else if (h === 'tech2') map.tech2 = idx;
          });
          if (map.admitNo != null && map.opDate != null) { colMap = map; headerRowIdx = i; break; }
        }

        if (!colMap) { reject(new Error('Header row (AdmitNo, OPDate...) Excel mein nahi mila')); return; }

        const rows = [];
        for (let i = headerRowIdx + 1; i < raw.length; i++) {
          const row = raw[i];
          const admitNo = String(row[colMap.admitNo] ?? '').trim();
          if (!admitNo) continue; // skips group-header rows ("Cash") and footer rows

          rows.push({
            admitNo,
            patName: String(row[colMap.patName] ?? '').trim(),
            description: String(row[colMap.description] ?? '').trim(),
            opDate: parseExcelDate(row[colMap.opDate]),
            anaesthetic: String(row[colMap.anaesthetic] ?? '').trim(),
            surgeon1: String(row[colMap.surgeon1] ?? '').trim(),
            surgeon2: String(row[colMap.surgeon2] ?? '').trim(),
            tech1: String(row[colMap.tech1] ?? '').trim(),
            tech2: String(row[colMap.tech2] ?? '').trim(),
          });
        }

        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function OtRegisterReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuthStore();
  const fileRef = useRef(null);
  const [groups, setGroups] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fromDate    = params.get('fromDate') || '';
  const toDate      = params.get('toDate') || '';
  const patientType = params.get('patientType') || 'ALL';
  const anaesthesiologistId = params.get('anaesthesiologistId') || '';
  const surgeonId           = params.get('surgeonId') || '';
  const techId              = params.get('techId') || '';
  const surgeryTypeId       = params.get('surgeryTypeId') || '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ fromDate, toDate, patientType });
      if (anaesthesiologistId) q.set('anaesthesiologistId', anaesthesiologistId);
      if (surgeonId) q.set('surgeonId', surgeonId);
      if (techId) q.set('techId', techId);
      if (surgeryTypeId) q.set('surgeryTypeId', surgeryTypeId);
      const res = await fetch(`${API}/reports/ot-register?${q}`).then(r => r.json());
      setGroups(res.data?.groups || []);
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
      const parsed = await parseOtRegisterExcel(file);
      if (!parsed.length) { toast.error('Excel mein valid rows nahi mile (AdmitNo/OPDate check karein)'); return; }

      const res = await fetch(`${API}/reports/ot-register/import`, {
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
        (d.surgeryTypesCreated ? ` • ${d.surgeryTypesCreated} surgery types created` : '') +
        (d.doctorsNotMatched ? ` • ${d.doctorsNotMatched} doctor names not matched` : '') +
        (d.invalidDate ? ` • ${d.invalidDate} rows had invalid OPDate` : '') +
        (d.missingAdmitNo ? ` • ${d.missingAdmitNo} rows had no AdmitNo` : '')
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
    const content = document.getElementById('otr-rep-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>OT Register Report</title>
      <style>
        *{box-sizing:border-box;}
        body{font-family:Tahoma,sans-serif;font-size:11px;margin:0;padding:12px;}
        table{width:100%;border-collapse:collapse;font-size:10px;}
        th{background:#1a3c6e!important;color:#fff!important;padding:4px 6px;text-align:left;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        td{padding:3px 6px;border-bottom:1px solid #ddd;}
        .otr-group-hdr td{font-weight:700;text-decoration:underline;border:none;padding-top:10px;}
        .otr-group-ftr td{font-weight:700;border-top:1px solid #999;background:#f4f6fa!important;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        h1{font-size:13px;margin:0 0 2px;text-transform:uppercase;letter-spacing:.04em;}
        p{font-size:10px;margin:0;color:#555;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    const aoa = [['OT Register Report'], [`Date: ${fmtDate(fromDate)} To ${fmtDate(toDate)}`], []];
    aoa.push(['AdmitNo', 'PatName', 'Description', 'OPDate', 'Anaesthetic', 'Surgeon1', 'Surgeon2', 'Tech1', 'Tech2', 'Entry Date/Time']);
    for (const g of groups) {
      aoa.push([CAT_LABEL[g.category] || g.category]);
      for (const r of g.rows) {
        aoa.push([r.admissionNo, r.patientName, r.description, fmtDate(r.surgeryDate), r.anaesthesiologist || '', r.surgeon1 || '', r.surgeon2 || '', r.tech1 || '', r.tech2 || '', fmtDateTime(r.createdAt)]);
      }
      aoa.push(['', '', '', '', '', '', '', '', `${CAT_LABEL[g.category] || g.category} No of Admission:`, g.count]);
    }
    if (total) aoa.push([], ['TOTAL', total.count]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OtRegister');
    XLSX.writeFile(wb, `ot_register_${fromDate}_${toDate}.xlsx`);
  };

  const hasRows = groups.some(g => g.rows.length > 0);

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
        <div className="ddp-report-page" id="otr-rep-printable">
          <div className="ddp-print-header">
            <h1>OT Register</h1>
            <p>Date &amp; Time: {printedAtStr} | Printed By: {printedBy}</p>
            <p>{fmtDate(fromDate)} to {fmtDate(toDate)}</p>
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !hasRows && <div className="ddp-empty">No records found for the selected filters.</div>}

          {!loading && hasRows && (
            <table className="ddp-table">
              <thead>
                <tr>
                  <th>AdmitNo</th>
                  <th>PatName</th>
                  <th>Description</th>
                  <th>OPDate</th>
                  <th>Anaesthetic:</th>
                  <th>Surgeon1:</th>
                  <th>Surgeon2:</th>
                  <th>Tech1:</th>
                  <th>Tech2:</th>
                  <th>Entry Date/Time</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <Fragment key={g.category}>
                    <tr className="otr-group-hdr"><td colSpan={10}>{CAT_LABEL[g.category] || g.category}</td></tr>
                    {g.rows.map(r => (
                      <tr key={r.id}>
                        <td>{r.admissionNo}</td>
                        <td>{r.patientName}</td>
                        <td>{r.description || '—'}</td>
                        <td>{fmtDate(r.surgeryDate)}</td>
                        <td>{r.anaesthesiologist || ''}</td>
                        <td>{r.surgeon1 || ''}</td>
                        <td>{r.surgeon2 || ''}</td>
                        <td>{r.tech1 || ''}</td>
                        <td>{r.tech2 || ''}</td>
                        <td>{fmtDateTime(r.createdAt)}</td>
                      </tr>
                    ))}
                    <tr className="otr-group-ftr">
                      <td colSpan={8} style={{ textAlign: 'right' }}>{CAT_LABEL[g.category] || g.category}&nbsp;&nbsp;No of Admission:</td>
                      <td colSpan={2}>{g.count}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
              {total && (
                <tfoot>
                  <tr className="ddp-total-row">
                    <td colSpan={8}>TOTAL</td>
                    <td colSpan={2}>{total.count}</td>
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
