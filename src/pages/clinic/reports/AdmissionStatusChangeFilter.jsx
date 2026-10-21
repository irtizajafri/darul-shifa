import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';

// Filter screen for Admission Status Change Report (wiped-out admissions).
// The backend endpoint takes no params, so these filter the fetched rows on
// the View page: Wiped Out date range (blank = all) + text search.
export default function AdmissionStatusChangeFilter() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');

  const handlePreview = () => {
    const params = new URLSearchParams({ fromDate, toDate, search: search.trim() });
    navigate(`/clinic/reports/admission-status-change/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Admission Status Change Report</span>
            <span className="cwf-title-right">Admission Status Change Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl">Wiped Out</label>
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
                placeholder="Admission #, Patient ya MR #"
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
