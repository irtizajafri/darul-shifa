import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Save, Copy, RotateCcw, DoorOpen, FileText, Printer, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import './SlipAdjustment.scss';
import './AdmissionAdjustment.scss';
import './SlipTransfer.scss';

const API = 'http://localhost:5001/api/clinic';

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

// ── Admission Lookup Modal — pick the correct admission to transfer this slip to ─
function AdmissionLookupModal({ onSelect, onClose, searchAdmissionsForAdjustment }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    searchAdmissionsForAdjustment('')
      .then((data) => setRows(data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [searchAdmissionsForAdjustment]);

  function handleQueryChange(val) {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      searchAdmissionsForAdjustment(val)
        .then((data) => setRows(data || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 300);
  }

  return (
    <div className="aa-overlay">
      <div className="aa-modal">
        <div className="aa-modal-hdr">
          <span>Select Correct Admission</span>
          <button className="aa-modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="aa-modal-search">
          <Search size={13} className="aa-modal-search-icon" />
          <input
            autoFocus
            className="aa-modal-search-input"
            placeholder="Search Admission # or Patient Name…"
            value={q}
            onChange={e => handleQueryChange(e.target.value)}
          />
        </div>
        <div className="aa-modal-body">
          {loading ? (
            <div className="aa-modal-loading">Loading…</div>
          ) : (
            <table className="aa-modal-tbl">
              <thead>
                <tr>
                  <th>Admission #</th>
                  <th>Patient</th>
                  <th>Admission Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} onClick={() => onSelect(r)}>
                    <td>{r.admissionNo}</td>
                    <td>{r.patientName}</td>
                    <td>{fmtDateTime(r.createdAt)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={3} className="aa-td-empty">Koi admit patient nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SlipTransfer() {
  const navigate = useNavigate();
  const { searchAdmissionsForAdjustment } = useClinicStore();

  // Search — by Slip # or patient name (never by Admission #)
  const [searchTerm, setSearchTerm] = useState('');
  const [searching,  setSearching]  = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [results,    setResults]    = useState([]);

  const [visit,   setVisit]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [newAdmitNo, setNewAdmitNo] = useState('');
  const [showLookup, setShowLookup] = useState(false);

  async function handleSearch() {
    setSearching(true);
    try {
      const res  = await fetch(`${API}/opd/slip-transfer/search?q=${encodeURIComponent(searchTerm.trim())}`);
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
      const res  = await fetch(`${API}/opd/slip-transfer/${row.source}/${row.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Slip load nahi hui');
      setVisit(json.data);
      setNewAdmitNo(json.data.admitNo || '');
    } catch (e) {
      toast.error(e.message || 'Error loading slip');
    } finally {
      setLoading(false);
    }
  }

  function resetToSearch() {
    setVisit(null);
    setNewAdmitNo('');
    setSearchTerm('');
    setSearched(false);
    setResults([]);
  }

  async function handleTransfer() {
    setSaving(true);
    try {
      const res = await fetch(`${API}/opd/slip-transfer/${visit.source}/${visit.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ admitNo: newAdmitNo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Transfer nahi ho saka');
      toast.success(newAdmitNo ? 'Slip transfer ho gayi' : 'Admission link hata di gayi');
      setVisit(v => ({ ...v, admitNo: newAdmitNo || null }));
    } catch (e) {
      toast.error(e.message || 'Error transferring slip');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sadj-page">
      <ClinicMenuBar />

      {showLookup && (
        <AdmissionLookupModal
          searchAdmissionsForAdjustment={searchAdmissionsForAdjustment}
          onSelect={(row) => { setNewAdmitNo(row.admissionNo); setShowLookup(false); }}
          onClose={() => setShowLookup(false)}
        />
      )}

      <div className="sadj-toolbar">
        <div className="sadj-toolbar-icons">
          <span className="sadj-tbtn sadj-tbtn--disabled"><Save size={16} /></span>
          <span className="sadj-tbtn sadj-tbtn--disabled"><Copy size={16} /></span>
          <span className="sadj-tbtn sadj-tbtn--disabled"><RotateCcw size={16} /></span>
          <button className="sadj-tbtn sadj-tbtn--exit" onClick={() => navigate(-1)} title="Exit">
            <DoorOpen size={16} />
          </button>
          <span className="sadj-tbtn sadj-tbtn--disabled"><FileText size={16} /></span>
          <span className="sadj-tbtn sadj-tbtn--disabled"><Printer size={16} /></span>
        </div>
        <span className="sadj-toolbar-title">Slip Transfer</span>
      </div>

      <div className="sadj-content">
        {!visit && (
          <>
            <div className="sadj-search-row">
              <label>Slip #</label>
              <div className="sadj-search-box">
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Slip # (Serial #) ya patient name likh kar search karein"
                />
                <button onClick={handleSearch} disabled={searching} title="Search">
                  <Search size={15} />
                </button>
              </div>
            </div>

            {searched && (
              <table className="sadj-search-tbl">
                <thead>
                  <tr>
                    <th>Serial #</th>
                    <th>Patient</th>
                    <th>Department</th>
                    <th>Source</th>
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
                        <span className={`sadj-src-badge sadj-src-badge--${s.source}`}>
                          {s.source === 'opd' ? 'New System' : 'Patients List'}
                        </span>
                      </td>
                      <td>{fmtDateTime(s.createdAt)}</td>
                    </tr>
                  ))}
                  {!results.length && (
                    <tr>
                      <td colSpan={5} className="sadj-td-empty">Koi match nahi mila</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </>
        )}

        {loading && <div className="sadj-loading">Loading…</div>}

        {!loading && visit && (
          <div className="sadj-form-card">
            <div className="sadj-form-row">
              <label className="sadj-label sadj-label--serial">Serial #</label>
              <input className="sadj-input sadj-input--serial" value={visit.serialNo} readOnly />
              <span className={`sadj-src-badge sadj-src-badge--${visit.source}`}>
                {visit.source === 'opd' ? 'New System' : 'Patients List'}
              </span>
              <span className="sadj-dept-badge">{(visit.department || '').toUpperCase()}</span>
            </div>

            <div className="sadj-separator" />

            <div className="sadj-form-row">
              <label className="sadj-label">Date &amp; Time</label>
              <span className="sadj-value">{fmtDateTime(visit.createdAt)}</span>
              <label className="sadj-label sadj-label--inline">Patient Name</label>
              <span className="sadj-value">{visit.patientType} {visit.patientName}</span>
            </div>

            <div className="sadj-separator" />

            <div className="sadj-readonly-note">Sirf Admission # yahan transfer ho sakta hai — patient info, department, doctor aur amount edit nahi hote.</div>

            <div className="st-transfer-row">
              <div className="st-transfer-field">
                <label>Current Admission #</label>
                <div className="st-current-value">{visit.admitNo || '— Koi link nahi —'}</div>
              </div>
              <div className="st-transfer-field">
                <label>Correct Admission #</label>
                <div className="st-transfer-input-wrap">
                  <input
                    value={newAdmitNo}
                    readOnly
                    placeholder="Select admission…"
                  />
                  <button onClick={() => setShowLookup(true)} title="Select admitted patient">
                    <Search size={13} />
                  </button>
                  {newAdmitNo && (
                    <button className="st-clear-btn" onClick={() => setNewAdmitNo('')} title="Remove link">✕</button>
                  )}
                </div>
              </div>
            </div>

            <table className="sadj-doc-tbl">
              <thead>
                <tr>
                  <th>Sub Dep.</th>
                  <th>Sub Department</th>
                  <th className="sadj-td-r">Amount</th>
                  <th>Doctor</th>
                  <th>Doctor</th>
                </tr>
              </thead>
              <tbody>
                {(visit.doctors || []).map(d => (
                  <tr key={d.id}>
                    <td>{d.subDept?.code}</td>
                    <td>{d.subDept?.name}</td>
                    <td className="sadj-td-r">{fmt2(d.amount)}</td>
                    <td>{d.doctor?.code}</td>
                    <td>{d.doctor?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && visit && (
          <div className="sadj-footer">
            <button className="sadj-save-btn" onClick={handleTransfer} disabled={saving}>
              {saving ? 'Transferring…' : 'Transfer'}
            </button>
            <button className="sadj-close-btn" onClick={resetToSearch} disabled={saving}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
