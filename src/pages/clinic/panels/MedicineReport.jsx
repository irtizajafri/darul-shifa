import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { useClinicStore } from '../../../store/useClinicStore';
import { printElementInPopup } from '../../../utils/printPopup';
import MedicineReportImportModal from './MedicineReportImportModal';
import usePagedList from '../../../hooks/usePagedList';
import ShowMoreFooter from '../../../components/reports/ShowMoreFooter';
import './MedicineReport.scss';
import { useShallow } from 'zustand/react/shallow';
const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};

// `@page` is document-level and shared across the whole app's stylesheet —
// inject a highest-priority override right before printing, remove it after
// (same pattern as Panel Cheques Report / Provisional Bill's own print).
// Now prints from a popup window (utils/printPopup.js) instead of
// window.print() on the main window, which could freeze the app on Windows.
function printMedicineReport(reportEl) {
  printElementInPopup(reportEl, { title: 'Medicine Report', page: 'A4 portrait', margin: '10mm' });
}

// Panels > Reports > Medicine Report — preview step. The legacy "Medican
// Report" filter (Admission # exact OR a date-range by Admission/Discharge
// Date, optional Company, Details vs Admit-wise Summary, Medical Store) is
// now its own screen, MedicineReportFilter, which opens this at
// /view?scopeMode&admissionNo&dateType&fromDate&toDate&companyId&viewMode&storeFilter.
export default function MedicineReport() {
  const { pharmacyStores, fetchPharmacyStores, fetchPanelMedicineIssuanceReport } = useClinicStore(useShallow((s) => ({ pharmacyStores: s.pharmacyStores, fetchPharmacyStores: s.fetchPharmacyStores, fetchPanelMedicineIssuanceReport: s.fetchPanelMedicineIssuanceReport })));
  const [params] = useSearchParams();
  const reportRef = useRef(null);

  const scopeMode = params.get('scopeMode') || 'date'; // 'admission' | 'date'
  const admissionNo = (params.get('admissionNo') || '').trim();
  const dateType = params.get('dateType') || 'discharge'; // 'admission' | 'discharge'
  const fromDate = params.get('fromDate') || '';
  const toDate = params.get('toDate') || '';
  const companyId = params.get('companyId') || '';
  const viewMode = params.get('viewMode') || 'details'; // 'details' | 'summary'
  // Medical Store (Parameters > Pharmacy Stores) — 'ALL' | 'hospital' | store id.
  const storeFilter = params.get('storeFilter') || 'ALL';

  const [showImport, setShowImport] = useState(false);

  const [data, setData] = useState(null);
  const [shown, setShown] = useState(false);
  // true until the first fetch lands, so the empty-state doesn't flash first
  const [loading, setLoading] = useState(true);

  // Only for the Medical Store label in the report header
  useEffect(() => { fetchPharmacyStores(); }, [fetchPharmacyStores]);

  const storeOptions = [
    { id: 'ALL', label: 'ALL' },
    // Pharmacy Stores usually already has a "HOSPITAL STORE" — only add our
    // own In-House option when it doesn't.
    ...(pharmacyStores.some((s) => /hospital/i.test(s.name)) ? [] : [{ id: 'hospital', label: 'Hospital Store' }]),
    ...pharmacyStores.map((s) => ({ id: String(s.id), label: s.status === 'inactive' ? `${s.name} (inactive)` : s.name })),
  ];
  const storeLabel = storeOptions.find((o) => o.id === storeFilter)?.label || 'ALL';

  const handleView = useCallback(async () => {
    if (scopeMode === 'admission' && !admissionNo) {
      toast.error('Admission # darj karein');
      setLoading(false);
      return;
    }
    if (scopeMode === 'date' && (!fromDate || !toDate)) {
      toast.error('From/To date select karein');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchPanelMedicineIssuanceReport({
        scopeMode,
        admissionNo: scopeMode === 'admission' ? admissionNo : undefined,
        dateType: scopeMode === 'date' ? dateType : undefined,
        fromDate: scopeMode === 'date' ? fromDate : undefined,
        toDate: scopeMode === 'date' ? toDate : undefined,
        panelCompanyId: companyId || undefined,
        storeFilter,
        viewMode,
      });
      setData(res);
      setShown(true);
    } catch (err) {
      toast.error(err.message || 'Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }, [fetchPanelMedicineIssuanceReport, scopeMode, admissionNo, dateType, fromDate, toDate, companyId, storeFilter, viewMode]);

  useEffect(() => { handleView(); }, [handleView]);

  const hasRows = data && (data.mode === 'summary' ? data.rows.length > 0 : data.days.length > 0);

  // On-screen paging (up to ~84k medicine lines froze the app for seconds):
  // Summary draws 300 admission rows at a time; Details draws 300 PATIENT
  // blocks at a time (each with all its lines and its TOTAL), keeping their
  // day headers. Day / patient / grand totals come from the data, so they
  // stay over everything; print and Excel use all of it. Page 1 again on
  // every new fetch.
  const groupCount = useMemo(() => {
    if (!data) return 0;
    if (data.mode === 'summary') return data.rows.length;
    return data.days.reduce((n, d) => n + d.patients.length, 0);
  }, [data]);
  const page = usePagedList(groupCount, data);
  const visible = useMemo(() => {
    if (!data) return null;
    if (page.limit >= groupCount) return data;
    if (data.mode === 'summary') return { ...data, rows: data.rows.slice(0, page.limit) };
    const days = [];
    let left = page.limit;
    for (const day of data.days) {
      if (left <= 0) break;
      days.push(day.patients.length <= left ? day : { ...day, patients: day.patients.slice(0, left) });
      left -= day.patients.length;
    }
    return { ...data, days };
  }, [data, groupCount, page.limit]);

  function handlePrint() {
    if (!hasRows) { toast.error('Print ke liye koi data nahi'); return; }
    // Print clones the on-screen report — render every row/patient for it.
    page.withAll(() => printMedicineReport(reportRef.current));
  }

  // Same rows / columns / totals as the preview — Summary: one row per
  // admission; Details: one row per medicine line with its day / patient,
  // then the patient TOTAL, DAY WISE TOTAL and Grand Total rows.
  function handleExport() {
    if (!hasRows) { toast.error('Export ke liye koi data nahi'); return; }
    const aoa = [
      ['MEDICINE ISSUANCE REPORT FOR PANEL'],
      [`${scopeMode === 'admission' ? `Admission # : ${admissionNo}` : `From : ${fmtDate(fromDate)}  To : ${fmtDate(toDate)}`}  |  Medical Store : ${storeLabel}`],
      [],
    ];
    if (data.mode === 'summary') {
      aoa.push(['Sno', 'Admission #', 'Patient', 'Company', 'Admit Date', 'Dis. Date', 'Items', 'Amount']);
      data.rows.forEach((r, idx) => aoa.push([idx + 1, r.admissionNo, r.patientName, r.companyName || '', fmtDate(r.admitDate), fmtDate(r.dischargeDate), r.itemCount, Number(r.total || 0)]));
      aoa.push(['Grand Total', '', '', '', '', '', '', Number(data.grandTotal || 0)]);
    } else {
      aoa.push(['Day', 'Admission #', 'Patient', 'Company', 'Admit Date', 'Dis. Date', 'Sno', 'Description', 'Med Date', 'Rate', 'Qty', 'Amount', 'Medical Store']);
      data.days.forEach((day) => {
        day.patients.forEach((p) => {
          p.items.forEach((it) => aoa.push([
            fmtDate(day.date), p.admissionNo, p.patientName, p.companyName || '', fmtDate(p.admitDate), fmtDate(p.dischargeDate),
            it.sno, it.description, fmtDate(it.medDate), Number(it.rate || 0), it.qty, Number(it.amount || 0), it.store || '',
          ]));
          aoa.push(['', p.admissionNo, 'TOTAL :', '', '', '', '', '', '', '', '', Number(p.patientTotal || 0)]);
        });
        aoa.push([fmtDate(day.date), '', 'DAY WISE TOTAL :', '', '', '', '', '', '', '', '', Number(day.dayTotal || 0)]);
      });
      aoa.push(['Grand Total', '', '', '', '', '', '', '', '', '', '', Number(data.grandTotal || 0)]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Medicine Report');
    XLSX.writeFile(wb, 'Medicine_Report.xlsx');
  }

  return (
    <div className="mrp-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExport} onRefresh={handleView} refreshing={loading}>
        <div className="rpt-tool-sep" />
        <button type="button" className="rpt-tool-btn" onClick={() => setShowImport(true)}>
          <Upload size={14} /> <span>Upload Excel</span>
        </button>
      </ReportToolbar>

      <div className="mrp-body">
        <div className="mrp-report rpt-arial9" ref={reportRef}>
          <div className="mrp-rpt-head">
            <div className="mrp-rpt-hospital">Darul Shifa Hospital</div>
            <div className="mrp-rpt-title">MEDICINE ISSUANCE REPORT FOR PANEL</div>
            {shown && (
              <div className="mrp-rpt-meta">
                <span>
                  {scopeMode === 'admission'
                    ? `Admission # : ${admissionNo}`
                    : `From : ${fmtDate(fromDate)}  To : ${fmtDate(toDate)}`}
                  {'  |  '}Medical Store : {storeLabel}
                </span>
                <span>Produced On : {new Date().toLocaleString('en-GB')}</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="mrp-empty">Loading…</div>
          ) : !shown ? (
            <div className="mrp-empty">Report load nahi hui — Refresh dabayein.</div>
          ) : !hasRows ? (
            <div className="mrp-empty">Is filter par koi record nahi mila.</div>
          ) : data.mode === 'summary' ? (
            <div className="mrp-table-wrap">
              <table className="mrp-rpt-table">
                <thead>
                  <tr>
                    <th className="mrp-l">Sno</th>
                    <th className="mrp-l">Admission #</th>
                    <th className="mrp-l">Patient</th>
                    <th className="mrp-l">Company</th>
                    <th className="mrp-l">Admit Date</th>
                    <th className="mrp-l">Dis. Date</th>
                    <th className="mrp-r">Items</th>
                    <th className="mrp-r">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.rows.map((r, idx) => (
                    <tr key={r.admissionNo}>
                      <td className="mrp-l">{idx + 1}</td>
                      <td className="mrp-l">{r.admissionNo}</td>
                      <td className="mrp-l">{r.patientName}</td>
                      <td className="mrp-l">{r.companyName || '—'}</td>
                      <td className="mrp-l">{fmtDate(r.admitDate)}</td>
                      <td className="mrp-l">{fmtDate(r.dischargeDate)}</td>
                      <td className="mrp-r">{r.itemCount}</td>
                      <td className="mrp-r">{fmt(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="mrp-rpt-totals">
                    <td colSpan={7} className="mrp-l">Grand Total</td>
                    <td className="mrp-r">{fmt(data.grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
              <ShowMoreFooter {...page} noun="admissions" />
            </div>
          ) : (
            <div className="mrp-details">
              {visible.days.map((day) => (
                <div className="mrp-day-block" key={day.date}>
                  <div className="mrp-day-hdr">
                    <span>{fmtDate(day.date)}</span>
                    <span className="mrp-day-total">DAY WISE TOTAL : <b>{fmt(day.dayTotal)}</b></span>
                  </div>

                  {day.patients.map((p) => (
                    <div className="mrp-patient-block" key={`${day.date}-${p.admissionNo}`}>
                      <div className="mrp-patient-hdr">
                        <span><b>PATIENT :</b> {p.admissionNo} - {p.patientName}</span>
                        <span><b>ADMIT DATE :</b> {fmtDate(p.admitDate)}</span>
                      </div>
                      <div className="mrp-patient-hdr">
                        <span><b>COMPANY :</b> {p.companyName || '—'}</span>
                        <span><b>DIS. DATE :</b> {fmtDate(p.dischargeDate)}</span>
                      </div>

                      <table className="mrp-rpt-table mrp-rpt-table--items">
                        <thead>
                          <tr>
                            <th className="mrp-l">Sno</th>
                            <th className="mrp-l">Description</th>
                            <th className="mrp-l">Med Date</th>
                            <th className="mrp-r">Rate</th>
                            <th className="mrp-r">Qty</th>
                            <th className="mrp-r">Amount</th>
                            <th className="mrp-l">Medical Store</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.items.map((it) => (
                            <tr key={it.sno}>
                              <td className="mrp-l">{it.sno}</td>
                              <td className="mrp-l">{it.description}</td>
                              <td className="mrp-l">{fmtDate(it.medDate)}</td>
                              <td className="mrp-r">{fmt(it.rate)}</td>
                              <td className="mrp-r">{it.qty}</td>
                              <td className="mrp-r">{fmt(it.amount)}</td>
                              <td className="mrp-l">{it.store || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="mrp-patient-totals">
                            <td colSpan={5} className="mrp-l">TOTAL :</td>
                            <td className="mrp-r">{fmt(p.patientTotal)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))}
                </div>
              ))}

              <ShowMoreFooter {...page} noun="patients" />
              <div className="mrp-grand-total">Grand Total : <b>{fmt(data.grandTotal)}</b></div>
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <MedicineReportImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}

