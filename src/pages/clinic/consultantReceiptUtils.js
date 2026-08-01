import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';

// ── Number to Words (Rupees) ──────────────────────────────────────────────────
const ONES = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const TENS = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

function _w(n) {
  if (n === 0) return '';
  if (n < 20) return ONES[n] + ' ';
  if (n < 100) return TENS[Math.floor(n / 10)] + ' ' + _w(n % 10);
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' Hundred ' + _w(n % 100);
  if (n < 100000) return _w(Math.floor(n / 1000)) + 'Thousand ' + _w(n % 1000);
  if (n < 10000000) return _w(Math.floor(n / 100000)) + 'Lakh ' + _w(n % 100000);
  return _w(Math.floor(n / 10000000)) + 'Crore ' + _w(n % 10000000);
}

export function numberToWords(n) {
  const num = Math.round(Math.abs(n || 0));
  if (num === 0) return 'Zero Only';
  return _w(num).replace(/\s+/g, ' ').trim() + ' Only';
}

// ── Invoice label from payment type ──────────────────────────────────────────
export function invoiceLabel(paymentType) {
  switch (paymentType) {
    case 'cc':
    case 'panel':     return 'CREDIT INVOICE';
    case 'jazzcash':  return 'JAZZCASH';
    case 'complementary': return 'COMPLEMENTARY';
    default:          return 'CASH INVOICE';
  }
}

// ── Receipt HTML ──────────────────────────────────────────────────────────────
export function buildConsultantReceiptHtml({ visit, tokenNo, isDuplicate, barcodeDataUrl, printedBy }) {
  const doc = visit;
  const docEntries = doc.doctors || [];
  // Distinct performing-doctor names (a visit can have multiple selected services/doctors)
  const performNames = [...new Set(docEntries.map((d) => d.doctor?.name).filter(Boolean))].join(', ') || '—';

  const pt = doc.paymentType;
  const label = invoiceLabel(pt);
  const isComplementary = pt === 'complementary';

  const total     = isComplementary ? 0 : (doc.totalAmount || 0);
  const discount  = isComplementary ? 0 : (doc.discount   || 0);
  const received  = isComplementary ? 0 : (doc.receive    || 0);
  const grossAmt  = total + discount;
  const balance   = Math.max(0, total - received);

  const ageStr = [
    doc.age != null ? `${doc.age} Year(s)` : '0 Year(s)',
    `${doc.ageMonths || 0} Month(s)`,
    `${doc.ageDays   || 0} Day(s)`,
  ].join(' ');

  const visitDate = new Date(doc.createdAt);
  const dateStr = visitDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '/');
  const timeStr = visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const fmt = (v) => Number(v || 0).toFixed(2);

  const lineItemsHtml = (docEntries.length ? docEntries : [{ subDept: { name: doc.department || 'OPD' }, amount: grossAmt }])
    .map((d) => `<div class="line-item"><span>${(d.subDept?.name || '').toUpperCase()}</span><span>${fmt(d.amount)}</span></div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>OPD Receipt - ${doc.serialNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  /* A6 landscape usable height is only ~105mm (~367px) minus margins — every
     size below is deliberately tight (not just "small") so that a slip with
     several line items (multiple doctors/services) still fits on ONE page
     instead of spilling onto a 2nd. The logo was the single biggest offender
     at a fixed 100px (~27% of the whole usable height on its own). */
  body { font-family: Arial, sans-serif; font-size: 9.5px; color: #000; background:#fff; width:520px; margin:auto; padding:6px 10px; }
  /* Logo box takes the SAME width as the rest of the slip content (body minus padding) */
  .logo-box { width:100%; }
  .logo-box .logo-img { width:100%; height:48px; object-fit:contain; }
  .address-box { text-align:center; margin-top:2px; }
  .address-box .address { font-size:8px; font-weight:700; margin-top:1px; color:#000; }
  .divider { border-top:1px solid #000; margin:3px 0; }
  .divider.thick { border-top:2px solid #000; }

  .info-grid { display:grid; grid-template-columns: 1.1fr 1fr 1fr; row-gap:2px; margin-top:2px; }
  .info-grid span { font-size:9px; }
  .info-grid .lbl { font-weight:600; }

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
  .disclaimer { font-size:7.5px; text-align:center; margin-top:3px; color:#111; }

  .bottom { display:flex; justify-content:space-between; align-items:flex-end; margin-top:5px; }
  .barcode-area img { height:28px; }
  .footer-urdu { font-size:7.5px; text-align:right; direction:rtl; max-width:280px; }

  .info-grid, .line-item, .amount-row, .invoice-row, .bottom {
    page-break-inside: avoid;
  }

  @media print {
    /* Explicit width×height (148mm × 105mm = A6 landscape) instead of the
       named "A6 landscape" form — printers whose driver doesn't recognize
       "A6" as a named size silently drop the whole size+orientation value
       and fall back to their own default (usually A4 portrait). Explicit
       mm dimensions keep the wide/landscape shape even when a printer
       can't match the exact paper size. */
    @page { margin:3mm; size: 148mm 105mm; }
    /* Let the body fill whatever printable box the printer actually gives
       (width:100%) instead of a hard-coded 142mm — real printers have hardware
       margins, so a fixed 142mm can exceed the printable width and make the
       driver shrink the WHOLE slip to "fit" (tiny print). padding:0 drops the
       on-screen padding so it doesn't stack on top of the @page 3mm margin
       (that double-margin was what pushed the footer onto a 2nd page). No
       fixed height / overflow:hidden — those clipped content on printers whose
       imageable height is under 99mm. */
    html, body { margin:0; padding:0; }
    body { width:100%; }
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
    <span><span class="lbl">Serial #:</span> ${doc.serialNo}</span>
    <span><span class="lbl">Date :</span> ${dateStr} ${timeStr}</span>
    <span><span class="lbl">Printed By:</span> ${printedBy || '—'}</span>

    <span><span class="lbl">Patient :</span> ${doc.patientType} ${doc.patientName}</span>
    <span></span>
    <span><span class="lbl">Age:</span> ${ageStr}</span>

    <span><span class="lbl">Ref. By</span> &nbsp;${doc.referredBy || '—'}</span>
    <span><span class="lbl">Perform By :</span> ${performNames}</span>
    <span></span>

    <span>&nbsp;&nbsp;&nbsp;${doc.antenatalNo || 'NA'}</span>
    <span></span>
    <span></span>
  </div>

  <div class="divider"></div>

  ${lineItemsHtml}

  <div class="divider"></div>
  <div class="amount-row total"><span>Total:</span><span>${fmt(grossAmt)}</span></div>
  ${discount > 0 ? `<div class="amount-row"><span>Discount:</span><span>${fmt(discount)}</span></div>` : ''}

  <div class="divider"></div>
  <div class="invoice-row">
    <div class="invoice-left">
      ${isDuplicate ? '<span class="duplicate-lbl">Duplicate</span>' : ''}
      <span class="invoice-label">${label}</span>
    </div>
    <span class="received-lbl">Received&nbsp;&nbsp;${fmt(received)}</span>
  </div>
  ${balance > 0.01 ? `<div class="amount-row balance-row"><span>Balance:</span><span>${fmt(balance)}</span></div>` : ''}

  <div class="divider"></div>
  <div class="amount-row grand"><span>Grand Total:</span><span>${fmt(total)}</span></div>

  <div class="in-words">Received Rupees ${isComplementary ? 'Zero (Complementary)' : numberToWords(received)}</div>
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
