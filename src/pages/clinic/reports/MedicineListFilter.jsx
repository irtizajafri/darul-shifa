import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';

// Filter screen for Medicine List. The list endpoint is always fetched with
// status 'all', so these filter the fetched rows on the View page:
// Status (default Active, same as before) + code/name search.
export default function MedicineListFilter() {
  const navigate = useNavigate();

  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');

  const handlePreview = () => {
    const params = new URLSearchParams({ status, search: search.trim() });
    navigate(`/clinic/reports/medicine-list/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Medicine List</span>
            <span className="cwf-title-right">Medicine List</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl">Status</label>
              <select className="cwf-input" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Search</label>
              <input
                type="text"
                className="cwf-input"
                style={{ width: 260 }}
                placeholder="Search code or name…"
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
