import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, DoorOpen, Save, Copy, RotateCcw, FileText, Printer, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import { useAuthStore } from '../../store/useAuthStore';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import './Admission.scss';
import './AdmissionAdjustment.scss';
import './AdmissionStatusChange.scss';

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${day}-${month}-${year} ${time}`;
}

const FILE_STATUSES = [
  { value: 'active',    label: 'Admit' },
  { value: 'discharge', label: 'Discharge' },
  { value: 'closed',    label: 'Closed' },
  { value: 'wipeout',   label: 'Wipeout' },
];

const WIPEOUT_REASONS = [
  'Baby file not allowed',
  'Billing to other admission',
  'Cancelled file',
  'Cash Received',
  'Panel closed',
];

// ── Admission Lookup Modal — any status (active/discharge/closed), since
// changing a discharged/closed file's status (or wiping it out) is exactly
// what this page is for. Reuses the same status-agnostic search Provisional
// Bill uses — deliberately NOT searchAdmissionsForAdjustment, which stays
// active-only for the Admission Adjustment page that actually relies on it.
function AdmissionLookupModal({ onSelect, onClose, searchAdmissions }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    searchAdmissions('')
      .then((data) => setRows(data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [searchAdmissions]);

  function handleQueryChange(val) {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      searchAdmissions(val)
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

function Field({ label, value }) {
  return (
    <div className="asc-field">
      <label>{label}</label>
      <span className="asc-value">{value || value === 0 ? value : '—'}</span>
    </div>
  );
}

export default function AdmissionStatusChange() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const changedBy = user?.name || user?.username || user?.email || '';
  const {
    doctors, fetchDoctors,
    roomCategories, fetchRoomCategories,
    beds, fetchBeds,
    surgeryTypes, fetchSurgeryTypes,
    searchAdmissionsForProvisionalBill,
    fetchAdmissionForAdjustment,
    updateAdmissionStatus,
  } = useClinicStore();

  const [admission, setAdmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLookup, setShowLookup] = useState(true);
  const [fileStatus, setFileStatus] = useState('active');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchDoctors();
    fetchRoomCategories();
    fetchBeds();
    fetchSurgeryTypes();
  }, [fetchDoctors, fetchRoomCategories, fetchBeds, fetchSurgeryTypes]);

  async function handleSelect(row) {
    setLoading(true);
    setShowLookup(false);
    try {
      const rec = await fetchAdmissionForAdjustment(row.id);
      setAdmission(rec);
      setFileStatus(rec.status || 'active');
      setReason('');
    } catch (e) {
      toast.error(e.message || 'Admission load nahi hui');
      setShowLookup(true);
    } finally {
      setLoading(false);
    }
  }

  function resetToLookup() {
    setAdmission(null);
    setFileStatus('active');
    setReason('');
    setShowLookup(true);
  }

  async function handleSave() {
    if (fileStatus === 'wipeout' && !reason) return toast.error('Reason select karna zaroori hai');
    if (fileStatus !== 'wipeout' && fileStatus !== admission.status && !reason.trim()) {
      return toast.error('Reason likhna zaroori hai');
    }
    setSaving(true);
    try {
      await updateAdmissionStatus(admission.id, { status: fileStatus, reason, changedBy });
      if (fileStatus === 'wipeout') {
        toast.success('Admission wiped out — poori detail delete ho gayi');
        resetToLookup();
      } else {
        toast.success('File Status update ho gaya');
        setAdmission(a => ({ ...a, status: fileStatus }));
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  const consultant   = doctors.find(d => d.id === admission?.consultantId);
  const roomCategory = roomCategories.find(r => r.id === admission?.roomCategoryId);
  const bed          = beds.find(b => b.id === admission?.bedId);
  const surgeryType  = surgeryTypes.find(s => s.id === admission?.surgeryTypeId);

  return (
    <>
      {showLookup && (
        <AdmissionLookupModal
          onSelect={handleSelect}
          onClose={() => navigate(-1)}
          searchAdmissions={searchAdmissionsForProvisionalBill}
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
          <span className="aa-toolbar-title">Admission Status Change</span>
        </div>

        {loading && <div className="aa-loading">Loading…</div>}

        {!loading && admission && (
          <div className="asc-body">
            <div className="asc-card">
              <div className="asc-section-title">Identification</div>
              <div className="asc-row">
                <Field label="Serial #" value={admission.serialNo} />
                <Field label="Admission #" value={admission.admissionNo} />
                <Field label="MR #" value={admission.mrNo} />
                <Field label="Arrived Slip #" value={admission.arrivedSlipNo} />
              </div>

              <div className="asc-section-title">Patient &amp; Admission Details</div>
              <div className="asc-row">
                <Field label="Patient Name" value={`${admission.patientTitle} ${admission.patientName}`} />
                <Field label="Category" value={admission.patientCategory} />
                <Field label="Age" value={`${admission.ageYears}y ${admission.ageMonths}m ${admission.ageDays}d`} />
                <Field label="Gender" value={admission.gender} />
              </div>
              <div className="asc-row">
                <Field label="Address" value={admission.address} />
                <Field label="Phone #" value={admission.phoneNo} />
                <Field label="Ward (Room Category)" value={roomCategory?.name} />
                <Field label="Bed #" value={bed?.name} />
              </div>
              <div className="asc-row">
                <Field label="Consultant" value={consultant?.name} />
                <Field label="Admission Date &amp; Time" value={fmtDateTime(admission.createdAt)} />
              </div>

              <div className="asc-section-title">Referral &amp; Care Team</div>
              <div className="asc-row">
                <Field label="Arrived under RMO" value={admission.arrivedUnderRmo} />
                <Field label="Referred By" value={admission.referredBy} />
              </div>

              <div className="asc-section-title">Billing &amp; Authorization</div>
              <div className="asc-row">
                <Field label="Responsible Party" value={admission.responsibleParty} />
                <Field label="Authority Letter" value={admission.authorityLetter ? 'Yes' : 'No'} />
                <Field label="Previous Admission" value={admission.previousAdmission} />
                <Field label="Advance Payment" value={admission.advancePayment != null ? Number(admission.advancePayment).toFixed(2) : ''} />
              </div>

              <div className="asc-section-title">Additional Flags</div>
              <div className="asc-row">
                <Field label="Surgery" value={admission.surgery ? (surgeryType?.name || 'Yes') : 'No'} />
                <Field label="Referral Patient" value={admission.referralPatient ? (admission.referralNote || 'Yes') : 'No'} />
                <Field label="Antenatal #" value={admission.antenatal ? admission.antenatalNo : 'No'} />
              </div>

              <div className="asc-separator" />

              <div className="asc-status-row">
                <label className="asc-status-label">File Status</label>
                <select className="asc-status-select" value={fileStatus} onChange={e => { setFileStatus(e.target.value); setReason(''); }}>
                  {FILE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>

                {fileStatus === 'wipeout' && (
                  <>
                    <label className="asc-status-label asc-status-label--reason">Reason</label>
                    <select className="asc-status-select" value={reason} onChange={e => setReason(e.target.value)}>
                      <option value="">— Select Reason —</option>
                      {WIPEOUT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </>
                )}

                {/* Any other real status change also needs a reason on record
                    (see Reports > Status Change History) — wipeout keeps its
                    own fixed dropdown above, everything else is free text
                    since "why was this re-admitted" etc. varies too much for
                    a preset list. */}
                {fileStatus !== 'wipeout' && fileStatus !== admission.status && (
                  <>
                    <label className="asc-status-label asc-status-label--reason">Reason</label>
                    <input
                      className="asc-status-select"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Status kyun badla ja raha hai…"
                    />
                  </>
                )}
              </div>

              {fileStatus === 'wipeout' && (
                <div className="asc-wipeout-warning">
                  Wipeout is se yeh admission ki poori detail permanently delete ho jayegi. Sirf report mein snapshot reh jayega.
                </div>
              )}
            </div>

            <div className="adm-actions">
              <button className="adm-btn adm-btn--save" onClick={handleSave} disabled={saving}>
                <Save size={16} />
                {saving ? 'Saving...' : 'Save'}
              </button>
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
