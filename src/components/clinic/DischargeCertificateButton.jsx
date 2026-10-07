import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/useAuthStore';
import { useClinicStore } from '../../store/useClinicStore';
import SearchableSelect from '../ui/SearchableSelect';
import { buildDischargeCertificatePrintHtml } from '../../pages/clinic/dischargeCertificatePrintUtils';
import '../../pages/clinic/DiscountRefundAdmission.scss';

const API = 'http://localhost:5001/api/clinic';

// `<input type="date">`'s own value format — used both to default the field
// to today and to preload an already-saved certificate's date into it.
function toDateInputValue(d) {
  const dt = d ? new Date(d) : new Date();
  return dt.toISOString().slice(0, 10);
}

const REASON_OPTIONS = [
  { value: 'treated', label: 'Patient Treated' },
  { value: 'transfer', label: 'Patient Transfer' },
  { value: 'lama', label: 'LAMA' },
  { value: 'expired', label: 'Patient Expired' },
  { value: 'discharge_on_request', label: 'Discharge on Request' },
];

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
            <label>Discharge Date *</label>
            <input
              type="date"
              value={form.dischargeDate}
              min={toDateInputValue(admission.createdAt)}
              onChange={e => onChange('dischargeDate', e.target.value)}
              required
            />
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
            <SearchableSelect
              options={diagnosisOptions}
              value={form.diagnosis}
              onChange={v => onChange('diagnosis', v)}
              placeholder="Select…"
              size="sm"
            />
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

// Discharge Certificate trigger button + modal — shared by Discount & Refund
// Against Admission and Provisional Bill (both let staff push a patient's
// balance to 0 and should offer the same one-click "discharge them now"
// action from there, instead of making staff navigate to a separate page).
// Saving the certificate is the discharge action itself — the backend flips
// the admission to 'discharge' status and frees its bed.
export default function DischargeCertificateButton({ admissionId, visible, className, onDischarged }) {
  const { user } = useAuthStore();
  const { diseases, fetchDiseases, surgeryTypes, fetchSurgeryTypes } = useClinicStore();

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
  function openDischargeCertificatePopup(data) {
    const w = window.open('', '_blank', 'width=700,height=900');
    if (!w) { toast.error('Popup blocked — please allow popups for this site'); return; }
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
    if (!dcForm.reasonOfDischarge) { toast.error('Reason of Discharge select karein'); return; }
    setDcSaving(true);
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
      openDischargeCertificatePopup({ ...dcHeader, certificate: json.data, printedBy });
      if (onDischarged) onDischarged();
    } catch (e) {
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
