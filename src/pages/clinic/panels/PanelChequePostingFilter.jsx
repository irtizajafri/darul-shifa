import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import '../reports/ConsultantWiseFilter.scss';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Panels > Reports > Panel Cheque Posting Report — filter step (owner's
// report format: filter screen first, then the preview). Same fields/defaults
// as the old pop-up, which matched the legacy "Report" dialog: From Dt / To Dt
// (today) + Posting / Posted Date. OK opens PanelChequePostingReport at /view.
export default function PanelChequePostingFilter() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [basis, setBasis] = useState('posting');

  function handlePreview() {
    if (!fromDate || !toDate) { toast.error('From aur To date dono chunein'); return; }
    if (fromDate > toDate) { toast.error('From date, To date se pehle honi chahiye'); return; }
    const q = new URLSearchParams({ from: fromDate, to: toDate, basis });
    navigate(`/clinic/panels/cheque-posting-report/view?${q}`);
  }

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Panel Cheque Posting Report</span>
            <span className="cwf-title-right">Panel Cheque Posting Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl" htmlFor="pcpr-from">From Dt</label>
              <input id="pcpr-from" type="date" className="cwf-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <label className="cwf-radio-label" style={{ marginLeft: 24 }}>
                <input type="radio" name="pcpr-basis" checked={basis === 'posting'} onChange={() => setBasis('posting')} />
                Posting Date
              </label>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl" htmlFor="pcpr-to">To Dt</label>
              <input id="pcpr-to" type="date" className="cwf-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              <label className="cwf-radio-label" style={{ marginLeft: 24 }}>
                <input type="radio" name="pcpr-basis" checked={basis === 'posted'} onChange={() => setBasis('posted')} />
                Posted Date
              </label>
            </div>

            <div className="cwf-actions">
              <button type="button" className="cwf-btn cwf-btn--ok" onClick={handlePreview}>OK</button>
              <button type="button" className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
