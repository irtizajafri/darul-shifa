import { useState, useEffect } from 'react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
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

const STATUS_LABEL = { active: 'Admit', discharge: 'Discharge', closed: 'Closed', wipeout: 'Wipeout' };

// Every non-wipeout File Status change (see Transactions > Admission Status
// Change) — Admit/Discharge/Closed in either direction, who changed it, and
// why. Wipeout keeps its own separate "Admission Status Change Report" (the
// existing page, misleadingly named but left as-is since it's already a
// working, distinctly-scoped report — that one shows what got deleted, this
// one shows what moved between statuses while still existing).
export default function AdmissionStatusChangeHistoryReport() {
  const { fetchAdmissionStatusChangeHistory } = useClinicStore();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdmissionStatusChangeHistory()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [fetchAdmissionStatusChangeHistory]);

  return (
    <div className="aschr-page">
      <ClinicMenuBar />

      <div className="aschr-header">
        <span className="aschr-title">Status Change History Report</span>
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
  );
}
