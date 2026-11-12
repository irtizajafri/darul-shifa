// Lab Billing (Panels) report print — a separate copy of the Laboratories
// report (src/pages/lab/labReportPrint.js), so a change to one never moves the
// other (owner, 2026-11-12). Same A4 letterhead layout, Arial 8pt, one page
// per test, ranges on one centred line. Differences: the number row shows the
// Admission # or Slip # instead of Lab No, and a row adds the Panel company
// and Employee #.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-GB', { month: 'short' })}-${dt.getFullYear()}`;
};
const fmtDT = (d) => `${fmtDate(d)} ${new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

// Blank space for the pre-printed letterhead, in mm. Bottom raised 30 → 45 →
// 63 on the owner's letterhead prints (2026-11-11): Printed By / Printed On
// sat on the letterhead's footer.
const LETTERHEAD = { top: 40, bottom: 63, side: 12 };
// A4 = 210 × 297mm; each page's block is what's left inside the margins.
const BLOCK_W = 210 - 2 * LETTERHEAD.side;
const BLOCK_H = 297 - LETTERHEAD.top - LETTERHEAD.bottom - 1;
const MARGIN = `${LETTERHEAD.top}mm ${LETTERHEAD.side}mm ${LETTERHEAD.bottom}mm`;

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; background: #fff; }
html, body { width: ${BLOCK_W}mm; }
.page { width: ${BLOCK_W}mm; min-height: ${BLOCK_H}mm; display: flex; flex-direction: column; break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
.pt { width: 100%; border-collapse: collapse; border-top: 2px solid #000; border-bottom: 2px solid #000; }
.pt td { padding: 3px 4px; vertical-align: top; font-size: 8pt; }
.pt tr:first-child td { padding-top: 2.5mm; }
.pt tr:last-child td { padding-bottom: 2.5mm; }
.pt .l { font-weight: 700; white-space: nowrap; width: 1%; padding-right: 10px; }
.pt .v { width: 44%; }
.title { text-align: center; font-weight: 700; font-size: 8pt; text-decoration: underline; margin: 3mm 0 8px; text-transform: uppercase; }
.res { width: calc(100% - 4mm); border-collapse: collapse; margin-left: 4mm; }
.res th { text-align: left; font-weight: 700; font-size: 8pt; padding: 3px 4px 7px; }
.res td { padding: 4px 4px; vertical-align: top; }
/* The ranges column is the widest: every group prints on one line. */
.res .c1 { width: 30%; } .res .c2 { width: 22%; }
.res .hd td { font-weight: 700; text-decoration: underline; padding-top: 8px; }
.res .note td { white-space: pre-line; }
.res .rng, .res th.rng { text-align: center; }
.res .abn { font-weight: 700; }
.res .flag { font-weight: 700; margin-left: 6px; }
.free { white-space: pre-wrap; margin: 4px 0 0 4mm; line-height: 1.45; }
.rem { margin-top: 14px; }
.rem b { display: block; margin-bottom: 4px; }
.rem div { white-space: pre-wrap; margin-left: 4mm; }
.foot { margin-top: auto; padding-top: 10mm; display: flex; justify-content: space-between; align-items: baseline; font-size: 8pt; }
.foot b { margin-right: 10px; }
@page { size: A4 portrait; margin: ${MARGIN}; }
@media screen {
  html, body { width: auto; }
  body { background: #e5e7eb; padding: 12px 0; }
  .page { width: 210mm; min-height: 297mm; padding: ${MARGIN}; margin: 0 auto 12px; background: #fff; box-shadow: 0 1px 6px rgba(0, 0, 0, .2); }
}
`;

function patientBlock(v) {
  const age = String(v.age || '').split(' ').filter(Boolean).join(' - ');
  const gender = v.gender ? v.gender[0].toUpperCase() + v.gender.slice(1) : '';
  const ageGender = [age, gender].filter(Boolean).join(' /');
  const emp = [v.empCode, v.employeeName ? `(${v.employeeName})` : ''].filter(Boolean).join(' ');
  return `<table class="pt"><tbody>
<tr><td class="l">MR No:</td><td class="v">${esc(v.mrNo ?? '—')}</td><td class="l">Age/Gender:</td><td>${esc(ageGender || '—')}</td></tr>
<tr><td class="l">${esc(v.numberLabel || 'Slip #')}:</td><td class="v">${esc(v.serialNo)}</td><td class="l">Referred By:</td><td>${esc(v.referredBy || '—')}</td></tr>
<tr><td class="l">Name:</td><td class="v">${esc(`${v.patientType || ''} ${v.patientName || ''}`.trim())}</td><td class="l">Sample Date:</td><td>${esc(fmtDate(v.createdAt))}</td></tr>
<tr><td class="l">Panel:</td><td class="v">${esc(v.panelName || '—')}</td><td class="l">Emp #:</td><td>${esc(emp || '—')}</td></tr>
${v.admitNo ? `<tr><td class="l">Admission #:</td><td class="v" colspan="3">${esc(v.admitNo)}</td></tr>` : ''}
</tbody></table>`;
}

// Test lines without a result don't print; a heading prints only when a line
// under it does; notes always print.
// The setup keeps each group on its own line; the report puts them on one
// (owner, 2026-11-11): "Male: 13-17 / Female: 12-15 / Children: 11-14.5".
const oneLine = (ref) => String(ref || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean).join(' / ');

function resultRows(values) {
  const rows = values.map((v) => ({ ...v, kind: v.kind || 'param' }));
  const keep = rows.map((r) => r.kind !== 'param' || !!r.value);
  rows.forEach((r, i) => {
    if (r.kind !== 'heading') return;
    let j = i + 1;
    let any = false;
    while (j < rows.length && rows[j].kind !== 'heading') { if (rows[j].kind === 'param' && rows[j].value) any = true; j += 1; }
    keep[i] = any;
  });
  return rows.filter((_, i) => keep[i]).map((r) => {
    if (r.kind === 'heading') return `<tr class="hd"><td colspan="3">${esc(r.parameterName)}</td></tr>`;
    if (r.kind === 'note') return `<tr class="note"><td colspan="3">${r.parameterName ? `<b>${esc(r.parameterName)}:</b> ` : ''}${esc(r.noteText || '')}</td></tr>`;
    const unit = r.unit ? ` ${esc(r.unit)}` : '';
    const flag = r.flag ? `<span class="flag">${esc(r.flag)}</span>` : '';
    return `<tr><td class="c1">${esc(r.parameterName)}</td><td class="c2"><span class="${r.flag ? 'abn' : ''}">${esc(r.value)}</span>${unit}${flag}</td><td class="rng">${esc(oneLine(r.referenceRange))}</td></tr>`;
  }).join('');
}

function testPage(t, visit, printedBy, i, n) {
  const r = t.result;
  const lines = (r.values || []).some((v) => (v.kind || 'param') === 'param' && v.value);
  const body = lines
    ? `<table class="res"><thead><tr><th class="c1">TEST(s)</th><th class="c2">RESULT(s)</th><th class="rng">REFERENCE RANGE(s)</th></tr></thead><tbody>${resultRows(r.values)}</tbody></table>
       ${r.remarks ? `<div class="rem"><b>REMARKS:</b><div>${esc(r.remarks)}</div></div>` : ''}`
    : `<div class="free">${esc(r.remarks || '')}</div>`;
  return `<section class="page">
${patientBlock(visit)}
<div class="title">${esc(t.name)}</div>
${body}
<div class="foot">
  <span><b>Printed By:</b>${esc(printedBy || '')}</span>
  <span><b>Printed On:</b>${esc(fmtDT(new Date()))}</span>
  <span><b>Page ${i + 1} of ${n}</b></span>
</div>
</section>`;
}

export function buildPanelLabReportHtml({ visit, tests, printedBy }) {
  const done = tests.filter((t) => t.result && t.result.status === 'done');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Panel Lab Report - ${esc(visit.serialNo)}</title><style>${CSS}</style></head>
<body>
${done.map((t, i) => testPage(t, visit, printedBy, i, done.length)).join('\n')}
<script>window.onload = function(){ window.print(); }</script>
</body></html>`;
}
