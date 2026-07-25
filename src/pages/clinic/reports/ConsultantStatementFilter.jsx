import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantStatementFilter.scss';

const API = 'http://localhost:5001/api/clinic';

const todayStr    = () => new Date().toISOString().split('T')[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; };

const SHIFTS = ['ALL', 'Morning', 'Evening', 'Night'];

export default function ConsultantStatementFilter() {
  const navigate = useNavigate();

  const [doctors,    setDoctors]    = useState([]);
  const [consultant, setConsultant] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [fromDate,   setFromDate]   = useState(todayStr());
  const [toDate,     setToDate]     = useState(tomorrowStr());
  const [fromTime,   setFromTime]   = useState('08:00');
  const [toTime,     setToTime]     = useState('07:59');
  const [shift,      setShift]      = useState('ALL');

  useEffect(() => {
    fetch(`${API}/doctors?minimal=true`)
      .then(r => r.json())
      .then(j => {
        const list = (j.data || []).filter(d => !activeOnly || d.status === 'active');
        setDoctors(list);
        if (list.length) setConsultant(String(list[0].id));
      })
      .catch(() => {});
  }, [activeOnly]);

  const handleOk = () => {
    if (!consultant) return;
    const params = new URLSearchParams({ consultant, fromDate, toDate, fromTime, toTime, shift });
    navigate(`/clinic/reports/consultant-statement/view?${params}`);
  };

  return (
    <div className="csf-page">
      <ClinicMenuBar />

      <div className="csf-center">
        <div className="csf-window">

          <div className="csf-titlebar">
            <span className="csf-title-left">Reports — Consultant Statement</span>
            <span className="csf-title-right">Consultant Statement</span>
          </div>

          <div className="csf-body">

            {/* From / To labels */}
            <div className="csf-fromto-labels">
              <span className="csf-fromto-lbl" style={{ marginLeft: 88 }}>From</span>
              <span className="csf-fromto-lbl" style={{ marginLeft: 180 }}>To</span>
            </div>

            {/* Consultant row */}
            <div className="csf-row">
              <label className="csf-lbl">Consultant</label>
              <select
                className="csf-input csf-input--con"
                value={consultant}
                onChange={e => setConsultant(e.target.value)}
              >
                <option value="">— Select —</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.id} - {d.name}</option>
                ))}
              </select>
              <label className="csf-chk-active">
                <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
                Active Consultants
              </label>
            </div>

            {/* Date row */}
            <div className="csf-row">
              <label className="csf-lbl">Date</label>
              <input type="date" className="csf-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              <input type="date" className="csf-input csf-input--to" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>

            {/* Time + Shift row */}
            <div className="csf-row">
              <label className="csf-lbl">Time</label>
              <input type="time" className="csf-input csf-input--time" value={fromTime} onChange={e => setFromTime(e.target.value)} />
              <input type="time" className="csf-input csf-input--time csf-input--to" value={toTime} onChange={e => setToTime(e.target.value)} />
              <div className="csf-shift-group">
                <span className="csf-shift-lbl">Shift</span>
                <select className="csf-input csf-input--shift" value={shift} onChange={e => setShift(e.target.value)}>
                  {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="csf-actions">
              <button className="csf-btn csf-btn--ok" onClick={handleOk}>OK</button>
              <button className="csf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
