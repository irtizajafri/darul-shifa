import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, DoorOpen, Save, Copy, RotateCcw, FileText, Printer, X, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import { useAuthStore } from '../../store/useAuthStore';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import './Admission.scss';
import './AdmissionAdjustment.scss';
import './BedShifting.scss';

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${day}-${month}-${year} ${time}`;
}

// ── Admission Lookup Modal — active/admitted patients only ────────────────────
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
          <span>Select Admitted Patient</span>
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

export default function BedShifting() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const shiftedBy = user?.name || user?.username || user?.email || '';
  const {
    roomCategories, fetchRoomCategories,
    beds, fetchBeds,
    searchAdmissionsForAdjustment,
    fetchAdmissionForAdjustment,
    fetchAvailableBeds,
    fetchBedShiftHistory,
    shiftAdmissionBed,
  } = useClinicStore();

  const [admission, setAdmission] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLookup, setShowLookup] = useState(true);

  const [newRoomCategoryId, setNewRoomCategoryId] = useState('');
  const [newBedId, setNewBedId] = useState('');
  const [newRoomBeds, setNewRoomBeds] = useState([]);

  useEffect(() => {
    fetchRoomCategories();
    fetchBeds();
  }, [fetchRoomCategories, fetchBeds]);

  // Deep-link from Bed parameter page (or anywhere else): ?admissionNo=... skips
  // the lookup and jumps straight to this admission's bed-shifting screen.
  useEffect(() => {
    const admissionNo = searchParams.get('admissionNo');
    if (!admissionNo) return;
    (async () => {
      try {
        const rows = await searchAdmissionsForAdjustment(admissionNo);
        const match = rows.find(r => r.admissionNo === admissionNo) || rows[0];
        if (match) await handleSelect(match);
      } catch { /* deep-link is best-effort */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function loadHistory(admissionId) {
    try { setHistory(await fetchBedShiftHistory(admissionId)); } catch { setHistory([]); }
  }

  async function handleSelect(row) {
    setLoading(true);
    setShowLookup(false);
    try {
      const rec = await fetchAdmissionForAdjustment(row.id);
      setAdmission(rec);
      setNewRoomCategoryId(rec.roomCategoryId != null ? String(rec.roomCategoryId) : '');
      setNewBedId('');
      if (rec.roomCategoryId) {
        try { setNewRoomBeds(await fetchAvailableBeds(rec.roomCategoryId, rec.id)); } catch { setNewRoomBeds([]); }
      } else {
        setNewRoomBeds([]);
      }
      await loadHistory(rec.id);
    } catch (e) {
      toast.error(e.message || 'Admission load nahi hui');
      setShowLookup(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleNewRoomChange(roomCategoryId) {
    setNewRoomCategoryId(roomCategoryId);
    setNewBedId('');
    if (!roomCategoryId) { setNewRoomBeds([]); return; }
    try {
      setNewRoomBeds(await fetchAvailableBeds(roomCategoryId, admission.id));
    } catch {
      setNewRoomBeds([]);
    }
  }

  function resetToLookup() {
    setAdmission(null);
    setHistory([]);
    setNewRoomCategoryId('');
    setNewBedId('');
    setNewRoomBeds([]);
    setShowLookup(true);
  }

  async function handleShift() {
    if (!newBedId) return toast.error('Naya Bed select karna zaroori hai');
    setSaving(true);
    try {
      const updated = await shiftAdmissionBed(admission.id, { newBedId, shiftedBy });
      toast.success('Bed shift ho gaya');
      setAdmission(updated);
      setNewRoomCategoryId(updated.roomCategoryId != null ? String(updated.roomCategoryId) : '');
      setNewBedId('');
      setNewRoomBeds(await fetchAvailableBeds(updated.roomCategoryId, updated.id));
      await loadHistory(updated.id);
    } catch (err) {
      toast.error(err.message || 'Bed shift nahi hua');
    } finally {
      setSaving(false);
    }
  }

  const currentRoomCategory = roomCategories.find(r => r.id === admission?.roomCategoryId);
  const currentBed = beds.find(b => b.id === admission?.bedId);

  return (
    <>
      {showLookup && (
        <AdmissionLookupModal
          onSelect={handleSelect}
          onClose={() => navigate(-1)}
          searchAdmissionsForAdjustment={searchAdmissionsForAdjustment}
        />
      )}

      <div className="adm-page">
        <ClinicMenuBar />

        <div className="aa-toolbar">
          <div className="aa-toolbar-icons">
            <span className="aa-tbtn aa-tbtn--disabled"><Save size={16} /></span>
            <span className="aa-tbtn aa-tbtn--disabled"><Copy size={16} /></span>
            <span className="aa-tbtn aa-tbtn--disabled"><RotateCcw size={16} /></span>
            <button className="aa-tbtn aa-tbtn--exit" onClick={() => navigate(-1)} title="Exit">
              <DoorOpen size={16} />
            </button>
            <span className="aa-tbtn aa-tbtn--disabled"><FileText size={16} /></span>
            <span className="aa-tbtn aa-tbtn--disabled"><Printer size={16} /></span>
          </div>
          <span className="aa-toolbar-title">Bed Shifting</span>
        </div>

        {loading && <div className="aa-loading">Loading…</div>}

        {!loading && admission && (
          <div className="bsh-body">
            <div className="bsh-card">
              <div className="bsh-patient-row">
                <span className="bsh-patient-name">{admission.patientTitle} {admission.patientName}</span>
                <span className="bsh-adm-no">Admission # {admission.admissionNo}</span>
              </div>

              <div className="bsh-transfer-row">
                <div className="bsh-bed-box bsh-bed-box--current">
                  <label>Current Ward / Bed</label>
                  <div className="bsh-bed-value">{currentRoomCategory?.name || '—'} / {currentBed?.name || '—'}</div>
                </div>

                <ArrowRight size={20} className="bsh-arrow" />

                <div className="bsh-bed-box">
                  <label>New Ward</label>
                  <select value={newRoomCategoryId} onChange={e => handleNewRoomChange(e.target.value)}>
                    <option value="">— Select Ward —</option>
                    {roomCategories.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="bsh-bed-box">
                  <label>New Bed</label>
                  <select value={newBedId} onChange={e => setNewBedId(e.target.value)} disabled={!newRoomCategoryId}>
                    <option value="">— Select Bed —</option>
                    {newRoomBeds.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {newRoomCategoryId && newRoomBeds.length === 0 && (
                    <span className="bsh-no-beds">No available beds</span>
                  )}
                </div>

                <button className="bsh-shift-btn" onClick={handleShift} disabled={saving || !newBedId}>
                  {saving ? 'Shifting…' : 'Shift'}
                </button>
              </div>
            </div>

            <div className="bsh-history-card">
              <div className="bsh-history-title">Shift History</div>
              <table className="bsh-history-tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>From Bed</th>
                    <th>To Bed</th>
                    <th>Shifted By</th>
                    <th>Shifted At</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={h.id}>
                      <td>{history.length - i}</td>
                      <td>{beds.find(b => b.id === h.fromBedId)?.name || '—'}</td>
                      <td>{beds.find(b => b.id === h.toBedId)?.name || '—'}</td>
                      <td>{h.shiftedBy || '—'}</td>
                      <td>{fmtDateTime(h.shiftedAt)}</td>
                    </tr>
                  ))}
                  {!history.length && (
                    <tr><td colSpan={5} className="bsh-history-empty">Abhi tak koi bed shift nahi hua</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="adm-actions">
              <button className="adm-btn" onClick={resetToLookup} disabled={saving}>
                Select Another Admission
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
