import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload, RefreshCw, Printer, FileDown } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './BillComparisonReport.scss';

const API = 'http://localhost:5001/api/clinic';

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb  = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Find header row — look for SNO
        let colMap = null;
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(raw.length, 25); i++) {
          const row = raw[i];
          const snoIdx = row.findIndex(c => String(c).trim().toUpperCase() === 'SNO');
          if (snoIdx !== -1) {
            headerRowIdx = i;
            colMap = {};
            row.forEach((cell, idx) => {
              const k = String(cell).trim().toUpperCase();
              if (k === 'SNO') colMap.sno = idx;
              if (k.includes('ADMIT') && (k.includes('NUMBER') || k.includes('NAME'))) colMap.admitAndName = idx;
              if (k.includes('EMPLOEE') || k.includes('EMPLOYEE') || k.includes('EMP')) colMap.employee = idx;
              if (k === 'COMPANY') colMap.company = idx;
              if (k === 'AMOUNT' && colMap.amount == null) colMap.amount = idx;
              if (k.includes('BILL') && k.includes('AMOUNT')) colMap.billAmount = idx;
              if (k === 'DEFF' || k === 'DIFF' || k === 'DIFFERENCE') colMap.diff = idx;
            });
            break;
          }
        }

        if (!colMap) { reject(new Error('Header row (SNO) not found in Excel')); return; }

        const rows = [];
        for (let i = headerRowIdx + 1; i < raw.length; i++) {
          const row = raw[i];
          const sno = row[colMap.sno];
          if (typeof sno !== 'number' || sno < 1) continue;

          const admitRaw = String(row[colMap.admitAndName ?? 1] || '').trim();
          const dashIdx  = admitRaw.indexOf(' - ');
          const admitNo     = dashIdx !== -1 ? admitRaw.substring(0, dashIdx).trim() : '';
          const patientName = dashIdx !== -1 ? admitRaw.substring(dashIdx + 3).trim() : admitRaw;

          rows.push({
            sno:          Number(sno),
            admitNo,
            patientName,
            employeeName: String(row[colMap.employee  ?? 2] || '').trim(),
            companyName:  String(row[colMap.company   ?? 4] || '').trim(),
            amount:       Number(row[colMap.amount    ?? 7]) || 0,
            billAmount:   Number(row[colMap.billAmount ?? 8]) || 0,
            diff:         Number(row[colMap.diff      ?? 9]) || 0,
          });
        }

        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BillComparisonReport() {
  const navigate    = useNavigate();
  const fileRef     = useRef(null);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/bill-comparison`);
      const json = await res.json();
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!['xlsx','xls'].includes(file.name.split('.').pop().toLowerCase())) {
      toast.error('Sirf Excel file (.xlsx/.xls) upload karo'); e.target.value = ''; return;
    }
    setUploading(true);
    try {
      const parsed = await parseExcel(file);
      if (!parsed.length) { toast.error('Excel mein valid data nahi mila'); return; }

      const res  = await fetch(`${API}/bill-comparison/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success(
        `${json.data.rowsInserted} rows imported` +
        (json.data.companiesCreated  ? ` • ${json.data.companiesCreated} companies created`  : '') +
        (json.data.employeesCreated  ? ` • ${json.data.employeesCreated} employees created`  : '') +
        (json.data.dependentsCreated ? ` • ${json.data.dependentsCreated} dependents added`  : '')
      );
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const totalAmount     = rows.reduce((s, r) => s + Number(r.amount     || 0), 0);
  const totalBillAmount = rows.reduce((s, r) => s + Number(r.billAmount || 0), 0);
  const totalDiff       = rows.reduce((s, r) => s + Number(r.diff       || 0), 0);

  function handlePrint() {
    const content = document.querySelector('.bcr-report-wrap');
    if (!content) return;
    const w = window.open('', '_blank', 'width=1000,height=700');
    w.document.write(`<html><head><title>Bill Comparison Report</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; font-size: 10px; padding: 16px; }
      h2 { font-size: 14px; text-align: center; font-weight: 900; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1a3c6e; color: #fff; padding: 4px 5px; text-align: left; }
      td { padding: 3px 5px; border-bottom: 1px solid #eee; }
      .neg { color: red; font-weight: 700; }
      .num { text-align: right; }
      tfoot td { font-weight: 700; border-top: 2px solid #1a3c6e; background: #eef2f8; }
    </style></head><body>
    ${content.innerHTML}
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
    w.document.close();
  }

  function handleExport() {
    if (!rows.length) { toast.error('Koi data nahi'); return; }
    const data = [
      ['SNO', 'Admit No', 'Patient Name', 'Employee Name', 'Company', 'Relation', 'Amount', 'Bill Amount', 'Diff'],
      ...rows.map(r => [r.sno, r.admitNo, r.patientName, r.employeeName, r.companyName,
        r.relation || 'SELF', Number(r.amount), Number(r.billAmount), Number(r.diff)]),
      [],
      ['', '', '', '', 'Total:', '', totalAmount, totalBillAmount, totalDiff],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch:6 },{ wch:12 },{ wch:22 },{ wch:20 },{ wch:26 },{ wch:12 },{ wch:12 },{ wch:12 },{ wch:12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bill Comparison');
    XLSX.writeFile(wb, 'Bill_Comparison_Report.xlsx');
  }

  return (
    <div className="bcr-page">
      <ClinicMenuBar />

      <div className="bcr-toolbar">
        <button className="bcr-btn bcr-btn--back" onClick={() => navigate(-1)}>← Back</button>
        <div className="bcr-sep" />
        <button
          className="bcr-btn bcr-btn--upload"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Upload size={14} /> {uploading ? 'Importing...' : 'Import Excel'}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleUpload} />
        <div className="bcr-sep" />
        <button className="bcr-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'bcr-spin' : ''} /> Refresh
        </button>
        <button className="bcr-btn" onClick={handlePrint}><Printer size={14} /> Print</button>
        <button className="bcr-btn bcr-btn--excel" onClick={handleExport}><FileDown size={14} /> Export Excel</button>
      </div>

      <div className="bcr-report-wrap">
        <h2>ADMISSION WISE PANEL BILLING REPORT</h2>

        {rows.length === 0 ? (
          <div className="bcr-empty">
            {loading ? 'Loading...' : 'Koi data nahi — Excel import karo'}
          </div>
        ) : (
          <table className="bcr-table">
            <thead>
              <tr>
                <th className="bcr-col-sno">SNO</th>
                <th className="bcr-col-admit">Admit No</th>
                <th className="bcr-col-patient">Patient Name</th>
                <th className="bcr-col-emp">Employee Name</th>
                <th className="bcr-col-co">Company</th>
                <th className="bcr-col-rel">Relation</th>
                <th className="bcr-col-num">Amount</th>
                <th className="bcr-col-num">Bill Amount</th>
                <th className="bcr-col-num">DEFF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const diff = Number(r.diff || 0);
                return (
                  <tr key={r.id} className={i % 2 === 0 ? 'bcr-even' : ''}>
                    <td>{r.sno}</td>
                    <td>{r.admitNo || ''}</td>
                    <td className="bcr-td-name">{r.patientName}</td>
                    <td>{r.employeeName || ''}</td>
                    <td>{r.companyName || ''}</td>
                    <td><span className={`bcr-rel bcr-rel--${(r.relation||'SELF').toLowerCase()}`}>{r.relation || 'SELF'}</span></td>
                    <td className="bcr-num">{fmt(r.amount)}</td>
                    <td className="bcr-num">{fmt(r.billAmount)}</td>
                    <td className={`bcr-num ${diff < 0 ? 'bcr-neg' : ''}`}>{fmt(diff)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} className="bcr-tf-label">Total Patients: {rows.length}</td>
                <td className="bcr-num bcr-tf">{fmt(totalAmount)}</td>
                <td className="bcr-num bcr-tf">{fmt(totalBillAmount)}</td>
                <td className={`bcr-num bcr-tf ${totalDiff < 0 ? 'bcr-neg' : ''}`}>{fmt(totalDiff)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
