import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantWiseFilter.scss';

const API = 'http://localhost:5001/api/clinic';

const todayStr    = () => new Date().toISOString().split('T')[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0]; };

const PATIENT_TYPES = ['Staff', 'Panel', 'Complem.', 'Cash', 'CC', 'JazzCash'];

export default function ConsultantWiseFilter() {
  const navigate = useNavigate();

  const [consultants,      setConsultants]      = useState([]);
  const [fromConsultant,   setFromConsultant]   = useState('');
  const [toConsultant,     setToConsultant]     = useState('');
  const [fromDate,         setFromDate]         = useState(todayStr());
  const [toDate,           setToDate]           = useState(tomorrowStr());
  const [fromTime,         setFromTime]         = useState('08:00');
  const [toTime,           setToTime]           = useState('07:59');
  const [types,            setTypes]            = useState([]);
  const [ipd,              setIpd]              = useState(false);
  const [activeOnly,       setActiveOnly]       = useState(false);
  const [reportType,       setReportType]       = useState('detail');

  useEffect(() => {
    fetch(`${API}/patient-visits/consultants`)
      .then(r => r.json())
      .then(j => {
        const list = j.data || [];
        setConsultants(list);
        if (list.length) { setFromConsultant(list[0]); setToConsultant(list[0]); }
      })
      .catch(() => {});
  }, []);

  const toggleType = (t) => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const handleOk = () => {
    const params = new URLSearchParams({ fromDate, toDate, fromTime, toTime, reportType });
    if (fromConsultant) params.set('fromConsultant', fromConsultant);
    if (toConsultant)   params.set('toConsultant',   toConsultant);
    if (types.length)   params.set('types', types.join(','));
    if (ipd)            params.set('ipd', '1');
    navigate(`/clinic/reports/consultant-wise/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">

          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Consultant Wise Patients</span>
            <span className="cwf-title-right">Consultant Wise Patients</span>
          </div>

          <div className="cwf-body">

            {/* Active Consultants — top right */}
            <div className="cwf-row cwf-row--right">
              <label className="cwf-chk-label">
                <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
                Active Consultants
              </label>
            </div>

            {/* Consultant From / To */}
            <div className="cwf-row">
              <label className="cwf-lbl">Consultant</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <select className="cwf-input cwf-input--con" value={fromConsultant} onChange={e => setFromConsultant(e.target.value)}>
                  <option value="">— All —</option>
                  {consultants.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <select className="cwf-input cwf-input--con" value={toConsultant} onChange={e => setToConsultant(e.target.value)}>
                  <option value="">— All —</option>
                  {consultants.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Date */}
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

            {/* Time */}
            <div className="cwf-row">
              <label className="cwf-lbl">Time</label>
              <div className="cwf-field-group">
                <input type="time" className="cwf-input cwf-input--time" value={fromTime} onChange={e => setFromTime(e.target.value)} />
              </div>
              <div className="cwf-field-group">
                <input type="time" className="cwf-input cwf-input--time" value={toTime} onChange={e => setToTime(e.target.value)} />
              </div>
            </div>

            {/* Patient Type + IPD */}
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
              <label className="cwf-chk-label cwf-chk-label--ipd">
                <input type="checkbox" checked={ipd} onChange={e => setIpd(e.target.checked)} />
                IPD
              </label>
            </div>

            {/* Report Type radio */}
            <div className="cwf-radios">
              {[
                { value: 'detail',            label: 'Detail' },
                { value: 'header',            label: 'Header' },
                { value: 'date_wise_summary', label: 'Date Wise Summary' },
              ].map(opt => (
                <label key={opt.value} className="cwf-radio-label">
                  <input type="radio" name="reportType" value={opt.value}
                    checked={reportType === opt.value} onChange={() => setReportType(opt.value)} />
                  {opt.label}
                </label>
              ))}
            </div>

            {/* Actions */}
            <div className="cwf-actions">
              <button className="cwf-btn cwf-btn--ok" onClick={handleOk}>OK</button>
              <button className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
