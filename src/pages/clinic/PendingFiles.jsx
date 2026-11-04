import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import ShowMoreFooter from '../../components/reports/ShowMoreFooter';
import usePagedList from '../../hooks/usePagedList';
import { api, fmt, fmtDateTime } from './parameters/fullSlipEditUtils';
import './parameters/FullSlipEdit.scss';

// Clinic > Transactions > Pending Files — open DAY CARE UNIT files. The backend
// job (dayCareAutoClose.job.js) closes them, so this page only shows where each
// one stands, and which ones staff have to close themselves.

const REFRESH_MS = 60 * 1000;

function timeLeft(closesAt) {
  const minutes = Math.max(1, Math.ceil((new Date(closesAt).getTime() - Date.now()) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} ghante ${minutes % 60} minute baad` : `${minutes} minute baad`;
}

function FileState({ file }) {
  if (file.hold) return <span className="fse-chip fse-chip--amber">Khud band karein: {file.hold}</span>;
  if (file.due) return <span className="fse-chip">5 minute ke andar band hogi</span>;
  return <span className="fse-muted">{timeLeft(file.closesAt)} band hogi</span>;
}

export default function PendingFiles() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('pending');

  useEffect(() => {
    let alive = true;
    const load = () => api('/pending-files')
      .then((d) => { if (alive) setData(d); })
      .catch((err) => toast.error(err.message));
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  const rows = data?.[tab] || [];
  const page = usePagedList(rows.length, tab);

  return (
    <div className="fse-page">
      <ClinicMenuBar />
      <div className="fse-body">
        <div>
          <h1 className="fse-title">Pending Files</h1>
          <p className="fse-sub">DAY CARE UNIT ki Rs. 300 wali file admission ke 12 ghante baad khud band ho jati hai.</p>
        </div>

        <div className="fse-toggle" style={{ alignSelf: 'flex-start' }}>
          <button type="button" className={tab === 'pending' ? 'on' : ''} onClick={() => setTab('pending')}>Pending ({data?.pending.length ?? 0})</button>
          <button type="button" className={tab === 'closed' ? 'on' : ''} onClick={() => setTab('closed')}>Auto band hui ({data?.closed.length ?? 0})</button>
        </div>

        <div className="fse-card">
          {!data && <p className="fse-empty">Loading…</p>}
          {data && rows.length === 0 && (
            <p className="fse-empty">{tab === 'pending' ? 'Koi pending file nahi.' : 'Abhi tak koi file auto band nahi hui.'}</p>
          )}
          {rows.length > 0 && (
            <div className="table-wrap">
              <table className="fse-table">
                {tab === 'pending' ? (
                  <>
                    <thead>
                      <tr><th>Admission #</th><th>Patient</th><th>Admit</th><th>File</th><th className="r">Received</th><th className="r">Bill</th><th>Kab band hogi</th></tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, page.limit).map((f) => (
                        <tr key={f.id}>
                          <td>{f.admissionNo}</td>
                          <td>{f.patientName}</td>
                          <td>{fmtDateTime(f.admittedAt)}</td>
                          <td>{f.status === 'discharge' ? 'Discharge' : 'Admit'}</td>
                          <td className="r">{fmt(f.received)}</td>
                          <td className="r">{fmt(f.billAmount)}</td>
                          <td><FileState file={f} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead><tr><th>Admission #</th><th>Patient</th><th>Closing Date</th></tr></thead>
                    <tbody>
                      {rows.slice(0, page.limit).map((f) => (
                        <tr key={f.id}><td>{f.admissionNo}</td><td>{f.patientName}</td><td>{fmtDateTime(f.closedAt)}</td></tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          )}
          {rows.length > 0 && <ShowMoreFooter {...page} noun="files" />}
        </div>
      </div>
    </div>
  );
}
