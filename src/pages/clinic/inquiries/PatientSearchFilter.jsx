import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { API_BASE_URL } from '../../../config';
import '../reports/ConsultantWiseFilter.scss';
import './PatientSearch.scss';

// Clinic → Inquiries → Patient Search (owner, 2026-11-17), laid out like the
// old system's screen: Patient Name, Visit Date, Phone #, Sex, Department,
// Sub Dep. and Patient Type. OK opens the result as a report.

const API = `${API_BASE_URL}/api/clinic`;
const PKT_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
const pktToday = () => PKT_DAY.format(new Date());
const daysBefore = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

const PATIENT_TYPES = [['staff', 'Staff'], ['panel', 'Panel'], ['complementary', 'Complementary'], ['cash', 'Cash'], ['', 'All']];

const blank = () => ({
  name: '', fromDate: daysBefore(pktToday(), 15), toDate: pktToday(), phone: '', sex: 'both',
  departmentId: '', subDeptId: '', patientType: 'cash',
});

export default function PatientSearchFilter() {
  const navigate = useNavigate();
  const [f, setF] = useState(blank);
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);

  useEffect(() => {
    Promise.all([fetch(`${API}/departments`).then((r) => r.json()), fetch(`${API}/sub-departments`).then((r) => r.json())])
      .then(([d, s]) => { setDepartments(d.data || []); setSubDepartments(s.data || []); })
      .catch((e) => toast.error(e?.message || 'Departments did not load'));
  }, []);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const subOptions = useMemo(
    () => subDepartments.filter((s) => !f.departmentId || String(s.departmentId ?? s.department?.id) === String(f.departmentId)),
    [subDepartments, f.departmentId],
  );

  const pickDepartment = (v) => setF((x) => {
    const keepSub = !v || subDepartments.some((s) => String(s.id) === String(x.subDeptId) && String(s.departmentId ?? s.department?.id) === String(v));
    return { ...x, departmentId: v || '', subDeptId: keepSub ? x.subDeptId : '' };
  });

  const preview = () => {
    if (!f.fromDate || !f.toDate) { toast.error('Select the visit dates'); return; }
    if (f.fromDate > f.toDate) { toast.error('From date is after To date'); return; }
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v); });
    if (!f.patientType) p.set('patientType', 'all');
    navigate(`/clinic/inquiries/patient-search/view?${p}`);
  };

  const onKey = (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); preview(); } };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window psf-window" onKeyDown={onKey}>
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Inquiries — Patient Search</span>
            <span className="cwf-title-right">Patient Search</span>
          </div>

          <div className="cwf-body">
            <fieldset className="cwf-fieldset psf-criteria">
              <legend className="cwf-legend">Selection Criteria</legend>

              <div className="cwf-row">
                <label className="cwf-lbl" htmlFor="ps-name">Patient Name</label>
                <input id="ps-name" className="cwf-input psf-wide" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
              </div>

              <div className="cwf-row">
                <label className="cwf-lbl">Visit Date</label>
                <input type="date" className="cwf-input" aria-label="Visit date from" value={f.fromDate} onChange={(e) => set('fromDate', e.target.value)} />
                <span className="psf-gap" />
                <input type="date" className="cwf-input" aria-label="Visit date to" value={f.toDate} min={f.fromDate} onChange={(e) => set('toDate', e.target.value)} />
              </div>

              <div className="cwf-row">
                <label className="cwf-lbl" htmlFor="ps-phone">Phone #</label>
                <input id="ps-phone" className="cwf-input" inputMode="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
                <span className="psf-gap" />
                <label className="cwf-sub-lbl" htmlFor="ps-sex">Sex</label>
                <select id="ps-sex" className="cwf-input" value={f.sex} onChange={(e) => set('sex', e.target.value)}>
                  <option value="both">Both</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="cwf-row">
                <label className="cwf-lbl">Department</label>
                <SearchableSelect
                  size="sm"
                  wrapperClassName="psf-select"
                  options={departments}
                  value={f.departmentId}
                  onChange={pickDepartment}
                  getKey={(d) => d.id}
                  getLabel={(d) => d.name}
                  placeholder="(all)"
                />
              </div>

              <div className="cwf-row">
                <label className="cwf-lbl">Sub Dep.</label>
                <SearchableSelect
                  size="sm"
                  wrapperClassName="psf-select"
                  options={subOptions}
                  value={f.subDeptId}
                  onChange={(v) => set('subDeptId', v || '')}
                  getKey={(s) => s.id}
                  getLabel={(s) => (f.departmentId ? s.name : `${s.name} — ${s.department?.name || ''}`)}
                  placeholder="(all)"
                  maxUnfiltered={400}
                />
              </div>

              <div className="cwf-row">
                <label className="cwf-lbl">Patient Type</label>
                <div className="cwf-radios psf-types">
                  {PATIENT_TYPES.map(([v, l]) => (
                    <label key={l} className="cwf-radio-label">
                      <input type="radio" name="ps-type" checked={f.patientType === v} onChange={() => set('patientType', v)} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            <p className="psf-note">Excel (Patients List) rows have no phone or sex, so a Phone # or Sex filter leaves them out.</p>

            <div className="cwf-actions">
              <button type="button" className="cwf-btn cwf-btn--ok" onClick={preview}>OK</button>
              <button type="button" className="cwf-btn" onClick={() => setF(blank())}>Clear</button>
              <button type="button" className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
