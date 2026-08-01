import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicStore } from '../../../store/useClinicStore';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import '../GeneralOPD.scss';
import './ConsultantWiseFilter.scss';
import './DepartmentDoctorPerformanceFilter.scss';

const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonthStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

// The only departments any part of this app actually writes visits into —
// used as the lookup list instead of the separate (differently-cased,
// legacy-named) ClinicDepartment parameter table.
const DEPARTMENTS = [
  'General OPD', 'Consultant OPD', 'Emergency', 'Dental OPD', 'Therapy',
  'Laboratory', 'Ultra Sound, Echo & Color Doppler', 'Radiology',
  'Blood Bank', 'Miscellaneous', 'Ambulance', 'Admission',
];

const PATIENT_TYPES = ['Staff', 'Panel', 'Complementary', 'Cash', 'CC'];

function LookupModal({ title, options, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const filtered = q.trim() ? options.filter(o => o.toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <div className="gopd-modal-overlay" onMouseDown={onClose}>
      <div className="gopd-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="gopd-modal-header">
          <div className="gopd-modal-title">{title}</div>
          <button className="gopd-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="gopd-modal-body">
          <input ref={inputRef} className="gopd-modal-search" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
          <table className="gopd-modal-table">
            <tbody>
              {filtered.map(o => (
                <tr key={o} className="gopd-modal-row" onClick={() => onSelect(o)}>
                  <td>{o}</td>
                </tr>
              ))}
              {!filtered.length && <tr><td className="gopd-modal-empty">No results</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentPatientsFilter() {
  const navigate = useNavigate();
  const { subDepartments, fetchSubDepartments } = useClinicStore();

  const [fromDate, setFromDate] = useState(firstOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [fromTime, setFromTime] = useState('08:00');
  const [toTime, setToTime] = useState('07:59');
  const [fromDept, setFromDept] = useState('');
  const [toDept, setToDept] = useState('');
  const [fromSubDept, setFromSubDept] = useState('');
  const [toSubDept, setToSubDept] = useState('');
  const [types, setTypes] = useState([]);
  const [todaysAll, setTodaysAll] = useState(false);
  const [reportType, setReportType] = useState('detail');
  const [lookup, setLookup] = useState(null); // 'fromDept' | 'toDept' | 'fromSubDept' | 'toSubDept' | null

  useEffect(() => { if (subDepartments.length === 0) fetchSubDepartments().catch(() => {}); }, []);

  const toggleType = (t) => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  // Sub-department options are scoped to whichever department is picked (From
  // takes priority, matching "select Department first, its Sub Departments open").
  const scopeDeptName = fromDept || toDept;
  const subDeptOptions = scopeDeptName
    ? subDepartments.filter(sd => sd.department?.name?.toLowerCase().includes(scopeDeptName.toLowerCase())
        || scopeDeptName.toLowerCase().includes(sd.department?.name?.toLowerCase() || '###')).map(sd => sd.name)
    : subDepartments.map(sd => sd.name);

  function handleLookupSelect(val) {
    if (lookup === 'fromDept') { setFromDept(val); setFromSubDept(''); }
    else if (lookup === 'toDept') { setToDept(val); setToSubDept(''); }
    else if (lookup === 'fromSubDept') setFromSubDept(val);
    else if (lookup === 'toSubDept') setToSubDept(val);
    setLookup(null);
  }

  const handleOk = () => {
    const params = new URLSearchParams({ fromDate, toDate, fromTime, toTime, reportType });
    if (fromDept) params.set('fromDept', fromDept);
    if (toDept) params.set('toDept', toDept);
    if (fromSubDept) params.set('fromSubDept', fromSubDept);
    if (toSubDept) params.set('toSubDept', toSubDept);
    if (types.length) params.set('types', types.join(','));
    if (todaysAll) params.set('todaysAll', '1');
    navigate(`/clinic/reports/department-patients/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      {lookup && (
        <LookupModal
          title={lookup.includes('SubDept') ? 'Select Sub Department' : 'Select Department'}
          options={lookup.includes('SubDept') ? subDeptOptions : DEPARTMENTS}
          onSelect={handleLookupSelect}
          onClose={() => setLookup(null)}
        />
      )}

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Sub Department wise Patients</span>
            <span className="cwf-title-right">Sub Department wise Patients</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl">Department</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input className="cwf-input" style={{ width: 160 }} value={fromDept} readOnly placeholder="All" />
                <button type="button" className="ddp-lookup-btn" onClick={() => setLookup('fromDept')}>…</button>
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input className="cwf-input" style={{ width: 160 }} value={toDept} readOnly placeholder="All" />
                <button type="button" className="ddp-lookup-btn" onClick={() => setLookup('toDept')}>…</button>
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Sub Department</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input className="cwf-input" style={{ width: 160 }} value={fromSubDept} readOnly placeholder="All" />
                <button type="button" className="ddp-lookup-btn" onClick={() => setLookup('fromSubDept')}>…</button>
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input className="cwf-input" style={{ width: 160 }} value={toSubDept} readOnly placeholder="All" />
                <button type="button" className="ddp-lookup-btn" onClick={() => setLookup('toSubDept')}>…</button>
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Date</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input type="date" className="cwf-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input type="date" className="cwf-input" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Time</label>
              <div className="cwf-field-group">
                <input type="time" className="cwf-input cwf-input--time" value={fromTime} onChange={e => setFromTime(e.target.value)} />
              </div>
              <div className="cwf-field-group">
                <input type="time" className="cwf-input cwf-input--time" value={toTime} onChange={e => setToTime(e.target.value)} />
              </div>
              <label className="cwf-chk-label" style={{ marginLeft: 12 }}>
                <input type="checkbox" checked={todaysAll} onChange={e => setTodaysAll(e.target.checked)} />
                Today's All
              </label>
            </div>

            <div className="cwf-row cwf-row--types">
              <div className="cwf-section">
                <fieldset className="cwf-fieldset">
                  <legend className="cwf-legend">Patient Type</legend>
                  <div className="cwf-checkboxes">
                    {PATIENT_TYPES.map(t => (
                      <label key={t} className="cwf-chk-label">
                        <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} />
                        {t}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>

            <div className="cwf-radios">
              {[
                ['detail', 'Detail'], ['summary', 'Summary'],
                ['dateTabular', 'Date Wise Tabular'], ['deptShift', 'Department and Shift Wise Summary'],
              ].map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="reportType" value={v} checked={reportType === v} onChange={() => setReportType(v)} />
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
