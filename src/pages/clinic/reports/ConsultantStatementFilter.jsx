import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import './ConsultantStatementFilter.scss';
import { todayStr, tomorrowStr } from './reportDates';

const API = 'http://localhost:5001/api/clinic';
const STATEMENT_CATEGORIES = ['consultant', 'contractor'];


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
  // The configured shifts (Parameters > Shift) — the list used to be a fixed
  // Morning / Evening / Night that matched nothing (owner, 2026-10-29).
  const [shifts,     setShifts]     = useState([]);
  useEffect(() => {
    fetch(`${API}/shifts`).then(r => r.json()).then(j => setShifts(j.data || [])).catch(() => setShifts([]));
  }, []);

  useEffect(() => {
    fetch(`${API}/doctors?minimal=true`)
      .then(r => r.json())
      .then(j => {
        // Only doctors whose Staff Category is Consultant or Contractor
        // (owner, 2026-10-23) — not every doctor/RMO/anaesthetist.
        const list = (j.data || [])
          .filter(d => STATEMENT_CATEGORIES.includes(String(d.staffCategory?.name || '').trim().toLowerCase()))
          .filter(d => !activeOnly || d.status === 'active');
        setDoctors(list);
        if (list.length) setConsultant(String(list[0].id));
      })
      .catch((err) => toast.error(err?.message || 'Failed to load doctors'));
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
              <SearchableSelect
                size="sm"
                style={{ width: 260 }}
                options={doctors}
                value={consultant}
                onChange={v => setConsultant(v)}
                getLabel={d => `${d.id} - ${d.name}`}
                placeholder="— Select —"
              />
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
                  <option value="ALL">ALL</option>
                  {shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
