// Mirrors the hospital's real pre-printed Death Certificate paper: letterhead
// (hospital name/address/logos) is already on the physical stationery, so
// this template only renders what goes BELOW it — "Death Certificate" heading
// down to the Dr. Signature line — same pattern as DischargeCertificatePrintTemplate.

const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${String(d.getDate()).padStart(2, '0')}-${MN[d.getMonth()]}-${d.getFullYear()} ${hh}:${mm}`;
}

const ageStr = (c) => `${c.ageYears || 0} Year(s) ${c.ageMonths || 0} Month(s) ${c.ageDays || 0} Day(s)`;
const certNo = (c) => (c.arrivedSlipNo ? `${c.arrivedSlipNo}/${c.admissionNo}` : c.admissionNo);

export function DeathCertificatePrintTemplate({ data }) {
  if (!data) return null;
  const { certificate: c, doctorName } = data;

  return (
    <div className="dthc-print">
      <div className="dthc-print-title">Death Certificate</div>

      <div className="dthc-print-box">
        <div className="dthc-row"><span className="dthc-lbl">Certificate #:</span><span className="dthc-val">{certNo(c)}</span></div>
        <div className="dthc-row"><span className="dthc-lbl">Death date &amp; time:</span><span className="dthc-val">{fmtDateTime(c.deathTime)}</span></div>
        <div className="dthc-row"><span className="dthc-lbl">Place of death:</span><span className="dthc-val">{c.deathPlace || ''}</span></div>
        <div className="dthc-row"><span className="dthc-lbl">Patient name:</span><span className="dthc-val">{c.patientName || ''}</span></div>
        <div className="dthc-row"><span className="dthc-lbl">{c.relationType || 'S/o'}.</span><span className="dthc-val">{c.relationName || ''}</span></div>
        <div className="dthc-row">
          <span className="dthc-lbl">Gender:</span><span className="dthc-val dthc-val--short">{c.gender === 'female' ? 'Female' : 'Male'}</span>
          <span className="dthc-lbl dthc-lbl--gap">Age:</span><span className="dthc-val">{ageStr(c)}</span>
        </div>
        <div className="dthc-row"><span className="dthc-lbl">Religion:</span><span className="dthc-val">{c.religion || ''}</span></div>
        <div className="dthc-row"><span className="dthc-lbl">Occupation:</span><span className="dthc-val">{c.occupation || ''}</span></div>
        <div className="dthc-row"><span className="dthc-lbl">Reason of death:</span><span className="dthc-val">{c.causeOfDeath || ''}</span></div>

        <div className="dthc-row dthc-row--spacer" />

        <div className="dthc-row"><span className="dthc-lbl">Doctor:</span><span className="dthc-val">{doctorName || ''}</span></div>
        <div className="dthc-row"><span className="dthc-lbl">Address of doctor:</span><span className="dthc-val">{c.drAddress || ''}</span></div>
      </div>

      <div className="dthc-note">
        <div className="dthc-note-en">
          NOTE : THIS IS A VERY IMPORTANT DOCUMENT PLEASE KEEP IT CAREFULLY NO DUPLICATE WILL BE ISSUE LATER ON
        </div>
        <div className="dthc-note-ur" dir="rtl" lang="ur">
          <div>یہ ایک انتہائی اہم دستاویز ہے اسے سنبھال کر رکھیں کسی بھی صورت</div>
          <div>میں اسکی نقل (DUPLICATE) فراہم نہیں کی جائے گی۔</div>
        </div>
      </div>

      <div className="dthc-sig">
        <div className="dthc-sig-line" />
        <div className="dthc-sig-label">Dr. Signature</div>
      </div>

      <div className="dthc-formcode">DSIKH/FM/001-01-00</div>
    </div>
  );
}
