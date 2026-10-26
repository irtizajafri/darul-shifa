import { renderToStaticMarkup } from 'react-dom/server';
import { DischargeBillPrintTemplate } from './DischargeBillPrintTemplate';

// Discharge/Final Bill used to print via window.print() on the MAIN browser
// window (see printDischargeBill, removed from DischargeRefund.jsx) — on
// Windows that opens a MODAL print dialog that can render behind the
// window, freezing the whole app (all tabs, not just this one) until
// dismissed. This builds a standalone popup document instead
// (renderToStaticMarkup + hand-flattened CSS from DischargeRefund.scss's
// old `.dr-print*` rules), printed the same safe way as the OPD slips.
// A5 portrait, laid out like the legacy Itemised Medical Bill. The top
// margin is left blank for the hospital's letterhead, same as the legacy
// print. The page block is a fixed-height column so the signatures /
// Created By sit at the bottom of the sheet.
const DR_PRINT_CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; background: #fff; }
.imb { width: 100%; min-height: 168mm; display: flex; flex-direction: column; }
.imb-title-row { position: relative; text-align: center; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 4px; }
.imb-title { font-weight: 700; font-size: 11.5pt; text-decoration: underline; letter-spacing: .3px; }
.imb-dup { position: absolute; right: 0; bottom: 3px; font-weight: 700; font-size: 10.5pt; }
.imb-hdr { width: 100%; border-collapse: collapse; margin-bottom: 5px; border-bottom: 1px solid #000; }
.imb-hdr td { padding: 2px 3px; vertical-align: baseline; }
.imb-hdr .l { white-space: nowrap; font-size: 9pt; width: 1%; }
.imb-hdr .v { padding-right: 10px; font-size: 9pt; }
.imb-hdr .b { font-weight: 700; }
.imb-hdr .room { text-align: right; white-space: nowrap; font-size: 9pt; }
.imb-box { border: 1.2px solid #000; padding: 3px 6px 6px; margin-bottom: 5px; }
.imb-box-title { text-align: center; font-weight: 700; text-decoration: underline; font-size: 9pt; margin-bottom: 3px; }
.imb-pay { width: 75%; margin: 0 auto; border-collapse: collapse; border: 1.2px solid #000; }
.imb-pay th { font-weight: 400; text-align: left; padding: 2px 5px; border-bottom: 1px solid #000; }
.imb-pay td { padding: 2px 5px; }
.imb-pay .c { text-align: center; }
.imb-pay .r { text-align: right; }
.imb-pay-total td { border-top: 1px solid #000; font-weight: 700; }
.imb-bill { padding: 3px 0 0; }
.imb-items { width: 100%; border-collapse: collapse; }
.imb-items th { font-weight: 700; text-align: left; padding: 2px 6px; border-top: 1px solid #000; border-bottom: 1px solid #000; }
.imb-items td { padding: 1.5px 6px; font-size: 9pt; }
.imb-items .r { text-align: right; }
.imb-total-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; border-top: 1.2px solid #000; padding: 4px 6px; margin-top: 2px; }
.imb-words { font-weight: 700; font-size: 9pt; line-height: 1.3; }
.imb-total { display: flex; align-items: center; gap: 4px; white-space: nowrap; font-weight: 700; }
.imb-total-box { border: 1.2px solid #000; padding: 1px 4px; min-width: 22mm; text-align: right; font-size: 9pt; }
.imb-extra { margin: 0 6px 0 auto; border-collapse: collapse; font-size: 9pt; }
.imb-extra td { padding: 1px 4px; }
.imb-extra .r { text-align: right; min-width: 22mm; }
.imb-foot { margin-top: auto; padding-top: 12mm; break-inside: avoid; page-break-inside: avoid; }
.imb-sigs { display: flex; justify-content: space-between; padding: 0 2mm; }
.imb-sig { width: 45mm; border-top: 1px solid #000; text-align: center; padding-top: 2px; font-size: 9pt; }
.imb-stamps { display: flex; justify-content: space-between; margin-top: 5mm; padding: 0 2mm; font-size: 9pt; }
.imb-stamp { display: flex; gap: 6px; }
.imb-form-code { margin-top: 5mm; font-size: 9pt; }
@page { size: A5 portrait; margin: 22mm 8mm 8mm; }
`;

export function buildDischargeBillPrintHtml({ detail, isDuplicate }) {
  const body = renderToStaticMarkup(
    <DischargeBillPrintTemplate detail={detail} isDuplicate={isDuplicate} />
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Itemised Medical Bill - ${detail?.admission?.admissionNo || ''}</title>
<style>${DR_PRINT_CSS}</style>
</head>
<body>
${body}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
