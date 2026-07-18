import { numberToWords, invoiceLabel } from './receiptUtils';

export function buildEmergencyReceiptHtml({ visit, tokenNo, isDuplicate, printedBy }) {
  const doc   = visit;
  const dr    = doc.doctors?.[0];
  const drName = dr?.doctor?.name || '';

  const pt    = doc.paymentType;
  const label = invoiceLabel(pt);
  const isComplementary = pt === 'complementary';

  const total    = isComplementary ? 0 : (doc.totalAmount || 0);
  const discount = isComplementary ? 0 : (doc.discount    || 0);
  const received = isComplementary ? 0 : (doc.receive     || total);
  const grossAmt = total + discount;

  const ageStr = [
    doc.age != null ? `${doc.age} Yr(s)` : '0 Yr(s)',
    `${doc.ageMonths || 0} M`,
    `${doc.ageDays   || 0} D`,
  ].join(' ');

  const visitDate = new Date(doc.createdAt);
  const dateStr   = visitDate.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }).replace(/ /g, '-');
  const timeStr   = visitDate.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true });

  const fmt = (v) => Number(v || 0).toFixed(2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Emergency Slip - ${doc.serialNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Arial, sans-serif;
    font-size: 11px;
    color: #000;
    background: #fff;
    width: 710px;
    margin: auto;
    padding: 12px 16px;
  }

  /* ── Header ── */
  .hdr {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding-bottom: 8px;
    border-bottom: 3px double #000;
    margin-bottom: 6px;
  }
  .hdr-logo { font-size: 44px; line-height: 1; }
  .hdr-text { text-align: left; }
  .hdr-h1 { font-size: 26px; font-weight: 900; letter-spacing: 3px; }
  .hdr-h2 { font-size: 16px; font-weight: 700; letter-spacing: 1px; margin-top: 1px; }
  .hdr-addr { font-size: 9px; color: #444; margin-top: 3px; line-height: 1.5; }

  /* ── Token ── */
  .token-line {
    text-align: center;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 2px;
    margin: 4px 0 6px;
  }

  /* ── Info rows ── */
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 2px; }
  .info-table td { font-size: 10.5px; padding: 2px 3px; }
  .info-table .lbl { font-weight: 700; padding-right: 4px; white-space: nowrap; }
  .info-table .val { border-bottom: 1px solid #ccc; width: 100%; }
  .info-sep { border-bottom: 1px dashed #bbb; }

  /* ── Title bar ── */
  .title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    padding: 5px 8px;
    margin: 7px 0 5px;
    background: #f4f4f4;
  }
  .emr-title { font-size: 14px; font-weight: 900; letter-spacing: 1.5px; }
  .total-box { text-align: right; font-size: 11.5px; font-weight: 700; }
  .total-box .amt { font-size: 14px; }

  /* ── Invoice block ── */
  .inv-block { border: 1px solid #aaa; padding: 5px 8px; margin-bottom: 4px; }
  .inv-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .inv-label { font-size: 14px; font-weight: 900; }
  .inv-ref { font-size: 8.5px; color: #555; margin-top: 1px; }
  .inv-right { text-align: right; }
  .inv-received { font-size: 11px; font-weight: 700; }
  .inv-grand { font-size: 13px; font-weight: 900; border-top: 1px solid #000; margin-top: 3px; padding-top: 2px; }
  .inv-words { font-size: 9.5px; font-style: italic; margin-top: 3px; color: #333; }

  /* ── DUPLICATE stamp ── */
  .duplicate {
    color: red; font-size: 20px; font-weight: 900; letter-spacing: 3px;
    border: 2px solid red; padding: 2px 8px;
    display: inline-block; transform: rotate(-8deg);
    margin-right: 8px;
  }

  /* ── Urdu disclaimer ── */
  .urdu {
    font-size: 9.5px; text-align: center; direction: rtl;
    border-top: 1px dashed #999; border-bottom: 1px dashed #999;
    padding: 3px 0; margin: 5px 0; line-height: 1.7;
  }

  /* ══════════════ Clinical Form ══════════════ */
  .form-wrap { border: 2px solid #000; margin-top: 8px; }

  .form-title {
    background: #2c2c2c; color: #fff;
    font-size: 11px; font-weight: 700;
    text-align: center; letter-spacing: 3px;
    padding: 4px;
  }

  /* Standard label+value row */
  .fr { display: flex; border-bottom: 1px solid #777; min-height: 36px; }
  .fr:last-child { border-bottom: none; }
  .fl {
    font-weight: 700; font-size: 10px;
    padding: 5px 7px;
    width: 120px; min-width: 120px;
    background: #f8f8f8;
    border-right: 1px solid #777;
    display: flex; align-items: center;
  }
  .fv { flex: 1; padding: 5px 7px; }
  .fv--tall { min-height: 52px; }
  .fv--xl   { min-height: 68px; }

  /* Multi-column rows */
  .fc { display: flex; border-bottom: 1px solid #777; min-height: 32px; }
  .fc-cell {
    flex: 1; padding: 5px 7px;
    border-right: 1px solid #888;
    font-size: 10px;
    display: flex; align-items: center; gap: 6px;
  }
  .fc-cell:last-child { border-right: none; }
  .fc-cell .lbl { font-weight: 700; white-space: nowrap; }
  .fc-cell--wide { flex: 2; }

  /* Checkbox style for alert/oriented/etc */
  .cb {
    display: inline-block; width: 12px; height: 12px;
    border: 1px solid #555; flex-shrink: 0;
    vertical-align: middle; margin-left: 3px;
  }

  /* Vitals */
  .vitals-row { display: flex; border-bottom: 1px solid #777; min-height: 42px; }
  .vt {
    flex: 1; padding: 5px 7px;
    border-right: 1px solid #888;
    font-size: 10px;
  }
  .vt:last-child { border-right: none; }
  .vt .lbl { font-weight: 700; display: block; margin-bottom: 4px; }
  .vt-line { border-bottom: 1px solid #999; margin-top: 8px; }

  /* Section header inside form */
  .sec-hdr {
    background: #e0e0e0; font-weight: 700;
    font-size: 10.5px; padding: 3px 7px;
    border-bottom: 1px solid #777;
    border-top: 1px solid #777;
    letter-spacing: 1px;
  }

  /* Treatment boxes */
  .tx-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px; padding: 6px;
  }
  .tx-box {
    border: 1px solid #777; padding: 4px 7px;
    min-height: 42px; font-size: 10px;
  }
  .tx-num { font-weight: 700; margin-right: 4px; }

  /* Investigation advice */
  .inv-adv { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 6px 8px; }
  .inv-adv-item { display: flex; align-items: center; gap: 4px; font-size: 10px; min-height: 26px; }
  .inv-adv-item .lbl { font-weight: 700; white-space: nowrap; }
  .inv-adv-line { flex: 1; border-bottom: 1px solid #333; }

  @media print {
    body { width: 100%; padding: 6px; }
    @page { margin: 5mm; size: A4; }
    button { display: none !important; }
  }
</style>
</head>
<body>

  <!-- ══ Hospital Header ══ -->
  <div class="hdr">
    <div class="hdr-logo">☾</div>
    <div class="hdr-text">
      <div class="hdr-h1">DARUL SHIFA</div>
      <div class="hdr-h2">IMAM KHOMEINI (REGD)</div>
      <div class="hdr-addr">Jafar-e-Tayyar Co-operative Housing Society, Malir Karachi</div>
      <div class="hdr-addr">Ph.: 4508390-91 &nbsp;|&nbsp; Fax: 4508392 &nbsp;|&nbsp; Email: darulshifa@yahoo.com</div>
    </div>
  </div>

  <!-- Token -->
  <div class="token-line">${tokenNo ? `Token: ${tokenNo}` : ''}</div>

  <!-- Info rows -->
  <table class="info-table">
    <tr>
      <td style="width:15%"><span class="lbl">Serial #:</span></td>
      <td style="width:25%">${doc.serialNo}</td>
      <td style="width:15%"><span class="lbl">Date:</span></td>
      <td style="width:25%">${dateStr} &nbsp; ${timeStr}</td>
      <td style="width:10%"><span class="lbl">Printed By:</span></td>
      <td style="width:10%">${printedBy || '—'}</td>
    </tr>
    <tr class="info-sep"><td colspan="6" style="height:3px"></td></tr>
    <tr>
      <td><span class="lbl">Patient:</span></td>
      <td colspan="3">${doc.patientType || ''} &nbsp; <strong>${doc.patientName || ''}</strong></td>
      <td><span class="lbl">Age:</span></td>
      <td>${ageStr}</td>
    </tr>
    <tr>
      <td><span class="lbl">Ref. By:</span></td>
      <td colspan="3">${doc.referredBy || '—'}</td>
      <td><span class="lbl">Attend By:</span></td>
      <td>${drName || '—'}</td>
    </tr>
  </table>

  <!-- Title bar -->
  <div class="title-bar">
    <span class="emr-title">EMERGENCY &nbsp;&nbsp; PATIENT ASSISMENT FORM</span>
    <div class="total-box">
      <div>Total</div>
      <div class="amt">${fmt(grossAmt)}</div>
    </div>
  </div>

  <!-- Invoice block -->
  <div class="inv-block">
    <div class="inv-top">
      <div>
        ${isDuplicate ? '<span class="duplicate">DUPLICATE</span>' : ''}
        <span class="inv-label">${label}</span>
        <div class="inv-ref">REC/FM/001-A-02-00</div>
      </div>
      <div class="inv-right">
        <div class="inv-received">Received &nbsp;&nbsp; ${fmt(received)}</div>
        <div class="inv-grand">Grand Total: &nbsp;&nbsp; ${fmt(total)}</div>
      </div>
    </div>
    <div class="inv-words">Received Rupees &nbsp; ${isComplementary ? 'Zero (Complementary)' : numberToWords(received)}</div>
  </div>

  <!-- Urdu disclaimer -->
  <div class="urdu">
    تمام وصول شدہ رقم مریضوں سے عطیہ اور ٹیکس سے مستثنیٰ ہے۔
    <br/>
    اسپتال کے کیش کاؤنٹر کے علاوہ کسی بھی شخص کو کسی بھی قسم کی ادائیگی نہ کریں۔ بصورت دیگر اسپتال ذمہ دار نہ ہوگا۔
  </div>

  <!-- ══ Clinical Assessment Form ══ -->
  <div class="form-wrap">

    <div class="form-title">CLINICAL ASSESSMENT</div>

    <div class="fr">
      <span class="fl">Symptoms:</span>
      <span class="fv fv--tall"></span>
    </div>

    <div class="fr">
      <span class="fl">Duration:</span>
      <span class="fv"></span>
    </div>

    <div class="fr">
      <span class="fl">Chronic Illnesses:</span>
      <span class="fv fv--tall"></span>
    </div>

    <!-- Examination / Mental Status -->
    <div class="fc">
      <div class="fc-cell fc-cell--wide"><span class="lbl">Examination:</span></div>
      <div class="fc-cell fc-cell--wide"><span class="lbl">Mental Status:</span></div>
    </div>

    <!-- Alert / Oriented / Drowsy / Confused / Comatose -->
    <div class="fc">
      <div class="fc-cell"><span class="lbl">Alert:</span><span class="cb"></span></div>
      <div class="fc-cell"><span class="lbl">Oriented:</span><span class="cb"></span></div>
      <div class="fc-cell"><span class="lbl">Drowsy:</span><span class="cb"></span></div>
      <div class="fc-cell"><span class="lbl">Confused:</span><span class="cb"></span></div>
      <div class="fc-cell"><span class="lbl">Comatose:</span><span class="cb"></span></div>
    </div>

    <!-- Vitals -->
    <div class="vitals-row">
      <div class="vt"><span class="lbl">HR:</span><div class="vt-line"></div></div>
      <div class="vt"><span class="lbl">BP:</span><div class="vt-line"></div></div>
      <div class="vt"><span class="lbl">T°:</span><div class="vt-line"></div></div>
      <div class="vt"><span class="lbl">R.R:</span><div class="vt-line"></div></div>
      <div class="vt"><span class="lbl">SpO₂:</span><div class="vt-line"></div></div>
    </div>

    <div class="fr"><span class="fl">CNS:</span><span class="fv"></span></div>
    <div class="fr"><span class="fl">CHEST:</span><span class="fv"></span></div>
    <div class="fr"><span class="fl">CVS:</span><span class="fv"></span></div>
    <div class="fr"><span class="fl">ABD:</span><span class="fv"></span></div>
    <div class="fr"><span class="fl">ASSESSMENT:</span><span class="fv fv--tall"></span></div>
    <div class="fr"><span class="fl">PLAN:</span><span class="fv fv--tall"></span></div>

    <!-- Treatment Advice -->
    <div class="sec-hdr">TREATMENT ADVICE:</div>
    <div class="tx-grid">
      <div class="tx-box"><span class="tx-num">1.</span></div>
      <div class="tx-box"><span class="tx-num">2.</span></div>
      <div class="tx-box"><span class="tx-num">3.</span></div>
      <div class="tx-box"><span class="tx-num">4.</span></div>
      <div class="tx-box"><span class="tx-num">5.</span></div>
      <div class="tx-box"><span class="tx-num">6.</span></div>
    </div>

    <!-- Investigation Advice -->
    <div class="sec-hdr">INVESTIGATION ADVICE:</div>
    <div class="inv-adv">
      <div class="inv-adv-item"><span class="lbl">1.</span><span class="inv-adv-line"></span></div>
      <div class="inv-adv-item"><span class="lbl">2.</span><span class="inv-adv-line"></span></div>
      <div class="inv-adv-item"><span class="lbl">3.</span><span class="inv-adv-line"></span></div>
      <div class="inv-adv-item"><span class="lbl">4.</span><span class="inv-adv-line"></span></div>
    </div>

  </div>

  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
