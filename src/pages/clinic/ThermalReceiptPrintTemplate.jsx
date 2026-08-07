import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';
import { numberToWords, invoiceLabel } from './receiptUtils';
import './ThermalReceiptPrintTemplate.scss';

// In-page version of the 80mm thermal receipt (thermalReceiptUtils.js) — used
// wherever a SECOND print (alongside the A6 slip's own popup) is needed in the
// same click. A second window.open() from the same gesture gets silently
// blocked by Chrome even when called synchronously (same issue documented in
// ClinicalRecordForm.jsx), so this prints in-page instead: no second window,
// nothing for a popup blocker to interfere with.
export function printThermalReceipt() {
  const styleId = 'th-page-size-override';
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = '@page { size: 80mm auto !important; margin: 0 !important; }';

  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000);

  window.print();
}

export function ThermalReceiptPrintTemplate({ visit, tokenNo, isDuplicate, barcodeDataUrl, printedBy }) {
  if (!visit) return null;
  const doc = visit;
  const docEntries = doc.doctors || [];

  const seenDoctors = new Map();
  docEntries.forEach((d) => {
    const doctor = d.doctor;
    if (doctor?.name && !seenDoctors.has(doctor.name)) seenDoctors.set(doctor.name, doctor);
  });
  const HIDE_DOCTOR_DEPTS = ['miscellaneous'];
  const hideDoctorRows = HIDE_DOCTOR_DEPTS.includes(String(doc.department || '').trim().toLowerCase());
  const doctorEntries = hideDoctorRows ? [] : [...seenDoctors.values()];

  const pt = doc.paymentType;
  const label = invoiceLabel(pt);
  const isComplementary = pt === 'complementary';

  const total    = isComplementary ? 0 : (doc.totalAmount || 0);
  const discount = isComplementary ? 0 : (doc.discount    || 0);
  const received = isComplementary ? 0 : (doc.receive     || 0);
  const grossAmt = total + discount;
  const balance  = Math.max(0, total - received);

  const ageStr = [
    doc.age != null ? `${doc.age}Y` : '0Y',
    `${doc.ageMonths || 0}M`,
    `${doc.ageDays   || 0}D`,
  ].join(' ');

  const visitDate = new Date(doc.createdAt);
  const dateStr = visitDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/');
  const timeStr = visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const fmt = (v) => Number(v || 0).toFixed(2);

  const TOKEN_DEPTS = ['dental opd', 'therapy', 'consultant opd'];
  const showToken = TOKEN_DEPTS.includes(String(doc.department || '').trim().toLowerCase()) && tokenNo > 0;

  const lineItems = docEntries.length ? docEntries : [{ subDept: { name: doc.department || 'OPD' }, amount: grossAmt }];

  return (
    <div className="th-rcpt">
      <img className="th-logo" src={RECEIPT_LOGO_DATA_URI} alt="logo" />
      <div className="th-addr">Jafar-e-Tayyar Co-op Housing Society, Malir Karachi<br/>Ph.: 4508390-91</div>

      {isDuplicate && <div className="th-duplicate">DUPLICATE</div>}

      <div className="th-divider th-divider--solid" />

      <div className="th-row"><span className="lbl">Serial #:</span><span>{doc.serialNo}</span></div>
      <div className="th-row"><span className="lbl">Date:</span><span>{dateStr} {timeStr}</span></div>
      <div className="th-row"><span className="lbl">Printed By:</span><span>{printedBy || '—'}</span></div>
      <div className="th-row"><span className="lbl">Patient:</span><span>{doc.patientType} {doc.patientName}</span></div>
      <div className="th-row"><span className="lbl">Age:</span><span>{ageStr}</span></div>
      {doc.mrNo ? <div className="th-row"><span className="lbl">MR #:</span><span>{doc.mrNo}</span></div> : null}
      {doc.referredBy && String(doc.referredBy).trim() ? <div className="th-row"><span className="lbl">Ref. By:</span><span>{doc.referredBy}</span></div> : null}
      {doc.antenatalNo && String(doc.antenatalNo).trim().toUpperCase() !== 'NA' ? <div className="th-row"><span className="lbl">Antenatal #:</span><span>{doc.antenatalNo}</span></div> : null}

      {doctorEntries.map((doctor) => {
        const extra = [doctor.qualification, doctor.speciality].filter(Boolean).join(', ');
        return (
          <div className="th-doctor" key={doctor.name}>
            <div className="th-doctor-name">{doctor.name}</div>
            {extra && <div className="th-doctor-qual">{extra}</div>}
          </div>
        );
      })}

      <div className="th-divider" />

      {lineItems.map((d, i) => (
        <div className="th-item" key={i}>
          <span>{(d.subDept?.name || '').toUpperCase()}{d.quantity > 1 ? ` x${d.quantity}` : ''}</span>
          <span>{fmt(d.amount)}</span>
        </div>
      ))}

      <div className="th-divider" />
      <div className="th-amt th-amt--total"><span>Total:</span><span>{fmt(grossAmt)}</span></div>
      {discount > 0 && <div className="th-amt"><span>Discount:</span><span>{fmt(discount)}</span></div>}

      <div className="th-divider" />
      <div className="th-invoice">{isDuplicate ? 'DUPLICATE — ' : ''}{label}</div>
      <div className="th-received"><span>Received</span><span>{fmt(received)}</span></div>
      {balance > 0.01 && <div className="th-amt th-amt--balance"><span>Balance:</span><span>{fmt(balance)}</span></div>}

      <div className="th-amt th-amt--grand"><span>Grand Total:</span><span>{fmt(total)}</span></div>

      <div className="th-words">Received Rupees {isComplementary ? 'Zero (Complementary)' : numberToWords(received)}</div>
      <div className="th-disclaimer">All Amount Received From Patients Treated As DONATION &amp; Exempt From Tax</div>

      {showToken && (
        <div className="th-token">
          <span className="th-token-lbl">Token</span>
          <span className="th-token-no">{tokenNo}</span>
        </div>
      )}

      <div className="th-barcode">
        {barcodeDataUrl && <img src={barcodeDataUrl} alt="barcode" />}
      </div>

      <div className="th-urdu">اسپتال کے کیش کاؤنٹر کے علاوہ کسی بھی شخص کو کسی بھی قسم کی ادائیگی نہ کریں۔ بصورت دیگر اسپتال ذمہ دار نہ ہوگا۔</div>
    </div>
  );
}
