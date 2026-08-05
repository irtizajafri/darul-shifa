import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';
import { numberToWords, invoiceLabel } from './receiptUtils';

// ── 80mm Thermal Receipt ────────────────────────────────────────────────────
// Same data/fields as the A6 slip (receiptUtils.js) but laid out single-column
// for an 80mm thermal roll — narrow width, everything stacked vertically
// (no side-by-side grid, that doesn't fit 80mm), height left to grow with
// content since thermal paper is a continuous roll, not a fixed page.
export function buildThermalReceiptHtml({ visit, tokenNo, isDuplicate, barcodeDataUrl, printedBy }) {
  const doc = visit;
  const docEntries = doc.doctors || [];

  const seenDoctors = new Map();
  docEntries.forEach((d) => {
    const doctor = d.doctor;
    if (doctor?.name && !seenDoctors.has(doctor.name)) seenDoctors.set(doctor.name, doctor);
  });
  const HIDE_DOCTOR_DEPTS = ['miscellaneous'];
  const hideDoctorRows = HIDE_DOCTOR_DEPTS.includes(String(doc.department || '').trim().toLowerCase());
  const doctorRowsHtml = hideDoctorRows ? '' : [...seenDoctors.values()].map((doctor) => {
    const extra = [doctor.qualification, doctor.speciality].filter(Boolean).join(', ');
    return `<div class="th-doctor"><div class="th-doctor-name">${doctor.name}</div>${extra ? `<div class="th-doctor-qual">${extra}</div>` : ''}</div>`;
  }).join('');

  const pt = doc.paymentType;
  const label = invoiceLabel(pt);
  const isComplementary = pt === 'complementary';

  const total     = isComplementary ? 0 : (doc.totalAmount || 0);
  const discount  = isComplementary ? 0 : (doc.discount   || 0);
  const received  = isComplementary ? 0 : (doc.receive    || 0);
  const grossAmt  = total + discount;
  const balance   = Math.max(0, total - received);

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

  const lineItemsHtml = (docEntries.length ? docEntries : [{ subDept: { name: doc.department || 'OPD' }, amount: grossAmt }])
    .map((d) => `<div class="th-item"><span>${(d.subDept?.name || '').toUpperCase()}</span><span>${fmt(d.amount)}</span></div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>OPD Receipt - ${doc.serialNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color:#000; background:#fff; width:100%; padding: 2mm 3mm; }

  .th-logo { width:100%; height:40px; object-fit:contain; display:block; margin:0 auto; }
  .th-addr { text-align:center; font-size:8.5px; font-weight:700; margin-top:2px; }

  .th-divider { border-top:1px dashed #000; margin:5px 0; }
  .th-divider.solid { border-top:1.5px solid #000; }

  .th-row { display:flex; justify-content:space-between; gap:6px; font-size:11px; margin:1.5px 0; }
  .th-row .lbl { font-weight:700; }

  .th-doctor { margin:3px 0; }
  .th-doctor-name { font-weight:700; font-size:11.5px; }
  .th-doctor-qual { font-size:9.5px; font-weight:700; color:#333; }

  .th-item { display:flex; justify-content:space-between; font-size:11px; padding:1.5px 0; }

  .th-amt { display:flex; justify-content:space-between; font-size:11px; padding:1.5px 0; }
  .th-amt.total { font-weight:700; }
  .th-amt.balance { font-weight:700; }
  .th-amt.grand { font-weight:900; font-size:13px; border-top:1.5px solid #000; margin-top:3px; padding-top:3px; }

  .th-invoice { text-align:center; font-weight:900; font-size:13px; margin:4px 0 2px; letter-spacing:1px; }
  .th-received { display:flex; justify-content:space-between; font-weight:700; font-size:11.5px; margin:2px 0; }

  .th-words { font-size:9.5px; margin:4px 0; }
  .th-disclaimer { font-size:8.5px; text-align:center; margin:4px 0; }

  .th-barcode { text-align:center; margin:6px 0 2px; }
  .th-barcode img { max-width:100%; height:34px; }

  .th-token { text-align:center; margin:4px 0; }
  .th-token-lbl { font-size:8.5px; font-weight:700; letter-spacing:1px; text-transform:uppercase; }
  .th-token-no { font-size:20px; font-weight:900; display:block; }

  .th-urdu { font-size:9px; text-align:center; direction:rtl; margin-top:5px; line-height:1.5; }

  @media print {
    @page { size: 80mm auto; margin: 0; }
    html, body { margin:0; padding:2mm 3mm; }
  }
</style>
</head>
<body>
  <img class="th-logo" src="${RECEIPT_LOGO_DATA_URI}" alt="logo" />
  <div class="th-addr">Jafar-e-Tayyar Co-op Housing Society, Malir Karachi<br/>Ph.: 4508390-91</div>

  ${isDuplicate ? '<div style="text-align:center;color:#000;font-weight:900;font-size:12px;letter-spacing:2px;margin-top:3px;">DUPLICATE</div>' : ''}

  <div class="th-divider solid"></div>

  <div class="th-row"><span class="lbl">Serial #:</span><span>${doc.serialNo}</span></div>
  <div class="th-row"><span class="lbl">Date:</span><span>${dateStr} ${timeStr}</span></div>
  <div class="th-row"><span class="lbl">Printed By:</span><span>${printedBy || '—'}</span></div>
  <div class="th-row"><span class="lbl">Patient:</span><span>${doc.patientType} ${doc.patientName}</span></div>
  <div class="th-row"><span class="lbl">Age:</span><span>${ageStr}</span></div>
  ${doc.mrNo ? `<div class="th-row"><span class="lbl">MR #:</span><span>${doc.mrNo}</span></div>` : ''}
  ${doc.referredBy && String(doc.referredBy).trim() ? `<div class="th-row"><span class="lbl">Ref. By:</span><span>${doc.referredBy}</span></div>` : ''}
  ${doc.antenatalNo && String(doc.antenatalNo).trim().toUpperCase() !== 'NA' ? `<div class="th-row"><span class="lbl">Antenatal #:</span><span>${doc.antenatalNo}</span></div>` : ''}

  ${doctorRowsHtml}

  <div class="th-divider"></div>

  ${lineItemsHtml}

  <div class="th-divider"></div>
  <div class="th-amt total"><span>Total:</span><span>${fmt(grossAmt)}</span></div>
  ${discount > 0 ? `<div class="th-amt"><span>Discount:</span><span>${fmt(discount)}</span></div>` : ''}

  <div class="th-divider"></div>
  <div class="th-invoice">${isDuplicate ? 'DUPLICATE — ' : ''}${label}</div>
  <div class="th-received"><span>Received</span><span>${fmt(received)}</span></div>
  ${balance > 0.01 ? `<div class="th-amt balance"><span>Balance:</span><span>${fmt(balance)}</span></div>` : ''}

  <div class="th-amt grand"><span>Grand Total:</span><span>${fmt(total)}</span></div>

  <div class="th-words">Received Rupees ${isComplementary ? 'Zero (Complementary)' : numberToWords(received)}</div>
  <div class="th-disclaimer">All Amount Received From Patients Treated As DONATION &amp; Exempt From Tax</div>

  ${showToken ? `<div class="th-token"><span class="th-token-lbl">Token</span><span class="th-token-no">${tokenNo}</span></div>` : ''}

  <div class="th-barcode">
    ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" alt="barcode"/>` : ''}
  </div>

  <div class="th-urdu">اسپتال کے کیش کاؤنٹر کے علاوہ کسی بھی شخص کو کسی بھی قسم کی ادائیگی نہ کریں۔ بصورت دیگر اسپتال ذمہ دار نہ ہوگا۔</div>

  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
