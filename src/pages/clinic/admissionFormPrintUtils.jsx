import { renderToStaticMarkup } from 'react-dom/server';
import { AdmissionPrintTemplate } from './AdmissionPrintTemplate';

// Admission Form used to print via window.print() on the MAIN browser
// window (see printAdmissionForm, removed from Admission.jsx) — on Windows
// that opens a MODAL print dialog that can render behind the window,
// freezing the whole app (all tabs, not just this one) until dismissed.
// This builds a standalone popup document instead (renderToStaticMarkup +
// hand-flattened CSS from Admission.scss's old `.adm-print` block — SCSS
// nesting like `.adm-print .foo` doesn't work outside a Sass build, so it's
// written out flat here), printed the same safe way as the OPD slips.
const ADMISSION_PRINT_CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; background: #fff; width: 190mm; margin: auto; }
.adm-print-logo-box { width: 100%; }
.adm-print-logo { width: 100%; height: 50px; }
.adm-print-info-box { position: relative; text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 4px; }
.adm-print-hosp-addr { font-size: 7.5pt; color: #333; margin-top: 2px; }
.adm-print-duplicate { position: absolute; right: 0; top: 0; font-size: 9pt; font-weight: 700; border: 1.5px solid #000; padding: 2px 8px; }
.adm-print-status-bar { display: flex; justify-content: space-between; align-items: center; border: 1px solid #000; padding: 3px 8px; font-size: 9pt; margin-bottom: 0; }
.adm-print-form-title { font-size: 13pt; font-weight: 900; letter-spacing: 1px; }
.adm-print-fields { width: 100%; border-collapse: collapse; border: 1px solid #000; border-top: none; font-size: 9pt; }
.adm-print-fields td { border: 1px solid #000; padding: 3px 6px; vertical-align: top; }
.apf-lbl { font-weight: 600; white-space: nowrap; width: 18%; background: #f5f5f5; }
.apf-val { width: 32%; min-height: 16px; }
.adm-print-recv-line { border: 1px solid #000; border-top: none; padding: 3px 8px; font-size: 9pt; }
.adm-print-section-hdr { text-align: center; font-weight: 700; font-size: 9pt; border: 1px solid #000; border-top: none; padding: 2px; background: #e8e8e8; letter-spacing: 1px; }
.adm-print-history { width: 100%; border-collapse: collapse; border: 1px solid #000; border-top: none; font-size: 9pt; }
.adm-print-history td { border: 1px solid #000; padding: 3px 6px; white-space: nowrap; }
.dln { display: inline-block; border-bottom: 1px solid #000; vertical-align: bottom; margin-left: 4px; }
.dln-sm { width: 60px; }
.dln-md { width: 100px; }
.dln-lg { width: 180px; }
.adm-print-oath { border: 1px solid #000; border-top: none; padding: 4px 8px; }
.adm-print-oath-title { text-align: center; font-size: 11pt; font-weight: 700; margin-bottom: 2px; }
.adm-print-oath-text { font-size: 9pt; line-height: 1.5; margin: 0; }
.adm-print-sig-row { display: flex; justify-content: space-between; padding: 6px 8px; font-size: 9pt; }
.adm-print-diag { width: 100%; border-collapse: collapse; border: 1px solid #000; border-top: none; font-size: 9pt; }
.adm-print-diag td { border: 1px solid #000; padding: 4px 6px; }
.apd-lbl { font-weight: 600; white-space: nowrap; width: 18%; background: #f5f5f5; }
.apd-val { min-height: 20px; }
.apd-lbl-sm { width: 12%; }
.apd-val-sm { width: 10%; }
.apd-val--tall { min-height: 60px; }
.adm-print-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px; }
.adm-print-form-code { font-size: 8pt; color: #333; }
.adm-print-barcode { height: 32px; }
@page { size: A4 portrait; margin: 8mm 10mm; }
`;

export function buildAdmissionFormPrintHtml({ form, doctors, roomCategories, availableBeds, isDuplicate, printedBy, barcodeDataUrl }) {
  const body = renderToStaticMarkup(
    <AdmissionPrintTemplate
      form={form}
      doctors={doctors}
      roomCategories={roomCategories}
      availableBeds={availableBeds}
      isDuplicate={isDuplicate}
      printedBy={printedBy}
      barcodeDataUrl={barcodeDataUrl}
    />
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Admission Form - ${form.admissionNo || ''}</title>
<style>${ADMISSION_PRINT_CSS}</style>
</head>
<body>
${body}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
