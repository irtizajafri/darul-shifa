import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';

const todayStr = () => new Date().toISOString().split('T')[0];

const DATE_TYPES = [
  ['lastVisit', 'Last Visit Date :'],
  ['nextVisit', 'Next Visit Date :'],
  ['entry', 'Entry Date :'],
];

export default function AppointmentFilter() {
  const navigate = useNavigate();
  const [dateType, setDateType] = useState('lastVisit');
  const [date, setDate] = useState(todayStr());

  const handleOk = () => {
    const params = new URLSearchParams({ dateType, date });
    navigate(`/clinic/reports/appointment/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports</span>
            <span className="cwf-title-right">Appointment Register</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <div className="cwf-field-group">
                <select className="cwf-input" value={dateType} onChange={e => setDateType(e.target.value)}>
                  {DATE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="cwf-field-group">
                <input type="date" className="cwf-input" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>

            <div className="cwf-actions">
              <button className="cwf-btn cwf-btn--ok" onClick={handleOk}>OK</button>
              <button className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
