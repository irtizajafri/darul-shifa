import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './DischargeCertificateReport.scss';

const API = 'http://localhost:5001/api/clinic';

const REASON_LABELS = {
  treated: 'Patient Treated',
  transfer: 'Patient Transfer',
  lama: 'LAMA',
  expired: 'Patient Expired',
  discharge_on_request: 'Discharge on Request',
};

// `@page` is a document-level rule shared across the whole bundled app — other
// pages each declare their own, so whichever loads last in the bundle wins for
// the WHOLE app's prints unless a page protects itself right before printing.
function printDischargeCertificateReport() {
  const styleId = 'dcgr-page-size-override';
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = '@page { size: A4 landscape !important; margin: 8mm !important; }';

  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000);

  window.print();
}

const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDMY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function fmtDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${String(d.getDate()).padStart(2, '0')}-${MN[d.getMonth()]}-${d.getFullYear()} ${hh}:${mm}`;
}

const ageStr = (r) => `${r.ageYears}y ${r.ageMonths}m ${r.ageDays}d`;
const ynLabel = (v) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '—');

export default function DischargeCertificateReport() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRows = () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (fromDate) q.set('fromDate', fromDate);
    if (toDate) q.set('toDate', toDate);
    fetch(`${API}/reports/discharge-certificate?${q}`)
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-param-change, same pattern as DeathCertificateReport.jsx
  useEffect(fetchRows, [fromDate, toDate]);

  function handleExportExcel() {
    const aoa = [
      ['Discharge Certificate Report'],
      [`From : ${fmtDMY(fromDate)}  To : ${fmtDMY(toDate)}`],
      [],
      ['Admission #', 'Patient Name', 'Age', 'Gender', 'Room', 'Bed', 'Consultant', 'Reason of Discharge', 'Diagnosis', 'Further Treatment', 'Medicine Prescribed', 'Discharge Date', 'Medical Officer'],
    ];
    rows.forEach((r) => {
      aoa.push([
        r.admissionNo, `${r.patientTitle} ${r.patientName}`, ageStr(r), r.gender,
        r.roomCategory || '', r.bed || '', r.consultant || '',
        REASON_LABELS[r.reasonOfDischarge] || '', r.diagnosis || '',
        ynLabel(r.furtherTreatmentNeeded), ynLabel(r.medicinePrescribed),
        fmtDateTime(r.dischargeDate), r.medicalOfficer || '',
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Discharge Certificates');
    XLSX.writeFile(wb, `Discharge_Certificate_Report_${fromDate}_to_${toDate}.xlsx`);
  }

  return (
    <div className="dcgr-page">
      <ClinicMenuBar />

      <div className="dcgr-body">
        <div className="dcgr-toolbar no-print">
          <button className="dcgr-tool-btn" onClick={() => navigate(-1)}>Back to Filter</button>
          <div className="dcgr-tool-spacer" />
          <button className="dcgr-tool-btn dcgr-tool-btn--excel" onClick={handleExportExcel} disabled={!rows.length}>Export Excel</button>
          <button className="dcgr-tool-btn dcgr-tool-btn--pdf" onClick={printDischargeCertificateReport} disabled={!rows.length}>Print / PDF</button>
        </div>

        <div className="dcgr-sheet">
          <div className="dcgr-hdr">
            <div className="dcgr-title">Discharge Certificate Report</div>
            <div className="dcgr-sub">From : {fmtDMY(fromDate)}&nbsp;&nbsp;To&nbsp;&nbsp;: {fmtDMY(toDate)}</div>
          </div>

          {loading ? (
            <div className="dcgr-empty">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="dcgr-empty">Is date range mein koi Discharge Certificate nahi mila.</div>
          ) : (
            <table className="dcgr-table">
              <thead>
                <tr>
                  <th className="dcgr-l">Admission #</th>
                  <th className="dcgr-l">Patient</th>
                  <th className="dcgr-l dcgr-nowrap">Age / Gender</th>
                  <th className="dcgr-l">Room / Bed</th>
                  <th className="dcgr-l">Consultant</th>
                  <th className="dcgr-l">Reason of Discharge</th>
                  <th className="dcgr-l">Diagnosis</th>
                  <th className="dcgr-c">Further Rx</th>
                  <th className="dcgr-c">Meds Rx</th>
                  <th className="dcgr-l dcgr-nowrap">Discharge Date</th>
                  <th className="dcgr-l">Medical Officer</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="dcgr-l">{r.admissionNo}</td>
                    <td className="dcgr-l">{r.patientTitle} {r.patientName}</td>
                    <td className="dcgr-l dcgr-nowrap">{ageStr(r)} / {r.gender}</td>
                    <td className="dcgr-l">{r.roomCategory || '—'} / {r.bed || '—'}</td>
                    <td className="dcgr-l">{r.consultant || '—'}</td>
                    <td className="dcgr-l">{REASON_LABELS[r.reasonOfDischarge] || '—'}</td>
                    <td className="dcgr-l">{r.diagnosis || '—'}</td>
                    <td className="dcgr-c">{ynLabel(r.furtherTreatmentNeeded)}</td>
                    <td className="dcgr-c">{ynLabel(r.medicinePrescribed)}</td>
                    <td className="dcgr-l dcgr-nowrap">{fmtDateTime(r.dischargeDate)}</td>
                    <td className="dcgr-l">{r.medicalOfficer || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
