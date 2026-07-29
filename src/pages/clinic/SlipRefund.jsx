import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Save, Copy, RotateCcw, DoorOpen, FileText, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { useAuthStore } from '../../store/useAuthStore';
import './SlipRefund.scss';

const API = 'http://localhost:5001/api/clinic';

const REASONS = [
  'Payment Refunded',
  'Wrong Charge',
  'Patient Complaint',
  'Test Not Done',
  'Duplicate Payment',
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

export default function SlipRefund() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Search — full list is accessible (no date restriction), but nothing loads
  // until the user actually searches.
  const [searchTerm, setSearchTerm] = useState('');
  const [searching,  setSearching]  = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [results,    setResults]    = useState([]);

  // Selected slip
  const [visit,   setVisit]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const [processRefund, setProcessRefund] = useState(false);
  const [amount,        setAmount]        = useState('');
  const [reason,        setReason]        = useState('');
  const [note,          setNote]          = useState('');

  async function handleSearch() {
    setSearching(true);
    try {
      const res  = await fetch(`${API}/opd/refund/search?q=${encodeURIComponent(searchTerm.trim())}`);
      const json = await res.json();
      setResults(json.data || []);
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
      const res  = await fetch(`${API}/opd/refund/${row.source}/${row.id}`);
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
    setProcessRefund(false);
    setAmount('');
    setReason('');
    setNote('');
    setSearchTerm('');
    setSearched(false);
    setResults([]);
  }

  const remaining = visit ? Number(visit.receive) - Number(visit.refund || 0) : 0;

  async function handleSave() {
    if (!processRefund) return toast.error('"Process Refund" checkbox tick karein');
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error('Refund amount (Rs) daalein');
    if (amt > remaining + 0.01) return toast.error(`Maximum ${fmt2(remaining)} refund ho sakta hai`);
    if (!reason) return toast.error('Reason select karein');

    setSaving(true);
    try {
      const res = await fetch(`${API}/opd/refund/${visit.source}/${visit.id}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          amount: amt,
          reason,
          note,
          refundedBy: user?.name || user?.username || user?.email || '',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Refund nahi ho saka');
      toast.success('Refund process ho gaya');
      resetToSearch();
    } catch (e) {
      toast.error(e.message || 'Error processing refund');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sref-page">
      <ClinicMenuBar />

      <div className="sref-toolbar">
        <div className="sref-toolbar-icons">
          <span className="sref-tbtn sref-tbtn--disabled"><Save size={16} /></span>
          <span className="sref-tbtn sref-tbtn--disabled"><Copy size={16} /></span>
          <span className="sref-tbtn sref-tbtn--disabled"><RotateCcw size={16} /></span>
          <button className="sref-tbtn sref-tbtn--exit" onClick={() => navigate(-1)} title="Exit">
            <DoorOpen size={16} />
          </button>
          <span className="sref-tbtn sref-tbtn--disabled"><FileText size={16} /></span>
          <span className="sref-tbtn sref-tbtn--disabled"><Printer size={16} /></span>
        </div>
        <span className="sref-toolbar-title">Slip Refund</span>
      </div>

      <div className="sref-content">
        {!visit && (
          <>
            <div className="sref-search-row">
              <label>Serial #</label>
              <div className="sref-search-box">
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
              <table className="sref-search-tbl">
                <thead>
                  <tr>
                    <th>Serial #</th>
                    <th>Patient</th>
                    <th>Department</th>
                    <th>Source</th>
                    <th className="sref-td-r">Received</th>
                    <th className="sref-td-r">Refunded</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(s => (
                    <tr key={`${s.source}_${s.id}`} onClick={() => handleSelect(s)}>
                      <td>{s.serialNo}</td>
                      <td>{s.patientName}</td>
                      <td>{s.department}</td>
                      <td>
                        <span className={`sref-src-badge sref-src-badge--${s.source}`}>
                          {s.source === 'opd' ? 'New System' : 'Patients List'}
                        </span>
                      </td>
                      <td className="sref-td-r">{fmt2(s.receive)}</td>
                      <td className="sref-td-r">{fmt2(s.refund)}</td>
                      <td>{fmtDateTime(s.createdAt)}</td>
                    </tr>
                  ))}
                  {!results.length && (
                    <tr>
                      <td colSpan={7} className="sref-td-empty">Koi match nahi mila</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </>
        )}

        {loading && <div className="sref-loading">Loading…</div>}

        {!loading && visit && (
          <div className="sref-form-card">
            <div className="sref-form-row">
              <label className="sref-label sref-label--serial">Serial #</label>
              <input className="sref-input sref-input--serial" value={visit.serialNo} readOnly />
              <span className={`sref-src-badge sref-src-badge--${visit.source}`}>
                {visit.source === 'opd' ? 'New System' : 'Patients List'}
              </span>
              <span className="sref-dept-badge">{(visit.department || '').toUpperCase()}</span>
            </div>

            <div className="sref-separator" />

            <div className="sref-form-row">
              <label className="sref-label">Date &amp; Time</label>
              <span className="sref-value">{fmtDateTime(visit.createdAt)}</span>
              <label className="sref-label sref-label--inline">Patient Name</label>
              <span className="sref-value">{visit.patientType} {visit.patientName}</span>
            </div>

            {visit.source === 'opd' && (
              <>
                <div className="sref-form-row">
                  <label className="sref-label">Age</label>
                  <span className="sref-value">{visit.age ?? '—'}</span>
                  <label className="sref-label sref-label--inline">Gender</label>
                  <span className="sref-value sref-value--cap">{visit.gender}</span>
                </div>
                <div className="sref-form-row">
                  <label className="sref-label">Phone #</label>
                  <span className="sref-value">{visit.phoneNo || '—'}</span>
                  <label className="sref-label sref-label--inline">Refered By</label>
                  <span className="sref-value">{visit.referredBy || '—'}</span>
                </div>
              </>
            )}

            <div className="sref-separator" />

            <table className="sref-doc-tbl">
              <thead>
                <tr>
                  <th>Sub Dep.</th>
                  <th>Sub Department</th>
                  <th className="sref-td-r">Amount</th>
                  <th>Doctor</th>
                  <th>Doctor</th>
                </tr>
              </thead>
              <tbody>
                {(visit.doctors || []).map(d => (
                  <tr key={d.id}>
                    <td>{d.subDept?.code}</td>
                    <td>{d.subDept?.name}</td>
                    <td className="sref-td-r">{fmt2(d.amount)}</td>
                    <td>{d.doctor?.code}</td>
                    <td>{d.doctor?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="sref-separator" />

            <div className="sref-amounts-row">
              <div className="sref-amt-box">
                <span className="sref-amt-lbl">Received</span>
                <span className="sref-amt-val">{fmt2(visit.receive)}</span>
              </div>
              <div className="sref-amt-box">
                <span className="sref-amt-lbl">Already Refunded</span>
                <span className="sref-amt-val">{fmt2(visit.refund)}</span>
              </div>
              <div className="sref-amt-box sref-amt-box--rem">
                <span className="sref-amt-lbl">Remaining Refundable</span>
                <span className="sref-amt-val">{fmt2(remaining)}</span>
              </div>
            </div>

            <div className="sref-refund-box">
              <label className="sref-checkbox-row">
                <input type="checkbox" checked={processRefund} onChange={e => setProcessRefund(e.target.checked)} />
                <span>Process Refund</span>
              </label>

              <div className="sref-form-row">
                <label className="sref-label">Rs</label>
                <input
                  className="sref-input sref-input--amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={remaining}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Refund amount"
                />
              </div>

              <div className="sref-form-row">
                <label className="sref-label">Reason</label>
                <select className="sref-select" value={reason} onChange={e => handleReasonChange(e.target.value)}>
                  <option value="">— Select Reason —</option>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <textarea
                className="sref-textarea"
                placeholder="Reason detail…"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        {!loading && visit && (
          <div className="sref-footer">
            <button className="sref-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="sref-close-btn" onClick={resetToSearch} disabled={saving}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
