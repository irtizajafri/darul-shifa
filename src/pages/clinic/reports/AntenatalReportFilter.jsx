import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { useClinicStore } from '../../../store/useClinicStore';
import './ConsultantWiseFilter.scss';
import './AntenatalReportFilter.scss';
import { useShallow } from 'zustand/react/shallow';

const todayStr = () => new Date().toISOString().split('T')[0];

export default function AntenatalReportFilter() {
  const navigate = useNavigate();
  const { doctors, fetchDoctors } = useClinicStore(useShallow((s) => ({ doctors: s.doctors, fetchDoctors: s.fetchDoctors })));

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
    if (doctors.length === 0) fetchDoctors().catch((err) => toast.error(err?.message || 'Failed to load doctors'));
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
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window atrf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Antenatal Report</span>
            <span className="cwf-title-right">Antenatal Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl">Date</label>
              <select className="cwf-input atrf-type" value={dateField} onChange={e => setDateField(e.target.value)}>
                <option value="registrationDate">Reg. Date</option>
                <option value="edd">ED Date</option>
              </select>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input type="date" className="cwf-input atrf-date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input type="date" className="cwf-input atrf-date" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Consultant</label>
              <SearchableSelect
                size="sm"
                style={{ flex: 1, minWidth: 0 }}
                options={antenatalDoctors}
                value={doctorId}
                onChange={v => setDoctorId(v)}
                getLabel={d => d.name}
                placeholder="ALL"
              />
            </div>

            <div className="cwf-actions">
              <button className="cwf-btn cwf-btn--ok" onClick={handlePreview}>OK</button>
              <button className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
