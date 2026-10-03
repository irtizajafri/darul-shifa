import { renderToStaticMarkup } from 'react-dom/server';
import { DischargeCertificatePrintTemplate } from './DischargeCertificatePrintTemplate';

// Discharge Certificate used to print via window.print() on the MAIN
// browser window (see printDischargeCertificate, removed from
// DiscountRefundAdmission.jsx) — on Windows that opens a MODAL print dialog
// that can render behind the window, freezing the whole app (all tabs, not
// just this one) until dismissed. This builds a standalone popup document
// instead (renderToStaticMarkup + hand-flattened CSS from
// DiscountRefundAdmission.scss's old `.dc-print*` rules), printed the same
// safe way as the OPD slips.
//
// Prints on pre-printed hospital letterhead — top page margin left generous
// on purpose so the certificate content starts below the letterhead artwork
// instead of overlapping it. No @page size on purpose — whichever paper size
// gets picked in the print dialog (A4 or A5), content width stays fixed and
// centered so it prints the same either way (same fix as Death/Birth Certificate).
const DC_PRINT_CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #000; background: #fff; width: 130mm; margin: 0 auto; }
.dc-print-title { text-align: center; font-weight: 900; font-size: 13pt; text-decoration: underline; margin-bottom: 10px; }
.dc-print-row { display: flex; gap: 14px; margin-bottom: 6px; }
.dc-print-field { display: flex; align-items: flex-end; gap: 5px; flex: 1; min-width: 0; }
.dc-print-field label { font-weight: 700; white-space: nowrap; }
.dc-print-field--full { flex: 1 1 100%; }
.dc-print-field--wide { flex: 2.2; }
.dc-print-line { flex: 1; border-bottom: 1px solid #000; min-width: 30px; padding: 0 3px 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dc-print-reason { display: flex; align-items: baseline; gap: 6px; margin: 8px 0 5px; font-size: 8.5pt; }
.dc-print-reason label { font-weight: 700; }
.dc-print-reason-val { font-weight: 700; text-decoration: underline; }
.dc-print-yn-row { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; font-size: 8pt; }
.dc-print-yn-row label { font-weight: 700; min-width: 150px; }
.dc-print-yn { display: flex; align-items: center; gap: 4px; }
.dc-print-box { display: inline-block; width: 9px; height: 9px; border: 1.2px solid #000; font-style: normal; }
.dc-print-box.checked {
  background:
    linear-gradient(45deg, transparent 40%, #000 40%, #000 60%, transparent 60%),
    linear-gradient(-45deg, transparent 40%, #000 40%, #000 60%, transparent 60%);
}
.dc-print-med-block { margin: 8px 0; }
.dc-print-med-hdr { font-weight: 700; text-decoration: underline; font-size: 8.5pt; margin-bottom: 3px; }
.dc-print-med-body { height: 210px; border: 1px solid #000; padding: 0 6px; display: flex; flex-direction: column; }
.dc-print-med-line { flex: 1; border-bottom: 1px solid #999; }
.dc-print-med-line:last-child { border-bottom: none; }
.dc-print-sig { display: flex; align-items: flex-end; gap: 6px; margin-top: 22px; font-weight: 700; }
.dc-print-sig-line { border-bottom: 1px solid #000; min-width: 140px; padding-bottom: 1px; }
@page { margin: 40mm 9mm 8mm 9mm; }
`;

export function buildDischargeCertificatePrintHtml(data) {
  const body = renderToStaticMarkup(<DischargeCertificatePrintTemplate data={data} />);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Discharge Certificate - ${data?.admission?.admissionNo || ''}</title>
<style>${DC_PRINT_CSS}</style>
</head>
<body>
${body}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
