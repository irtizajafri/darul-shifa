import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';
import './StatusWiseAdmissionFilter.scss';

const API = 'http://localhost:5001/api/clinic';

const todayStr    = () => new Date().toISOString().split('T')[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; };

const PATIENT_TYPES = [
  ['staff', 'Staff'], ['panel', 'Panel'], ['complementary', 'Complementary'], ['private', 'Cash'], ['cc', 'CC'],
];
const ADMISSION_TYPES = [
  ['active', 'Admit'], ['discharge', 'Discharge'], ['closed', 'Closed'],
];

export default function StatusWiseAdmissionFilter() {
  const navigate = useNavigate();

  const [doctors, setDoctors] = useState([]);
  const [surgeryTypes, setSurgeryTypes] = useState([]);
  const [activeOnly, setActiveOnly] = useState(false);

  const [dateFrom, setDateFrom] = useState(todayStr());
  const [dateTo, setDateTo] = useState(tomorrowStr());

  const [admissionFrom, setAdmissionFrom] = useState('');
  const [admissionTo, setAdmissionTo] = useState('');

  const [doctorFrom, setDoctorFrom] = useState('');
  const [doctorTo, setDoctorTo] = useState('');

  const [surgeryFrom, setSurgeryFrom] = useState('');
  const [surgeryTo, setSurgeryTo] = useState('');

  const [patientTypes, setPatientTypes] = useState(['private']);
  const [admissionTypes, setAdmissionTypes] = useState(['active']);
  const [groupMode, setGroupMode] = useState('normal'); // normal | group

  useEffect(() => {
    fetch(`${API}/doctors?minimal=true`)
      .then(r => r.json())
      .then(j => setDoctors((j.data || []).filter(d => !activeOnly || d.status === 'active')))
      .catch(() => {});
  }, [activeOnly]);

  useEffect(() => {
    fetch(`${API}/surgery-types`)
      .then(r => r.json())
      .then(j => setSurgeryTypes(j.data || []))
      .catch(() => {});
  }, []);

  const togglePatientType = (v) => {
    setPatientTypes(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));
  };
  const toggleAdmissionType = (v) => {
    setAdmissionTypes(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));
  };

  const handlePreview = () => {
    const fromDoc = doctors.find(d => String(d.id) === doctorFrom);
    const toDoc = doctors.find(d => String(d.id) === doctorTo);
    const fromSurg = surgeryTypes.find(s => String(s.id) === surgeryFrom);
    const toSurg = surgeryTypes.find(s => String(s.id) === surgeryTo);

    const params = new URLSearchParams({
      dateFrom, dateTo,
      admissionFrom, admissionTo,
      doctorFromCode: fromDoc?.code || '',
      doctorToCode: toDoc?.code || '',
      surgeryFromCode: fromSurg?.code || '',
      surgeryToCode: toSurg?.code || '',
      patientTypes: patientTypes.join(','),
      admissionTypes: admissionTypes.join(','),
      groupMode,
    });
    navigate(`/clinic/reports/status-wise-admission/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window swa-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Status Wise Admission</span>
            <span className="cwf-title-right">Status Wise Admission</span>
          </div>

          <div className="cwf-body">

            <div className="swa-active-row">
              <label className="cwf-chk-active">
                <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
                Active Consultants
              </label>
            </div>

            <div className="swa-fromto-labels">
              <span className="swa-fromto-lbl">From</span>
              <span className="swa-fromto-lbl">To</span>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Date</label>
              <input type="date" className="cwf-input swa-half" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
              <input type="date" className="cwf-input swa-half" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Admission #</label>
              <input type="text" className="cwf-input swa-half" placeholder="(first)" value={admissionFrom} onChange={e => setAdmissionFrom(e.target.value)} />
              <input type="text" className="cwf-input swa-half" placeholder="(last)" value={admissionTo} onChange={e => setAdmissionTo(e.target.value)} />
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Doctor</label>
              <select className="cwf-input swa-half" value={doctorFrom} onChange={e => setDoctorFrom(e.target.value)}>
                <option value="">(first)</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
              </select>
              <select className="cwf-input swa-half" value={doctorTo} onChange={e => setDoctorTo(e.target.value)}>
                <option value="">(last)</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.code} - {d.name}</option>)}
              </select>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Surgery Type</label>
              <select className="cwf-input swa-half" value={surgeryFrom} onChange={e => setSurgeryFrom(e.target.value)}>
                <option value="">(first)</option>
                {surgeryTypes.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </select>
              <select className="cwf-input swa-half" value={surgeryTo} onChange={e => setSurgeryTo(e.target.value)}>
                <option value="">(last)</option>
                {surgeryTypes.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
              </select>
            </div>

            <fieldset className="cwf-fieldset">
              <legend className="cwf-legend">Patient Type</legend>
              <div className="cwf-checkboxes">
                {PATIENT_TYPES.map(([v, l]) => (
                  <label key={v} className="cwf-chk-label">
                    <input type="checkbox" checked={patientTypes.includes(v)} onChange={() => togglePatientType(v)} />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="cwf-fieldset">
              <legend className="cwf-legend">Admission Type</legend>
              <div className="cwf-checkboxes">
                {ADMISSION_TYPES.map(([v, l]) => (
                  <label key={v} className="cwf-chk-label">
                    <input type="checkbox" checked={admissionTypes.includes(v)} onChange={() => toggleAdmissionType(v)} />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="cwf-radios">
              {[['group', 'Group wise'], ['normal', 'Normal']].map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="groupMode" value={v} checked={groupMode === v} onChange={() => setGroupMode(v)} />
                  {l}
                </label>
              ))}
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
