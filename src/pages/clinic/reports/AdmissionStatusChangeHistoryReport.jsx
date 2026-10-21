import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { useClinicStore } from '../../../store/useClinicStore';
import { printElementInPopup } from '../../../utils/printPopup';
import './AdmissionStatusChangeHistoryReport.scss';

function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day}-${month}-${year} ${time}`;
}

// Local YYYY-MM-DD of a timestamp, to compare against the filter's date inputs.
function localYmd(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const STATUS_LABEL = { active: 'Admit', discharge: 'Discharge', closed: 'Closed', wipeout: 'Wipeout' };

// Every non-wipeout File Status change (see Transactions > Admission Status
// Change) — Admit/Discharge/Closed in either direction, who changed it, and
// why. Wipeout keeps its own separate "Admission Status Change Report" (the
// existing page, misleadingly named but left as-is since it's already a
// working, distinctly-scoped report — that one shows what got deleted, this
// one shows what moved between statuses while still existing).
// View page — filters come from AdmissionStatusChangeHistoryFilter via the
// URL. The endpoint has no params, so they are applied client-side.
export default function AdmissionStatusChangeHistoryReport() {
  const { fetchAdmissionStatusChangeHistory } = useClinicStore();
  const [params] = useSearchParams();
  const reportRef = useRef(null);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const toStatus = params.get('toStatus') || 'all';
  const fromDate = params.get('fromDate') || '';
  const toDate = params.get('toDate') || '';
  const search = params.get('search') || '';

  const fetchData = () => {
    setLoading(true);
    fetchAdmissionStatusChangeHistory()
      .then(setAllRows)
      .catch(() => setAllRows([]))
      .finally(() => setLoading(false));
  };

  // Load once on mount; Refresh calls fetchData again.
  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (toStatus !== 'all' && r.toStatus !== toStatus) return false;
      const ymd = localYmd(r.changedAt);
      if (fromDate && (!ymd || ymd < fromDate)) return false;
      if (toDate && (!ymd || ymd > toDate)) return false;
      if (q) {
        const hay = `${r.admissionNo || ''} ${r.patientName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allRows, toStatus, fromDate, toDate, search]);

  const filterText = [
    toStatus !== 'all' ? `Changed To: ${STATUS_LABEL[toStatus] || toStatus}` : '',
    fromDate || toDate ? `Changed At: ${fromDate || '…'} to ${toDate || '…'}` : 'All dates',
    search ? `Search: "${search}"` : '',
  ].filter(Boolean).join(' — ');

  const handlePrint = () => {
    printElementInPopup(reportRef.current, { title: 'Status Change History Report', page: 'A4 landscape', margin: '8mm' });
  };

  const handleExportExcel = () => {
    if (!rows.length) { toast.error('No data to export'); return; }
    const aoa = [['Status Change History Report'], [filterText], []];
    aoa.push(['Admission #', 'Patient', 'Status Change', 'Reason', 'Changed By', 'Changed At']);
    rows.forEach((r) => aoa.push([
      r.admissionNo,
      r.patientName,
      `${STATUS_LABEL[r.fromStatus] || r.fromStatus} → ${STATUS_LABEL[r.toStatus] || r.toStatus}`,
      r.reason,
      r.changedBy || '—',
      fmtDateTime(r.changedAt),
    ]));
    aoa.push([]);
    aoa.push([`${rows.length} change${rows.length !== 1 ? 's' : ''}`]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'StatusChangeHistory');
    XLSX.writeFile(wb, `status_change_history_${localYmd(new Date())}.xlsx`);
  };

  return (
    <div className="aschr-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExportExcel} onRefresh={fetchData} refreshing={loading} />

      <div className="aschr-printable rpt-arial9" ref={reportRef}>
        <div className="aschr-header">
          <div>
            <span className="aschr-title">Status Change History Report</span>
            <div className="aschr-filters">{filterText}</div>
          </div>
          <span className="aschr-count">{rows.length} change{rows.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="aschr-body">
          {loading ? (
            <div className="aschr-empty">Loading…</div>
          ) : (
            <table className="aschr-tbl">
              <thead>
                <tr>
                  <th>Admission #</th>
                  <th>Patient</th>
                  <th>Status Change</th>
                  <th>Reason</th>
                  <th>Changed By</th>
                  <th>Changed At</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.admissionNo}</td>
                    <td>{r.patientName}</td>
                    <td>
                      <span className={`aschr-status aschr-status--${r.fromStatus}`}>{STATUS_LABEL[r.fromStatus] || r.fromStatus}</span>
                      <span className="aschr-arrow">→</span>
                      <span className={`aschr-status aschr-status--${r.toStatus}`}>{STATUS_LABEL[r.toStatus] || r.toStatus}</span>
                    </td>
                    <td>{r.reason}</td>
                    <td>{r.changedBy || '—'}</td>
                    <td>{fmtDateTime(r.changedAt)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={6} className="aschr-empty-row">Koi status change nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
