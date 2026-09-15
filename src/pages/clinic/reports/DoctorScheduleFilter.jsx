import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';
import './DoctorScheduleFilter.scss';

const API = 'http://localhost:5001/api/clinic';

export default function DoctorScheduleFilter() {
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeOnly, setActiveOnly] = useState(true);

  const [doctorFrom, setDoctorFrom] = useState('');
  const [doctorTo, setDoctorTo] = useState('');
  const [deptFrom, setDeptFrom] = useState('');
  const [deptTo, setDeptTo] = useState('');

  useEffect(() => {
    fetch(`${API}/doctors?minimal=true`)
      .then(r => r.json())
      .then(j => setDoctors((j.data || []).filter(d => !activeOnly || d.status === 'active')))
      .catch(() => {});
  }, [activeOnly]);

  useEffect(() => {
    fetch(`${API}/departments`)
      .then(r => r.json())
      .then(j => setDepartments(j.data || []))
      .catch(() => {});
  }, []);

  const handlePreview = () => {
    const fromDoc = doctors.find(d => String(d.id) === doctorFrom);
    const toDoc = doctors.find(d => String(d.id) === doctorTo);
    const fromDept = departments.find(d => String(d.id) === deptFrom);
    const toDept = departments.find(d => String(d.id) === deptTo);
    const params = new URLSearchParams({
      doctorFromCode: fromDoc?.code || '',
      doctorToCode: toDoc?.code || '',
      deptFromCode: fromDept?.code || '',
      deptToCode: toDept?.code || '',
      activeOnly: activeOnly ? '1' : '0',
    });
    navigate(`/clinic/reports/doctor-schedule/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window dsf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Doctor Schedule</span>
            <span className="cwf-title-right">Doctor Schedule Report</span>
          </div>

          <div className="cwf-body">

            <div className="dsf-active-row">
              <label className="cwf-chk-active">
                <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
                Active Doctors Only
              </label>
            </div>

            <div className="dsf-fromto-labels">
              <span className="dsf-fromto-lbl">From</span>
              <span className="dsf-fromto-lbl">To</span>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Doctor</label>
              <select className="cwf-input dsf-half" value={doctorFrom} onChange={e => setDoctorFrom(e.target.value)}>
                <option value="">(first)</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className="cwf-input dsf-half" value={doctorTo} onChange={e => setDoctorTo(e.target.value)}>
                <option value="">(last)</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Department</label>
              <select className="cwf-input dsf-half" value={deptFrom} onChange={e => setDeptFrom(e.target.value)}>
                <option value="">(first)</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select className="cwf-input dsf-half" value={deptTo} onChange={e => setDeptTo(e.target.value)}>
                <option value="">(last)</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
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
