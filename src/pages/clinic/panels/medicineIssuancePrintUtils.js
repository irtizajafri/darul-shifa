// Clinic > Report > Medicine Issuance — Details print, laid out like the
// legacy Crystal "MADICAL ISSUANCE REPORT FOR CASH" (CashMed.rpt): plain
// Arial, small type, no boxes — a solid rule under each day heading, a dashed
// rule above each patient's medicine columns, TOTAL under Amount.
//
// Printed from a standalone popup (never window.print() on the main window,
// which can freeze the app on Windows), A4 portrait.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = (n) => String(n).padStart(2, '0');

function dmy(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`;
}

function dayHeading(ymd) {
  if (!ymd || ymd === '—') return '—';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function producedOn(dt = new Date()) {
  const h = dt.getHours() % 12 || 12;
  return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} AT ${pad(h)}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())} ${dt.getHours() < 12 ? 'AM' : 'PM'}`;
}

const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 7pt; color: #000; background: #fff; }
.top { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: start; }
.top .hosp { font-size: 7.5pt; padding-top: 2px; }
.top .mid { text-align: center; }
.top .title { font-size: 10pt; font-weight: 700; text-decoration: underline; letter-spacing: 0.2px; }
.top .range { font-size: 7pt; margin-top: 2px; }
.top .right { text-align: right; font-size: 6.5pt; padding-top: 2px; }
.scope { margin: 12px 0 2px; font-size: 7pt; }
.day { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #000; padding: 2px 0 1px; margin-top: 4px; break-after: avoid; page-break-after: avoid; }
.day .d { font-size: 8.5pt; font-weight: 700; }
.day .t { font-size: 9.5pt; font-weight: 700; display: flex; gap: 0; }
.day .t .lbl { width: 42mm; }
.day .t .v { min-width: 28mm; text-align: right; }
.pt { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 7pt; }
.pt td { padding: 1px 0; vertical-align: top; }
.pt .no { width: 8mm; padding-left: 2mm; }
.pt .lb { width: 16mm; font-weight: 700; }
.pt .lb2 { width: 22mm; font-weight: 700; }
.pt .dv { width: 22mm; }
.pt .lb3 { width: 16mm; font-weight: 700; }
.items { width: calc(100% - 13mm); margin-left: 13mm; border-collapse: collapse; font-size: 7pt; margin-top: 4px; }
.items thead th { font-weight: 700; text-align: left; padding: 3px 3px 1px; border-top: 1px dashed #000; }
.items td { padding: 1px 3px; vertical-align: top; }
.items .r { text-align: right; }
.items .tot td { font-weight: 700; padding-top: 3px; }
.patient { break-inside: avoid; page-break-inside: avoid; margin-bottom: 4px; }
.grand { display: flex; justify-content: flex-end; gap: 6mm; border-top: 1px solid #000; margin-top: 6px; padding-top: 3px; font-size: 9.5pt; font-weight: 700; }
@page { size: A4 portrait; margin: 8mm 8mm 10mm 8mm; }
`;

/**
 * @param {object} d
 * @param {object} d.data            Report response ({ mode: 'details', days, grandTotal })
 * @param {object} d.filters         Applied filters ({ scopeMode, admissionNo, dateType, fromDate, toDate, storeLabel })
 * @param {string} [d.title]         Report heading
 */
export function buildMedicineIssuancePrintHtml({ data, filters, title = 'MEDICAL ISSUANCE REPORT FOR CASH' }) {
  const f = filters || {};
  const rangeText = f.scopeMode === 'admission'
    ? `Admission # : ${esc(f.admissionNo)}`
    : `From : ${dmy(`${f.fromDate}T00:00:00`)} &nbsp;To : ${dmy(`${f.toDate}T00:00:00`)}`;
  const storeText = f.storeLabel && f.storeLabel !== 'ALL' ? ` &nbsp;&nbsp; Medical Store : ${esc(f.storeLabel)}` : '';

  let patientNo = 0;
  const days = (data?.days || []).map((day) => {
    const patients = day.patients.map((p) => {
      patientNo += 1;
      const rows = p.items.map((it) => `
        <tr>
          <td class="r" style="width:7mm">${esc(it.sno)}</td>
          <td style="width:40mm">${esc(it.description)}</td>
          <td style="width:16mm">${esc(dmy(it.medDate))}</td>
          <td class="r" style="width:13mm">${money(it.rate)}</td>
          <td style="width:7mm">${esc(it.qty)}</td>
          <td class="r" style="width:16mm">${money(it.amount)}</td>
          <td style="width:18mm">${esc(it.createdByName || '')}</td>
          <td style="width:16mm">${esc(it.createdAt ? dmy(it.createdAt) : '')}</td>
          <td>${esc(it.store || '')}</td>
        </tr>`).join('');
      return `
      <div class="patient">
        <table class="pt">
          <tr>
            <td class="no">${patientNo}</td>
            <td class="lb">PATIENT :</td>
            <td>${esc(p.admissionNo)} - ${esc(p.patientName)}</td>
            <td class="lb2">ADMIT DATE :</td>
            <td class="dv">${esc(dmy(p.admitDate))}</td>
            <td class="lb3">STATUS :</td>
            <td style="width:20mm">${esc(p.status || '')}</td>
          </tr>
          <tr>
            <td></td>
            <td class="lb">COMPANY :</td>
            <td></td>
            <td class="lb2">DIS. DATE :</td>
            <td class="dv">${esc(dmy(p.dischargeDate))}</td>
            <td></td><td></td>
          </tr>
        </table>
        <table class="items">
          <thead>
            <tr>
              <th class="r">SNO</th><th>DESCRIPTION</th><th>MED DATE</th><th class="r">RATE</th><th>QTY</th>
              <th class="r">AMOUNT</th><th>CREATED</th><th>DATE</th><th>MEDICAL STORE</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tbody>
            <tr class="tot"><td colspan="5" class="r">TOTAL:</td><td class="r">${money(p.patientTotal)}</td><td colspan="3"></td></tr>
          </tbody>
        </table>
      </div>`;
    }).join('');
    return `
    <div class="day">
      <span class="d">${esc(dayHeading(day.date))}</span>
      <span class="t"><span class="lbl">DAY WISE TOTAL:</span><span class="v">${money(day.dayTotal)}</span></span>
    </div>
    ${patients}`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="top">
  <div class="hosp">Darul Shifa Hospital</div>
  <div class="mid">
    <div class="title">${esc(title)}</div>
    <div class="range">${rangeText}${storeText}</div>
  </div>
  <div class="right">Produced On : ${producedOn()}</div>
</div>
<div class="scope">${rangeText}</div>
${days}
<div class="grand"><span>GRAND TOTAL:</span><span>${money(data?.grandTotal)}</span></div>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
