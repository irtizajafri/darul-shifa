import { renderToStaticMarkup } from 'react-dom/server';
import { BirthCertificatePrintTemplate } from './BirthCertificatePrintTemplate';

// Prints on pre-printed hospital letterhead (same reasoning as
// dischargeCertificatePrintUtils.jsx / deathCertificatePrintUtils.jsx) —
// generous top margin so content starts below the letterhead artwork. No
// @page size on purpose — whichever paper size gets picked (A4 or A5),
// content width stays fixed and centered so it prints the same either way.
// Standalone popup + window.print(), never the main window.
const BTHC_PRINT_CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; background: #fff; width: 130mm; margin: 0 auto; }
.bthc-print-titlebox { border: 2px solid #000; text-align: center; font-weight: 900; font-size: 13pt; padding: 6px 0; margin-bottom: 14px; }
.bthc-print-box { border: 1px solid #000; padding: 10px 12px; }
.bthc-row { display: flex; align-items: baseline; gap: 8px; padding: 6px 0; }
.bthc-row--spacer { padding: 8px 0 0; }
.bthc-row--triple { gap: 6px; }
.bthc-lbl { font-weight: 700; white-space: nowrap; flex: 0 0 110px; }
.bthc-lbl--sm { flex: 0 0 55px; }
.bthc-lbl--gap { flex: 0 0 72px; margin-left: 6px; }
.bthc-val { flex: 1; border-bottom: 1px solid #000; min-width: 10px; padding: 0 2px 1px; }
.bthc-val--short { flex: 0 0 42px; }
.bthc-sig-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 46px; }
.bthc-sig { width: 180px; }
.bthc-sig-line { border-bottom: 1px solid #000; height: 28px; }
.bthc-sig-label { font-weight: 700; font-size: 8.5pt; margin-top: 2px; }
.bthc-issue { display: flex; align-items: baseline; gap: 8px; }
.bthc-issue .bthc-lbl { flex: none; }
.bthc-issue .bthc-val { border-bottom: none; }
.bthc-disclaimer { margin-top: 20px; font-weight: 700; font-size: 9pt; text-align: center; }
.bthc-formcode { margin-top: 24px; font-size: 7pt; }
@page { margin: 40mm 9mm 8mm 9mm; }
`;

export function buildBirthCertificatePrintHtml(data) {
  const body = renderToStaticMarkup(<BirthCertificatePrintTemplate data={data} />);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Birth Certificate - ${data?.certificate?.admissionNo || ''}</title>
<style>${BTHC_PRINT_CSS}</style>
</head>
<body>
${body}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
