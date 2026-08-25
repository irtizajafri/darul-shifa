import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { useAuthStore } from '../../store/useAuthStore';
import { useClinicStore } from '../../store/useClinicStore';
import './DiscountRefundAdmission.scss';

const API = 'http://localhost:5001/api/clinic';

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${day}/${month}/${year} ${time}`;
}

function fmt2(n) { return Number(n || 0).toFixed(2); }

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-GB', { month: 'short' })}-${dt.getFullYear()}`;
}

const REASON_OPTIONS = [
  { value: 'treated', label: 'Patient Treated' },
  { value: 'transfer', label: 'Patient Transfer' },
  { value: 'lama', label: 'LAMA' },
  { value: 'expired', label: 'Patient Expired' },
  { value: 'discharge_on_request', label: 'Discharge on Request' },
];
const REASON_LABELS = Object.fromEntries(REASON_OPTIONS.map(r => [r.value, r.label]));
const DISCHARGE_MED_LINES = Array.from({ length: 8 });

// `@page` is a document-level rule shared across the whole bundled app — inject
// an override right before printing so this page's print isn't silently
// overridden by whichever other page's `@page` rule happens to load last.
function printDischargeCertificate() {
  const styleId = 'dc-page-size-override';
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  // Prints on pre-printed hospital letterhead — top margin left generous on
  // purpose so the certificate content starts below the letterhead artwork
  // instead of overlapping it.
  style.textContent = '@page { size: A5 portrait !important; margin: 40mm 9mm 8mm 9mm !important; }';

  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000);

  window.print();
}

// ── Admission Lookup Modal ─────────────────────────────────────────────────────
function AdmissionLookupModal({ onSelect, onClose, closedFilesOnly }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const timer = useRef(null);

  // The backend endpoint only ever returns the most recent 100 admissions
  // (by id) — fine as an initial "browse recent" list, but a text search
  // must re-query the server with the typed term, or an older admission
  // (very common once it's discharged/closed, not just-created) would never
  // even be fetched to filter through, regardless of the checkbox/search text.
  function runSearch(term) {
    return fetch(`${API}/admission/receiving/search?q=${encodeURIComponent(term)}`)
      .then(r => r.json())
      .then(res => setRows(res.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { runSearch(''); }, []);

  function handleQueryChange(val) {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setLoading(true); runSearch(val); }, 300);
  }

  const filtered = rows.filter(r =>
    closedFilesOnly ? (r.status === 'discharge' || r.status === 'closed') : r.status === 'active'
  );

  return (
    <div className="dra-overlay">
      <div className="dra-modal">
        <div className="dra-modal-hdr">
          <span>{closedFilesOnly ? 'Select Discharged / Closed File' : 'Select Admission'}</span>
          <button className="dra-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="dra-modal-search">
          <Search size={13} className="dra-modal-search-icon" />
          <input
            autoFocus
            className="dra-modal-search-input"
            placeholder="Search Admission # or Patient Name…"
            value={q}
            onChange={e => handleQueryChange(e.target.value)}
          />
        </div>
        <div className="dra-modal-body">
          {loading ? (
            <div className="dra-modal-loading">Loading…</div>
          ) : (
            <table className="dra-modal-tbl">
              <thead>
                <tr>
                  <th>Admission #</th>
                  <th>Patient</th>
                  <th>Admission Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} onClick={() => onSelect(r)}>
                    <td>{r.admissionNo}</td>
                    <td>{r.patientName}</td>
                    <td>{fmtDateTime(r.createdAt)}</td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={3} className="dra-td-empty">{closedFilesOnly ? 'Koi discharged/closed file nahi mili' : 'Koi admission nahi mila'}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Discharge Certificate Modal ─────────────────────────────────────────────────
function DischargeCertificateModal({ header, form, onChange, onClose, onSave, saving, diagnosisOptions }) {
  const { admission, roomCategory, bed, consultant } = header;
  return (
    <div className="dra-overlay">
      <div className="dra-modal dc-modal">
        <div className="dra-modal-hdr">
          <span>Discharge Certificate — {admission.admissionNo}</span>
          <button className="dra-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="dc-modal-body">
          <div className="dc-modal-info">
            {admission.patientTitle} {admission.patientName} · {roomCategory?.name || '—'} / {bed?.name || '—'} · Consultant: {consultant?.name || '—'}
          </div>

          <div className="dc-modal-row">
            <label>Reason of Discharge *</label>
            <select value={form.reasonOfDischarge} onChange={e => onChange('reasonOfDischarge', e.target.value)}>
              <option value="">Select…</option>
              {REASON_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div className="dc-modal-row">
            <label>Diagnosis</label>
            <select value={form.diagnosis} onChange={e => onChange('diagnosis', e.target.value)}>
              <option value="">Select…</option>
              {diagnosisOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <div className="dc-modal-row dc-modal-row--split">
            <div className="dc-modal-col">
              <label>Further Treatment Needed</label>
              <div className="dc-modal-yn">
                <label><input type="radio" name="dc-ftn" checked={form.furtherTreatmentNeeded === 'yes'} onChange={() => onChange('furtherTreatmentNeeded', 'yes')} /> Yes</label>
                <label><input type="radio" name="dc-ftn" checked={form.furtherTreatmentNeeded === 'no'} onChange={() => onChange('furtherTreatmentNeeded', 'no')} /> No</label>
              </div>
            </div>
            <div className="dc-modal-col">
              <label>Medicine Prescribed</label>
              <div className="dc-modal-yn">
                <label><input type="radio" name="dc-mp" checked={form.medicinePrescribed === 'yes'} onChange={() => onChange('medicinePrescribed', 'yes')} /> Yes</label>
                <label><input type="radio" name="dc-mp" checked={form.medicinePrescribed === 'no'} onChange={() => onChange('medicinePrescribed', 'no')} /> No</label>
              </div>
            </div>
          </div>

          <div className="dc-modal-row dc-modal-row--split">
            <div className="dc-modal-col">
              <label>Follow Up</label>
              <input value={form.followUp} onChange={e => onChange('followUp', e.target.value)} />
            </div>
            <div className="dc-modal-col">
              <label>Medical Officer</label>
              <input value={form.medicalOfficer} onChange={e => onChange('medicalOfficer', e.target.value)} />
            </div>
          </div>
        </div>
        <div className="dc-modal-footer">
          <button className="dra-add-btn" onClick={onSave} disabled={saving}>Save &amp; Print</button>
        </div>
      </div>
    </div>
  );
}

// ── Discharge Certificate Print Template ────────────────────────────────────────
// Sample hand-written duplicate bill used bordered boxes for every field; this
// print instead fills each label with an underline — data is already
// system-typed, so a "write here" box no longer serves a purpose.
function DischargeCertificatePrintTemplate({ data }) {
  if (!data) return null;
  const { admission, roomCategory, bed, consultant, certificate, printedBy } = data;
  const ageStr = [
    admission.ageYears ? `${admission.ageYears}y` : null,
    admission.ageMonths ? `${admission.ageMonths}m` : null,
    admission.ageDays ? `${admission.ageDays}d` : null,
  ].filter(Boolean).join(' ') || '—';

  return (
    <div className="dc-print">
      <div className="dc-print-title">DISCHARGE CERTIFICATE</div>

      <div className="dc-print-row">
        <span className="dc-print-field dc-print-field--wide"><label>Printed by:</label><span className="dc-print-line">{printedBy}</span></span>
        <span className="dc-print-field"><label>Status:</label><span className="dc-print-line">{admission.status}</span></span>
        <span className="dc-print-field"><label>File #</label><span className="dc-print-line">{admission.admissionNo}</span></span>
      </div>

      <div className="dc-print-row">
        <span className="dc-print-field dc-print-field--full"><label>Pat. Name:</label><span className="dc-print-line">{admission.patientTitle} {admission.patientName}</span></span>
      </div>

      <div className="dc-print-row">
        <span className="dc-print-field"><label>Age:</label><span className="dc-print-line">{ageStr}</span></span>
        <span className="dc-print-field"><label>Gender:</label><span className="dc-print-line">{admission.gender}</span></span>
      </div>

      <div className="dc-print-row">
        <span className="dc-print-field"><label>Room:</label><span className="dc-print-line">{roomCategory?.name || '—'}</span></span>
        <span className="dc-print-field"><label>Bed:</label><span className="dc-print-line">{bed?.name || '—'}</span></span>
      </div>

      <div className="dc-print-row">
        <span className="dc-print-field dc-print-field--wide"><label>Consultant:</label><span className="dc-print-line">{consultant?.name || '—'}</span></span>
        <span className="dc-print-field"><label>Ad Date:</label><span className="dc-print-line">{fmtDate(admission.createdAt)}</span></span>
        <span className="dc-print-field"><label>Di Date:</label><span className="dc-print-line">{fmtDate(certificate?.dischargeDate)}</span></span>
      </div>

      <div className="dc-print-row">
        <span className="dc-print-field dc-print-field--full"><label>Diagnosis:</label><span className="dc-print-line">{certificate?.diagnosis || ''}</span></span>
      </div>

      <div className="dc-print-reason">
        <label>Reason of Discharge:</label>
        <span className="dc-print-reason-val">{REASON_LABELS[certificate?.reasonOfDischarge] || '—'}</span>
      </div>

      <div className="dc-print-yn-row">
        <label>Further Treatment Needed:</label>
        <span className="dc-print-yn"><i className={`dc-print-box${certificate?.furtherTreatmentNeeded === 'yes' ? ' checked' : ''}`} />Yes</span>
        <span className="dc-print-yn"><i className={`dc-print-box${certificate?.furtherTreatmentNeeded === 'no' ? ' checked' : ''}`} />No</span>
      </div>
      <div className="dc-print-yn-row">
        <label>Medicine prescribed:</label>
        <span className="dc-print-yn"><i className={`dc-print-box${certificate?.medicinePrescribed === 'yes' ? ' checked' : ''}`} />Yes</span>
        <span className="dc-print-yn"><i className={`dc-print-box${certificate?.medicinePrescribed === 'no' ? ' checked' : ''}`} />No</span>
      </div>

      <div className="dc-print-med-block">
        <div className="dc-print-med-hdr">Discharge Medicine</div>
        {/* Left blank on purpose — the doctor fills this in by hand on the
            printed copy, so it's just a ruled box, no data-bound text. Real
            bordered line elements instead of a CSS background pattern — a
            background-image silently disappears unless the browser's print
            dialog has "Background graphics" checked, borders always print. */}
        <div className="dc-print-med-body">
          {DISCHARGE_MED_LINES.map((_, i) => <div key={i} className="dc-print-med-line" />)}
        </div>
      </div>

      <div className="dc-print-row">
        <span className="dc-print-field dc-print-field--full"><label>Follow Up:</label><span className="dc-print-line">{certificate?.followUp || ''}</span></span>
      </div>

      <div className="dc-print-sig">
        <span>Medical Officer:</span>
        <span className="dc-print-sig-line">{certificate?.medicalOfficer || ''}</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DiscountRefundAdmission() {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const { diseases, fetchDiseases, surgeryTypes, fetchSurgeryTypes } = useClinicStore();

  useEffect(() => {
    fetchDiseases();
    fetchSurgeryTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Diagnosis dropdown mixes both parameter lists (Diseases + Surgery Types)
  // into one flat, de-duplicated, alphabetical list — per the user's request
  // these open "mixed together", not grouped by source.
  const diagnosisOptions = useMemo(() => {
    const names = new Set([...diseases.map(d => d.name), ...surgeryTypes.map(s => s.name)]);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [diseases, surgeryTypes]);

  const [showLookup, setShowLookup] = useState(false);
  // Default lookup only shows active (not-yet-discharged) admissions — for
  // creating a fresh Discharge Certificate. Checking "Closed Files" switches
  // the lookup to already-processed admissions (discharge or closed status)
  // instead, e.g. to review/reprint an existing certificate.
  const [closedFilesOnly, setClosedFilesOnly] = useState(false);
  const [admission, setAdmission] = useState(null);
  const [billAmount, setBillAmount] = useState(0);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [history, setHistory] = useState([]);

  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState('amount');
  const [permissionBy, setPermissionBy] = useState('');
  const [refundOverride, setRefundOverride] = useState('');
  const [saving, setSaving] = useState(false);

  const [dcOpen, setDcOpen] = useState(false);
  const [dcHeader, setDcHeader] = useState(null);
  const [dcForm, setDcForm] = useState(null);
  const [dcSaving, setDcSaving] = useState(false);
  const [dcPrintData, setDcPrintData] = useState(null);

  const discountAmt = discountType === 'percent'
    ? Math.round((billAmount * (Number(discount) || 0)) / 100)
    : (Number(discount) || 0);
  // What the patient still owes after discount, ignoring payments — this is
  // what "refund due" is measured against below, not what's shown as the
  // Net Balance figure (that also has to account for what's already received).
  const netBillAmount = Math.max(0, billAmount - discountAmt);
  // Net Balance shown to the user must reflect payments already received too
  // — Bill Amount minus Discount minus Received Amount — not just Bill minus
  // Discount, which previously ignored Received Amount entirely.
  const netBalance = Math.max(0, netBillAmount - receivedAmount);
  const autoRefundAmt = Math.max(0, receivedAmount - netBillAmount);
  // Refund can be auto-computed (received exceeds what's owed) or manually
  // typed by staff (e.g. refunding part/all of Received Amount for reasons
  // unrelated to the discount math) — manual entry wins when present.
  const refundAmt = refundOverride !== '' ? (Number(refundOverride) || 0) : autoRefundAmt;

  // Discount/Refund history is saved as independent entries, but only the
  // LATEST one is ever the currently-active discount (see addAdmissionDiscountRefund
  // comment) — so whenever an admission is (re)loaded, the Discount field must be
  // pre-filled from that latest entry. Otherwise it always starts blank, Net
  // Balance recomputes as if no discount had ever been given, and a discount
  // that was genuinely saved earlier looks like it "didn't apply" on reload.
  async function loadAdmissionByNo(admissionNo) {
    const res = await fetch(`${API}/admission/discount-refund/by-number/${encodeURIComponent(admissionNo)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Load failed');
    const latest = (json.data.history || [])[0] || null;
    setAdmission(json.data.admission);
    setBillAmount(json.data.billAmount || 0);
    setReceivedAmount(json.data.receivedAmount || 0);
    setHistory(json.data.history || []);
    // discountAmount is always stored as the already-resolved rupee value
    // (percent entries get converted before saving), so it's always safe to
    // pre-fill back in as a plain "amount" regardless of how it was entered.
    setDiscount(latest ? String(latest.discountAmount || '') : '');
    setDiscountType('amount');
    setPermissionBy('');
    setRefundOverride('');
    setDcHeader(null);
    setDcForm(null);
    return json.data;
  }

  async function handleSelect(row) {
    setShowLookup(false);
    try {
      await loadAdmissionByNo(row.admissionNo);
    } catch (e) {
      toast.error(e.message || 'Admission load nahi hui');
    }
  }

  async function handleAdd() {
    if (!admission) { toast.error('Pehle admission select karein'); return; }
    if (discountAmt <= 0 && refundAmt <= 0) { toast.error('Discount ya Refund amount daalein'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admission/discount-refund/${admission.id}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billAmount,
          receivedAmount,
          discountAmount: discountAmt,
          discountType,
          permissionBy,
          netBalance,
          refundAmount: refundAmt,
          createdByUserId: user?.id != null ? String(user.id) : null,
          createdByName: user?.name || user?.username || user?.email || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Save nahi hui');
      toast.success('Discount/Refund save ho gaya');
      // Reload the same admission (not resetForm/blank) so Net Balance and
      // history immediately reflect the discount that was just saved.
      await loadAdmissionByNo(admission.admissionNo);
    } catch (e) {
      toast.error(e.message || 'Error saving');
    } finally {
      setSaving(false);
    }
  }

  async function openDischargeCertificate() {
    if (!admission) return;
    try {
      const res = await fetch(`${API}/admission/discharge-certificate/${admission.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Load failed');
      const { certificate, ...header } = json.data;
      setDcHeader(header);
      setDcForm({
        reasonOfDischarge: certificate?.reasonOfDischarge || '',
        diagnosis: certificate?.diagnosis || '',
        furtherTreatmentNeeded: certificate?.furtherTreatmentNeeded || '',
        medicinePrescribed: certificate?.medicinePrescribed || '',
        followUp: certificate?.followUp || '',
        medicalOfficer: certificate?.medicalOfficer || '',
      });
      setDcOpen(true);
    } catch (e) {
      toast.error(e.message || 'Discharge Certificate load nahi hui');
    }
  }

  function updateDcForm(field, value) {
    setDcForm(f => ({ ...f, [field]: value }));
  }

  // Reports > Reprint > Discharge Certificate lands here with
  // ?admissionNo=X&autoprint=1 — load that admission the same way Search does,
  // then print the already-saved certificate straight away. If none was ever
  // saved for this admission, fall back to the normal create form instead of
  // printing a blank page.
  async function handleReprintCertificate(no) {
    try {
      const data = await loadAdmissionByNo(no);

      const certRes = await fetch(`${API}/admission/discharge-certificate/${data.admission.id}`);
      const certJson = await certRes.json();
      if (!certRes.ok) throw new Error(certJson.message || 'Load failed');
      const { certificate, ...header } = certJson.data;
      setDcHeader(header);

      if (certificate) {
        const printedBy = user?.name || user?.username || user?.email || '';
        setDcPrintData({ ...header, certificate, printedBy });
        setTimeout(() => printDischargeCertificate(), 300);
      } else {
        toast.error('Is admission ka Discharge Certificate abhi tak nahi bana — pehle bana lein');
        setDcForm({
          reasonOfDischarge: '', diagnosis: '', furtherTreatmentNeeded: '',
          medicinePrescribed: '', followUp: '', medicalOfficer: '',
        });
        setDcOpen(true);
      }
    } catch (e) {
      toast.error(e.message || 'Admission load nahi hui');
    }
  }

  useEffect(() => {
    const no = searchParams.get('admissionNo');
    const autoprint = searchParams.get('autoprint');
    if (no && autoprint) handleReprintCertificate(no);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDcSaveAndPrint() {
    if (!dcForm.reasonOfDischarge) { toast.error('Reason of Discharge select karein'); return; }
    setDcSaving(true);
    try {
      const printedBy = user?.name || user?.username || user?.email || '';
      const res = await fetch(`${API}/admission/discharge-certificate/${admission.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dcForm,
          createdByUserId: user?.id != null ? String(user.id) : null,
          createdByName: printedBy || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Save nahi hui');
      // Saving the certificate is the discharge action itself — backend also
      // flips admission status to 'discharge' and frees the bed.
      toast.success('Discharge Certificate save ho gaya — patient discharge ho gaya, bed free ho gaya');
      setDcOpen(false);
      setDcPrintData({ ...dcHeader, certificate: json.data, printedBy });
      setTimeout(() => printDischargeCertificate(), 200);
    } catch (e) {
      toast.error(e.message || 'Error saving');
    } finally {
      setDcSaving(false);
    }
  }

  return (
    <div className="dra-page">
      <ClinicMenuBar />

      <div className="dra-title-bar">
        <span className="dra-title-text">Discount &amp; Refund Against Admission</span>
      </div>

      <div className="dra-content">
        <div className="dra-form-card">

          <div className="dra-form-row">
            <label className="dra-label">Admission #</label>
            <input
              className="dra-input dra-input--serial"
              value={admission?.admissionNo || ''}
              readOnly
              placeholder=""
            />
            <button className="dra-lookup-btn" onClick={() => setShowLookup(true)} title="Search admissions">
              <Search size={13} />
            </button>
            {admission && (
              <span className="dra-inline-patient">
                {admission.patientTitle} {admission.patientName}
              </span>
            )}
            <label className="dra-check-label dra-check-label--closed">
              <input
                type="checkbox"
                checked={closedFilesOnly}
                onChange={e => setClosedFilesOnly(e.target.checked)}
              />
              Closed Files
            </label>
          </div>

          {admission && (
            <>
              <div className="dra-separator" />

              <div className="dra-form-row">
                <label className="dra-label">Bill Amount</label>
                <input className="dra-input dra-input--amount" value={fmt2(billAmount)} readOnly />
                <label className="dra-label dra-label--right">Received Amount</label>
                <span className="dra-value dra-value--green">{fmt2(receivedAmount)}</span>
              </div>

              <div className="dra-form-row">
                <label className="dra-label">Discount Amount</label>
                <input
                  className="dra-input dra-input--amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                />
                <div className="dra-disc-toggle">
                  <button
                    className={`dra-disc-btn ${discountType === 'amount' ? 'dra-disc-btn--active' : ''}`}
                    onClick={() => { setDiscountType('amount'); setDiscount(''); }}
                    type="button"
                  >PKR</button>
                  <button
                    className={`dra-disc-btn ${discountType === 'percent' ? 'dra-disc-btn--active' : ''}`}
                    onClick={() => { setDiscountType('percent'); setDiscount(''); }}
                    type="button"
                  >%</button>
                </div>
                {discountType === 'percent' && discount && (
                  <span className="dra-disc-calc">= {discountAmt}</span>
                )}
                <label className="dra-label dra-label--right">Net Balance</label>
                <span className="dra-value">{fmt2(netBalance)}</span>
              </div>

              <div className="dra-form-row">
                <label className="dra-label">Permission By</label>
                <input
                  className="dra-input dra-input--wide"
                  value={permissionBy}
                  onChange={e => setPermissionBy(e.target.value)}
                  placeholder="Authorized by…"
                />
                <label className="dra-label dra-label--right">Refund Amount</label>
                <input
                  className="dra-input dra-input--amount dra-input--refund"
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundOverride}
                  onChange={e => setRefundOverride(e.target.value)}
                  placeholder={fmt2(autoRefundAmt)}
                />
                {refundOverride !== '' && Number(refundOverride) !== autoRefundAmt && (
                  <span className="dra-disc-calc">(auto: {fmt2(autoRefundAmt)})</span>
                )}
              </div>

              {netBalance === 0 && (
                <div className="dc-trigger-row">
                  <button className="dc-trigger-btn" onClick={openDischargeCertificate}>
                    Discharge Certificate
                  </button>
                </div>
              )}

              {history.length > 0 && (
                <>
                  <div className="dra-separator" />
                  <div className="dra-history">
                    <div className="dra-history-title">Previous Entries</div>
                    <table className="dra-history-tbl">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Discount</th>
                          <th>Permission By</th>
                          <th>Refund</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(h => (
                          <tr key={h.id}>
                            <td>{fmtDateTime(h.createdAt)}</td>
                            <td className="dra-td-r">{fmt2(h.discountAmount)}{h.discountType === 'percent' ? ' %' : ''}</td>
                            <td>{h.permissionBy || '—'}</td>
                            <td className="dra-td-r">{fmt2(h.refundAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <div className="dra-footer">
          <button className="dra-add-btn" onClick={handleAdd} disabled={saving || !admission}>Add</button>
        </div>
      </div>

      {showLookup && (
        <AdmissionLookupModal onSelect={handleSelect} onClose={() => setShowLookup(false)} closedFilesOnly={closedFilesOnly} />
      )}

      {dcOpen && dcHeader && dcForm && (
        <DischargeCertificateModal
          header={dcHeader}
          form={dcForm}
          onChange={updateDcForm}
          onClose={() => setDcOpen(false)}
          onSave={handleDcSaveAndPrint}
          saving={dcSaving}
          diagnosisOptions={diagnosisOptions}
        />
      )}

      <div className="dc-print-area">
        <DischargeCertificatePrintTemplate data={dcPrintData} />
      </div>
    </div>
  );
}
