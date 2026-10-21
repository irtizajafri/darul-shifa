import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';
import './DischargeCertificateFilter.scss';

const todayStr = () => new Date().toISOString().split('T')[0];
const monthAgoStr = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; };

export default function DischargeCertificateFilter() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(monthAgoStr());
  const [toDate, setToDate] = useState(todayStr());

  const handleView = () => navigate(`/clinic/reports/discharge-certificate/view?fromDate=${fromDate}&toDate=${toDate}`);
  const handleClose = () => navigate(-1);

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window dcgf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Discharge Certificate Report</span>
            <span className="cwf-title-right">Discharge Certificate Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl">Date</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input type="date" className="cwf-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input type="date" className="cwf-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>

            <div className="cwf-actions">
              <button className="cwf-btn cwf-btn--ok" onClick={handleView}>OK</button>
              <button className="cwf-btn" onClick={handleClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
