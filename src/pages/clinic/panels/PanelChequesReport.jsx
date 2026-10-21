import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { useClinicStore } from '../../../store/useClinicStore';
import { printElementInPopup } from '../../../utils/printPopup';
import PanelChequesImportModal from './PanelChequesImportModal';
import './PanelChequesReport.scss';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};

// `@page` is document-level and shared across the whole app's stylesheet —
// inject a highest-priority override right before printing, remove it after
// (same pattern as PanelBillingDetailReport / PanelBilling's own print).
// Now prints from a popup window (utils/printPopup.js) instead of
// window.print() on the main window, which could freeze the app on Windows.
function printChequesReport(reportEl) {
  printElementInPopup(reportEl, { title: 'Panel Cheques Report', page: 'A4 portrait', margin: '10mm' });
}

// Panels > Reports > Panel Cheques Report — preview step. The "Bill Report"
// filter (Due / Received / Both, optional Post DT date range, Company,
// Summary + Comp / Month / Patient depth) is now its own screen,
// PanelChequesFilter, which opens this at /view?status&postDT&from&to&
// companyId&summary&groupBy. Layout matches the legacy "PANEL IPD SUMMARY
// REPORT": Company header → Billing-Month subtotal → (Patient depth only)
// individual admission rows.
export default function PanelChequesReport() {
  const { fetchPanelChequesReport } = useClinicStore();
  const [params] = useSearchParams();
  const reportRef = useRef(null);

  const status = params.get('status') || 'both'; // due | received | both
  const postDT = params.get('postDT') === '1';
  const fromDate = params.get('from') || '';
  const toDate = params.get('to') || '';
  const companyId = params.get('companyId') || 'ALL';
  const summary = params.get('summary') !== '0';
  const groupBy = params.get('groupBy') || 'comp'; // comp | month | patient
  // Post DT unchecked → no date range (same as the old in-page filter)
  const appliedFrom = postDT ? fromDate : null;
  const appliedTo = postDT ? toDate : null;

  const [data, setData] = useState(null);
  const [shown, setShown] = useState(false);
  // true until the first fetch lands, so the empty-state doesn't flash first
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPanelChequesReport({
        status,
        from: appliedFrom || undefined,
        to: appliedTo || undefined,
        panelCompanyId: companyId,
      });
      setData(res);
      setShown(true);
    } catch (e) {
      toast.error(e.message || 'Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }, [fetchPanelChequesReport, status, appliedFrom, appliedTo, companyId]);

  useEffect(() => { handlePreview(); }, [handlePreview]);

  const companies = data?.companies || [];
  const grandTotal = data?.grandTotal;

  function handlePrint() {
    if (!shown || !companies.length) { toast.error('Print ke liye koi data nahi'); return; }
    printChequesReport(reportRef.current);
  }

  // Same rows / columns / totals the preview shows for the chosen layout
  function handleExport() {
    if (!shown || !companies.length) { toast.error('Export ke liye koi data nahi'); return; }
    const aoa = [
      ['PANEL IPD SUMMARY REPORT'],
      [`From : ${appliedFrom ? fmtDate(appliedFrom) : '—'}   To : ${appliedTo ? fmtDate(appliedTo) : '—'}`],
      [],
    ];
    if (summary) {
      aoa.push(['Company Code & Name', 'Pat.', 'IPD AMT', 'OPD AMT', 'Amount', 'Received', 'Ded', 'Balance']);
      const numRow = (label, x) => [label, x.patCount, Number(x.ipdAmt || 0), Number(x.opdAmt || 0), Number(x.amount || 0), Number(x.received || 0), Number(x.deduction || 0), Number(x.balance || 0)];
      companies.forEach((c) => {
        aoa.push(numRow(`${c.companyCode ? `${c.companyCode}-` : ''}${c.companyName}`, c));
        if (groupBy === 'comp') return;
        c.months.forEach((m) => {
          aoa.push(numRow(`    ${m.monthLabel}`, m));
          if (groupBy !== 'patient') return;
          m.patients.forEach((p) => {
            aoa.push([`        ${p.sno}  ${p.admissionNo} - ${p.patientName}  ${p.billType}`, '', '', '', fmtDate(p.date), Number(p.amount || 0), p.status]);
          });
        });
      });
      if (grandTotal) aoa.push(numRow('GRAND TOTAL', grandTotal));
    } else {
      aoa.push(['Company', 'Month', 'Admission #', 'Patient', 'Date', 'Amount', 'Received', 'Ded', 'Balance', 'Status']);
      companies.forEach((c) => c.months.forEach((m) => m.patients.forEach((p) => {
        aoa.push([`${c.companyCode} — ${c.companyName}`, m.monthLabel, p.admissionNo, p.patientName, fmtDate(p.date),
          Number(p.amount || 0), Number(p.received || 0), Number(p.deduction || 0), Number(p.balance || 0), p.status]);
      })));
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Panel Cheques');
    XLSX.writeFile(wb, 'Panel_Cheques_Report.xlsx');
  }

  return (
    <div className="pcqr-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExport} onRefresh={handlePreview} refreshing={loading}>
        <div className="rpt-tool-sep" />
        <button type="button" className="rpt-tool-btn" onClick={() => setShowImport(true)}>
          <Upload size={14} /> <span>Upload Excel</span>
        </button>
      </ReportToolbar>

      <div className="pcqr-body">
        <div className="pcqr-report rpt-arial9" ref={reportRef}>
          <div className="pcqr-rpt-head">
            <div className="pcqr-rpt-sub">Darul Shifa Hospital</div>
            <div className="pcqr-rpt-title">PANEL IPD SUMMARY REPORT</div>
            <div className="pcqr-rpt-meta">
              <span>From : {appliedFrom ? fmtDate(appliedFrom) : '—'} &nbsp;&nbsp;&nbsp; To : {appliedTo ? fmtDate(appliedTo) : '—'}</span>
              <span>Produced On : {new Date().toLocaleString('en-GB')}</span>
            </div>
          </div>

          {!shown ? (
            <div className="pcqr-empty">{loading ? 'Loading…' : 'Report load nahi hui — Refresh dabayein.'}</div>
          ) : !companies.length ? (
            <div className="pcqr-empty">Is filter par koi record nahi mila.</div>
          ) : summary ? (
            <div className="pcqr-table-wrap">
              <table className="pcqr-table">
                <thead>
                  <tr>
                    <th className="pcqr-l">Company Code &amp; Name</th>
                    <th className="pcqr-r">Pat.</th>
                    <th className="pcqr-r">IPD AMT</th>
                    <th className="pcqr-r">OPD AMT</th>
                    <th className="pcqr-r">Amount</th>
                    <th className="pcqr-r">Received</th>
                    <th className="pcqr-r">Ded</th>
                    <th className="pcqr-r">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <Fragment key={c.panelCompanyId ?? 'none'}>
                      <tr className="pcqr-comp-row">
                        <td className="pcqr-l">{c.companyCode ? `${c.companyCode}-` : ''}{c.companyName}</td>
                        <td className="pcqr-r">{c.patCount}</td>
                        <td className="pcqr-r">{fmt(c.ipdAmt)}</td>
                        <td className="pcqr-r">{fmt(c.opdAmt)}</td>
                        <td className="pcqr-r">{fmt(c.amount)}</td>
                        <td className="pcqr-r">{fmt(c.received)}</td>
                        <td className="pcqr-r">{fmt(c.deduction)}</td>
                        <td className="pcqr-r">{fmt(c.balance)}</td>
                      </tr>
                      {groupBy !== 'comp' && c.months.map((m) => (
                        <Fragment key={`${c.panelCompanyId ?? 'none'}-${m.year}-${m.month}`}>
                          <tr className="pcqr-month-row">
                            <td className="pcqr-l pcqr-indent">{m.monthLabel}</td>
                            <td className="pcqr-r">{m.patCount}</td>
                            <td className="pcqr-r">{fmt(m.ipdAmt)}</td>
                            <td className="pcqr-r">{fmt(m.opdAmt)}</td>
                            <td className="pcqr-r">{fmt(m.amount)}</td>
                            <td className="pcqr-r">{fmt(m.received)}</td>
                            <td className="pcqr-r">{fmt(m.deduction)}</td>
                            <td className="pcqr-r">{fmt(m.balance)}</td>
                          </tr>
                          {groupBy === 'patient' && m.patients.map((p) => (
                            <tr className="pcqr-patient-row" key={p.admissionId}>
                              <td className="pcqr-l pcqr-indent2" colSpan={4}>
                                <span className="pcqr-sno">{p.sno}</span>
                                {p.admissionNo} - {p.patientName}
                                <span className="pcqr-bill-type">{p.billType}</span>
                              </td>
                              <td className="pcqr-l pcqr-pdate">{fmtDate(p.date)}</td>
                              <td className="pcqr-r">{fmt(p.amount)}</td>
                              <td className={`pcqr-l pcqr-status ${p.status === 'Due' ? 'pcqr-status--due' : ''}`} colSpan={2}>{p.status}</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                {grandTotal && (
                  <tfoot>
                    <tr className="pcqr-totals">
                      <td className="pcqr-l">GRAND TOTAL</td>
                      <td className="pcqr-r">{grandTotal.patCount}</td>
                      <td className="pcqr-r">{fmt(grandTotal.ipdAmt)}</td>
                      <td className="pcqr-r">{fmt(grandTotal.opdAmt)}</td>
                      <td className="pcqr-r">{fmt(grandTotal.amount)}</td>
                      <td className="pcqr-r">{fmt(grandTotal.received)}</td>
                      <td className="pcqr-r">{fmt(grandTotal.deduction)}</td>
                      <td className="pcqr-r">{fmt(grandTotal.balance)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            // Summary unchecked — flat, ungrouped list (one row per admission)
            <div className="pcqr-table-wrap">
              <table className="pcqr-table">
                <thead>
                  <tr>
                    <th className="pcqr-l">Company</th>
                    <th className="pcqr-l">Month</th>
                    <th className="pcqr-l">Admission #</th>
                    <th className="pcqr-l">Patient</th>
                    <th className="pcqr-l">Date</th>
                    <th className="pcqr-r">Amount</th>
                    <th className="pcqr-r">Received</th>
                    <th className="pcqr-r">Ded</th>
                    <th className="pcqr-r">Balance</th>
                    <th className="pcqr-l">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.flatMap((c) => c.months.flatMap((m) => m.patients.map((p) => (
                    <tr key={p.admissionId}>
                      <td className="pcqr-l">{c.companyCode} — {c.companyName}</td>
                      <td className="pcqr-l">{m.monthLabel}</td>
                      <td className="pcqr-l">{p.admissionNo}</td>
                      <td className="pcqr-l">{p.patientName}</td>
                      <td className="pcqr-l">{fmtDate(p.date)}</td>
                      <td className="pcqr-r">{fmt(p.amount)}</td>
                      <td className="pcqr-r">{fmt(p.received)}</td>
                      <td className="pcqr-r">{fmt(p.deduction)}</td>
                      <td className="pcqr-r">{fmt(p.balance)}</td>
                      <td className={`pcqr-l ${p.status === 'Due' ? 'pcqr-status--due' : ''}`}>{p.status}</td>
                    </tr>
                  ))))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <PanelChequesImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); if (shown) handlePreview(); }}
        />
      )}
    </div>
  );
}

