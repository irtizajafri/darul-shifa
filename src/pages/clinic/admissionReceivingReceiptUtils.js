import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';
import { numberToWords } from './receiptUtils';

// ── Receiving against Admission — payment receipt ────────────────────────────
export function buildAdmissionPaymentReceiptHtml({ payment, admission, printedBy, barcodeDataUrl, isDuplicate }) {
  const dt = new Date(payment.receivedAt || payment.createdAt);
  const dateStr = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/');
  const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const admDt = new Date(admission.createdAt);
  const admDateStr = admDt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '/');
  const admTimeStr = admDt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const patientName = `${admission.patientTitle || ''} ${admission.patientName || ''}`.trim();
  const amt = Number(payment.amount) || 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Receiving Slip - ${payment.serialNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background:#fff; width:520px; margin:auto; padding:10px 14px; }
  .logo-box { width:100%; }
  .logo-box .logo-img { width:100%; height:100px; }
  .address-box { text-align:center; margin-top:4px; }
  .address-box .address { font-size:9.5px; font-weight:700; margin-top:2px; color:#000; }
  .divider { border-top:1px solid #000; margin:5px 0; }
  .divider.thick { border-top:2px solid #000; }

  .info-grid { display:grid; grid-template-columns: 1.1fr 1fr 1fr; row-gap:3px; margin-top:4px; }
  .info-grid span { font-size:10.5px; }
  .info-grid .lbl { font-weight:600; }

  .amount-row { display:flex; justify-content:space-between; padding: 1px 0; font-size:11px; }
  .amount-row.grand { font-weight:700; border-top:2px double #000; margin-top:6px; padding-top:4px; font-size:13px; }

  .title-row { text-align:center; font-weight:900; font-size:14px; margin:8px 0 4px; letter-spacing:1px; }
  .in-words { font-size:10px; margin: 6px 0 2px; }
  .disclaimer { font-size:9px; text-align:center; margin-top:6px; color:#111; }

  .bottom { display:flex; justify-content:space-between; align-items:flex-end; margin-top:10px; }
  .barcode-area img { height:40px; }
  .footer-urdu { font-size:9px; text-align:right; direction:rtl; max-width:280px; }

  @media print {
    body { width:100%; }
    @page { margin:4mm; size: 148mm 105mm; }
  }
</style>
</head>
<body>
  <div class="logo-box">
    <img class="logo-img" src="${RECEIPT_LOGO_DATA_URI}" alt="logo" />
  </div>
  <div class="address-box">
    <div class="address">Jafar-e-Tayyar Co-operative Housing Society, Malir Karachi</div>
    <div class="address">Ph.:4508390-91, Fax:4508392 &nbsp; Email : darulshifa@yahoo.com</div>
  </div>

  ${isDuplicate ? '<div style="text-align:center;color:red;font-weight:900;font-size:14px;letter-spacing:2px;">DUPLICATE</div>' : ''}

  <div class="title-row">RECEIVING AGAINST ADMISSION</div>
  <div class="divider thick"></div>

  <div class="info-grid">
    <span><span class="lbl">Serial #:</span> ${payment.serialNo}</span>
    <span><span class="lbl">Date:</span> ${dateStr}</span>
    <span><span class="lbl">Time:</span> ${timeStr}</span>

    <span><span class="lbl">Admission #:</span> ${admission.admissionNo}</span>
    <span><span class="lbl">Admitted:</span> ${admDateStr}</span>
    <span><span class="lbl">${admTimeStr}</span></span>

    <span style="grid-column: span 3;"><span class="lbl">Patient:</span> ${patientName}</span>
    <span style="grid-column: span 3;"><span class="lbl">Printed By:</span> ${printedBy || '—'}</span>
  </div>

  <div class="divider"></div>

  <div class="amount-row">
    <span>Payment Type</span>
    <span>${payment.paymentType === 'cc' ? 'Credit Card' : 'Cash'}</span>
  </div>
  <div class="amount-row grand">
    <span>Amount Received</span>
    <span>${amt.toFixed(2)}</span>
  </div>

  <div class="in-words">Received Rupees ${numberToWords(amt)}.</div>
  <div class="disclaimer">All Amount Received From Patients Treated As DONATION &amp; Exempt From Tax</div>

  <div class="bottom">
    <div class="barcode-area">
      ${barcodeDataUrl ? `<img src="${barcodeDataUrl}" alt="barcode" />` : ''}
    </div>
    <div class="footer-urdu">
      اسپتال کے کیش کاؤنٹر کے علاوہ کسی بھی شخص کو کسی بھی قسم کی ادائیگی نہ کریں۔ دیگر اسپتال ذمہ دار نہ ہوگا۔
    </div>
  </div>
</body>
</html>`;
}
