import { renderToStaticMarkup } from 'react-dom/server';
import { DischargeBillPrintTemplate } from './DischargeBillPrintTemplate';

// Discharge/Final Bill used to print via window.print() on the MAIN browser
// window (see printDischargeBill, removed from DischargeRefund.jsx) — on
// Windows that opens a MODAL print dialog that can render behind the
// window, freezing the whole app (all tabs, not just this one) until
// dismissed. This builds a standalone popup document instead
// (renderToStaticMarkup + hand-flattened CSS from DischargeRefund.scss's
// old `.dr-print*` rules), printed the same safe way as the OPD slips.
const DR_PRINT_CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; background: #fff; width: 190mm; margin: auto; }
.dr-print-logo-box { width: 100%; margin-bottom: 6px; }
.dr-print-logo { width: 100%; height: 70px; object-fit: contain; }
.dr-print-title-row { display: flex; align-items: baseline; justify-content: center; gap: 12px; margin-bottom: 8px; }
.dr-print-title { font-weight: 900; font-size: 13pt; text-decoration: underline; }
.dr-print-duplicate { font-weight: 900; color: #c62828; }
.dr-print-hdr-tbl { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 8px; }
.dr-print-hdr-tbl td { padding: 2px 4px; }
.dr-print-hdr-tbl .l { font-weight: 700; white-space: nowrap; }
.dr-print-hdr-tbl .v { padding-right: 14px; }
.dr-print-section-hdr { font-weight: 700; text-decoration: underline; font-size: 10pt; margin: 8px 0 3px; }
.dr-print-pay-tbl, .dr-print-items-tbl { width: 100%; border-collapse: collapse; font-size: 9pt; border: 1px solid #000; }
.dr-print-pay-tbl th, .dr-print-pay-tbl td, .dr-print-items-tbl th, .dr-print-items-tbl td { border: 1px solid #999; padding: 2px 6px; }
.dr-print-pay-tbl th, .dr-print-items-tbl th { background: #eee; text-align: left; }
.dr-print-pay-tbl .r, .dr-print-items-tbl .r { text-align: right; }
.dr-print-grand td { font-weight: 700; border-top: 2px double #000 !important; }
.dr-print-summary-tbl { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 6px; }
.dr-print-summary-tbl td { padding: 2px 4px; }
.dr-print-summary-tbl .r { text-align: right; }
.dr-print-balance-row td { border-top: 2px solid #000; padding-top: 4px; }
.dr-print-words { font-size: 9.5pt; font-weight: 700; margin: 6px 0; }
.dr-print-sig { display: flex; flex-direction: column; align-items: flex-start; margin-top: 30px; gap: 2px; }
.dr-print-sig-name { border-top: 1px solid #000; padding-top: 2px; min-width: 140px; font-size: 9.5pt; }
.dr-print-sig-lbl { font-size: 8.5pt; color: #444; }
@page { size: A4 portrait; margin: 30mm 10mm; }
`;

export function buildDischargeBillPrintHtml({ detail, isDuplicate, printedBy }) {
  const body = renderToStaticMarkup(
    <DischargeBillPrintTemplate detail={detail} isDuplicate={isDuplicate} printedBy={printedBy} />
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Discharge Bill - ${detail?.admission?.admissionNo || ''}</title>
<style>${DR_PRINT_CSS}</style>
</head>
<body>
${body}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
