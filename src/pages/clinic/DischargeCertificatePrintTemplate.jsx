// Same label→display-text map as DiscountRefundAdmission.jsx's own
// REASON_OPTIONS/REASON_LABELS (duplicated here, not imported, so this file
// and DiscountRefundAdmission.jsx don't import each other in a circle).
const REASON_LABELS = {
  treated: 'Patient Treated',
  transfer: 'Patient Transfer',
  lama: 'LAMA',
  expired: 'Patient Expired',
  discharge_on_request: 'Discharge on Request',
};
const DISCHARGE_MED_LINES = Array.from({ length: 8 });

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-GB', { month: 'short' })}-${dt.getFullYear()}`;
}

// Sample hand-written duplicate bill used bordered boxes for every field; this
// print instead fills each label with an underline — data is already
// system-typed, so a "write here" box no longer serves a purpose.
export function DischargeCertificatePrintTemplate({ data }) {
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
