import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { useClinicStore } from '../../../store/useClinicStore';
import { printElementInPopup } from '../../../utils/printPopup';
import DoctorWiseStatementImportModal from './DoctorWiseStatementImportModal';
import './DoctorWiseStatement.scss';
import { useShallow } from 'zustand/react/shallow';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};

// Prints from a popup window, never window.print() on the main window (which
// can freeze the whole app behind a modal print dialog on Windows) — see
// utils/printPopup.js. The whole body is printed (one .dws-company-page per
// company, page-break between them per the page's own print CSS).
function printDoctorWiseStatement(bodyEl) {
  printElementInPopup(bodyEl, { title: 'Doctor Wise Statement', page: 'A4 portrait', margin: '10mm' });
}

// Panels > Reports > Doctor Wise Statement — preview step ("Statement of
// Consultant for Indoor Files" print output). The legacy "Statement of
// Surgery" filter is now its own screen, DoctorWiseStatementFilter, which
// opens this at /view?doctorId&fromDate&toDate. Import is fully standalone —
// never creates or matches a ClinicAdmission — and is scoped per-doctor:
// re-uploading a doctor's file wholesale replaces that doctor's statement.
// Results print one Company section per A4 page (page-break-before, see
// DoctorWiseStatement.scss), each a self-contained mini-statement with its
// own repeated doctor/date header, matching the legacy paper output.
export default function DoctorWiseStatement() {
  const { fetchDoctorStatement } = useClinicStore(useShallow((s) => ({ fetchDoctorStatement: s.fetchDoctorStatement })));
  const [params] = useSearchParams();
  const bodyRef = useRef(null);

  const doctorId = params.get('doctorId') || '';
  const fromDate = params.get('fromDate') || '';
  const toDate = params.get('toDate') || '';

  const [showImport, setShowImport] = useState(false);

  const [data, setData] = useState(null);
  // true until the first fetch lands, so the empty-state doesn't flash first
  const [loading, setLoading] = useState(true);

  const handlePreview = useCallback(async () => {
    if (!doctorId) { toast.error('Doctor select karein'); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetchDoctorStatement({ doctorId, fromDate, toDate });
      setData(res);
    } catch (err) {
      toast.error(err.message || 'Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }, [fetchDoctorStatement, doctorId, fromDate, toDate]);

  useEffect(() => { handlePreview(); }, [handlePreview]);

  const hasRows = data && data.companies && data.companies.length > 0;

  function handlePrint() {
    if (!hasRows) { toast.error('Print ke liye koi data nahi'); return; }
    printDoctorWiseStatement(bodyRef.current);
  }

  // Same content as the preview, company by company: its voucher lines,
  // each voucher's Total Patients / Total For Doctor (+ amount in words and
  // signee), then the company total.
  function handleExport() {
    if (!hasRows) { toast.error('Export ke liye koi data nahi'); return; }
    const aoa = [
      ['Statement of Consultant for Indoor Files'],
      [`${data.doctor.code}  ${data.doctor.name}`],
      [`From : ${fmtDate(fromDate)}   To : ${fmtDate(toDate)}`],
    ];
    data.companies.forEach((c) => {
      aoa.push([]);
      aoa.push([c.companyCode, c.companyName]);
      aoa.push(['Admit #', 'PatName', 'Surgery', 'Op. Date', 'Amount']);
      c.vouchers.forEach((v) => {
        v.items.forEach((it) => aoa.push([it.admissionNo, it.patientName, it.surgery || '', fmtDate(it.opDate), Number(it.amount || 0)]));
        aoa.push(['', 'Total Patients:', v.totalPatients, 'Total For Doctor:', Number(v.totalAmount || 0)]);
        if (v.amountWords) aoa.push([v.amountWords]);
        if (v.signeeName) aoa.push([v.signeeName]);
      });
      aoa.push([`${c.companyName} — Total Patients :`, c.totalPatients, '', 'Total Amount :', Number(c.totalAmount || 0)]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Doctor Statement');
    XLSX.writeFile(wb, `Doctor_Wise_Statement_${fromDate}_${toDate}.xlsx`);
  }

  return (
    <div className="dws-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExport} onRefresh={handlePreview} refreshing={loading}>
        <div className="rpt-tool-sep" />
        <button type="button" className="rpt-tool-btn" onClick={() => setShowImport(true)}>
          <Upload size={14} /> <span>Upload Excel</span>
        </button>
      </ReportToolbar>

      <div className="dws-body rpt-arial9" ref={bodyRef}>
        {loading ? (
          <div className="dws-report"><div className="dws-empty">Loading…</div></div>
        ) : !hasRows ? (
          <div className="dws-report"><div className="dws-empty">Is filter par koi record nahi mila.</div></div>
        ) : (
          data.companies.map((c) => (
            <div className="dws-report dws-company-page" key={c.companyName}>
              <div className="dws-rpt-head">
                <div className="dws-rpt-sub">Darul Shifa Hospital</div>
                <div className="dws-rpt-title">Statement of Consultant for Indoor Files</div>
                <div className="dws-doctor-line">
                  <span className="dws-doctor-code">{data.doctor.code}</span>
                  <span className="dws-doctor-name">{data.doctor.name}</span>
                </div>
                <div className="dws-fromto">
                  <span>From : {fmtDate(fromDate)}</span>
                  <span>To : {fmtDate(toDate)}</span>
                </div>
              </div>

              <div className="dws-company-hdr">
                <span className="dws-company-code">{c.companyCode}</span>
                <b>{c.companyName}</b>
              </div>

              <table className="dws-col-labels">
                <thead>
                  <tr>
                    <th className="dws-l">Admit #</th>
                    <th className="dws-l">PatName</th>
                    <th className="dws-l">Surgery</th>
                    <th className="dws-l">Op. Date</th>
                    <th className="dws-r">Amount</th>
                  </tr>
                </thead>
              </table>

              {c.vouchers.map((v, vi) => (
                <div className="dws-voucher" key={vi}>
                  <table className="dws-items-table">
                    <tbody>
                      {v.items.map((it, ii) => (
                        <tr key={ii}>
                          <td className="dws-l">{it.admissionNo}</td>
                          <td className="dws-l">{it.patientName}</td>
                          <td className="dws-l">{it.surgery || ''}</td>
                          <td className="dws-l">{fmtDate(it.opDate)}</td>
                          <td className="dws-r">{fmt(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="dws-voucher-total">
                    <span>Total Patients: <b>{v.totalPatients}</b></span>
                    <span>Total For Doctor: <b>{fmt(v.totalAmount)}</b></span>
                  </div>

                  {v.amountWords && <div className="dws-words">{v.amountWords}</div>}
                  {v.signeeName && <div className="dws-signee">{v.signeeName}</div>}

                  <div className="dws-siglabels">
                    <span>Prepaid By</span>
                    <span>Administrator</span>
                    <span>Receiver</span>
                  </div>
                </div>
              ))}

              <div className="dws-company-total">
                <span>{c.companyName} — Total Patients : <b>{c.totalPatients}</b></span>
                <span>Total Amount : <b>{fmt(c.totalAmount)}</b></span>
              </div>
            </div>
          ))
        )}
      </div>

      {showImport && (
        <DoctorWiseStatementImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}

