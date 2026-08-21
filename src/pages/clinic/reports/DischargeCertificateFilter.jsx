import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
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
    <div className="dcgf-page">
      <ClinicMenuBar />

      <div className="dcgf-center">
        <div className="dcgf-window">
          <div className="dcgf-titlebar">Discharge Certificate Report</div>

          <div className="dcgf-body">
            <div className="dcgf-row">
              <label>Date From :</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="dcgf-row">
              <label>Date To :</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          <div className="dcgf-actions">
            <button className="dcgf-btn dcgf-btn--view" onClick={handleView}>View</button>
            <button className="dcgf-btn dcgf-btn--close" onClick={handleClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
