import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { useClinicStore } from '../../store/useClinicStore';
import SearchableSelect from '../ui/SearchableSelect';
import { buildDischargeCertificatePrintHtml } from '../../pages/clinic/dischargeCertificatePrintUtils';
import '../../pages/clinic/DiscountRefundAdmission.scss';
import { openPrintWindow } from '../../utils/printRelay';
import { printedByCode } from '../../utils/printedBy';
import { useShallow } from 'zustand/react/shallow';
import useModalKeys from '../../hooks/useModalKeys';

const API = 'http://localhost:5001/api/clinic';

// `<input type="date">`'s own value format — used both to default the field
// to today and to preload an already-saved certificate's date into it.
function toDateInputValue(d) {
  // PKT calendar day — a plain UTC slice gave the previous day for anything
  // between 00:00 and 05:00 PKT (admission time, or "today" after midnight).
  const dt = d ? new Date(d) : new Date();
  return new Date(dt.getTime() + 5 * 3600000).toISOString().slice(0, 10);
}

const REASON_OPTIONS = [
  { value: 'treated', label: 'Patient Treated' },
  { value: 'transfer', label: 'Patient Transfer' },
  { value: 'lama', label: 'LAMA' },
  { value: 'expired', label: 'Patient Expired' },
  { value: 'discharge_on_request', label: 'Discharge on Request' },
];

// Follow Up is picked from this list (owner, 2026-10-23).
const FOLLOW_UP_OPTIONS = ['After 1 Day', 'After 3 Days', 'After 5 Days', 'After 1 Week', 'After 2 Weeks', 'After 1 Month', 'After 3 Months'];

function normCat(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }

// Shared by this button and Discount & Refund's reprint fallback.
export function DischargeCertificateModal({ header, form, onChange, onClose, onSave, saving, diagnosisOptions }) {
  const { admission, roomCategory, bed, consultant } = header;
  // Panel file: these three aren't asked (owner, 2026-10-23) — see the print.
  const isPanel = admission.patientCategory === 'panel';
  // ESC only — this is a data-entry form, so no backdrop-click close.
  useModalKeys({ active: true, onEsc: onClose });

  // Medical Officer is picked from the RMO list (owner, 2026-10-23) — same
  // list as Admission's "Arrived under RMO": active doctors whose Staff
  // Category contains "rmo". A name saved before stays selectable.
  const { doctors, fetchDoctors } = useClinicStore(useShallow((s) => ({ doctors: s.doctors, fetchDoctors: s.fetchDoctors })));
  useEffect(() => {
    if (!doctors.length) fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rmoOptions = useMemo(() => {
    const names = doctors.filter(d => d.status === 'active' && normCat(d.staffCategory?.name).includes('rmo')).map(d => d.name);
    const cur = form.medicalOfficer;
    return cur && !names.includes(cur) ? [cur, ...names] : names;
  }, [doctors, form.medicalOfficer]);
  // A Follow Up typed before the list existed stays selectable.
  const followUpOptions = form.followUp && !FOLLOW_UP_OPTIONS.includes(form.followUp)
    ? [form.followUp, ...FOLLOW_UP_OPTIONS] : FOLLOW_UP_OPTIONS;

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
            <label>Discharge Date *</label>
            <input
              type="date"
              value={form.dischargeDate}
              min={toDateInputValue(admission.createdAt)}
              onChange={e => onChange('dischargeDate', e.target.value)}
              required
            />
          </div>

          {!isPanel && (
          <div className="dc-modal-row">
            <label>Reason of Discharge *</label>
            <select value={form.reasonOfDischarge} onChange={e => onChange('reasonOfDischarge', e.target.value)}>
              <option value="">Select…</option>
              {REASON_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          )}

          <div className="dc-modal-row">
            <label>Diagnosis</label>
            <SearchableSelect
              options={diagnosisOptions}
              value={form.diagnosis}
              onChange={v => onChange('diagnosis', v)}
              placeholder="Select…"
              size="sm"
            />
          </div>

          {!isPanel && (
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
          )}

          <div className="dc-modal-row dc-modal-row--split">
            <div className="dc-modal-col">
              <label>Follow Up</label>
              <SearchableSelect
                options={followUpOptions}
                value={form.followUp}
                onChange={v => onChange('followUp', v)}
                placeholder="Select…"
                size="sm"
              />
            </div>
            <div className="dc-modal-col">
              <label>Medical Officer</label>
              <SearchableSelect
                options={rmoOptions}
                value={form.medicalOfficer}
                onChange={v => onChange('medicalOfficer', v)}
                placeholder="Select RMO…"
                size="sm"
              />
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

// Discharge Certificate trigger button + modal — shared by Discount & Refund
// Against Admission and Provisional Bill (both let staff push a patient's
// balance to 0 and should offer the same one-click "discharge them now"
// action from there, instead of making staff navigate to a separate page).
// Saving the certificate is the discharge action itself — the backend flips
// the admission to 'discharge' status and frees its bed.
export default function DischargeCertificateButton({ admissionId, visible, className, onDischarged }) {
  const { user } = useAuthStore();
  const { diseases, fetchDiseases, surgeryTypes, fetchSurgeryTypes } = useClinicStore(useShallow((s) => ({ diseases: s.diseases, fetchDiseases: s.fetchDiseases, surgeryTypes: s.surgeryTypes, fetchSurgeryTypes: s.fetchSurgeryTypes })));

  useEffect(() => {
    fetchDiseases();
    fetchSurgeryTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Diagnosis dropdown mixes both parameter lists (Diseases + Surgery Types)
  // into one flat, de-duplicated, alphabetical list.
  const diagnosisOptions = useMemo(() => {
    const names = new Set([...diseases.map(d => d.name), ...surgeryTypes.map(s => s.name)]);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [diseases, surgeryTypes]);

  const [dcOpen, setDcOpen] = useState(false);
  const [dcHeader, setDcHeader] = useState(null);
  const [dcForm, setDcForm] = useState(null);
  const [dcSaving, setDcSaving] = useState(false);

  // Popup-based print (never window.print() on the main window — see
  // dischargeCertificatePrintUtils for why that used to freeze the whole app).
  // `w` is opened on the click, before the save request — a window opened
  // after an await is treated as an unrequested popup and blocked.
  function openDischargeCertificatePopup(data, w = openPrintWindow('width=700,height=900')) {
    w.document.write(buildDischargeCertificatePrintHtml(data));
    w.document.close();
  }

  async function openDischargeCertificate() {
    if (!admissionId) return;
    try {
      const res = await fetch(`${API}/admission/discharge-certificate/${admissionId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Load failed');
      const { certificate, ...header } = json.data;
      setDcHeader(header);
      setDcForm({
        dischargeDate: toDateInputValue(certificate?.dischargeDate),
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

  async function handleDcSaveAndPrint() {
    if (!dcForm.dischargeDate) { toast.error('Discharge Date select karein'); return; }
    const isPanel = dcHeader?.admission?.patientCategory === 'panel';
    if (!isPanel && !dcForm.reasonOfDischarge) { toast.error('Reason of Discharge select karein'); return; }
    setDcSaving(true);
    const printWin = openPrintWindow('width=700,height=900');
    try {
      const printedBy = user?.name || user?.username || user?.email || '';
      const res = await fetch(`${API}/admission/discharge-certificate/${admissionId}`, {
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
      toast.success('Discharge Certificate save ho gaya — patient discharge ho gaya, bed free ho gaya');
      setDcOpen(false);
      openDischargeCertificatePopup({ ...dcHeader, certificate: json.data, printedBy: printedByCode(user) }, printWin);
      if (onDischarged) onDischarged();
    } catch (e) {
      printWin.close();
      toast.error(e.message || 'Error saving');
    } finally {
      setDcSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <>
      <div className={className || 'dc-trigger-row'}>
        <button className="dc-trigger-btn" onClick={openDischargeCertificate}>
          Discharge Certificate
        </button>
      </div>

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
    </>
  );
}
