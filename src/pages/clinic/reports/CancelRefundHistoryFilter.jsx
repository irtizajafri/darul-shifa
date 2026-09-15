import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';

const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonthStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

const TYPES = [
  ['all', 'All'],
  ['cancelled', 'Cancelled'],
  ['refunded', 'Refunded'],
];

export default function CancelRefundHistoryFilter() {
  const navigate = useNavigate();

  const [type, setType] = useState('all');
  const [fromDate, setFromDate] = useState(firstOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [search, setSearch] = useState('');

  const handlePreview = () => {
    const params = new URLSearchParams({ type, fromDate, toDate, search });
    navigate(`/clinic/reports/cancel-refund-history/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Cancel &amp; Refund Slip History</span>
            <span className="cwf-title-right">Cancel &amp; Refund Slip History</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-radios">
              {TYPES.map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="type" value={v} checked={type === v} onChange={() => setType(v)} />
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
              <label className="cwf-lbl">Search</label>
              <input
                type="text"
                className="cwf-input"
                style={{ width: 260 }}
                placeholder="Patient name ya Slip #"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="cwf-actions">
              <button className="cwf-btn cwf-btn--ok" onClick={handlePreview}>Preview</button>
              <button className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
