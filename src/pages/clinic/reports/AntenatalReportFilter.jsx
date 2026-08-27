import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import './AntenatalReportFilter.scss';

const todayStr = () => new Date().toISOString().split('T')[0];

export default function AntenatalReportFilter() {
  const navigate = useNavigate();
  const { doctors, fetchDoctors } = useClinicStore();

  // Registration Date by default — a patient registered today has an EDD
  // ~9 months out, so defaulting to "ED Date = today" (matching the legacy
  // dropdown's default) would show nothing for anything just registered.
  // "ED Date" is still available for finding who's due to deliver in a
  // given range, just not the default.
  const [dateField, setDateField] = useState('registrationDate');
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [doctorId, setDoctorId] = useState('');

  useEffect(() => {
    if (doctors.length === 0) fetchDoctors().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same "linked to Antenatal department" filter as the Antenatal registration
  // form's own "Under Treatment" dropdown (see Antenatal.jsx) — this is the
  // same Consultant list, matched by department name, not a loose "gyn" guess.
  const antenatalDoctors = doctors.filter(d =>
    d.status === 'active' &&
    d.subDepts?.some(s => s.subDept?.department?.name?.trim().toLowerCase() === 'antenatal')
  );

  function handlePreview() {
    const params = new URLSearchParams({ dateField, fromDate, toDate });
    if (doctorId) params.set('doctorId', doctorId);
    navigate(`/clinic/reports/antenatal/view?${params}`);
  }

  return (
    <div className="atrf-page">
      <ClinicMenuBar />

      <div className="atrf-center">
        <div className="atrf-window">
          <div className="atrf-titlebar">Antenatal Report</div>

          <div className="atrf-body">
            <div className="atrf-row">
              <select className="atrf-select atrf-select--type" value={dateField} onChange={e => setDateField(e.target.value)}>
                <option value="registrationDate">Reg. Date</option>
                <option value="edd">ED Date</option>
              </select>
              <span className="atrf-lbl">From :</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              <span className="atrf-lbl">To :</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>

            <div className="atrf-row atrf-row--consultant">
              <span className="atrf-lbl atrf-lbl--wide">Consultant :</span>
              <select className="atrf-select atrf-select--consultant" value={doctorId} onChange={e => setDoctorId(e.target.value)}>
                <option value="">ALL</option>
                {antenatalDoctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <div className="atrf-actions">
            <button className="atrf-btn atrf-btn--preview" onClick={handlePreview}>Preview</button>
            <button className="atrf-btn atrf-btn--close" onClick={() => navigate(-1)}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
