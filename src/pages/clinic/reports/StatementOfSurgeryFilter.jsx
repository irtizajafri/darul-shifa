import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';
import './StatementOfSurgeryFilter.scss';

const API = 'http://localhost:5001/api/clinic';

const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonthStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

export default function StatementOfSurgeryFilter() {
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState([]);
  const [activeOnly, setActiveOnly] = useState(false);
  const [doctorFrom, setDoctorFrom] = useState('');
  const [doctorTo, setDoctorTo] = useState('');

  const [fromDate, setFromDate] = useState(firstOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [fromTime, setFromTime] = useState('08:00');
  const [toTime, setToTime] = useState('07:59');

  // "Statement of Surgery" is IPD-only (admissions) — the legacy screen has
  // no OPD/IPD toggle because OPD surgeries were never in scope, per explicit
  // instruction, so this filter doesn't ask for it either.
  const [patientType, setPatientType] = useState('cash'); // cash | panel

  useEffect(() => {
    // Full Doctors/Consultant parameter list — not narrowed to a "Surgeon"
    // staff category, since real data doesn't reliably tag doctors that way
    // (confirmed 0 rows on that filter against dev data).
    fetch(`${API}/doctors?minimal=true`)
      .then(r => r.json())
      .then(j => {
        const list = (j.data || []).filter(d => !activeOnly || d.status === 'active');
        setDoctors(list);
        if (list.length) {
          setDoctorFrom(String(list[0].id));
          setDoctorTo(String(list[list.length - 1].id));
        }
      })
      .catch(() => {});
  }, [activeOnly]);

  const handleOk = () => {
    if (!doctorFrom || !doctorTo) return;
    const fromDoc = doctors.find(d => String(d.id) === doctorFrom);
    const toDoc = doctors.find(d => String(d.id) === doctorTo);
    const params = new URLSearchParams({
      doctorFromCode: fromDoc?.code || '',
      doctorToCode: toDoc?.code || '',
      fromDate, toDate, fromTime, toTime, patientType,
    });
    navigate(`/clinic/reports/statement-of-surgery/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window sos-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Statement of Surgery</span>
            <span className="cwf-title-right">Statement of Surgery</span>
          </div>

          <div className="cwf-body">

            <div className="sos-active-row">
              <label className="cwf-chk-active">
                <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
                Active Consultants
              </label>
            </div>

            {/* Doctor From / To */}
            <div className="sos-fromto-labels">
              <span className="sos-fromto-lbl">From</span>
              <span className="sos-fromto-lbl">To</span>
            </div>
            <div className="cwf-row">
              <label className="cwf-lbl">Doctor</label>
              <select className="cwf-input sos-doctor-select" value={doctorFrom} onChange={e => setDoctorFrom(e.target.value)}>
                <option value="">— Select —</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
              </select>
              <select className="cwf-input sos-doctor-select" value={doctorTo} onChange={e => setDoctorTo(e.target.value)}>
                <option value="">— Select —</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
              </select>
            </div>

            {/* Date From / To */}
            <div className="cwf-row">
              <label className="cwf-lbl">Date</label>
              <input type="date" className="cwf-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              <input type="date" className="cwf-input" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>

            {/* Time From / To */}
            <div className="cwf-row">
              <label className="cwf-lbl">Time</label>
              <input type="time" step="1" className="cwf-input cwf-input--time" value={fromTime} onChange={e => setFromTime(e.target.value)} />
              <input type="time" step="1" className="cwf-input cwf-input--time" value={toTime} onChange={e => setToTime(e.target.value)} />
            </div>

            {/* Panel / Cash */}
            <div className="cwf-radios">
              {[['cash', 'Cash'], ['panel', 'Panel']].map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="patientType" value={v} checked={patientType === v} onChange={() => setPatientType(v)} />
                  {l}
                </label>
              ))}
            </div>

            <div className="cwf-actions">
              <button className="cwf-btn cwf-btn--ok" onClick={handleOk}>Preview</button>
              <button className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
