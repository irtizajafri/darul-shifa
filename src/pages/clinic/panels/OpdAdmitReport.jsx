import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { useClinicStore } from '../../../store/useClinicStore';
import { printElementInPopup } from '../../../utils/printPopup';
import { openPrintWindow } from '../../../utils/printRelay';
import OpdAdmitReportImportModal from './OpdAdmitReportImportModal';
import usePagedList from '../../../hooks/usePagedList';
import ShowMoreFooter from '../../../components/reports/ShowMoreFooter';
import './OpdAdmitReport.scss';
import { useShallow } from 'zustand/react/shallow';

const NO_COMPANY = '(company not set)';
const VIEW_LABEL = { details: 'Details', headers: 'Headers', summary: 'Summary', withSlip: 'With Slip' };
const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};

// `@page` is document-level and shared across the whole app's stylesheet —
// inject a highest-priority override right before printing, remove it after
// (same pattern as Panel Cheques Report / Medicine Report's own print).
// Now prints from a popup window (utils/printPopup.js) instead of
// window.print() on the main window, which could freeze the app on Windows.
function printOpdAdmitReport(reportEl, targetWindow) {
  printElementInPopup(reportEl, { title: 'OPD Admit Report', page: 'A4 portrait', margin: '10mm', targetWindow });
}

// Panels > Reports > OPD Admit Report — preview step. The legacy "Panel
// Report" filter (Admission/OPD universe, Discharge/Admit date for the
// From/To range, optional Company, Details/Headers/Summary/With Slip) is now
// its own screen, OpdAdmitReportFilter, which opens this at
// /view?scopeType&dateType&fromDate&toDate&companyId&viewMode. Views (all
// from the same data): Details = each admission / patient with its dept rows
// (the "ADMISSION WISE PANEL REPORT" reference); With Slip = plus each dept's
// slips; Headers = the admission / patient rows only; Summary = one row per
// panel company (owner, 2026-11-27 — no reference format given for these
// two). Import is fully standalone — same
// architecture/rationale as Medicine Report's (see clinic.service.js): never
// creates or matches a ClinicAdmission, just reflects the uploaded file's own
// data as-is.
export default function OpdAdmitReport() {
  const { panelCompanies, fetchPanelCompanies, fetchPanelAdmitReport } = useClinicStore(useShallow((s) => ({ panelCompanies: s.panelCompanies, fetchPanelCompanies: s.fetchPanelCompanies, fetchPanelAdmitReport: s.fetchPanelAdmitReport })));
  const [params] = useSearchParams();
  const reportRef = useRef(null);

  const scopeType = params.get('scopeType') || 'admission'; // admission | opd
  const dateType = params.get('dateType') || 'discharge'; // discharge | admit
  const fromDate = params.get('fromDate') || '';
  const toDate = params.get('toDate') || '';
  const companyId = params.get('companyId') || 'ALL';
  const viewMode = params.get('viewMode') || 'details'; // details | headers | summary | withSlip

  const [showImport, setShowImport] = useState(false);

  const [data, setData] = useState(null);
  // true until the first fetch lands, so the empty-state doesn't flash first
  const [loading, setLoading] = useState(true);

  // Only for the Company name in the report header
  useEffect(() => { fetchPanelCompanies(); }, [fetchPanelCompanies]);

  const selectedCompany = panelCompanies.find((c) => String(c.id) === String(companyId));
  const isOpd = scopeType === 'opd';

  const handlePreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPanelAdmitReport({
        scopeType, dateType, fromDate, toDate,
        panelCompanyId: companyId !== 'ALL' ? companyId : undefined,
      });
      setData(res);
    } catch (err) {
      toast.error(err.message || 'Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }, [fetchPanelAdmitReport, scopeType, dateType, fromDate, toDate, companyId]);

  useEffect(() => { handlePreview(); }, [handlePreview]);

  const hasRows = data && data.admissions && data.admissions.length > 0;
  const showSlips = viewMode === 'withSlip';
  const showDepts = viewMode === 'details' || viewMode === 'withSlip';
  const isSummary = viewMode === 'summary';

  // Summary: one row per panel company — admissions / patients, slips, amount.
  const companyRows = useMemo(() => {
    if (!isSummary || !data?.admissions) return [];
    const m = new Map();
    for (const a of data.admissions) {
      const k = a.companyName || NO_COMPANY;
      if (!m.has(k)) m.set(k, { company: k, count: 0, slip: 0, amount: 0 });
      const r = m.get(k);
      r.count += 1; r.slip += Number(a.slip) || 0; r.amount += Number(a.amount) || 0;
    }
    return [...m.values()].sort((a, b) => (a.company === NO_COMPANY) - (b.company === NO_COMPANY) || a.company.localeCompare(b.company));
  }, [isSummary, data]);

  // Draw 300 admissions (each with all its dept / slip lines) at a time —
  // ~9.4k rows froze the app. Totals come from data.totals (all rows);
  // print and Excel use every admission. Page 1 again on every new fetch.
  const admissions = data?.admissions;
  const page = usePagedList(admissions?.length || 0, admissions);
  const visibleAdmissions = useMemo(
    () => (!admissions || page.limit >= admissions.length ? admissions : admissions.slice(0, page.limit)),
    [admissions, page.limit],
  );

  const metaText = [
    scopeType === 'admission' ? 'Admission' : 'OPD',
    scopeType === 'opd' ? 'Slip Date (8 AM – 8 AM)' : dateType === 'discharge' ? 'Discharge Date' : 'Admit Date',
    `From : ${fmtDate(fromDate)}   To : ${fmtDate(toDate)}`,
    selectedCompany ? `Company : ${selectedCompany.code} - ${selectedCompany.name}` : null,
    VIEW_LABEL[viewMode] || viewMode, // which view, on screen, print and Excel (2026-11-27)
  ].filter(Boolean).join('   |   ');

  const reportTitle = `${isOpd ? 'OPD WISE PANEL REPORT' : 'ADMISSION WISE PANEL REPORT'}${isSummary ? ' — SUMMARY' : ''}`;
  const totalLabel = isOpd ? 'Total Patients' : 'Total Admissions';
  const countLabel = isOpd ? 'Patients' : 'Admissions';

  function handlePrint() {
    if (!hasRows) { toast.error('Print ke liye koi data nahi'); return; }
    // Print clones the on-screen table — render every admission for it.
    // Window opened first, on the click — the full render can take a while.
    const w = openPrintWindow('width=1000,height=800');
    page.withAll(() => printOpdAdmitReport(reportRef.current, w));
  }

  // Same rows / columns / totals as the preview: admission row, its dept
  // rows (and, With Slip, each dept's slips), then the totals row. Headers:
  // the admission rows only. Summary: one row per company.
  function handleExport() {
    if (!hasRows) { toast.error('Export ke liye koi data nahi'); return; }
    if (isSummary) {
      const aoa = [[reportTitle], [metaText], [], ['Company', countLabel, 'Slip', 'Amount']];
      companyRows.forEach((r) => aoa.push([r.company, r.count, r.slip, Number(r.amount.toFixed(2))]));
      aoa.push([`Total (${companyRows.length} companies)`, data.totals.admissionCount, data.totals.slip, Number(data.totals.amount || 0)]);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'OPD Admit Report');
      XLSX.writeFile(wb, `OPD_Admit_Report_Summary_${fromDate}_${toDate}.xlsx`);
      return;
    }
    const aoa = [
      [reportTitle],
      [metaText],
      [],
      isOpd
        ? ['Patient Name', 'Employee Name', 'Company', 'Relation', 'Date', '', 'Slip', 'Amount']
        : ['Admit Number & Patient Name', 'Employee Name', 'Company', 'Status', 'Admit Date', 'Dis Date', 'Slip', 'Amount'],
    ];
    data.admissions.forEach((a) => {
      aoa.push(isOpd
        ? [a.patientName, a.employeeName || '', a.companyName || '', a.relation || '', fmtDate(a.date), '', a.slip, Number(a.amount || 0)]
        : [`${a.admissionNo} - ${a.patientName}`, a.employeeName || '', a.companyName || '', a.status || '', fmtDate(a.admitDate), fmtDate(a.dischargeDate), a.slip, Number(a.amount || 0)]);
      if (showDepts) a.depts.forEach((d) => {
        aoa.push(['', '', '', d.dept, '', '', d.slip, Number(d.amount || 0)]);
        if (showSlips) {
          d.slips.forEach((s) => aoa.push(['', '', '', `${s.slipNo ? String(s.slipNo).padStart(9, '0') : '—'} - ${s.patientName || a.patientName}`, '', '', '', Number(s.amount || 0)]));
        }
      });
    });
    aoa.push([`${totalLabel} : ${data.totals.admissionCount}`, '', '', '', '', '', data.totals.slip, Number(data.totals.amount || 0)]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OPD Admit Report');
    XLSX.writeFile(wb, `OPD_Admit_Report_${VIEW_LABEL[viewMode] ? VIEW_LABEL[viewMode].replace(/ /g, '_') + '_' : ''}${fromDate}_${toDate}.xlsx`);
  }

  return (
    <div className="oar-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExport} onRefresh={handlePreview} refreshing={loading}>
        <div className="rpt-tool-sep" />
        <button type="button" className="rpt-tool-btn" onClick={() => setShowImport(true)}>
          <Upload size={14} /> <span>Upload Excel</span>
        </button>
      </ReportToolbar>

      <div className="oar-body">
        <div className="oar-report rpt-arial9" ref={reportRef}>
          <div className="oar-rpt-head">
            <div className="oar-rpt-sub">Darul Shifa Hospital</div>
            <div className="oar-rpt-title">{reportTitle}</div>
            <div className="oar-rpt-meta">
              <span>{metaText}</span>
              <span>Produced On : {new Date().toLocaleString('en-GB')}</span>
            </div>
          </div>

          {loading ? (
            <div className="oar-empty">Loading…</div>
          ) : !hasRows ? (
            <div className="oar-empty">Is filter par koi record nahi mila.</div>
          ) : isSummary ? (
            <div className="oar-table-wrap">
              <table className="oar-table">
                <thead>
                  <tr>
                    <th className="oar-l">Company</th>
                    <th className="oar-r">{countLabel}</th>
                    <th className="oar-r">Slip</th>
                    <th className="oar-r">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {companyRows.map((r) => (
                    <tr className="oar-adm-row" key={r.company}>
                      <td className="oar-l">{r.company}</td>
                      <td className="oar-r">{r.count}</td>
                      <td className="oar-r">{r.slip}</td>
                      <td className="oar-r">{fmt(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="oar-totals">
                    <td className="oar-l">Total ({companyRows.length} companies)</td>
                    <td className="oar-r">{data.totals.admissionCount}</td>
                    <td className="oar-r">{data.totals.slip}</td>
                    <td className="oar-r">{fmt(data.totals.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="oar-table-wrap">
              <table className="oar-table">
                <thead>
                  <tr>
                    <th className="oar-l">{isOpd ? 'Patient Name' : <>Admit Number &amp; Patient Name</>}</th>
                    <th className="oar-l">Employee Name</th>
                    <th className="oar-l">Company</th>
                    <th className="oar-l">{isOpd ? 'Relation' : 'Status'}</th>
                    <th className="oar-l">{isOpd ? 'Date' : 'Admit Date'}</th>
                    <th className="oar-l">{isOpd ? '' : 'Dis Date'}</th>
                    <th className="oar-r">Slip</th>
                    <th className="oar-r">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAdmissions.map((a) => (
                    <Fragment key={a.admissionNo}>
                      <tr className="oar-adm-row">
                        <td className="oar-l">{isOpd ? a.patientName : `${a.admissionNo} - ${a.patientName}`}</td>
                        <td className="oar-l">{a.employeeName || '—'}</td>
                        <td className="oar-l">{a.companyName || '—'}</td>
                        <td className="oar-l">{(isOpd ? a.relation : a.status) || '—'}</td>
                        <td className="oar-l">{fmtDate(isOpd ? a.date : a.admitDate)}</td>
                        <td className="oar-l">{isOpd ? '' : fmtDate(a.dischargeDate)}</td>
                        <td className="oar-r">{a.slip}</td>
                        <td className="oar-r">{fmt(a.amount)}</td>
                      </tr>
                      {showDepts && a.depts.map((d, idx) => (
                        <Fragment key={`${a.admissionNo}-${idx}`}>
                          <tr className="oar-dept-row">
                            <td className="oar-l" colSpan={3} />
                            <td className="oar-l oar-dept-lbl">{d.dept}</td>
                            <td colSpan={2} />
                            <td className="oar-r">{d.slip}</td>
                            <td className="oar-r">{fmt(d.amount)}</td>
                          </tr>
                          {showSlips && d.slips.map((s, sidx) => (
                            <tr className="oar-slip-row" key={`${a.admissionNo}-${idx}-${sidx}`}>
                              <td className="oar-l" colSpan={3} />
                              <td className="oar-l oar-slip-lbl">
                                {s.slipNo ? String(s.slipNo).padStart(9, '0') : '—'} - {s.patientName || a.patientName}
                              </td>
                              <td colSpan={3} />
                              <td className="oar-r">{fmt(s.amount)}</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="oar-totals">
                    <td className="oar-l" colSpan={6}>{totalLabel} : {data.totals.admissionCount}</td>
                    <td className="oar-r">{data.totals.slip}</td>
                    <td className="oar-r">{fmt(data.totals.amount)}</td>
                  </tr>
                </tfoot>
              </table>
              <ShowMoreFooter {...page} noun={isOpd ? 'patients' : 'admissions'} />
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <OpdAdmitReportImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}

