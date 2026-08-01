import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';

const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonthStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

const PATIENT_TYPES = [
  ['ALL', 'ALL'], ['private', 'Cash'], ['panel', 'Panel'], ['staff', 'Staff'], ['cc', 'CC'], ['complementary', 'Complementary'],
];

export default function AdmissionWiseFilter() {
  const navigate = useNavigate();

  const [scope, setScope] = useState('admission'); // admission | opd
  const [statusMode, setStatusMode] = useState('discharge'); // discharge | admit
  const [fromDate, setFromDate] = useState(firstOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [patientType, setPatientType] = useState('ALL');
  const [reportType, setReportType] = useState('detail'); // detail | headers | summary | withSlip

  const handleOk = () => {
    if (scope !== 'admission') { toast.error('OPD scope abhi available nahi hai'); return; }
    const params = new URLSearchParams({ fromDate, toDate, statusMode, patientType, reportType });
    navigate(`/clinic/reports/admission-wise/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Admission Report</span>
            <span className="cwf-title-right">Admission Wise Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-radios">
              {[['admission', 'Admission'], ['opd', 'OPD']].map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="scope" value={v} checked={scope === v} onChange={() => setScope(v)} />
                  {l}
                </label>
              ))}
            </div>

            <div className="cwf-radios">
              {[['discharge', 'Discharge'], ['admit', 'Admit']].map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="statusMode" value={v} checked={statusMode === v} onChange={() => setStatusMode(v)} />
                  {l}
                </label>
              ))}
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Date</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input type="date" className="cwf-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input type="date" className="cwf-input" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Type</label>
              <div className="cwf-field-group">
                <select className="cwf-input" value={patientType} onChange={e => setPatientType(e.target.value)}>
                  {PATIENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="cwf-radios">
              {[['detail', 'Details'], ['headers', 'Headers'], ['summary', 'Summary'], ['withSlip', 'With Slip']].map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="reportType" value={v} checked={reportType === v} onChange={() => setReportType(v)} />
                  {l}
                </label>
              ))}
            </div>

            <div className="cwf-actions">
              <button className="cwf-btn cwf-btn--ok" onClick={handleOk}>Preview</button>
              <button className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
