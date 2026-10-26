import { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { REPORT_PRINT_FONT_CSS } from '../../../components/reports/reportFont';
import './BillComparisonReport.scss';
import { openPrintWindow } from '../../../utils/printRelay';
import usePagedList from '../../../hooks/usePagedList';
import ShowMoreFooter from '../../../components/reports/ShowMoreFooter';

const API = 'http://localhost:5001/api/clinic';

const fmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '');
const BILLED_LABEL = { all: 'ALL', billed: 'Billed', unbilled: 'Unbilled' };

// Preview step — BillComparisonFilter opens this at
// /clinic/panels/bill-comparison/view?mode=&from=&to=&companyId=&billed=
// with live panel bills (Admission or OPD) for that range.
export default function BillComparisonReport() {
  const [searchParams] = useSearchParams();
  const mode     = searchParams.get('mode') === 'opd' ? 'opd' : 'admission';
  const from     = searchParams.get('from') || '';
  const to       = searchParams.get('to') || '';
  const companyId = searchParams.get('companyId') || 'ALL';
  const billed   = searchParams.get('billed') || 'all';
  const reportRef   = useRef(null);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [searchParams]);

  async function fetchData() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ mode, from, to, companyId, billed });
      const res  = await fetch(`${API}/bill-comparison?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (e) { toast.error(e.message || 'Data load failed'); }
    finally { setLoading(false); }
  }

  const refLabel = mode === 'opd' ? 'Slip No' : 'Admit No';
  const companyLabel = companyId === 'ALL' ? 'ALL' : (rows[0]?.companyName || companyId);

  const totalAmount     = rows.reduce((s, r) => s + Number(r.amount     || 0), 0);
  const totalBillAmount = rows.reduce((s, r) => s + Number(r.billAmount || 0), 0);
  const totalDiff       = rows.reduce((s, r) => s + Number(r.diff       || 0), 0);

  // Draw 300 rows at a time (7k+ rows froze the app); totals, print and
  // Excel stay on all `rows`. Back to page 1 whenever the data is reloaded.
  const page = usePagedList(rows.length, rows);
  const visibleRows = useMemo(() => (page.limit >= rows.length ? rows : rows.slice(0, page.limit)), [rows, page.limit]);

  // Print copies the on-screen table's HTML — render every row for it.
  // The window is opened first, straight on the click — rendering every row
  // can take a while and must not use up the click's popup permission.
  function handlePrint() {
    const w = openPrintWindow('width=1000,height=700');
    page.withAll(() => printReport(w));
  }

  function printReport(w) {
    // ref, not document.querySelector — every open tab stays mounted
    const content = reportRef.current;
    if (!content) { w.close(); return; }
    w.document.write(`<html><head><title>Bill Comparison Report</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; font-size: 10px; padding: 16px; }
      h2 { font-size: 14px; text-align: center; font-weight: 900; margin-bottom: 2px; }
      .bcr-sub { text-align: center; font-size: 10px; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1a3c6e; color: #fff; padding: 4px 5px; text-align: left; }
      td { padding: 3px 5px; border-bottom: 1px solid #eee; }
      .neg { color: red; font-weight: 700; }
      .num { text-align: right; }
      tfoot td { font-weight: 700; border-top: 2px solid #1a3c6e; background: #eef2f8; }
      ${REPORT_PRINT_FONT_CSS}
    </style></head><body>
    ${content.innerHTML}
    <script>window.onload=function(){window.print();}<\/script>
    </body></html>`);
    w.document.close();
  }

  function handleExport() {
    if (!rows.length) { toast.error('Koi data nahi'); return; }
    const data = [
      [`Bill Comparison Report — ${mode === 'opd' ? 'OPD' : 'Admission'} — ${fmtDay(from)} to ${fmtDay(to)} — Company: ${companyLabel} — ${BILLED_LABEL[billed] || 'ALL'}`],
      [],
      ['SNO', refLabel, 'Date', 'Patient Name', 'Employee Name', 'Company', 'Relation', 'Status', 'Amount', 'Bill Amount', 'Diff'],
      ...rows.map(r => [r.sno, r.admitNo, fmtDay(r.date), r.patientName, r.employeeName, r.companyName,
        r.relation || 'SELF', r.billed ? 'Billed' : 'Unbilled', Number(r.amount), Number(r.billAmount), Number(r.diff)]),
      [],
      ['', '', '', '', '', 'Total:', '', '', totalAmount, totalBillAmount, totalDiff],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch:6 },{ wch:12 },{ wch:11 },{ wch:22 },{ wch:20 },{ wch:26 },{ wch:12 },{ wch:10 },{ wch:12 },{ wch:12 },{ wch:12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bill Comparison');
    XLSX.writeFile(wb, 'Bill_Comparison_Report.xlsx');
  }

  return (
    <div className="bcr-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExport} onRefresh={fetchData} refreshing={loading} />

      <div className="bcr-report-wrap rpt-arial9" ref={reportRef}>
        <h2>{mode === 'opd' ? 'OPD' : 'ADMISSION'} WISE PANEL BILLING REPORT</h2>
        <div className="bcr-sub">
          From {fmtDay(from)} To {fmtDay(to)} &nbsp;|&nbsp; Company: {companyLabel} &nbsp;|&nbsp; {BILLED_LABEL[billed] || 'ALL'}
        </div>

        {rows.length === 0 ? (
          <div className="bcr-empty">
            {loading ? 'Loading...' : 'Is filter mein koi record nahi'}
          </div>
        ) : (
          <table className="bcr-table">
            <thead>
              <tr>
                <th className="bcr-col-sno">SNO</th>
                <th className="bcr-col-admit">{refLabel}</th>
                <th className="bcr-col-date">Date</th>
                <th className="bcr-col-patient">Patient Name</th>
                <th className="bcr-col-emp">Employee Name</th>
                <th className="bcr-col-co">Company</th>
                <th className="bcr-col-rel">Relation</th>
                <th className="bcr-col-rel">Status</th>
                <th className="bcr-col-num">Amount</th>
                <th className="bcr-col-num">Bill Amount</th>
                <th className="bcr-col-num">DEFF</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r, i) => {
                const diff = Number(r.diff || 0);
                return (
                  <tr key={r.id} className={i % 2 === 0 ? 'bcr-even' : ''}>
                    <td>{r.sno}</td>
                    <td>{r.admitNo || ''}</td>
                    <td>{fmtDay(r.date)}</td>
                    <td className="bcr-td-name">{r.patientName}</td>
                    <td>{r.employeeName || ''}</td>
                    <td>{r.companyName || ''}</td>
                    <td><span className={`bcr-rel bcr-rel--${(r.relation||'SELF').toLowerCase()}`}>{r.relation || 'SELF'}</span></td>
                    <td>{r.billed ? 'Billed' : 'Unbilled'}</td>
                    <td className="bcr-num">{fmt(r.amount)}</td>
                    <td className="bcr-num">{fmt(r.billAmount)}</td>
                    <td className={`bcr-num ${diff < 0 ? 'bcr-neg' : ''}`}>{fmt(diff)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={8} className="bcr-tf-label">Total Patients: {rows.length}</td>
                <td className="bcr-num bcr-tf">{fmt(totalAmount)}</td>
                <td className="bcr-num bcr-tf">{fmt(totalBillAmount)}</td>
                <td className={`bcr-num bcr-tf ${totalDiff < 0 ? 'bcr-neg' : ''}`}>{fmt(totalDiff)}</td>
              </tr>
            </tfoot>
          </table>
        )}
        <ShowMoreFooter {...page} noun="patients" />
      </div>
    </div>
  );
}
