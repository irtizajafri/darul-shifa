import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicStore } from '../../../store/useClinicStore';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import '../GeneralOPD.scss';
import './ConsultantWiseFilter.scss';
import './DepartmentDoctorPerformanceFilter.scss';

const API_USERS = 'http://localhost:5001/api/users';
const todayStr = () => new Date().toISOString().split('T')[0];

function UserLookupModal({ onSelect, onClose }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch(API_USERS).then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : (d.data || []))).catch(() => {});
  }, []);

  const filtered = q.trim()
    ? users.filter(u => u.name?.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase()))
    : users;

  return (
    <div className="gopd-modal-overlay" onMouseDown={onClose}>
      <div className="gopd-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="gopd-modal-header">
          <div className="gopd-modal-title">Select User</div>
          <button className="gopd-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="gopd-modal-body">
          <input ref={inputRef} className="gopd-modal-search" placeholder="Name / Email…" value={q} onChange={e => setQ(e.target.value)} />
          <table className="gopd-modal-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="gopd-modal-row" onClick={() => onSelect(u)}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={3} className="gopd-modal-empty">No users found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function UserDateSummaryFilter() {
  const navigate = useNavigate();
  const { shifts, fetchShifts } = useClinicStore();

  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [date, setDate] = useState(todayStr());
  const [shift, setShift] = useState('ALL');
  const [showLookup, setShowLookup] = useState(false);

  useEffect(() => { if (shifts.length === 0) fetchShifts().catch(() => {}); }, []);

  function handleSelect(u) {
    setUserId(u.id);
    setUserName(u.name);
    setShowLookup(false);
  }

  const handleOk = () => {
    if (!userId) return;
    const params = new URLSearchParams({ userId, date, shift });
    navigate(`/clinic/reports/user-date-summary/view?${params}`);
  };

  return (
    <div className="cwf-page">
      <ClinicMenuBar />

      {showLookup && <UserLookupModal onSelect={handleSelect} onClose={() => setShowLookup(false)} />}

      <div className="cwf-center">
        <div className="cwf-window">
          <div className="cwf-titlebar">
            <span className="cwf-title-left">Reports — Date wise Summary</span>
            <span className="cwf-title-right">Date wise Summary</span>
          </div>

          <div className="cwf-body">
            <div className="cwf-row">
              <label className="cwf-lbl">User ID</label>
              <div className="cwf-field-group">
                <input className="cwf-input" style={{ width: 200 }} value={userName} readOnly placeholder="Select user…" />
                <button type="button" className="ddp-lookup-btn" onClick={() => setShowLookup(true)}>…</button>
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Date</label>
              <div className="cwf-field-group">
                <input type="date" className="cwf-input" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>

            <div className="cwf-row">
              <label className="cwf-lbl">Shift</label>
              <div className="cwf-field-group">
                <select className="cwf-input" value={shift} onChange={e => setShift(e.target.value)}>
                  <option value="ALL">ALL</option>
                  {shifts.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
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
