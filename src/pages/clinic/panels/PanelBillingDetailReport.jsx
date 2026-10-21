import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { printElementInPopup } from '../../../utils/printPopup';
import { importBillingExcel, isExcelFile } from './panelBillingDetailImport';
import './PanelBillingDetailReport.scss';

const API = 'http://localhost:5001/api/clinic';

// `@page` is a document-level rule — other pages (Admission, Death Certificate
// Report) each declare their own `@page` with different size/margin, and since
// Vite bundles every page's SCSS into one global stylesheet, whichever rule
// loads last wins for the WHOLE app's prints. Inject a highest-priority
// override right before printing this page, and remove it once the print
// dialog closes so it doesn't leak into other pages.
// Now prints from a popup window (utils/printPopup.js) instead of
// window.print() on the main window, which could freeze the app on Windows.
function printBillingDetailReport(reportEl) {
  printElementInPopup(reportEl, { title: 'Panel Billing Report', page: 'A4 landscape', margin: '6mm' });
}

// Bill-head columns (order = report columns)
const HEADS = [
  { key: 'constFee',        label: 'Const Fee' },
  { key: 'followUp',        label: 'Follow-up' },
  { key: 'anesthesia',      label: 'Anesthesia' },
  { key: 'medicine',        label: 'Medicine' },
  { key: 'laboratory',      label: 'Laboratory' },
  { key: 'costOfBlood',     label: 'Cost of Blood' },
  { key: 'echocardiograph', label: 'Echocardiograph' },
  { key: 'ultrasound',      label: 'Ultrasound' },
  { key: 'xRay',            label: 'X-Ray' },
  { key: 'physiotherapy',   label: 'Physiotherapy' },
  { key: 'ctScan',          label: 'C.T. Scan' },
  { key: 'surgeonFee',      label: 'Surgeon Fee' },
];

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2, '0')}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${dt.getUTCFullYear()}`;
};

// Panels > Reports > Billing Detail Report — preview step. Every CLOSED panel
// file whose Billing discharge date is in From/To, head-wise amounts straight
// from Panels > Billing (see getPanelBillingDetails). The filter
// (Organisation / Person-Emp. / Consultant + Month From/To) is now its own
// screen, PanelBillingDetailFilter, which opens this at /view?from&to&
// companyId&employeeId&consultantId. Upload Excel still loads the legacy
// system's own export, which only fills in the head split for files
// imported without one.
export default function PanelBillingDetailReport() {
  const [params] = useSearchParams();
  const fileRef = useRef(null);
  const reportRef = useRef(null);

  const fromDate = params.get('from') || '';
  const toDate = params.get('to') || '';
  const companyId = params.get('companyId') || 'ALL';
  const employeeId = params.get('employeeId') || 'ALL';
  const consultantId = params.get('consultantId') || 'ALL';

  const [data, setData] = useState({ rows: [], totals: {}, period: null, count: 0 });
  // true until the first fetch lands, so the empty-state doesn't flash first
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [shown, setShown] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!fromDate || !toDate) { toast.error('Month From aur To dono chunein'); setLoading(false); return; }
    if (fromDate > toDate) { toast.error('From date, To date se pehle honi chahiye'); setLoading(false); return; }
    setLoading(true);
    try {
      const q = new URLSearchParams({ from: fromDate, to: toDate, panelCompanyId: companyId, panelEmployeeId: employeeId, consultantId });
      const res = await fetch(`${API}/panel-billing?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setData(json.data || { rows: [], totals: {}, period: null, count: 0 });
      setShown(true);
    } catch (err) {
      toast.error(err.message || 'Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, companyId, employeeId, consultantId]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

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
      fetchReport();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const { rows, totals, period } = data;

  function handlePrint() {
    if (!shown || !rows.length) { toast.error('Print ke liye koi data nahi'); return; }
    printBillingDetailReport(reportRef.current);
  }

  // Same rows / columns / totals as the preview table
  function handleExport() {
    if (!shown || !rows.length) { toast.error('Export ke liye koi data nahi'); return; }
    const aoa = [
      ['PANEL BILLING REPORT'],
      [`From : ${fmtDate(period?.from)}   To : ${fmtDate(period?.to)}`],
      [],
      ['Admit #', 'Patient Name', 'ConsCode', 'CompCode', ...HEADS.map((h) => h.label), 'Total Amount'],
      ...rows.map((r) => [
        r.admitNo, r.patientName, r.consCode || '', r.companyCode || r.companyName || '',
        ...HEADS.map((h) => Number(r[h.key] || 0)), Number(r.totalAmount || 0),
      ]),
      [`TOTAL — ${rows.length} bills`, '', '', '', ...HEADS.map((h) => Number(totals[h.key] || 0)), Number(totals.totalAmount || 0)],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Billing Detail');
    XLSX.writeFile(wb, `Panel_Billing_Detail_${fromDate}_${toDate}.xlsx`);
  }

  return (
    <div className="pbd-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExport} onRefresh={fetchReport} refreshing={loading}>
        <div className="rpt-tool-sep" />
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleUpload} />
        <button type="button" className="rpt-tool-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload size={14} /> <span>{uploading ? 'Uploading…' : 'Upload Excel'}</span>
        </button>
      </ReportToolbar>

      <div className="pbd-body">
        {/* ── Report ── */}
        <div className="pbd-report rpt-arial9" ref={reportRef}>
          <div className="pbd-rpt-head">
            <div className="pbd-rpt-title">PANEL BILLING REPORT</div>
            <div className="pbd-rpt-sub">Darul Shifa Hospital</div>
            <div className="pbd-rpt-meta">
              <span>From : {fmtDate(period?.from)}　To : {fmtDate(period?.to)}</span>
              <span>Produced On : {new Date().toLocaleString('en-GB')}</span>
            </div>
          </div>

          {!shown ? (
            <div className="pbd-empty">{loading ? 'Loading…' : 'Report load nahi hui — Refresh dabayein.'}</div>
          ) : !rows.length ? (
            <div className="pbd-empty">Is filter par koi bill nahi mila.</div>
          ) : (
            <div className="pbd-table-wrap">
              <table className="pbd-table">
                <thead>
                  <tr>
                    <th className="pbd-l">Admit #</th>
                    <th className="pbd-l">Patient Name</th>
                    <th className="pbd-l">ConsCode</th>
                    <th className="pbd-l">CompCode</th>
                    {HEADS.map((h) => <th key={h.key} className="pbd-r pbd-amt">{h.label}</th>)}
                    <th className="pbd-r pbd-amt pbd-total-col">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="pbd-l">{r.admitNo}</td>
                      <td className="pbd-l">{r.patientName}</td>
                      <td className="pbd-l">{r.consCode || '—'}</td>
                      <td className="pbd-l" title={r.companyName || ''}>{r.companyCode || r.companyName || '—'}</td>
                      {HEADS.map((h) => <td key={h.key} className="pbd-r pbd-amt">{r[h.key] ? fmt(r[h.key]) : '-'}</td>)}
                      <td className="pbd-r pbd-amt pbd-total-col">{fmt(r.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="pbd-totals">
                    <td className="pbd-l" colSpan={4}>TOTAL — {rows.length} bills</td>
                    {HEADS.map((h) => <td key={h.key} className="pbd-r pbd-amt">{fmt(totals[h.key])}</td>)}
                    <td className="pbd-r pbd-amt pbd-total-col">{fmt(totals.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
