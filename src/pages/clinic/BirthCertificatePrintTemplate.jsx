// Mirrors the hospital's real pre-printed Birth Certificate paper — letterhead
// is already on the physical stationery, so this only renders what goes
// below it, same pattern as DeathCertificatePrintTemplate.

const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDateTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${String(d.getDate()).padStart(2, '0')}-${MN[d.getMonth()]}-${d.getFullYear()} ${hh}:${mm}`;
}

export function BirthCertificatePrintTemplate({ data }) {
  if (!data) return null;
  const { certificate: c } = data;

  return (
    <div className="bthc-print">
      <div className="bthc-print-titlebox">BIRTH CERTIFICATE</div>

      <div className="bthc-print-box">
        <div className="bthc-row"><span className="bthc-lbl">Registration #:</span><span className="bthc-val">{c.admissionNo}</span></div>
        <div className="bthc-row"><span className="bthc-lbl">Mother Name:</span><span className="bthc-val">{c.motherName || ''}</span></div>
        <div className="bthc-row"><span className="bthc-lbl">Father Name:</span><span className="bthc-val">{c.fatherName || ''}</span></div>
        <div className="bthc-row"><span className="bthc-lbl">Address:</span><span className="bthc-val">{c.address || ''}</span></div>

        <div className="bthc-row bthc-row--spacer" />

        <div className="bthc-row"><span className="bthc-lbl">Date of Birth:</span><span className="bthc-val">{fmtDateTime(c.birthTime)}</span></div>
        <div className="bthc-row bthc-row--triple">
          <span className="bthc-lbl bthc-lbl--sm">Gender:</span><span className="bthc-val bthc-val--short">{c.gender === 'baby' ? 'Baby' : 'Baba'}</span>
          <span className="bthc-lbl bthc-lbl--gap">Weight (kg):</span><span className="bthc-val bthc-val--short">{c.weight ?? ''}</span>
          <span className="bthc-lbl bthc-lbl--gap">Blood Group:</span><span className="bthc-val">{c.bloodGroup || ''}</span>
        </div>
        <div className="bthc-row"><span className="bthc-lbl">Remarks:</span><span className="bthc-val">{c.remarks || ''}</span></div>
      </div>

      <div className="bthc-sig-row">
        <div className="bthc-sig">
          <div className="bthc-sig-line" />
          <div className="bthc-sig-label">Signature</div>
        </div>
        <div className="bthc-issue">
          <span className="bthc-lbl">Issue date:</span><span className="bthc-val">{fmtDateTime(c.createdAt)}</span>
        </div>
      </div>

      <div className="bthc-disclaimer">
        This is a Computer Generated Document Which Don&apos;t Acquire Any Stemp For Any Enquiry Please Contact on Given Numbers.
      </div>

      <div className="bthc-formcode">DSIKH/FM/001-02-00</div>
    </div>
  );
}
