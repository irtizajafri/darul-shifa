// For reports that write their own print window HTML (not printElementInPopup):
// append this to that window's <style> (last) so the print is Arial 9 and
// black & white like the other reports.
//
// Black & white (owner's request, 2026-10-21): totals printed as white text
// on a dark blue bar vanished on the B/W printer. In print every text is
// black, coloured bars are dropped, and headings / Total / Grand Total rows
// get a light grey fill + black rules instead. Screen colours are untouched.
const BW = (root) => `
${root}, ${root} * { color:#000 !important; background:transparent !important; box-shadow:none !important; text-shadow:none !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
${root} th, ${root} thead td { background:#ececec !important; font-weight:700 !important; border-bottom:1px solid #000 !important; }
${root} tfoot td, ${root} tfoot th,
${root} tr[class*="total" i] td, ${root} tr[class*="total" i] th,
${root} tr[class*="grand" i] td, ${root} tr[class*="grand" i] th,
${root} td[class*="total" i], ${root} td[class*="grand" i],
${root} tr[class*="sub-row" i] td, ${root} tr[class*="subtotal" i] td {
  background:#e0e0e0 !important; font-weight:700 !important;
  border-top:1px solid #000 !important; border-bottom:1px solid #000 !important;
}
${root} [class*="badge" i], ${root} [class*="pill" i], ${root} [class*="chip" i] { border:1px solid #000 !important; }
`;

// `:not(#rpt-bw)` lifts these above any report's own class-based print
// colours (no element has that id).
export const REPORT_PRINT_BW_CSS = BW('body:not(#rpt-bw)');
export const REPORT_PRINT_FONT_CSS = `*{font-family:Arial,Helvetica,sans-serif !important;font-size:9pt !important;}${REPORT_PRINT_BW_CSS}`;
export { BW as reportPrintBwCss };
