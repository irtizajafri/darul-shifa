import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Upload, X } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import useModalKeys from '../../../hooks/useModalKeys';
import DoctorWiseStatementImportModal from './DoctorWiseStatementImportModal';
import '../reports/ConsultantWiseFilter.scss';
import './DoctorWiseStatement.scss';

const todayIso = () => new Date().toISOString().slice(0, 10);
// The hospital's own operating day runs 08:00:00 AM to 07:59:59 AM (next
// day) — matches the backend's own daily "Day close" boundary, not
// midnight — so that's the sane default here, not 00:00/23:59.
const DEFAULT_FROM_TIME = '08:00:00';
const DEFAULT_TO_TIME = '07:59:59';

// Panels > Reports > Doctor Wise Statement — filter step (owner's report
// format: filter screen first, then the preview). Same fields/defaults as
// the old pop-up, which matched the legacy "Statement of Surgery" dialog:
// From Doctor is a real lookup, To Doctor is permanently disabled (the
// legacy screen's own unfinished "Label1" placeholder, kept as-is rather
// than invented over). Only one Doctor is ever actually pickable. The Time
// fields are kept as on the legacy dialog; like before, the report itself
// only uses the dates. OK opens DoctorWiseStatement at /view.
export default function DoctorWiseStatementFilter() {
  const navigate = useNavigate();
  const { doctors, fetchDoctors } = useClinicStore();

  const [activeConsultantsOnly, setActiveConsultantsOnly] = useState(false);
  const [doctorId, setDoctorId] = useState('');
  const [showDoctorPicker, setShowDoctorPicker] = useState(false);

  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [fromTime, setFromTime] = useState(DEFAULT_FROM_TIME);
  const [toTime, setToTime] = useState(DEFAULT_TO_TIME);

  const [showImport, setShowImport] = useState(false);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const selectedDoctor = doctors.find((d) => String(d.id) === String(doctorId));
  const pickableDoctors = activeConsultantsOnly ? doctors.filter((d) => d.status === 'active') : doctors;

  function handlePreview() {
    if (!doctorId) return;
    const q = new URLSearchParams({ doctorId, fromDate, toDate });
    navigate(`/clinic/panels/doctor-wise-statement/view?${q}`);
  }

  return (
    <div className="cwf-page dws-filter-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Doctor Wise Statement</span>
            <span className="cwf-title-right">Doctor Wise Statement</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row cwf-row--right">
              <label className="cwf-chk-label">
                <input
                  type="checkbox"
                  checked={activeConsultantsOnly}
                  onChange={(e) => setActiveConsultantsOnly(e.target.checked)}
                />
                Active Consultants
              </label>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Doctor</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <div className="dws-lookup-row">
                  <input
                    className="cwf-input dws-lookup-input"
                    readOnly
                    value={selectedDoctor ? `${selectedDoctor.code} — ${selectedDoctor.name}` : ''}
                    placeholder="Doctor select karein"
                    onClick={() => setShowDoctorPicker(true)}
                  />
                  {selectedDoctor && (
                    <button type="button" className="dws-lookup-clear" onClick={() => setDoctorId('')} title="Clear">✕</button>
                  )}
                  <button type="button" className="dws-lookup-btn" onClick={() => setShowDoctorPicker(true)} title="Search doctor"><Search size={13} /></button>
                </div>
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input className="cwf-input" disabled placeholder="Label1" />
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Date</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input type="date" className="cwf-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input type="date" className="cwf-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Time</label>
              <div className="cwf-field-group">
                <input type="time" step="1" className="cwf-input cwf-input--time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
              </div>
              <div className="cwf-field-group">
                <input type="time" step="1" className="cwf-input cwf-input--time" value={toTime} onChange={(e) => setToTime(e.target.value)} />
              </div>
            </div>

            <div className="cwf-actions">
              <button type="button" className="cwf-btn dws-btn-icon" onClick={() => setShowImport(true)}><Upload size={13} /> Upload Excel</button>
              <button type="button" className="cwf-btn cwf-btn--ok" onClick={handlePreview} disabled={!selectedDoctor} title={!selectedDoctor ? 'Doctor select karein' : ''}>
                OK
              </button>
              <button type="button" className="cwf-btn" onClick={() => navigate(-1)}>Close</button>
            </div>
          </div>
        </div>
      </div>

      {showDoctorPicker && (
        <DoctorPickerModal
          doctors={pickableDoctors}
          onSelect={(d) => { setDoctorId(String(d.id)); setShowDoctorPicker(false); }}
          onClose={() => setShowDoctorPicker(false)}
        />
      )}

      {showImport && (
        <DoctorWiseStatementImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}

function DoctorPickerModal({ doctors, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useModalKeys({ active: true, onEsc: onClose });

  const filtered = doctors.filter((d) =>
    !q.trim() ||
    d.name.toLowerCase().includes(q.trim().toLowerCase()) ||
    d.code.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="dws-modal-overlay" onMouseDown={onClose}>
      <div className="dws-modal dws-modal--picker" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dws-modal-head">
          <span>Select Doctor</span>
          <button onClick={onClose} aria-label="Close" title="Close"><X size={16} /></button>
        </div>
        <div className="dws-picker-search">
          <Search size={13} />
          <input ref={inputRef} placeholder="Search doctor…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="dws-picker-list">
          {filtered.length === 0 ? (
            <div className="dws-picker-empty">Koi doctor nahi mila</div>
          ) : filtered.map((d) => (
            <div key={d.id} className="dws-picker-row" onClick={() => onSelect(d)}>
              <span className="dws-picker-code">{d.code}</span>
              <span className="dws-picker-name">{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
