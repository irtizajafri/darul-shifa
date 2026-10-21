import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { useClinicStore } from '../../../store/useClinicStore';
import { printElementInPopup } from '../../../utils/printPopup';
import './AdmissionStatusChangeReport.scss';

function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day}-${month}-${year} ${time}`;
}

function fmt2(n) { return n != null ? Number(n).toFixed(2) : '—'; }

// Local YYYY-MM-DD of a timestamp, to compare against the filter's date inputs.
function localYmd(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// View page — filters come from AdmissionStatusChangeFilter via the URL. The
// endpoint has no params, so the date range / search are applied client-side.
export default function AdmissionStatusChangeReport() {
  const { fetchAdmissionWipeoutReport } = useClinicStore();
  const [params] = useSearchParams();
  const reportRef = useRef(null);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fromDate = params.get('fromDate') || '';
  const toDate = params.get('toDate') || '';
  const search = params.get('search') || '';

  const fetchData = () => {
    setLoading(true);
    fetchAdmissionWipeoutReport()
      .then(setAllRows)
      .catch(() => setAllRows([]))
      .finally(() => setLoading(false));
  };

  // Load once on mount; Refresh calls fetchData again.
  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      const ymd = localYmd(r.wipedOutAt);
      if (fromDate && (!ymd || ymd < fromDate)) return false;
      if (toDate && (!ymd || ymd > toDate)) return false;
      if (q) {
        const hay = `${r.admissionNo || ''} ${r.patientTitle || ''} ${r.patientName || ''} ${r.mrNo || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, fromDate, toDate, search]);

  const filterText = [
    fromDate || toDate ? `Wiped Out: ${fromDate || '…'} to ${toDate || '…'}` : 'All dates',
    search ? `Search: "${search}"` : '',
  ].filter(Boolean).join(' — ');

  const handlePrint = () => {
    printElementInPopup(reportRef.current, { title: 'Admission Status Change Report', page: 'A4 landscape', margin: '8mm' });
  };

  const handleExportExcel = () => {
    if (!rows.length) { toast.error('No data to export'); return; }
    const aoa = [['Admission Status Change Report'], [filterText], []];
    aoa.push(['Admission #', 'Patient', 'MR #', 'Advance Payment', 'Admitted On', 'Reason', 'Wiped Out By', 'Wiped Out At']);
    rows.forEach((r) => aoa.push([
      r.admissionNo,
      `${r.patientTitle || ''} ${r.patientName || ''}`.trim(),
      r.mrNo || '—',
      r.advancePayment != null ? Number(r.advancePayment) : '—',
      fmtDateTime(r.admittedAt),
      r.reason,
      r.wipedOutBy || '—',
      fmtDateTime(r.wipedOutAt),
    ]));
    aoa.push([]);
    aoa.push([`${rows.length} wiped-out record${rows.length !== 1 ? 's' : ''}`]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'StatusChange');
    XLSX.writeFile(wb, `admission_status_change_${localYmd(new Date())}.xlsx`);
  };

  return (
    <div className="ascr-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExportExcel} onRefresh={fetchData} refreshing={loading} />

      <div className="ascr-printable rpt-arial9" ref={reportRef}>
        <div className="ascr-header">
          <div>
            <span className="ascr-title">Admission Status Change Report</span>
            <div className="ascr-filters">{filterText}</div>
          </div>
          <span className="ascr-count">{rows.length} wiped-out record{rows.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="ascr-body">
          {loading ? (
            <div className="ascr-empty">Loading…</div>
          ) : (
            <table className="ascr-tbl">
              <thead>
                <tr>
                  <th>Admission #</th>
                  <th>Patient</th>
                  <th>MR #</th>
                  <th className="ascr-td-r">Advance Payment</th>
                  <th>Admitted On</th>
                  <th>Reason</th>
                  <th>Wiped Out By</th>
                  <th>Wiped Out At</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.admissionNo}</td>
                    <td>{r.patientTitle} {r.patientName}</td>
                    <td>{r.mrNo || '—'}</td>
                    <td className="ascr-td-r">{fmt2(r.advancePayment)}</td>
                    <td>{fmtDateTime(r.admittedAt)}</td>
                    <td>{r.reason}</td>
                    <td>{r.wipedOutBy || '—'}</td>
                    <td>{fmtDateTime(r.wipedOutAt)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={8} className="ascr-empty-row">Koi wiped-out admission nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
