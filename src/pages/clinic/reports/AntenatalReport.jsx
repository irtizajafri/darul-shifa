import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { printElementInPopup } from '../../../utils/printPopup';
import './AntenatalReport.scss';

const API = 'http://localhost:5001/api/clinic';

// Prints from a popup window, never window.print() on the main window (which
// can freeze the whole app behind a modal print dialog on Windows) — see
// utils/printPopup.js. The @page size/margin travels with the call.
function printAntenatalReport(sheetEl) {
  printElementInPopup(sheetEl, { title: 'Antenatal Report', page: 'A4 landscape', margin: '8mm' });
}

function fmtDMY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function fmtDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

const fmt2 = (v) => Number(v || 0).toFixed(2);

export default function AntenatalReport() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sheetRef = useRef(null);
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const dateField = searchParams.get('dateField') || 'edd';
  const doctorId = searchParams.get('doctorId') || '';

  const [rows, setRows] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchRows = () => {
    setLoading(true);
    const q = new URLSearchParams({ dateField });
    if (fromDate) q.set('fromDate', fromDate);
    if (toDate) q.set('toDate', toDate);
    if (doctorId) q.set('doctorId', doctorId);
    fetch(`${API}/reports/antenatal?${q}`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.data?.rows || []);
        setTotalAmount(j.data?.totalAmount || 0);
      })
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-param-change, same pattern as DischargeCertificateReport.jsx
  useEffect(fetchRows, [fromDate, toDate, dateField, doctorId]);

  function handleExportExcel() {
    const aoa = [
      ['Antenatal Report'],
      [`From : ${fmtDMY(fromDate)}  To : ${fmtDMY(toDate)}`],
      [],
      ['SNO', 'ATI No.', 'Slip No', 'Slip Date', 'Patient Name', 'Cons. Name', 'LMP Date', 'ED Date', 'Phone', 'Husband Name', 'Amount'],
    ];
    rows.forEach((r, i) => {
      aoa.push([
        i + 1, r.antenatalNo, r.serialNo || '', fmtDate(r.registrationDate), r.patientName,
        r.consultantName, fmtDate(r.lmpDate), fmtDate(r.edd), r.phoneNo || '', r.husbandName || '',
        Number(r.amount) || 0,
      ]);
    });
    aoa.push([]);
    aoa.push(['Total Number Of :', rows.length]);
    aoa.push(['Total Amount Of :', totalAmount]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Antenatal Report');
    XLSX.writeFile(wb, `Antenatal_Report_${fromDate}_to_${toDate}.xlsx`);
  }

  return (
    <div className="atr-page">
      <ClinicMenuBar />

      <div className="atr-body">
        <div className="atr-toolbar no-print">
          <button className="atr-tool-btn" onClick={() => navigate(-1)}>Back to Filter</button>
          <div className="atr-tool-spacer" />
          <button className="atr-tool-btn atr-tool-btn--excel" onClick={handleExportExcel} disabled={!rows.length}>Export Excel</button>
          <button className="atr-tool-btn atr-tool-btn--pdf" onClick={() => printAntenatalReport(sheetRef.current)} disabled={!rows.length}>Print / PDF</button>
        </div>

        <div className="atr-sheet" ref={sheetRef}>
          <div className="atr-hdr">
            <div className="atr-title">Antenatal Report</div>
            <div className="atr-sub">From : {fmtDMY(fromDate)}&nbsp;&nbsp;To&nbsp;&nbsp;: {fmtDMY(toDate)}</div>
          </div>

          {loading ? (
            <div className="atr-empty">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="atr-empty">Is date range mein koi Antenatal registration nahi mili.</div>
          ) : (
            <>
              <table className="atr-table">
                <thead>
                  <tr>
                    <th className="atr-c">SNO.</th>
                    <th className="atr-l">ATI No.</th>
                    <th className="atr-l">Slip No</th>
                    <th className="atr-l atr-nowrap">Slip Date</th>
                    <th className="atr-l">Patient Name</th>
                    <th className="atr-l">Cons. Name</th>
                    <th className="atr-l atr-nowrap">LMP Date</th>
                    <th className="atr-l atr-nowrap">ED Date</th>
                    <th className="atr-l">Phone</th>
                    <th className="atr-l">Husband Name</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="atr-c">{i + 1}</td>
                      <td className="atr-l">{r.antenatalNo}</td>
                      <td className="atr-l">{r.serialNo || '—'}</td>
                      <td className="atr-l atr-nowrap">{fmtDate(r.registrationDate)}</td>
                      <td className="atr-l">{r.patientName}</td>
                      <td className="atr-l">{r.consultantName}</td>
                      <td className="atr-l atr-nowrap">{fmtDate(r.lmpDate)}</td>
                      <td className="atr-l atr-nowrap">{fmtDate(r.edd)}</td>
                      <td className="atr-l">{r.phoneNo || '—'}</td>
                      <td className="atr-l">{r.husbandName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="atr-totals">
                <div><span>Total Number Of :</span><span>{rows.length}</span></div>
                <div><span>Total Amount Of :</span><span>{fmt2(totalAmount)}</span></div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
