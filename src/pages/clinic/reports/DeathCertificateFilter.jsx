import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './DeathCertificateFilter.scss';

const todayStr = () => new Date().toISOString().split('T')[0];
const monthAgoStr = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; };

export default function DeathCertificateFilter() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(monthAgoStr());
  const [toDate, setToDate] = useState(todayStr());

  const handleView = () => navigate(`/clinic/reports/death-certificate/view?fromDate=${fromDate}&toDate=${toDate}`);
  const handleClose = () => navigate(-1);

  return (
    <div className="dcf-page">
      <ClinicMenuBar />

      <div className="dcf-center">
        <div className="dcf-window">
          <div className="dcf-titlebar">Death Certificate Report</div>

          <div className="dcf-body">
            <div className="dcf-row">
              <label>Date From :</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="dcf-row">
              <label>Date To :</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          <div className="dcf-actions">
            <button className="dcf-btn dcf-btn--view" onClick={handleView}>View</button>
            <button className="dcf-btn dcf-btn--close" onClick={handleClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
