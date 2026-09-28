import { renderToStaticMarkup } from 'react-dom/server';
import { ProvisionalBillPrintTemplate } from './ProvisionalBillPrintTemplate';

// Provisional Bill used to print via window.print() on the MAIN browser
// window (see printProvisionalBill, removed from ProvisionalBill.jsx) — on
// Windows that opens a MODAL print dialog that can render behind the
// window, freezing the whole app (all tabs, not just this one) until
// dismissed. This builds a standalone popup document instead
// (renderToStaticMarkup + hand-flattened CSS from ProvisionalBill.scss's
// old `.pb-print*` rules), printed the same safe way as the OPD slips.
const PB_PRINT_CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; background: #fff; width: 138mm; margin: auto; }
.pb-print-logo-box { width: 100%; margin-bottom: 4px; }
.pb-print-logo { width: 100%; height: 46px; object-fit: contain; }
.pb-print-title-row { display: flex; align-items: baseline; justify-content: center; gap: 10px; margin-bottom: 6px; }
.pb-print-title { font-weight: 900; font-size: 11pt; text-decoration: underline; }
.pb-print-duplicate { font-weight: 900; font-size: 8pt; color: #c62828; }
.pb-print-hdr-tbl { width: 100%; border-collapse: collapse; font-size: 7.5pt; margin-bottom: 6px; }
.pb-print-hdr-tbl td { padding: 1px 3px; }
.pb-print-hdr-tbl .l { font-weight: 700; white-space: nowrap; }
.pb-print-hdr-tbl .v { padding-right: 10px; }
.pb-print-box { border: 1px solid #000; margin-bottom: 6px; }
.pb-print-box-hdr { text-align: center; font-weight: 700; text-decoration: underline; font-size: 7.5pt; padding: 3px 0 2px; border-bottom: 1px solid #000; }
.pb-print-pay-tbl, .pb-print-items-tbl { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
.pb-print-pay-tbl th, .pb-print-pay-tbl td, .pb-print-items-tbl th, .pb-print-items-tbl td { border: 1px solid #999; padding: 1px 5px; }
.pb-print-pay-tbl th, .pb-print-items-tbl th { background: #eee; text-align: left; }
.pb-print-pay-tbl .r, .pb-print-items-tbl .r { text-align: right; }
.pb-print-grand td { font-weight: 700; border-top: 2px double #000 !important; }
.pb-print-ward-block { margin: 4px; }
.pb-print-ward-name { font-weight: 700; font-size: 7.5pt; background: #f0f0f0; padding: 2px 5px; border: 1px solid #999; border-bottom: none; }
.pb-print-subtotal td { font-weight: 700; background: #f7f7f7; }
.pb-print-no-items { text-align: center; color: #666; padding: 8px 0; font-size: 7.5pt; }
.pb-print-summary-tbl { width: 100%; border-collapse: collapse; font-size: 7.5pt; border-top: 1px solid #000; margin-top: 2px; }
.pb-print-summary-tbl td { padding: 2px 5px; }
.pb-print-summary-tbl .r { text-align: right; }
.pb-print-balance-row td { border-top: 2px solid #000; padding-top: 3px; }
.pb-print-words { font-size: 7.5pt; font-weight: 700; margin: 5px 0; }
.pb-print-sig { display: flex; flex-direction: column; align-items: flex-start; margin-top: 20px; gap: 2px; }
.pb-print-sig-name { border-top: 1px solid #000; padding-top: 2px; min-width: 120px; font-size: 7.5pt; }
.pb-print-sig-lbl { font-size: 7pt; color: #444; }
@page { size: A5 portrait; margin: 8mm 7mm; }
`;

export function buildProvisionalBillPrintHtml({ detail, isDuplicate, printedBy }) {
  const body = renderToStaticMarkup(
    <ProvisionalBillPrintTemplate detail={detail} isDuplicate={isDuplicate} printedBy={printedBy} />
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Provisional Bill - ${detail?.admission?.admissionNo || ''}</title>
<style>${PB_PRINT_CSS}</style>
</head>
<body>
${body}
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
}
