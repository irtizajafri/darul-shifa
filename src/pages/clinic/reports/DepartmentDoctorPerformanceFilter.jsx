import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicStore } from '../../../store/useClinicStore';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import '../GeneralOPD.scss';
import './ConsultantWiseFilter.scss';
import './DepartmentDoctorPerformanceFilter.scss';

const todayStr = () => new Date().toISOString().split('T')[0];
const firstOfMonthStr = () => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; };

// ── Doctor Lookup Modal — search by name/code, select fills the code field ──
function DoctorLookupModal({ doctors, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const filtered = q.trim()
    ? doctors.filter(d => d.name?.toLowerCase().includes(q.toLowerCase()) || d.code?.toLowerCase().includes(q.toLowerCase()))
    : doctors;
  return (
    <div className="gopd-modal-overlay" onMouseDown={onClose}>
      <div className="gopd-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="gopd-modal-header">
          <div className="gopd-modal-title">Select Doctor</div>
          <button className="gopd-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="gopd-modal-body">
          <input ref={inputRef} className="gopd-modal-search" placeholder="Name / Code…" value={q} onChange={e => setQ(e.target.value)} />
          <table className="gopd-modal-table">
            <thead><tr><th>Code</th><th>Name</th></tr></thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="gopd-modal-row" onClick={() => onSelect(d)}>
                  <td>{d.code}</td>
                  <td>{d.name}</td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={2} className="gopd-modal-empty">No doctors found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentDoctorPerformanceFilter({ title = 'Departmental Performance' }) {
  const navigate = useNavigate();
  const { doctors, fetchDoctors } = useClinicStore();

  const [fromDate, setFromDate] = useState(firstOfMonthStr());
  const [toDate, setToDate] = useState(todayStr());
  const [fromDoctorCode, setFromDoctorCode] = useState('');
  const [toDoctorCode, setToDoctorCode] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [reportType, setReportType] = useState('summary');
  const [lookupTarget, setLookupTarget] = useState(null); // 'from' | 'to' | null

  useEffect(() => { if (doctors.length === 0) fetchDoctors().catch(() => {}); }, []);

  function handleDoctorSelect(doc) {
    if (lookupTarget === 'from') setFromDoctorCode(doc.code);
    else if (lookupTarget === 'to') setToDoctorCode(doc.code);
    setLookupTarget(null);
  }

  const handleOk = () => {
    const params = new URLSearchParams({ fromDate, toDate, reportType });
    if (fromDoctorCode) params.set('fromDoctorCode', fromDoctorCode);
    if (toDoctorCode)   params.set('toDoctorCode', toDoctorCode);
    if (activeOnly)     params.set('activeOnly', '1');
    navigate(`/clinic/reports/department-doctor-performance/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      {lookupTarget && (
        <DoctorLookupModal doctors={doctors} onSelect={handleDoctorSelect} onClose={() => setLookupTarget(null)} />
      )}

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — {title}</span>
            <span className="cwf-title-right">Department wise Doctor's Performance</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row cwf-row--right">
              <label className="cwf-chk-label">
                <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} />
                Active Consultants
              </label>
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
              <label className="cwf-lbl">Doctor</label>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">From</span>
                <input className="cwf-input ddp-code-input" value={fromDoctorCode} onChange={e => setFromDoctorCode(e.target.value)} placeholder="Code" />
                <button type="button" className="ddp-lookup-btn" onClick={() => setLookupTarget('from')}>…</button>
              </div>
              <div className="cwf-field-group">
                <span className="cwf-sub-lbl">To</span>
                <input className="cwf-input ddp-code-input" value={toDoctorCode} onChange={e => setToDoctorCode(e.target.value)} placeholder="Code" />
                <button type="button" className="ddp-lookup-btn" onClick={() => setLookupTarget('to')}>…</button>
              </div>
            </div>

            <div className="cwf-radios">
              {[['summary', 'Summary'], ['detail', 'Detail']].map(([v, l]) => (
                <label key={v} className="cwf-radio-label">
                  <input type="radio" name="reportType" value={v} checked={reportType === v} onChange={() => setReportType(v)} />
                  {l}
                </label>
              ))}
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
