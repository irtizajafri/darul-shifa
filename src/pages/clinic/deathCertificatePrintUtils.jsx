import { renderToStaticMarkup } from 'react-dom/server';
import { DeathCertificatePrintTemplate } from './DeathCertificatePrintTemplate';

// Prints on pre-printed hospital letterhead (same reasoning as
// dischargeCertificatePrintUtils.jsx) — generous top margin so the
// certificate content starts below the letterhead artwork instead of
// overlapping it. Standalone popup + window.print(), never the main window.
//
// No @page size here on purpose — whichever paper size the user picks in the
// print dialog (A4 or A5), content width stays fixed and centered so it
// prints the same regardless of the page's overall width/height.
const DTHC_PRINT_CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; background: #fff; width: 130mm; margin: 0 auto; }
.dthc-print-title { font-weight: 900; font-size: 14pt; text-decoration: underline; margin-bottom: 10px; text-align: center; }
.dthc-print-box { border: 2px solid #000; padding: 10px 12px; }
.dthc-row { display: flex; align-items: baseline; gap: 8px; padding: 4px 0; }
.dthc-row--spacer { padding: 10px 0 0; }
.dthc-lbl { font-weight: 700; white-space: nowrap; flex: 0 0 150px; }
.dthc-lbl--gap { flex: 0 0 50px; margin-left: 20px; }
.dthc-val { flex: 1; }
.dthc-val--short { flex: 0 0 90px; }
.dthc-note { margin-top: 32px; font-size: 7.5pt; text-align: center; }
.dthc-note-en { font-weight: 700; }
.dthc-note-ur { margin-top: 6px; font-size: 11pt; line-height: 1.7; font-weight: 700; font-family: "Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Noto Naskh Arabic", Tahoma, sans-serif; }
.dthc-sig { margin-top: 46px; width: 220px; }
.dthc-sig-line { border-bottom: 1px solid #000; height: 28px; }
.dthc-sig-label { font-weight: 700; font-size: 8.5pt; margin-top: 2px; }
.dthc-formcode { margin-top: 20px; font-size: 7pt; }
@page { margin: 40mm 9mm 8mm 9mm; }
`;

export function buildDeathCertificatePrintHtml(data) {
  const body = renderToStaticMarkup(<DeathCertificatePrintTemplate data={data} />);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Death Certificate - ${data?.certificate?.admissionNo || ''}</title>
<style>${DTHC_PRINT_CSS}</style>
</head>
<body>
${body}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
