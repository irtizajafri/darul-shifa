import { openPrintWindow } from '../../utils/printRelay';
import { PHARMACY_NAME, fmtDate, fmtQty, fmtAmt } from './pharmacyApi';

// GD / GIN documents for Al Shifa Hospital Pharmacy: A4 portrait, Arial.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
@page { size: A4 portrait; margin: 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; }
.doc { page-break-after: always; }
.doc:last-child { page-break-after: auto; }
.top { text-align: center; border-bottom: 2px solid #000; padding-bottom: 4mm; margin-bottom: 4mm; }
.top h1 { font-size: 14pt; letter-spacing: .04em; }
.top h2 { font-size: 11pt; margin-top: 1.5mm; text-decoration: underline; }
.info { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
.info td { padding: 1.2mm 1.5mm; vertical-align: top; }
.info .l { font-weight: 700; white-space: nowrap; width: 1%; }
.lines { width: 100%; border-collapse: collapse; }
.lines th, .lines td { border: 1px solid #555; padding: 1.5mm 2mm; }
.lines th { background: #eee; text-align: left; }
.lines .n { text-align: right; white-space: nowrap; }
.lines tfoot td { font-weight: 700; }
.note { margin-top: 4mm; }
.sign { display: flex; justify-content: space-between; margin-top: 20mm; }
.sign div { width: 30%; border-top: 1px solid #000; padding-top: 1.5mm; text-align: center; }
.foot { margin-top: 6mm; font-size: 7.5pt; color: #333; }
`;

function patientRows(d) {
  return `
<tr><td class="l">${d.admissionNumber ? 'Admission No:' : d.opdSlipNo ? 'Panel Slip No:' : 'Patient:'}</td><td>${esc(d.admissionNumber || d.opdSlipNo || '—')}</td>
<td class="l">Patient Name:</td><td>${esc(d.patientName || '—')}</td></tr>`;
}

function gdDoc(gd, printedBy) {
  return `<section class="doc">
<div class="top"><h1>${PHARMACY_NAME}</h1><h2>GOODS DEMAND (GD)</h2></div>
<table class="info"><tbody>
<tr><td class="l">GD No:</td><td>${esc(gd.code)}</td><td class="l">Request Date:</td><td>${esc(fmtDate(gd.requestDate))}</td></tr>
<tr><td class="l">Department:</td><td>${esc(gd.departmentName)}</td><td class="l">Status:</td><td>${esc(gd.status === 'closed' ? 'Issued' : gd.status === 'partial' ? 'Partially issued' : 'Open')}</td></tr>
${patientRows(gd)}
</tbody></table>
<table class="lines"><thead><tr><th style="width:8mm">#</th><th style="width:24mm">Code</th><th>Medicine</th><th style="width:18mm">Pack</th><th class="n" style="width:24mm">Qty Requested</th><th class="n" style="width:22mm">Issued</th></tr></thead>
<tbody>${gd.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.medicineCode || '')}</td><td>${esc(it.medicineName)}</td><td>${esc(it.packSize || '')}</td><td class="n">${fmtQty(it.quantityRequested)}</td><td class="n">${fmtQty(it.quantityIssued)}</td></tr>`).join('')}</tbody></table>
${gd.comment ? `<p class="note"><b>Comment:</b> ${esc(gd.comment)}</p>` : ''}
<div class="sign"><div>Demanded By</div><div>Approved By</div><div>Pharmacy</div></div>
<p class="foot">Created by ${esc(gd.createdByName || '—')} · Printed by ${esc(printedBy || '')} on ${esc(new Date().toLocaleString('en-GB'))}</p>
</section>`;
}

function ginDoc(gin, printedBy) {
  return `<section class="doc">
<div class="top"><h1>${PHARMACY_NAME}</h1><h2>GOODS ISSUANCE NOTE (GIN)</h2></div>
<table class="info"><tbody>
<tr><td class="l">GIN No:</td><td>${esc(gin.code)}</td><td class="l">Issue Date:</td><td>${esc(fmtDate(gin.issueDate))}</td></tr>
<tr><td class="l">Against GD:</td><td>${esc(gin.gd?.code || '')}</td><td class="l">Department:</td><td>${esc(gin.departmentName)}</td></tr>
${patientRows(gin)}
<tr><td class="l">Issued To:</td><td colspan="3">${esc(gin.issuedToName || '—')}</td></tr>
</tbody></table>
<table class="lines"><thead><tr><th style="width:8mm">#</th><th style="width:24mm">Code</th><th>Medicine</th><th style="width:16mm">Pack</th><th class="n" style="width:20mm">Qty</th><th class="n" style="width:22mm">Rate</th><th class="n" style="width:26mm">Amount</th></tr></thead>
<tbody>${gin.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.medicineCode || '')}</td><td>${esc(it.medicineName)}</td><td>${esc(it.packSize || '')}</td><td class="n">${fmtQty(it.quantity)}</td><td class="n">${fmtAmt(it.rate)}</td><td class="n">${fmtAmt(it.amount)}</td></tr>`).join('')}</tbody>
<tfoot><tr><td colspan="6" class="n">Total</td><td class="n">${fmtAmt(gin.totalAmount)}</td></tr></tfoot></table>
<div class="sign"><div>Issued By (Pharmacy)</div><div>Received By</div><div>Approved By</div></div>
<p class="foot">Created by ${esc(gin.createdByName || '—')} · Printed by ${esc(printedBy || '')} on ${esc(new Date().toLocaleString('en-GB'))}</p>
</section>`;
}

function printDocs(title, body, win) {
  const w = win || openPrintWindow();
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export const printGD = (gd, printedBy, win) => printDocs(`GD ${gd.code}`, gdDoc(gd, printedBy), win);
export const printGIN = (gin, printedBy, win) => printDocs(`GIN ${gin.code}`, ginDoc(gin, printedBy), win);
