import { useState, useEffect } from 'react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
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

export default function AdmissionStatusChangeReport() {
  const { fetchAdmissionWipeoutReport } = useClinicStore();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdmissionWipeoutReport()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [fetchAdmissionWipeoutReport]);

  return (
    <div className="ascr-page">
      <ClinicMenuBar />

      <div className="ascr-header">
        <span className="ascr-title">Admission Status Change Report</span>
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
  );
}
