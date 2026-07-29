import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Save, Copy, RotateCcw, DoorOpen, FileText, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { useAuthStore } from '../../store/useAuthStore';
import './CancelSlip.scss';

const API = 'http://localhost:5001/api/clinic';

const REASONS = [
  'Wrong Entry',
  'Duplicate Slip',
  'Patient Left',
  'Payment Refunded',
  'Blood Donated',
  'Test Cancelled',
  'Other',
];

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${day}-${month}-${year} ${time}`;
}

function fmt2(n) { return Number(n || 0).toFixed(2); }

export default function CancelSlip() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Search (nothing loads until the user actually searches)
  const [searchTerm, setSearchTerm] = useState('');
  const [searching,  setSearching]  = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [todaySlips, setTodaySlips] = useState(null); // cached today's active slips
  const [results,    setResults]    = useState([]);

  // Selected slip
  const [visit,   setVisit]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const [slipCancel, setSlipCancel] = useState(false);
  const [reason,     setReason]     = useState('');
  const [note,       setNote]       = useState('');

  async function handleSearch() {
    setSearching(true);
    try {
      let list = todaySlips;
      if (!list) {
        const res  = await fetch(`${API}/opd/cancel/today-list`);
        const json = await res.json();
        list = json.data || [];
        setTodaySlips(list);
      }
      const term = searchTerm.trim().toLowerCase();
      const filtered = term
        ? list.filter(s => s.serialNo?.toLowerCase().includes(term) || s.patientName?.toLowerCase().includes(term))
        : list;
      setResults(filtered);
      setSearched(true);
    } catch {
      toast.error('Search fail hui');
    } finally {
      setSearching(false);
    }
  }

  async function handleSelect(row) {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/opd/cancel/${row.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Slip load nahi hui');
      setVisit(json.data);
    } catch (e) {
      toast.error(e.message || 'Error loading slip');
    } finally {
      setLoading(false);
    }
  }

  function handleReasonChange(val) {
    setReason(val);
    if (val !== 'Other') setNote(val);
    else setNote('');
  }

  function resetToSearch() {
    setVisit(null);
    setSlipCancel(false);
    setReason('');
    setNote('');
    setSearchTerm('');
    setSearched(false);
    setResults([]);
    setTodaySlips(null); // force a fresh fetch next time (list changes after a cancel)
  }

  async function handleSave() {
    if (!slipCancel) return toast.error('"Slip Cancel" checkbox tick karein');
    if (!reason)     return toast.error('Reason select karein');

    setSaving(true);
    try {
      const res = await fetch(`${API}/opd/cancel/${visit.id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          reason,
          note,
          cancelledBy: user?.name || user?.username || user?.email || '',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Cancel nahi ho saki');
      toast.success('Slip cancel ho gayi');
      resetToSearch();
    } catch (e) {
      toast.error(e.message || 'Error cancelling slip');
    } finally {
      setSaving(false);
    }
  }

  const totalAmount = visit?.totalAmount || 0;

  return (
    <div className="cnsl-page">
      <ClinicMenuBar />

      <div className="cnsl-toolbar">
        <div className="cnsl-toolbar-icons">
          <span className="cnsl-tbtn cnsl-tbtn--disabled"><Save size={16} /></span>
          <span className="cnsl-tbtn cnsl-tbtn--disabled"><Copy size={16} /></span>
          <span className="cnsl-tbtn cnsl-tbtn--disabled"><RotateCcw size={16} /></span>
          <button className="cnsl-tbtn cnsl-tbtn--exit" onClick={() => navigate(-1)} title="Exit">
            <DoorOpen size={16} />
          </button>
          <span className="cnsl-tbtn cnsl-tbtn--disabled"><FileText size={16} /></span>
          <span className="cnsl-tbtn cnsl-tbtn--disabled"><Printer size={16} /></span>
        </div>
        <span className="cnsl-toolbar-title">Cancel Slip</span>
      </div>

      <div className="cnsl-content">
        {!visit && (
          <>
            <div className="cnsl-search-row">
              <label>Serial #</label>
              <div className="cnsl-search-box">
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Serial # ya patient name likh kar search karein"
                />
                <button onClick={handleSearch} disabled={searching} title="Search">
                  <Search size={15} />
                </button>
              </div>
            </div>

            {searched && (
              <table className="cnsl-search-tbl">
                <thead>
                  <tr>
                    <th>Serial #</th>
                    <th>Patient</th>
                    <th>Department</th>
                    <th className="cnsl-td-r">Amount</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(s => (
                    <tr key={s.id} onClick={() => handleSelect(s)} className={s.status === 'cancelled' ? 'cnsl-row-cancelled' : ''}>
                      <td>{s.serialNo}</td>
                      <td>{s.patientName}</td>
                      <td>{s.department}</td>
                      <td className="cnsl-td-r">{fmt2(s.totalAmount)}</td>
                      <td>{fmtDateTime(s.createdAt)}</td>
                      <td>
                        <span className={`cnsl-status-badge cnsl-status-badge--${s.status === 'cancelled' ? 'cancelled' : 'active'}`}>
                          {s.status === 'cancelled' ? 'Cancelled' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!results.length && (
                    <tr>
                      <td colSpan={6} className="cnsl-td-empty">
                        Koi match nahi mila (aaj ki sab slips yahan aati hain)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </>
        )}

        {loading && <div className="cnsl-loading">Loading…</div>}

        {!loading && visit && (
          <div className="cnsl-form-card">
            <div className="cnsl-form-row">
              <label className="cnsl-label cnsl-label--serial">Serial #</label>
              <input className="cnsl-input cnsl-input--serial" value={visit.serialNo} readOnly />
              {visit.status === 'cancelled' && (
                <span className="cnsl-status-badge cnsl-status-badge--cancelled">Cancelled</span>
              )}
              <span className="cnsl-dept-badge">{(visit.department || '').toUpperCase()}</span>
            </div>

            <div className="cnsl-separator" />

            <div className="cnsl-form-row">
              <label className="cnsl-label">Date &amp; Time</label>
              <span className="cnsl-value">{fmtDateTime(visit.createdAt)}</span>
              <label className="cnsl-label cnsl-label--inline">Patient Name</label>
              <span className="cnsl-value">{visit.patientType} {visit.patientName}</span>
            </div>

            <div className="cnsl-form-row">
              <label className="cnsl-label">Age</label>
              <span className="cnsl-value">{visit.age ?? '—'}</span>
              <label className="cnsl-label cnsl-label--inline">Gender</label>
              <span className="cnsl-value cnsl-value--cap">{visit.gender}</span>
            </div>

            <div className="cnsl-form-row">
              <label className="cnsl-label">Phone #</label>
              <span className="cnsl-value">{visit.phoneNo || '—'}</span>
              <label className="cnsl-label cnsl-label--inline">Refered By</label>
              <span className="cnsl-value">{visit.referredBy || '—'}</span>
            </div>

            <div className="cnsl-separator" />

            <table className="cnsl-doc-tbl">
              <thead>
                <tr>
                  <th>Sub Dep.</th>
                  <th>Sub Department</th>
                  <th className="cnsl-td-r">Amount</th>
                  <th>Doctor</th>
                  <th>Doctor</th>
                </tr>
              </thead>
              <tbody>
                {(visit.doctors || []).map(d => (
                  <tr key={d.id}>
                    <td>{d.subDept?.code}</td>
                    <td>{d.subDept?.name}</td>
                    <td className="cnsl-td-r">{fmt2(d.amount)}</td>
                    <td>{d.doctor?.code}</td>
                    <td>{d.doctor?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="cnsl-separator" />

            {visit.status === 'cancelled' ? (
              <div className="cnsl-already-cancelled">
                <div className="cnsl-already-cancelled-title">Ye slip pehle se cancel ho chuki hai</div>
                <div className="cnsl-form-row">
                  <label className="cnsl-label">Reason</label>
                  <span className="cnsl-value">{visit.cancelReason || '—'}</span>
                </div>
                {visit.cancelNote && (
                  <div className="cnsl-form-row">
                    <label className="cnsl-label">Note</label>
                    <span className="cnsl-value">{visit.cancelNote}</span>
                  </div>
                )}
                <div className="cnsl-form-row">
                  <label className="cnsl-label">Cancelled By</label>
                  <span className="cnsl-value">{visit.cancelledBy || '—'}</span>
                  <label className="cnsl-label cnsl-label--inline">Cancelled At</label>
                  <span className="cnsl-value">{fmtDateTime(visit.cancelledAt)}</span>
                </div>
              </div>
            ) : (
              <>
                <div className="cnsl-cancel-box">
                  <label className="cnsl-checkbox-row">
                    <input type="checkbox" checked={slipCancel} onChange={e => setSlipCancel(e.target.checked)} />
                    <span>Slip Cancel</span>
                  </label>

                  <div className="cnsl-form-row">
                    <label className="cnsl-label">Reason</label>
                    <select className="cnsl-select" value={reason} onChange={e => handleReasonChange(e.target.value)}>
                      <option value="">— Select Reason —</option>
                      {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <textarea
                    className="cnsl-textarea"
                    placeholder="Reason detail…"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="cnsl-total-box">
                  <span className="cnsl-total-lbl">Total Amount</span>
                  <span className="cnsl-total-val">{fmt2(totalAmount)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {!loading && visit && (
          <div className="cnsl-footer">
            {visit.status !== 'cancelled' && (
              <button className="cnsl-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
            <button className="cnsl-close-btn" onClick={resetToSearch} disabled={saving}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
