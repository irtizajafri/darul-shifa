// Payment Refund Slip — printed from Transactions > Discount & Refund Against
// Admission whenever a refund is saved (and reprinted from its history row).
// Layout copies the hospital's existing paper slip.
//
// Same print conventions as the Death/Birth/Discharge Certificates: a
// standalone popup window (never window.print() on the main window, which can
// freeze the app on Windows), no @page size so A4 or A5 both print the same,
// a fixed 130mm-wide centered block, and a 40mm top margin so the content
// starts below the pre-printed letterhead.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

function dateTime(d, withSeconds = false) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const base = `${pad(dt.getDate())}-${MON[dt.getMonth()]}-${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  return withSeconds ? `${base}:${pad(dt.getSeconds())}` : base;
}
function dateTime12(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const h = dt.getHours() % 12 || 12;
  return `${pad(dt.getDate())}-${MON[dt.getMonth()]}-${dt.getFullYear()} ${h}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())} ${dt.getHours() < 12 ? 'AM' : 'PM'}`;
}

const RELATION_LABEL = { son: 'S/o', daughter: 'D/o', wife: 'W/o', husband: 'H/o', father: 'F/o', mother: 'M/o' };
function relationLabel(type) {
  const t = String(type || '').trim();
  if (!t) return 'S/o / W/o';
  if (/^[a-z]\/o$/i.test(t)) return t.charAt(0).toUpperCase() + '/o';
  return RELATION_LABEL[t.toLowerCase()] || t;
}

const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #000; background: #fff; width: 130mm; margin: 0 auto; }
.rs-title { text-align: center; font-size: 13pt; font-weight: 700; text-decoration: underline; margin-bottom: 8px; }
.rs-head { display: grid; grid-template-columns: 1fr 1.3fr 1fr; gap: 4px 10px; margin-bottom: 10px; }
.rs-head .r { text-align: right; }
.rs-lbl { font-weight: 700; }
.rs-sub { text-align: center; font-weight: 700; text-decoration: underline; margin: 6px 0 4px; }
.rs-box { border: 1px solid #000; margin: 0 6mm 10px; }
.rs-tbl { width: 100%; border-collapse: collapse; }
.rs-tbl th { text-align: left; font-weight: 700; border-bottom: 1px solid #000; padding: 3px 6px; }
.rs-tbl td { padding: 3px 6px; }
.rs-tbl .num { text-align: right; }
.rs-tbl tfoot td { border-top: 1px solid #000; font-weight: 700; }
.rs-refund { border: 1px solid #000; margin-top: 4px; }
.rs-refund-title { text-align: center; font-weight: 700; border-bottom: 1px solid #000; padding: 3px 0; }
.rs-refund-body { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; padding: 6px 8px; }
.rs-row { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
.rs-row .v { font-weight: 700; text-align: right; }
.rs-row.big .v { font-size: 11pt; }
.rs-sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 34px; text-align: center; }
.rs-sign .name { min-height: 14px; font-weight: 700; }
.rs-sign .line { border-top: 1px solid #000; padding-top: 3px; font-weight: 700; }
@page { margin: 40mm 9mm 8mm 9mm; }
`;

/**
 * @param {object} d
 * @param {object} d.admission       ClinicAdmission row
 * @param {object} d.entry           ClinicAdmissionDiscountRefund row being printed
 * @param {Array}  d.paymentHistory  [{ date, slipNo, amount }]
 * @param {string} [d.dischargeDate]
 * @param {string} [d.printedBy]
 */
export function buildRefundSlipPrintHtml({ admission, entry, paymentHistory = [], dischargeDate, printedBy }) {
  const patient = `${admission?.patientTitle || ''} ${admission?.patientName || ''}`.trim();
  const historyTotal = paymentHistory.reduce((s, p) => s + Number(p.amount || 0), 0);
  const discount = Number(entry?.discountAmount || 0);
  const rows = paymentHistory.length
    ? paymentHistory.map((p) => `<tr><td>${esc(dateTime(p.date, true))}</td><td>${esc(p.slipNo)}</td><td class="num">${money(p.amount)}</td></tr>`).join('')
    : '<tr><td colspan="3" style="text-align:center">—</td></tr>';

  const body = `
<div class="rs-title">Payment Refund Slip</div>
<div class="rs-head">
  <div><span class="rs-lbl">Admission #:</span> ${esc(admission?.admissionNo)}</div>
  <div><span class="rs-lbl">Patient:</span> ${esc(patient)}</div>
  <div class="r">${esc(dateTime12(entry?.createdAt || new Date()))}</div>
  <div style="grid-column: 1 / span 3"><span class="rs-lbl">${esc(relationLabel(admission?.relationType))}</span> ${esc(admission?.relationName || '')}</div>
</div>

<div class="rs-sub">Payment History</div>
<div class="rs-box">
  <table class="rs-tbl">
    <thead><tr><th>Date &amp; Time</th><th>Slip #</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="2" class="num">Grand Total:</td><td class="num">${money(historyTotal)}</td></tr></tfoot>
  </table>
</div>

<div class="rs-refund">
  <div class="rs-refund-title">Refund</div>
  <div class="rs-refund-body">
    <div>
      <div class="rs-row"><span>Receive Amount:</span><span class="v">${money(entry?.receivedAmount)}</span></div>
      <div class="rs-row"><span>Bill Amount:</span><span class="v">${money(entry?.billAmount)}</span></div>
      ${discount > 0 ? `<div class="rs-row"><span>Discount:</span><span class="v">${money(discount)}</span></div>` : ''}
      <div class="rs-row big"><span>Refund:</span><span class="v">${money(entry?.refundAmount)}</span></div>
    </div>
    <div>
      <div class="rs-row"><span>Permission By:</span><span class="v">${esc(entry?.permissionBy || '—')}</span></div>
      <div class="rs-row"><span>Discharge date:</span><span class="v">${esc(dischargeDate ? dateTime(dischargeDate) : '—')}</span></div>
      ${entry?.voucherNo ? `<div class="rs-row"><span>Voucher #:</span><span class="v">${esc(entry.voucherNo)}</span></div>` : ''}
    </div>
  </div>
</div>

<div class="rs-sign">
  <div><div class="name"></div><div class="line">Received By</div></div>
  <div><div class="name"></div><div class="line">Paid By</div></div>
  <div><div class="name">${esc(printedBy || entry?.createdByName || '')}</div><div class="line">Printed By</div></div>
</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Payment Refund Slip - ${esc(admission?.admissionNo || '')}</title>
<style>${CSS}</style>
</head>
<body>
${body}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
