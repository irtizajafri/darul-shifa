import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import './ConsultantWiseFilter.scss';

const API = 'http://localhost:5001/api/clinic';

// Local (PKT) calendar date — toISOString gave the UTC date, a day behind
// before 05:00.
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr    = () => ymd(new Date());
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate()+1); return ymd(d); };

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
  const [activeOnly,       setActiveOnly]       = useState(false);
  const [reportType,       setReportType]       = useState('detail');

  // Blank From/To = all consultants. "Active Consultants" reloads the list
  // with only active HMS doctors; a pick no longer in it is cleared.
  useEffect(() => {
    fetch(`${API}/patient-visits/consultants${activeOnly ? '?activeOnly=1' : ''}`)
      .then(r => r.json())
      .then(j => {
        const list = j.data || [];
        setConsultants(list);
        setFromConsultant((v) => (list.includes(v) ? v : ''));
        setToConsultant((v) => (list.includes(v) ? v : ''));
      })
      .catch((err) => toast.error(err?.message || 'Failed to load consultants'));
  }, [activeOnly]);

  const toggleType = (t) => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t]);

  const handleOk = () => {
    const params = new URLSearchParams({ fromDate, toDate, fromTime, toTime, reportType });
    if (fromConsultant) params.set('fromConsultant', fromConsultant);
    if (toConsultant)   params.set('toConsultant',   toConsultant);
    if (types.length)   params.set('types', types.join(','));
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
                <SearchableSelect
                  size="sm"
                  style={{ width: 260 }}
                  options={consultants}
                  value={fromConsultant}
                  onChange={v => setFromConsultant(v)}
                  placeholder="— All —"
                />
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <SearchableSelect
                  size="sm"
                  style={{ width: 260 }}
                  options={consultants}
                  value={toConsultant}
                  onChange={v => setToConsultant(v)}
                  placeholder="— All —"
                />
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

            {/* Patient Type */}
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
