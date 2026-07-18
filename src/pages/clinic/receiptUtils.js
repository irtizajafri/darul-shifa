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
export function buildReceiptHtml({ visit, tokenNo, isDuplicate, barcodeDataUrl, printedBy }) {
  const doc = visit;
  const dr = doc.doctors?.[0];
  const drName = dr?.doctor?.name || '';
  const drQual = dr?.doctor?.qualification || dr?.doctor?.staffCategory?.name || '';
  const subDeptName = dr?.subDept?.name || '';

  const pt = doc.paymentType;
  const label = invoiceLabel(pt);
  const isComplementary = pt === 'complementary';

  const total     = isComplementary ? 0 : (doc.totalAmount || 0);
  const discount  = isComplementary ? 0 : (doc.discount   || 0);
  const received  = isComplementary ? 0 : (doc.receive    || 0);
  const grossAmt  = total + discount;

  const ageStr = [
    doc.age != null ? `${doc.age} Year(s)` : '',
    doc.ageMonths   ? `${doc.ageMonths} Month(s)` : '',
    doc.ageDays     ? `${doc.ageDays} Day(s)` : '',
  ].filter(Boolean).join(' ') || '—';

  const now = new Date();
  const printTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const visitDate = new Date(doc.createdAt);
  const dateStr = visitDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '/');
  const timeStr = visitDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const fmt = (v) => Number(v || 0).toFixed(2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>OPD Receipt - ${doc.serialNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background:#fff; width:320px; margin:auto; padding:8px; }
  .header { text-align:center; border-bottom: 2px double #000; padding-bottom:6px; margin-bottom:6px; }
  .header .logo-row { display:flex; align-items:center; justify-content:center; gap:6px; }
  .header .crescent { font-size:22px; }
  .header .hosp-name { font-size:17px; font-weight:900; letter-spacing:1px; }
  .header .sub-name { font-size:12px; font-weight:700; letter-spacing:0.5px; }
  .header .address { font-size:9px; margin-top:3px; color:#222; }
  .info-row { display:flex; justify-content:space-between; margin-bottom:2px; }
  .info-row span { font-size:10px; }
  .info-row .lbl { font-weight:600; }
  .divider { border-top:1px solid #000; margin:5px 0; }
  .visit-title { text-align:center; font-size:12px; font-weight:700; margin:5px 0 4px; }
  .amount-row { display:flex; justify-content:space-between; padding: 1px 4px; font-size:11px; }
  .amount-row.grand { font-weight:700; border-top:1px solid #000; margin-top:3px; padding-top:3px; }
  .in-words { font-size:9px; margin: 5px 0 3px; font-style:italic; }
  .bottom { display:flex; justify-content:space-between; align-items:flex-start; margin-top:8px; }
  .barcode-area { max-width:120px; }
  .barcode-area img { width:100%; }
  .center-area { text-align:center; flex:1; }
  .invoice-label { font-size:12px; font-weight:700; }
  .token-box { display:inline-block; border:2px solid #000; width:36px; height:36px; line-height:36px; text-align:center; font-size:20px; font-weight:900; margin-top:4px; }
  .rmo-area { text-align:right; font-size:10px; }
  .rmo-area .rmo-lbl { font-size:9px; }
  .rmo-area .rmo-name { font-size:12px; font-weight:700; }
  .footer-urdu { font-size:9px; text-align:center; margin-top:8px; direction:rtl; border-top:1px solid #000; padding-top:4px; }
  .duplicate { color:red; font-size:22px; font-weight:900; text-align:center; letter-spacing:4px; border:3px solid red; padding:2px 8px; display:inline-block; transform:rotate(-10deg); margin: 6px auto; }
  @media print {
    body { width:100%; }
    @page { margin:4mm; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="logo-row">
      <span class="crescent">☾</span>
      <div>
        <div class="hosp-name">DARUL SHIFA</div>
        <div class="sub-name">IMAM KHOMEINI (REGD)</div>
      </div>
    </div>
    <div class="address">Jafar-e-Tayyar Co-operative Housing Society, Malir Karachi</div>
    <div class="address">Ph.: 4508390-91, Fax: 4508392 &nbsp; Email: darulshifa@yahoo.com</div>
  </div>

  ${isDuplicate ? '<div style="text-align:center"><span class="duplicate">DUPLICATE</span></div>' : ''}

  <div class="info-row">
    <span><span class="lbl">Serial #:</span> ${doc.serialNo}</span>
    <span><span class="lbl">Date:</span> ${dateStr} ${timeStr}</span>
  </div>
  <div class="info-row">
    <span><span class="lbl">Patient:</span> ${doc.patientType} ${doc.patientName}</span>
    <span><span class="lbl">Printed By:</span> ${printedBy || '—'}</span>
  </div>
  <div class="info-row">
    <span></span>
    <span><span class="lbl">Age:</span> ${ageStr}</span>
  </div>
  <div class="info-row">
    <span></span>
    <span><span class="lbl">Time:</span> ${printTime}</span>
  </div>

  <div class="divider"></div>

  <div class="visit-title">GENERAL OPD${subDeptName ? ` (${subDeptName})` : ''}</div>

  <div class="amount-row"><span>Total:</span><span>${fmt(grossAmt)}</span></div>
  <div class="amount-row"><span>Discount:</span><span>${fmt(discount)}</span></div>
  <div class="amount-row"><span>Received:</span><span>${fmt(received)}</span></div>
  <div class="amount-row grand"><span>Grand Total:</span><span>Rs. ${fmt(total)}</span></div>

  <div class="divider"></div>
  <div class="in-words">Received Rupees ${isComplementary ? 'Zero (Complementary)' : numberToWords(received)}</div>

  <div class="bottom">
    <div class="barcode-area">
      ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" alt="barcode"/>` : ''}
    </div>
    <div class="center-area">
      <div class="invoice-label">${label}</div>
      <div class="token-box">${tokenNo}</div>
    </div>
    <div class="rmo-area">
      <div class="rmo-lbl">RMO</div>
      <div class="rmo-name">${drName}</div>
      <div>${drQual}</div>
    </div>
  </div>

  <div class="footer-urdu">اسپتال کے کیش کاؤنٹر کے علاوہ کسی بھی شخص کو کسی بھی قسم کی ادائیگی نہ کریں۔ بصورت دیگر اسپتال ذمہ دار نہ ہوگا۔</div>

  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
