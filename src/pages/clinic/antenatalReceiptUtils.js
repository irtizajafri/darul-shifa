import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';
import { numberToWords, invoiceLabel } from './receiptUtils';

// ── Antenatal Registration Slip ─────────────────────────────────────────────
// Same visual template (logo/address/info-grid/barcode/footer) as the
// General OPD / Consultant OPD receipt (see receiptUtils.js /
// consultantReceiptUtils.js) — only the content is Antenatal-specific
// (LMP/EDD/Para/Gravida/Husband Name instead of OPD's department/services),
// and the single line item reads "ANTENATAL REGISTRATION" where an OPD slip
// would print the department/sub-department name.
export function buildAntenatalReceiptHtml({ antenatal, doctor, isDuplicate, barcodeDataUrl, printedBy }) {
  const doc = antenatal;
  const pt = doc.paymentType;
  const label = invoiceLabel(pt);
  const isComplementary = pt === 'complementary';

  // Registration is paid in full at the counter — no separate discount/CC
  // surcharge/partial-receive concept on this form (unlike OPD visits).
  const total    = isComplementary ? 0 : (Number(doc.amount) || 0);
  const received = total;

  const visitDate = doc.registrationDate ? new Date(doc.registrationDate) : new Date();
  const dateStr = visitDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '/');
  const timeStr = visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/') : '—';
  const fmt = (v) => Number(v || 0).toFixed(2);

  const doctorRowHtml = doctor?.name
    ? `<div class="doctor-row"><span class="doctor-name">${doctor.name}</span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Antenatal Registration - ${doc.serialNo || ''}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 9.5px; color: #000; background:#fff; width:520px; margin:auto; padding:6px 10px; }
  .logo-box { width:100%; }
  .logo-box .logo-img { width:100%; height:48px; object-fit:contain; }
  .address-box { text-align:center; margin-top:2px; }
  .address-box .address { font-size:8px; font-weight:700; margin-top:1px; color:#000; }
  .divider { border-top:1px solid #000; margin:3px 0; }

  .info-grid { display:grid; grid-template-columns: 1.1fr 1fr 1fr; row-gap:2px; margin-top:2px; }
  .info-grid span { font-size:9px; }
  .info-grid .lbl { font-weight:600; }

  .doctor-row { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; font-size:9.5px; margin-top:2px; }
  .doctor-row .doctor-name { font-weight:700; font-size:11px; }

  .line-item { display:flex; justify-content:space-between; font-size:9.5px; padding:1px 0; }

  .amount-row { display:flex; justify-content:space-between; padding: 1px 0; font-size:9.5px; }
  .amount-row.total { font-weight:700; }
  .amount-row.balance-row { font-weight:700; color:#b91c1c; }
  .amount-row.grand { font-weight:700; border-top:2px double #000; margin-top:2px; padding-top:2px; font-size:10.5px; }

  .invoice-row { display:flex; justify-content:space-between; align-items:center; margin-top:2px; }
  .invoice-left { display:flex; align-items:baseline; gap:8px; }
  .duplicate-lbl { font-weight:700; font-size:10.5px; }
  .invoice-label { font-size:13px; font-weight:900; }
  .received-lbl { font-size:10.5px; font-weight:700; }

  .in-words { font-size:8.5px; margin: 3px 0 1px; }
  .disclaimer { font-size:7.5px; text-align:right; margin-top:3px; margin-left:auto; max-width:280px; color:#111; }

  .bottom { display:flex; justify-content:space-between; align-items:flex-end; margin-top:5px; }
  .barcode-area { display:flex; align-items:center; gap:10px; }
  .barcode-area img { height:28px; }
  .footer-urdu { font-size:7.5px; text-align:right; direction:rtl; max-width:280px; }

  .info-grid, .line-item, .amount-row, .invoice-row, .bottom {
    page-break-inside: avoid;
  }

  @media print {
    @page { size: auto; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { width: 148mm; margin: 0 auto; padding: 5mm; }
  }
</style>
</head>
<body>
  <div class="logo-box">
    <img class="logo-img" src="${RECEIPT_LOGO_DATA_URI}" alt="logo" />
  </div>
  <div class="address-box">
    <div class="address">Jafar-e-Tayyar Co-operative Housing Society, Malir Karachi &nbsp; Ph.:4508390-91</div>
  </div>

  ${isDuplicate ? '<div style="text-align:center;color:red;font-weight:900;font-size:14px;letter-spacing:2px;">DUPLICATE</div>' : ''}

  <div class="info-grid">
    <span><span class="lbl">Serial #:</span> ${doc.serialNo || ''}</span>
    <span><span class="lbl">Date :</span> ${dateStr} ${timeStr}</span>
    <span><span class="lbl">Printed By:</span> ${printedBy || '—'}</span>

    <span><span class="lbl">Patient :</span> ${doc.patientName || ''}</span>
    ${doc.mrNo ? `<span><span class="lbl">MR #:</span> ${doc.mrNo}</span>` : '<span></span>'}
    <span><span class="lbl">Age:</span> ${doc.age != null ? `${doc.age} Year(s)` : '—'}</span>

    <span><span class="lbl">Antenatal #:</span> ${doc.antenatalNo || '—'}</span>
    <span><span class="lbl">LMP Date:</span> ${fmtDate(doc.lmpDate)}</span>
    <span><span class="lbl">EDD:</span> ${fmtDate(doc.edd)}</span>

    <span><span class="lbl">W/o:</span> ${doc.husbandName || '—'}</span>
    <span><span class="lbl">Para:</span> ${doc.para ?? 0}</span>
    <span><span class="lbl">Gravida:</span> ${doc.gravidia ?? 0}</span>
  </div>

  <div class="divider"></div>

  <div class="line-item"><span>ANTENATAL REGISTRATION</span><span>${fmt(total)}</span></div>

  <div class="divider"></div>
  <div class="amount-row total"><span>Total:</span><span>${fmt(total)}</span></div>

  <div class="divider"></div>
  <div class="invoice-row">
    <div class="invoice-left">
      ${isDuplicate ? '<span class="duplicate-lbl">Duplicate</span>' : ''}
      <span class="invoice-label">${label}</span>
    </div>
    <span class="received-lbl">Received&nbsp;&nbsp;${fmt(received)}</span>
  </div>

  <div class="divider"></div>
  <div class="amount-row grand"><span>Grand Total:</span><span>${fmt(total)}</span></div>

  <div class="in-words">Received Rupees ${isComplementary ? 'Zero (Complementary)' : numberToWords(received)}</div>

  ${doctorRowHtml}

  <div class="disclaimer">All Amount Received From Patients Treated As DONATION &amp; Exempt From Tax</div>

  <div class="bottom">
    <div class="barcode-area">
      ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" alt="barcode"/>` : ''}
    </div>
    <div class="footer-urdu">اسپتال کے کیش کاؤنٹر کے علاوہ کسی بھی شخص کو کسی بھی قسم کی ادائیگی نہ کریں۔ بصورت دیگر اسپتال ذمہ دار نہ ہوگا۔</div>
  </div>

  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}

// ── Antenatal Card (patient's own copy) ─────────────────────────────────────
// Same size/skeleton as the receipt above (and General OPD's slip) — no
// amount/payment section at all, just the registration + pregnancy details
// the patient carries with her on follow-up visits.
export function buildAntenatalCardHtml({ antenatal, doctor, barcodeDataUrl }) {
  const doc = antenatal;
  const visitDate = doc.registrationDate ? new Date(doc.registrationDate) : new Date();
  const dateStr = visitDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/');
  const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/') : '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Antenatal Card - ${doc.serialNo || ''}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 9.5px; color: #000; background:#fff; width:520px; margin:auto; padding:6px 10px; }
  .logo-box { width:100%; }
  .logo-box .logo-img { width:100%; height:48px; object-fit:contain; }
  .address-box { text-align:center; margin-top:2px; }
  .address-box .address { font-size:8px; font-weight:700; margin-top:1px; color:#000; }
  .divider { border-top:1px solid #000; margin:3px 0; }

  .info-grid { display:grid; grid-template-columns: 1.1fr 1fr 1fr; row-gap:2px; margin-top:2px; }
  .info-grid span { font-size:9px; }
  .info-grid .lbl { font-weight:600; }

  .doctor-row { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; font-size:9.5px; margin-top:4px; }
  .doctor-row .doctor-name { font-weight:700; font-size:11px; }

  .bottom { display:flex; justify-content:space-between; align-items:flex-end; margin-top:8px; }
  .barcode-area { display:flex; align-items:center; gap:10px; }
  .barcode-area img { height:28px; }

  .info-grid, .doctor-row, .bottom { page-break-inside: avoid; }

  @media print {
    @page { size: auto; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { width: 148mm; margin: 0 auto; padding: 5mm; }
  }
</style>
</head>
<body>
  <div class="logo-box">
    <img class="logo-img" src="${RECEIPT_LOGO_DATA_URI}" alt="logo" />
  </div>
  <div class="address-box">
    <div class="address">Jafar-e-Tayyar Co-operative Housing Society, Malir Karachi &nbsp; Ph.:4508390-91</div>
  </div>

  <div class="info-grid">
    <span><span class="lbl">Antenatal #:</span> ${doc.antenatalNo || '—'}</span>
    <span><span class="lbl">Slip #:</span> ${doc.serialNo || ''}</span>
    <span><span class="lbl">Slip Date:</span> ${dateStr}</span>

    <span><span class="lbl">Patient's Name:</span> ${doc.patientName || ''}</span>
    <span><span class="lbl">W/o:</span> ${doc.husbandName || '—'}</span>
    <span></span>

    <span><span class="lbl">LMP Date:</span> ${fmtDate(doc.lmpDate)}</span>
    <span><span class="lbl">EDD:</span> ${fmtDate(doc.edd)}</span>
    <span></span>

    <span><span class="lbl">Para:</span> ${doc.para ?? 0}</span>
    <span><span class="lbl">Gravida:</span> ${doc.gravidia ?? 0}</span>
    <span></span>
  </div>

  <div class="divider"></div>

  <div class="doctor-row">
    <span>Under Observation of ${doctor?.name ? `<span class="doctor-name">${doctor.name}</span>` : '<span class="doctor-name">Visiting Doctor (RMO)</span>'}</span>
  </div>

  <div class="bottom">
    <div class="barcode-area">
      ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" alt="barcode"/>` : ''}
    </div>
  </div>

  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
