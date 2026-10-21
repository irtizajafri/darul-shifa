import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { useClinicStore } from '../../../store/useClinicStore';
import { printElementInPopup } from '../../../utils/printPopup';
import OpdAdmitReportImportModal from './OpdAdmitReportImportModal';
import './OpdAdmitReport.scss';

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
function printOpdAdmitReport(reportEl) {
  printElementInPopup(reportEl, { title: 'OPD Admit Report', page: 'A4 portrait', margin: '10mm' });
}

// Panels > Reports > OPD Admit Report — preview step. The legacy "Panel
// Report" filter (Admission/OPD universe, Discharge/Admit date for the
// From/To range, optional Company, Details/Headers/Summary/With Slip) is now
// its own screen, OpdAdmitReportFilter, which opens this at
// /view?scopeType&dateType&fromDate&toDate&companyId&viewMode. Only
// Admission + Details/With Slip is built (matching the "ADMISSION WISE PANEL
// REPORT" reference) — the other combinations still show a placeholder until
// their own reference is provided. Import is fully standalone — same
// architecture/rationale as Medicine Report's (see clinic.service.js): never
// creates or matches a ClinicAdmission, just reflects the uploaded file's own
// data as-is.
export default function OpdAdmitReport() {
  const { panelCompanies, fetchPanelCompanies, fetchPanelAdmitReport } = useClinicStore();
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
  const notBuiltYet = scopeType !== 'admission' || (viewMode !== 'details' && viewMode !== 'withSlip');

  const handlePreview = useCallback(async () => {
    if (notBuiltYet) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetchPanelAdmitReport({
        dateType, fromDate, toDate,
        panelCompanyId: companyId !== 'ALL' ? companyId : undefined,
      });
      setData(res);
    } catch (err) {
      toast.error(err.message || 'Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }, [fetchPanelAdmitReport, notBuiltYet, dateType, fromDate, toDate, companyId]);

  useEffect(() => { handlePreview(); }, [handlePreview]);

  const hasRows = data && data.admissions && data.admissions.length > 0;
  const showSlips = viewMode === 'withSlip';

  const metaText = [
    scopeType === 'admission' ? 'Admission' : 'OPD',
    dateType === 'discharge' ? 'Discharge Date' : 'Admit Date',
    `From : ${fmtDate(fromDate)}   To : ${fmtDate(toDate)}`,
    selectedCompany ? `Company : ${selectedCompany.code} - ${selectedCompany.name}` : null,
  ].filter(Boolean).join('   |   ');

  function handlePrint() {
    if (!hasRows) { toast.error('Print ke liye koi data nahi'); return; }
    printOpdAdmitReport(reportRef.current);
  }

  // Same rows / columns / totals as the preview: admission row, its dept
  // rows (and, With Slip, each dept's slips), then the totals row.
  function handleExport() {
    if (!hasRows) { toast.error('Export ke liye koi data nahi'); return; }
    const aoa = [
      ['ADMISSION WISE PANEL REPORT'],
      [metaText],
      [],
      ['Admit Number & Patient Name', 'Employee Name', 'Company', 'Status', 'Admit Date', 'Dis Date', 'Slip', 'Amount'],
    ];
    data.admissions.forEach((a) => {
      aoa.push([`${a.admissionNo} - ${a.patientName}`, a.employeeName || '', a.companyName || '', a.status || '', fmtDate(a.admitDate), fmtDate(a.dischargeDate), a.slip, Number(a.amount || 0)]);
      a.depts.forEach((d) => {
        aoa.push(['', '', '', d.dept, '', '', d.slip, Number(d.amount || 0)]);
        if (showSlips) {
          d.slips.forEach((s) => aoa.push(['', '', '', `${s.slipNo ? String(s.slipNo).padStart(9, '0') : '—'} - ${s.patientName || a.patientName}`, '', '', '', Number(s.amount || 0)]));
        }
      });
    });
    aoa.push([`Total Admissions : ${data.totals.admissionCount}`, '', '', '', '', '', data.totals.slip, Number(data.totals.amount || 0)]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'OPD Admit Report');
    XLSX.writeFile(wb, `OPD_Admit_Report_${fromDate}_${toDate}.xlsx`);
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
            <div className="oar-rpt-title">ADMISSION WISE PANEL REPORT</div>
            <div className="oar-rpt-meta">
              <span>{metaText}</span>
              <span>Produced On : {new Date().toLocaleString('en-GB')}</span>
            </div>
          </div>

          {loading ? (
            <div className="oar-empty">Loading…</div>
          ) : notBuiltYet ? (
            <div className="oar-empty">
              Yeh combination (OPD scope / Headers / Summary) abhi banaya nahi gaya — filhal sirf <b>Admission</b> + <b>Details</b>/<b>With Slip</b> available hai.
            </div>
          ) : !hasRows ? (
            <div className="oar-empty">Is filter par koi record nahi mila.</div>
          ) : (
            <div className="oar-table-wrap">
              <table className="oar-table">
                <thead>
                  <tr>
                    <th className="oar-l">Admit Number &amp; Patient Name</th>
                    <th className="oar-l">Employee Name</th>
                    <th className="oar-l">Company</th>
                    <th className="oar-l">Status</th>
                    <th className="oar-l">Admit Date</th>
                    <th className="oar-l">Dis Date</th>
                    <th className="oar-r">Slip</th>
                    <th className="oar-r">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.admissions.map((a) => (
                    <Fragment key={a.admissionNo}>
                      <tr className="oar-adm-row">
                        <td className="oar-l">{a.admissionNo} - {a.patientName}</td>
                        <td className="oar-l">{a.employeeName || '—'}</td>
                        <td className="oar-l">{a.companyName || '—'}</td>
                        <td className="oar-l">{a.status || '—'}</td>
                        <td className="oar-l">{fmtDate(a.admitDate)}</td>
                        <td className="oar-l">{fmtDate(a.dischargeDate)}</td>
                        <td className="oar-r">{a.slip}</td>
                        <td className="oar-r">{fmt(a.amount)}</td>
                      </tr>
                      {a.depts.map((d, idx) => (
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
                    <td className="oar-l" colSpan={6}>Total Admissions : {data.totals.admissionCount}</td>
                    <td className="oar-r">{data.totals.slip}</td>
                    <td className="oar-r">{fmt(data.totals.amount)}</td>
                  </tr>
                </tfoot>
              </table>
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

