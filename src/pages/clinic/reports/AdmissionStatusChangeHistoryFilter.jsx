import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';

const STATUSES = [
  ['all', 'All'],
  ['active', 'Admit'],
  ['discharge', 'Discharge'],
  ['closed', 'Closed'],
];

// Filter screen for Status Change History Report. The backend endpoint takes
// no params, so these filter the fetched rows on the View page: Changed At
// date range (blank = all), the status it was changed TO, and text search.
export default function AdmissionStatusChangeHistoryFilter() {
  const navigate = useNavigate();

  const [toStatus, setToStatus] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');

  const handlePreview = () => {
    const params = new URLSearchParams({ toStatus, fromDate, toDate, search: search.trim() });
    navigate(`/clinic/reports/status-change-history/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Status Change History Report</span>
            <span className="cwf-title-right">Status Change History Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl">Changed To</label>
              <div className="cwf-radios">
                {STATUSES.map(([v, l]) => (
                  <label key={v} className="cwf-radio-label">
                    <input type="radio" name="toStatus" value={v} checked={toStatus === v} onChange={() => setToStatus(v)} />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Changed At</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input type="date" className="cwf-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input type="date" className="cwf-input" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
              <span className="cwf-sub-lbl">(blank = all)</span>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Search</label>
              <input
                type="text"
                className="cwf-input"
                style={{ width: 260 }}
                placeholder="Admission # ya Patient"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handlePreview(); }}
              />
            </div>

            <div className="cwf-actions">
              <button className="cwf-btn cwf-btn--ok" onClick={handlePreview}>OK</button>
              <button className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
