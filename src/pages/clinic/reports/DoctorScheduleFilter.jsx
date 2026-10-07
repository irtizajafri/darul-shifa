import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import './ConsultantWiseFilter.scss';
import './DoctorScheduleFilter.scss';

const API = 'http://localhost:5001/api/clinic';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DoctorScheduleFilter() {
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeOnly, setActiveOnly] = useState(true);

  const [doctorFrom, setDoctorFrom] = useState('');
  const [doctorTo, setDoctorTo] = useState('');
  const [deptFrom, setDeptFrom] = useState('');
  const [deptTo, setDeptTo] = useState('');
  const [day, setDay] = useState('');

  useEffect(() => {
    fetch(`${API}/doctors?minimal=true`)
      .then(r => r.json())
      .then(j => setDoctors((j.data || []).filter(d => !activeOnly || d.status === 'active')))
      .catch((err) => toast.error(err?.message || 'Failed to load doctors'));
  }, [activeOnly]);

  useEffect(() => {
    fetch(`${API}/departments`)
      .then(r => r.json())
      .then(j => setDepartments(j.data || []))
      .catch((err) => toast.error(err?.message || 'Failed to load departments'));
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
      day,
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
              <SearchableSelect
                size="sm"
                wrapperClassName="dsf-half"
                options={doctors}
                value={doctorFrom}
                onChange={v => setDoctorFrom(v)}
                getLabel={d => d.name}
                placeholder="(first)"
              />
              <SearchableSelect
                size="sm"
                wrapperClassName="dsf-half"
                options={doctors}
                value={doctorTo}
                onChange={v => setDoctorTo(v)}
                getLabel={d => d.name}
                placeholder="(last)"
              />
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Department</label>
              <SearchableSelect
                size="sm"
                wrapperClassName="dsf-half"
                options={departments}
                value={deptFrom}
                onChange={v => setDeptFrom(v)}
                getLabel={d => d.name}
                placeholder="(first)"
              />
              <SearchableSelect
                size="sm"
                wrapperClassName="dsf-half"
                options={departments}
                value={deptTo}
                onChange={v => setDeptTo(v)}
                getLabel={d => d.name}
                placeholder="(last)"
              />
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Day</label>
              <select className="cwf-input" value={day} onChange={e => setDay(e.target.value)}>
                <option value="">(all days)</option>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
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
