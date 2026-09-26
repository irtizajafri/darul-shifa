import { renderToStaticMarkup } from 'react-dom/server';
import { ClinicalRecordPrintTemplate } from './ClinicalRecordForm';
import ECGReportForm from './ECGReportForm';

// The Clinical Record Form / ECG Report used to print via window.print() on
// the MAIN browser window (see printClinicalRecordForm, removed) — on
// Windows that opens a MODAL print dialog that blocks the entire browser
// window (not just the tab) until it's dismissed, and the dialog can render
// behind the window, making the whole app look frozen.
//
// A first fix merged this into the slip's own popup as a second page (one
// print job, one window.print() call) — safe, but staff found it confusing:
// the A6 slip and the A4 form came out of ONE print job back-to-back, which
// read as "the two slips got merged into one" (they used to be two distinct
// prints/dialogs). A second popup isn't an option either — Chrome silently
// blocks a second window.open() from the same click/gesture as spam, even
// when called synchronously right alongside the first.
//
// Current approach: still only ONE popup (so nothing is there for the popup
// blocker to block) loading ONE document ONCE, but it prints TWICE — the
// slip first, and then, once that print dialog is dismissed (the popup's own
// `afterprint` event), a CSS class toggle swaps which half of that same
// document is visible and prints again for the CRF/ECG. Two distinct print
// jobs/dialogs, like before, never a window.print() on the main app window,
// and — since the document is never replaced/reloaded — no risk of the
// popup closing itself early the way replacing it with document.open()/
// write() a second time did (see buildSequentialPrintHtml below).
//
// That popup is a bare about:blank document (window.open('', ...)) with
// none of the app's own stylesheets loaded, so every rule these two
// templates need travels with them as inline CSS — flattened by hand from
// ClinicalRecordForm.scss / ECGReportForm.scss (SCSS nesting like `&--sm`
// doesn't work outside a Sass build, so it's written out flat here).
const CRF_CSS = `
.copd-crf {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 9.5pt;
  color: #000;
  background: #fff;
  border: 1.5px solid #000;
  padding: 8px;
  min-height: 281mm;
  display: flex;
  flex-direction: column;
}
.copd-crf-hdr { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.copd-crf-hdr-brand { flex: 1; min-width: 0; }
.copd-crf-hdr-logo { height: 58px; max-width: 100%; object-fit: contain; object-position: left center; }
.copd-crf-hdr-title {
  width: fit-content; border: 1.5px solid #000; border-radius: 5px;
  font-weight: 900; font-size: 14pt; letter-spacing: 0.3px; padding: 9px 18px; white-space: nowrap;
}
.copd-crf-info {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;
  border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 0; margin-bottom: 7px;
}
.copd-crf-info-text > div { margin: 2px 0; }
.copd-crf-dln { display: inline-block; border-bottom: 1px solid #000; min-width: 160px; padding: 0 5px; font-weight: 600; }
.copd-crf-dln--sm { min-width: 90px; }
.copd-crf-dln--md { min-width: 200px; }
.copd-crf-dln--xs { min-width: 38px; text-align: center; }
.copd-crf-dln--vit { flex: 1; min-width: 20px; }
.copd-crf-dln--full { flex: 1; min-width: 0; width: auto; }
.copd-crf-inforow { display: flex; align-items: baseline; flex-wrap: nowrap; gap: 4px; }
.copd-crf-barcode { display: flex; align-items: center; flex-shrink: 0; }
.copd-crf-barcode img { height: 32px; }
.copd-crf-cols { display: flex; flex: 1; gap: 8px; align-items: stretch; }
.copd-crf-col-left { flex: 0.8; display: flex; flex-direction: column; gap: 7px; }
.copd-crf-col-right { flex: 1.35; display: flex; flex-direction: column; gap: 7px; }
.copd-crf-box { border: 1px solid #000; border-radius: 6px; overflow: hidden; }
.copd-crf-box--rx { flex: 1; display: flex; flex-direction: column; }
.copd-crf-box--inv { flex: 1; display: flex; flex-direction: column; }
.copd-crf-box--inv .copd-crf-box-body { flex: 1; }
.copd-crf-box-hdr { background: #d9d9d9; font-weight: 700; font-size: 9.5pt; padding: 3px 8px; border-bottom: 1px solid #000; }
.copd-crf-box-body { padding: 6px 8px; }
.copd-crf-box-body > div { margin: 2px 0; }
.copd-crf-vitals > div { display: flex; align-items: baseline; gap: 5px; margin: 4px 0; white-space: nowrap; }
.copd-crf-subhdr {
  background: #ececec; border: 1px solid #999; border-radius: 3px; text-align: center;
  font-weight: 700; font-size: 9pt; padding: 2px 0; margin: 6px 0 3px;
}
.copd-crf-checkgrid { display: flex; gap: 5px; }
.copd-crf-checkcol { flex: 1; min-width: 0; }
.copd-crf-check { display: flex; align-items: flex-start; gap: 4px; font-size: 8.5pt; line-height: 1.4; margin-bottom: 2px; }
.copd-crf-checkbox { width: 8pt; height: 8pt; border: 1px solid #000; flex-shrink: 0; margin-top: 2px; }
.copd-crf-check--blank { align-items: center; margin-bottom: 6px; }
.copd-crf-blankfill { flex: 1; border-bottom: 1px solid #999; height: 15pt; }
.copd-crf-fillrow { display: flex; align-items: baseline; gap: 5px; }
.copd-crf-dashline { flex: 1; border-bottom: 1px solid #000; height: 1px; align-self: flex-end; margin-bottom: 3px; }
.copd-crf-rx-body { flex: 1; position: relative; }
.copd-crf-rx-symbol { font-size: 19pt; font-weight: 700; margin-bottom: 3px; }
.copd-crf-line { border-bottom: 1px solid #e6e6e6; height: 22px; }
.copd-crf-footer {
  display: flex; justify-content: space-between; margin-top: 7px; padding-top: 6px;
  border-top: 1px solid #000; font-weight: 700; font-size: 10pt;
}
`;

// ECG report reuses .copd-crf-dln / .copd-crf-dashline from CRF_CSS above
// (see ECGReportForm.scss's own comment) — always paired with CRF_CSS.
const ECG_CSS = `
.ecg-rpt { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; background: #fff; min-height: 281mm; display: flex; flex-direction: column; }
.ecg-rpt-hdr { margin-bottom: 4px; }
.ecg-rpt-hdr-logo { height: 50px; max-width: 60%; object-fit: contain; object-position: left center; }
.ecg-rpt-info {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 14px;
  border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 5px 0; margin-bottom: 6px;
}
.ecg-rpt-info-cols { display: flex; gap: 24px; flex: 1; }
.ecg-rpt-info-col { flex: 1; }
.ecg-rpt-info-col > div { margin: 2px 0; font-size: 9.5pt; }
.ecg-rpt-rec-code { font-size: 8pt; color: #333; margin-top: 4px; }
.ecg-rpt-barcode { flex-shrink: 0; }
.ecg-rpt-barcode img { height: 32px; }
.ecg-rpt-svc {
  display: flex; justify-content: space-between; align-items: baseline; font-weight: 900;
  font-size: 12pt; letter-spacing: 1px; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 6px;
}
.ecg-rpt-title { text-align: center; font-weight: 900; font-size: 14pt; text-decoration: underline; margin-bottom: 2px; }
.ecg-rpt-subtitle { text-align: center; font-weight: 900; font-size: 12pt; text-decoration: underline; margin-bottom: 10px; }
.ecg-rpt-history { display: flex; align-items: stretch; gap: 8px; margin-bottom: 10px; }
.ecg-rpt-history-lbl { font-weight: 700; font-size: 10pt; writing-mode: horizontal-tb; display: flex; align-items: center; }
.ecg-rpt-history-box { flex: 1; border: 1px solid #000; min-height: 60px; }
.ecg-rpt-cols { display: flex; gap: 24px; margin-bottom: 8px; }
.ecg-rpt-col { flex: 1; display: flex; flex-direction: column; gap: 10px; }
.ecg-rpt-fillrow { display: flex; align-items: baseline; gap: 5px; font-weight: 700; font-size: 9.5pt; white-space: nowrap; }
.ecg-rpt-diagnosis-lbl { font-weight: 700; font-size: 10pt; text-decoration: underline; margin: 6px 0 2px; }
.ecg-rpt-lines { display: flex; flex-direction: column; }
.ecg-rpt-line { border-bottom: 1px solid #000; height: 20px; }
.ecg-rpt-footer { display: flex; justify-content: space-between; gap: 20px; margin-top: auto; padding-top: 14px; font-weight: 700; font-size: 10pt; }
`;

function wrapAsPrintDocument(bodyHtml, css, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  ${css}
</style>
</head>
<body>
${bodyHtml}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}

export function buildCrfPrintDocument({ visit, consultantName, barcodeDataUrl, formTitle }) {
  const body = renderToStaticMarkup(
    <ClinicalRecordPrintTemplate visit={visit} consultantName={consultantName} barcodeDataUrl={barcodeDataUrl} formTitle={formTitle} />
  );
  return wrapAsPrintDocument(body, CRF_CSS, formTitle || 'Clinical Record Form');
}

export function buildEcgPrintDocument({ visit, barcodeDataUrl, printedBy }) {
  const body = renderToStaticMarkup(
    <ECGReportForm visit={visit} barcodeDataUrl={barcodeDataUrl} printedBy={printedBy} />
  );
  return wrapAsPrintDocument(body, CRF_CSS + ECG_CSS, 'ECG Report');
}

// Pulls the <style> and <body> content back out of one of this app's
// self-contained print documents (every builder — buildReceiptHtml,
// buildThermalReceiptHtml, buildConsultantReceiptHtml,
// buildEmergencyReceiptHtml, and the two build*PrintDocument above — follows
// the exact same shape: one <style> block, then <body>...<script>window.onload).
function extractStyleAndBody(fullHtml) {
  const styleMatch = fullHtml.match(/<style>([\s\S]*?)<\/style>/);
  const bodyMatch = fullHtml.match(/<body>([\s\S]*?)<script>window\.onload/);
  return { css: styleMatch ? styleMatch[1] : '', body: bodyMatch ? bodyMatch[1] : '' };
}

// Combines the slip and the CRF/ECG doc into ONE document loaded ONCE, that
// prints TWICE (slip, then — once that dialog is dismissed via `afterprint`
// — the CRF/ECG) by toggling which half is visible, never by replacing the
// document's content.
//
// An earlier version kept the two as separate documents and reused the
// popup by calling document.open()/write()/close() a second time after the
// slip's afterprint — that visually worked (two distinct print dialogs, one
// popup) but made the window close itself once the second print finished,
// instead of staying open until staff closed it themselves. Never replacing
// the document at all — the popup only ever loads once, exactly like the
// plain single-slip case (which never had this problem) — avoids whatever
// about the reopen/rewrite was causing that.
export function buildSequentialPrintHtml(slipFullHtml, extraFullHtml) {
  if (!extraFullHtml) return slipFullHtml;
  const slip = extractStyleAndBody(slipFullHtml);
  const extra = extractStyleAndBody(extraFullHtml);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Print</title>
<style>
${slip.css}
${extra.css}
#seq-print-extra { display: none; }
body.seq-print-stage-2 #seq-print-slip { display: none; }
body.seq-print-stage-2 #seq-print-extra { display: block; }
</style>
</head>
<body>
<div id="seq-print-slip">${slip.body}</div>
<div id="seq-print-extra">${extra.body}</div>
<script>
  window.onload = function(){ window.print(); };
  var seqPrintedExtra = false;
  window.onafterprint = function(){
    if (seqPrintedExtra) return;
    seqPrintedExtra = true;
    document.body.className = 'seq-print-stage-2';
    window.print();
  };
</script>
</body>
</html>`;
}
