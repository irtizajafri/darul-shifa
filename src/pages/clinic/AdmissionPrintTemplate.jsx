import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';
import { relationParts } from './relationText';

function numToWords(n) {
  if (n === 0) return 'zero';
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function cvt(num) {
    if (num === 0) return '';
    if (num < 20) return ones[num] + ' ';
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + ones[num % 10] : '') + ' ';
    if (num < 1000) return ones[Math.floor(num / 100)] + ' hundred ' + cvt(num % 100);
    if (num < 100000) return cvt(Math.floor(num / 1000)) + 'thousand ' + cvt(num % 1000);
    return cvt(Math.floor(num / 100000)) + 'lakh ' + cvt(num % 100000);
  }
  return cvt(Math.abs(Math.floor(n))).trim();
}

// 'Tuesday 08 Sept 2026 13:47'
function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const dateStr = dt.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dateStr.replace(',', '')} ${timeStr}`;
}

// '13-10-2026 15:17' — compact, for the Room / Payment History rows
function fmtShort(d) {
  if (!d) return '';
  const dt = new Date(d);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(dt.getDate())}-${p(dt.getMonth() + 1)}-${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

// `record` — the saved admission's own data (see getAdmissionFormPrintData /
// Admission.jsx): who generated it, real admit time, current room (= the
// room it was discharged from), room shifts, payments, discharge date. The
// typed-in fields still come from `form`.
export function AdmissionPrintTemplate({ form, doctors, roomCategories, availableBeds, isDuplicate, barcodeDataUrl, record = {} }) {
  // Old records without a Relation keep the previous S/o / D/o-by-Sex label.
  const rel = relationParts(form, form?.gender === 'female' ? 'D/o' : 'S/o');
  const consultant = doctors.find(d => String(d.id) === String(form.consultantId));
  const roomCat    = roomCategories.find(r => String(r.id) === String(form.roomCategoryId));
  const bed        = availableBeds.find(b => String(b.id) === String(form.bedId));
  const roomCategoryName = record.roomCategoryName || roomCat?.name || '—';
  const roomName         = record.roomName || bed?.name || '—';

  const admitDateTime = fmtDateTime(record.admittedAt || new Date());
  const roomHistory = record.roomHistory || [];
  const payments    = record.payments || [];

  const statusLabel = { private: 'Private', staff: 'Staff', panel: 'Panel', cc: 'CC', complementary: 'Complementary', jazzcash: 'JazzCash' }[form.patientCategory] || 'Private';

  const ageStr = `${form.ageYears || 0} Year(s) ${form.ageMonths || 0} Month(s) ${form.ageDays || 0} Day(s)`;

  const advAmt   = parseFloat(form.advancePayment || 0);
  const advWords = advAmt > 0 ? numToWords(Math.floor(advAmt)) : '';

  return (
    <div className="adm-print">
      {/* Header — logo and hospital info live in their own full-width divs so the
          logo's width always matches the form's content width. */}
      <div className="adm-print-logo-box">
        <img src={RECEIPT_LOGO_DATA_URI} alt="Darul Shifa" className="adm-print-logo" />
      </div>
      <div className="adm-print-info-box">
        <div className="adm-print-hosp-addr">Jafar-e-Tayyar Co-operative Housing Society, Malir Karachi &nbsp; Ph.:4508390-91</div>
        {isDuplicate && <div className="adm-print-duplicate">Duplicate</div>}
      </div>

      {/* Status bar */}
      <div className="adm-print-status-bar">
        <span>Patients Status: <strong>{statusLabel}</strong></span>
        <span className="adm-print-form-title">ADMISSION FORM</span>
        <span>Admitted By: <strong>{record.admittedBy || ''}</strong></span>
      </div>

      {/* Fields table */}
      <table className="adm-print-fields">
        <tbody>
          <tr>
            <td className="apf-lbl">Admission #:</td>
            <td className="apf-val">{form.admissionNo}</td>
            <td className="apf-lbl">Admit Date &amp; Time:</td>
            <td className="apf-val">{admitDateTime}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Patient Name:</td>
            <td className="apf-val">{form.patientTitle} {form.patientName}</td>
            <td className="apf-lbl">{rel.label}.:</td>
            <td className="apf-val">{rel.name}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Room Category:</td>
            <td className="apf-val">{roomCategoryName}</td>
            <td className="apf-lbl">Room #:</td>
            <td className="apf-val">{roomName}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Age:</td>
            <td className="apf-val">{ageStr}</td>
            <td className="apf-lbl">Gender:</td>
            <td className="apf-val">{form.gender === 'male' ? 'Male' : 'Female'}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Address:</td>
            <td className="apf-val">{form.address}</td>
            <td className="apf-lbl">Phone / Mobile #:</td>
            <td className="apf-val">{form.phoneNo}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Arrived under RMO:</td>
            <td className="apf-val">{form.arrivedUnderRmo || 'Visiting Doctor (RMO)'}</td>
            <td className="apf-lbl">Consultant:</td>
            <td className="apf-val">{consultant?.name || '—'}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Responsible Party:</td>
            <td className="apf-val">{form.responsibleParty}</td>
            <td className="apf-lbl">Authority Letter:</td>
            <td className="apf-val">{form.authorityLetter ? 'Yes' : 'No'}</td>
          </tr>
          <tr>
            <td className="apf-lbl">Adv. Received:</td>
            <td className="apf-val">{advAmt > 0 ? `Rs. ${advAmt.toFixed(2)}` : ''}</td>
            <td className="apf-lbl">Discharge Date:</td>
            <td className="apf-val">{fmtDateTime(record.dischargeDate)}</td>
          </tr>
        </tbody>
      </table>

      {/* Received line */}
      {advAmt > 0 && (
        <div className="adm-print-recv-line">
          Received with thanks from <strong>{form.responsibleParty || form.patientName}</strong> Rupees {advWords} only.
        </div>
      )}

      {/* Room History */}
      <div className="adm-print-section-hdr">ROOM HISTORY</div>
      <table className="adm-print-history">
        <tbody>
          {roomHistory.map((h, i) => (
            <tr key={`h-${i}`} className="aph-filled">
              <td>Shifted from <span>{[h.fromCategory, h.fromRoom].filter(Boolean).join(' / ') || '—'}</span></td>
              <td>Category <span>{h.toCategory || ''}</span></td>
              <td>Room # <span>{h.toRoom || ''}</span></td>
              <td>Date &amp; Time <span>{fmtShort(h.shiftedAt)}</span></td>
              <td>By <span>{h.shiftedBy || ''}</span></td>
            </tr>
          ))}
          {/* blank lines left to fill by hand — at least two rows in all */}
          {Array.from({ length: Math.max(0, 2 - roomHistory.length) }, (_, i) => (
            <tr key={i}>
              <td>Shifted to <span className="dln dln-md" /></td>
              <td>Category <span className="dln dln-sm" /></td>
              <td>Room # <span className="dln dln-sm" /></td>
              <td>Date &amp; Time <span className="dln dln-md" /></td>
              <td>Sign. <span className="dln dln-sm" /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Payment History */}
      <div className="adm-print-section-hdr">PAYMENT HISTORY</div>
      <table className="adm-print-history">
        <tbody>
          {payments.map((p, i) => (
            <tr key={`p-${i}`} className="aph-filled">
              <td>Date: <span>{fmtShort(p.date)}</span></td>
              <td>Amount: <span>{Number(p.amount || 0).toFixed(2)}</span></td>
              <td>Slip #: <span>{p.slipNo || ''}</span></td>
              <td>Sig. <span className="dln dln-sm" /></td>
            </tr>
          ))}
          {/* blank lines left to fill by hand — at least four rows in all */}
          {Array.from({ length: Math.max(0, 4 - payments.length) }, (_, i) => (
            <tr key={i}>
              <td>Date: <span className="dln dln-md" /></td>
              <td>Amount: <span className="dln dln-sm" /></td>
              <td>Slip #: <span className="dln dln-sm" /></td>
              <td>Sig. <span className="dln dln-sm" /></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Halafnama */}
      <div className="adm-print-oath">
        <div className="adm-print-oath-title">حلف نامہ</div>
        <p className="adm-print-oath-text" dir="rtl">
میں / ہم بخوبی واقف ہوں کہ یہ ایک نجی ہسپتال ہے اور یہ کہ مجھے / ہمیں یہاں جو سہولت (جو مجھے فراہم کی جائے گی) اس کا معاوضہ ادا کرنا ہے۔ میں اللہ تعالیٰ کو حاضر ناظر جان کر کہتا ہوں / کرتی ہوں کہ ہسپتال کے بل کی ادائیگی کروں گا / کروں گی۔کسی بھی قسم کا ریفنڈ صرف صاحب دستخط شخص کو دیا جائے گا.</p>
      </div>

      {/* Signature row */}
      <div className="adm-print-sig-row">
        <span>Name: <span className="dln dln-lg" /></span>
        <span>Signature: <span className="dln dln-lg" /></span>
      </div>
      <div className="adm-print-sig-row">
        <span>Address: <span className="dln dln-lg" /></span>
        <span>Phone #: <span className="dln dln-lg" /></span>
      </div>

      {/* Diagnosis */}
      <table className="adm-print-diag">
        <tbody>
          <tr>
            <td className="apd-lbl">Provisional Diagnosis</td>
            <td className="apd-val"></td>
            <td className="apd-lbl apd-lbl-sm">Code Number</td>
            <td className="apd-val apd-val-sm apd-val--tall"></td>
          </tr>
          <tr>
            <td className="apd-lbl">Final Diagnosis</td>
            <td colSpan={3} className="apd-val"></td>
          </tr>
          <tr>
            <td className="apd-lbl">Operations</td>
            <td colSpan={3} className="apd-val apd-val--tall"></td>
          </tr>
        </tbody>
      </table>

      {/* Footer — form code + barcode */}
      <div className="adm-print-footer">
        <span className="adm-print-form-code">REC/FM/001-05-00</span>
        {barcodeDataUrl && <img src={barcodeDataUrl} alt="" className="adm-print-barcode" />}
      </div>
    </div>
  );
}
