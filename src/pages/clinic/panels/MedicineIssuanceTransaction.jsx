import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { REPORT_PRINT_FONT_CSS } from '../../../components/reports/reportFont';
import { useClinicStore } from '../../../store/useClinicStore';
import { printElementInPopup } from '../../../utils/printPopup';
import { buildMedicineIssuancePrintHtml } from './medicineIssuancePrintUtils';
import MedicineIssuanceImportModal from './MedicineIssuanceImportModal';
// Shares Panels > Reports > Medicine Report's styles; the Cash layout's own
// extras (patient grid, store filter) live in MedicineIssuanceTransaction.scss.
import './MedicineReport.scss';
import './MedicineIssuanceTransaction.scss';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};

// Details prints the legacy CashMed.rpt layout (medicineIssuancePrintUtils);
// Admit wise Summary prints the on-screen table from a popup. Both in Arial 9
// (owner's report format) and both from a popup window, never window.print()
// on the main window (which could freeze the app on Windows).
function printMedicineIssuanceTxn(reportEl, data, filters) {
  if (data?.mode === 'details') {
    const w = window.open('', '_blank', 'width=1000,height=800');
    if (!w) { toast.error('Popup blocked — please allow popups for this site'); return; }
    const html = buildMedicineIssuancePrintHtml({ data, filters }).replace('</style>', `${REPORT_PRINT_FONT_CSS}</style>`);
    w.document.write(html);
    w.document.close();
    return;
  }
  // Font comes from the report body's `rpt-arial9` class (stylesheets are
  // copied into the popup).
  printElementInPopup(reportEl, {
    title: 'Medicine Issuance',
    page: 'A4 portrait',
    margin: '8mm',
  });
}

// Clinic > Report > Medicine Issuance — "MADICAL ISSUANCE REPORT FOR CASH".
// Cash (non-panel) admissions' medicine from the Provisional Bill's Pharmacy
// Bill tab (Hospital Store + Outside Stores), plus anything uploaded from the
// legacy .xls (ClinicPanelMedicineIssuanceTxn*). Panel admissions' medicine
// shows in Panels > Reports > Medicine Report instead.
//
// Preview step: the filter (Admission # exact OR a date-range by Medicine/
// Admission/Discharge Date, Medical Store, Details vs Admit-wise Summary) is
// its own screen, MedicineIssuanceFilter, which opens this at
// /view?scopeMode&admissionNo&dateType&fromDate&toDate&storeFilter&viewMode.
const DATE_TYPE_LABEL = { admission: 'Admission Date', discharge: 'Discharge Date', medicine: 'Medicine Date' };
const fmtDayHeading = (ymd) => {
  if (!ymd || ymd === '—') return '—';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

export default function MedicineIssuanceTransaction() {
  const { pharmacyStores, fetchPharmacyStores, fetchPanelMedicineIssuanceTxnReport } = useClinicStore();
  const [params] = useSearchParams();
  const reportRef = useRef(null);

  const scopeMode = params.get('scopeMode') || 'date'; // 'admission' | 'date'
  const admissionNo = (params.get('admissionNo') || '').trim();
  const dateType = params.get('dateType') || 'medicine'; // 'admission' | 'discharge' | 'medicine'
  const fromDate = params.get('fromDate') || '';
  const toDate = params.get('toDate') || '';
  const storeFilter = params.get('storeFilter') || 'ALL'; // 'ALL' | 'hospital' | store id
  const viewMode = params.get('viewMode') || 'details'; // 'details' | 'summary'

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
  const appliedFilters = { scopeMode, admissionNo, dateType, fromDate, toDate, storeLabel };
  const scopeText = scopeMode === 'admission'
    ? `Admission # : ${admissionNo}`
    : `${DATE_TYPE_LABEL[dateType] || ''} — From : ${fmtDate(fromDate)}  To : ${fmtDate(toDate)}`;

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
      const res = await fetchPanelMedicineIssuanceTxnReport({
        scopeMode,
        admissionNo: scopeMode === 'admission' ? admissionNo : undefined,
        dateType: scopeMode === 'date' ? dateType : undefined,
        fromDate: scopeMode === 'date' ? fromDate : undefined,
        toDate: scopeMode === 'date' ? toDate : undefined,
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
  }, [fetchPanelMedicineIssuanceTxnReport, scopeMode, admissionNo, dateType, fromDate, toDate, storeFilter, viewMode]);

  useEffect(() => { handleView(); }, [handleView]);

  const hasRows = data && (data.mode === 'summary' ? data.rows.length > 0 : data.days.length > 0);
  let patientNo = 0;

  function handlePrint() {
    if (!hasRows) { toast.error('Print ke liye koi data nahi'); return; }
    printMedicineIssuanceTxn(reportRef.current, data, appliedFilters);
  }

  // Same rows / columns / totals as the preview — Summary: one row per
  // admission + Grand Total; Details: one row per medicine line with its day
  // / patient, then the patient TOTAL, DAY WISE TOTAL and Grand Total rows.
  function handleExport() {
    if (!hasRows) { toast.error('Export ke liye koi data nahi'); return; }
    const aoa = [
      ['MEDICINE ISSUANCE REPORT FOR CASH'],
      [`${scopeText}  |  Medical Store : ${storeLabel}`],
      [],
    ];
    if (data.mode === 'summary') {
      aoa.push(['Sno', 'Admission #', 'Patient', 'Admit Date', 'Dis. Date', 'Status', 'Items', 'Amount']);
      data.rows.forEach((r, idx) => aoa.push([idx + 1, r.admissionNo, r.patientName, fmtDate(r.admitDate), fmtDate(r.dischargeDate), r.status || '', r.itemCount, Number(r.total || 0)]));
      aoa.push(['Grand Total', '', '', '', '', '', '', Number(data.grandTotal || 0)]);
    } else {
      aoa.push(['Day', 'Patient #', 'Admission #', 'Patient', 'Admit Date', 'Status', 'Dis. Date', 'Sno', 'Description', 'Med Date', 'Rate', 'Qty', 'Amount', 'Created', 'Date', 'Medical Store']);
      let n = 0;
      data.days.forEach((day) => {
        day.patients.forEach((p) => {
          n += 1;
          p.items.forEach((it) => aoa.push([
            fmtDayHeading(day.date), n, p.admissionNo, p.patientName, fmtDate(p.admitDate), p.status || '', fmtDate(p.dischargeDate),
            it.sno, it.description, fmtDate(it.medDate), Number(it.rate || 0), it.qty, Number(it.amount || 0),
            it.createdByName || '', it.createdAt ? fmtDate(it.createdAt) : '', it.store || '',
          ]));
          aoa.push(['', n, p.admissionNo, 'TOTAL :', '', '', '', '', '', '', '', '', Number(p.patientTotal || 0)]);
        });
        aoa.push([fmtDayHeading(day.date), '', '', 'DAY WISE TOTAL :', '', '', '', '', '', '', '', '', Number(day.dayTotal || 0)]);
      });
      aoa.push(['Grand Total', '', '', '', '', '', '', '', '', '', '', '', Number(data.grandTotal || 0)]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Medicine Issuance');
    XLSX.writeFile(wb, viewMode === 'summary' ? 'Medicine_Issuance_Summary.xlsx' : 'Medicine_Issuance.xlsx');
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
            <div className="mrp-rpt-title">MEDICINE ISSUANCE REPORT FOR CASH</div>
            {shown && (
              <div className="mrp-rpt-meta">
                <span>
                  {scopeText}
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
                    <th className="mrp-l">Admit Date</th>
                    <th className="mrp-l">Dis. Date</th>
                    <th className="mrp-l">Status</th>
                    <th className="mrp-r">Items</th>
                    <th className="mrp-r">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, idx) => (
                    <tr key={r.admissionNo}>
                      <td className="mrp-l">{idx + 1}</td>
                      <td className="mrp-l">{r.admissionNo}</td>
                      <td className="mrp-l">{r.patientName}</td>
                      <td className="mrp-l">{fmtDate(r.admitDate)}</td>
                      <td className="mrp-l">{fmtDate(r.dischargeDate)}</td>
                      <td className="mrp-l">{r.status || '—'}</td>
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
            </div>
          ) : (
            <div className="mrp-details">
              {data.days.map((day) => (
                <div className="mrp-day-block" key={day.date}>
                  <div className="mrp-day-hdr">
                    <span>{fmtDayHeading(day.date)}</span>
                    <span className="mrp-day-total">DAY WISE TOTAL : <b>{fmt(day.dayTotal)}</b></span>
                  </div>

                  {day.patients.map((p) => {
                    patientNo += 1;
                    return (
                      <div className="mrp-patient-block" key={`${day.date}-${p.admissionNo}`}>
                        <div className="mit-patient-grid">
                          <span className="mit-patient-no">{patientNo}</span>
                          <span><b>PATIENT :</b> {p.admissionNo} - {p.patientName}</span>
                          <span><b>ADMIT DATE :</b> {fmtDate(p.admitDate)}</span>
                          <span><b>STATUS :</b> {p.status || '—'}</span>
                          <span />
                          <span />
                          <span><b>DIS. DATE :</b> {fmtDate(p.dischargeDate)}</span>
                          <span />
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
                              <th className="mrp-l">Created</th>
                              <th className="mrp-l">Date</th>
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
                                <td className="mrp-l">{it.createdByName || '—'}</td>
                                <td className="mrp-l">{it.createdAt ? fmtDate(it.createdAt) : '—'}</td>
                                <td className="mrp-l">{it.store || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="mrp-patient-totals">
                              <td colSpan={5} className="mrp-l">TOTAL :</td>
                              <td className="mrp-r">{fmt(p.patientTotal)}</td>
                              <td colSpan={3} />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="mrp-grand-total">Grand Total : <b>{fmt(data.grandTotal)}</b></div>
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <MedicineIssuanceImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
