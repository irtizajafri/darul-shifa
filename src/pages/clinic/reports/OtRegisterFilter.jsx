import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import './ConsultantWiseFilter.scss';
import './OtRegisterFilter.scss';

const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonthStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

const PATIENT_TYPES = [
  ['ALL', 'All'], ['private', 'Cash'], ['panel', 'Panel'], ['staff', 'Staff'], ['cc', 'CC'], ['complementary', 'Complementary'],
];

// A doctor "is" a given OT role purely by which Staff Category was assigned
// to them in Doctor parameters — matched by keyword (same logic as the OT
// Register entry screen) so spelling variants ("Anaesthetic" etc.) still work.
function normCat(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }
const ROLE_KEYWORDS = { anaesthesiologist: ['anaesth', 'anesth'], surgeon: ['surgeon'], tech: ['tech'] };
function doctorsForRole(doctors, role) {
  return doctors.filter(d => ROLE_KEYWORDS[role].some(k => normCat(d.staffCategory?.name).includes(k)));
}

// ── Generic search/select popup used by every lookup field below ─────────────
function PickerModal({ title, rows, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const filtered = rows.filter(r => !q.trim() || r.label.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="otrf-overlay">
      <div className="otrf-modal">
        <div className="otrf-modal-hdr">
          <span>{title}</span>
          <button className="otrf-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="otrf-modal-search">
          <Search size={13} className="otrf-modal-search-icon" />
          <input autoFocus className="otrf-modal-search-input" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="otrf-modal-body">
          <table className="otrf-modal-tbl">
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} onClick={() => onSelect(r)}><td>{r.label}</td></tr>
              ))}
              {!filtered.length && <tr><td className="otrf-td-empty">Koi record nahi mila</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Lookup field: readonly text + search button, opens a PickerModal ─────────
function LookupField({ label, valueLabel, rows, onPick, onClear }) {
  const [showPicker, setShowPicker] = useState(false);
  return (
    <div className="cwf-row">
      <label className="cwf-lbl otrf-lbl">{label}</label>
      <div className="cwf-field-group">
        <input className="cwf-input otrf-lookup-inp" value={valueLabel || ''} readOnly />
        <button className="otrf-lookup-btn" onClick={() => setShowPicker(true)} title={`Search ${label}`}>
          <Search size={12} />
        </button>
        {valueLabel && (
          <button className="otrf-clear-btn" onClick={onClear} title="Clear">✕</button>
        )}
      </div>

      {showPicker && (
        <PickerModal
          title={`Select ${label}`}
          rows={rows}
          onSelect={(r) => { onPick(r); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

export default function OtRegisterFilter() {
  const navigate = useNavigate();
  const { doctors, fetchDoctors, surgeryTypes, fetchSurgeryTypes } = useClinicStore();

  const [fromDate, setFromDate] = useState(firstOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [patientType, setPatientType] = useState('ALL');

  const [anaesthesiologist, setAnaesthesiologist] = useState(null);
  const [surgeon, setSurgeon] = useState(null);
  const [tech, setTech] = useState(null);
  const [surgeryType, setSurgeryType] = useState(null);

  useEffect(() => { fetchDoctors(); fetchSurgeryTypes(); }, [fetchDoctors, fetchSurgeryTypes]);

  const anaesthesiologistRows = doctorsForRole(doctors, 'anaesthesiologist').map(d => ({ id: d.id, label: `${d.code} — ${d.name}` }));
  const surgeonRows           = doctorsForRole(doctors, 'surgeon').map(d => ({ id: d.id, label: `${d.code} — ${d.name}` }));
  const techRows              = doctorsForRole(doctors, 'tech').map(d => ({ id: d.id, label: `${d.code} — ${d.name}` }));
  const surgeryTypeRows       = surgeryTypes.map(s => ({ id: s.id, label: s.code ? `${s.code} — ${s.name}` : s.name }));

  const handleOk = () => {
    const params = new URLSearchParams({ fromDate, toDate, patientType });
    if (anaesthesiologist) params.set('anaesthesiologistId', anaesthesiologist.id);
    if (surgeon) params.set('surgeonId', surgeon.id);
    if (tech) params.set('techId', tech.id);
    if (surgeryType) params.set('surgeryTypeId', surgeryType.id);
    navigate(`/clinic/reports/ot-register/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — OT Register</span>
            <span className="cwf-title-right">Report</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <select className="cwf-input otrf-date-lbl" disabled>
                <option>Surg. Date</option>
              </select>
              <div className="cwf-field-group">
                <input type="date" className="cwf-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <span className="cwf-sub-lbl">To :</span>
              <div className="cwf-field-group">
                <input type="date" className="cwf-input" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
            </div>

            <div className="otrf-two-col">
              <div className="otrf-col-left">
                <LookupField
                  label="Anaesthesiologist:" valueLabel={anaesthesiologist?.label}
                  rows={anaesthesiologistRows}
                  onPick={setAnaesthesiologist} onClear={() => setAnaesthesiologist(null)}
                />
                <LookupField
                  label="Surgeon :" valueLabel={surgeon?.label}
                  rows={surgeonRows}
                  onPick={setSurgeon} onClear={() => setSurgeon(null)}
                />
                <LookupField
                  label="Tech :" valueLabel={tech?.label}
                  rows={techRows}
                  onPick={setTech} onClear={() => setTech(null)}
                />
                <LookupField
                  label="Surgery Type" valueLabel={surgeryType?.label}
                  rows={surgeryTypeRows}
                  onPick={setSurgeryType} onClear={() => setSurgeryType(null)}
                />
              </div>

              <div className="otrf-col-right">
                <label className="cwf-sub-lbl">Report Type:</label>
                <select className="cwf-input" value={patientType} onChange={e => setPatientType(e.target.value)}>
                  {PATIENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

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
