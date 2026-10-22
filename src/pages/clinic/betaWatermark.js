// BETA watermark on clinic slips (owner, 2026-10-22) — while the system runs
// as a beta, every slip prints with a faint diagonal "NOT FOR USE" so a beta
// print can't pass as a real receipt. Turn it off at go-live by setting
// BETA_WATERMARK to false (one line); nothing else needs to change.
export const BETA_WATERMARK = true;

// Dropped in right after <body> of each slip's print HTML (not before
// </body>: buildSequentialPrintHtml keeps only what comes before the print
// <script>, so a watermark placed there was cut off on OPD + CRF prints).
// Laid over the slip itself (absolute over <body>, which is only as tall as
// the slip) rather than the page — a small slip printed on A4 would
// otherwise get it in the blank middle of the sheet. Low opacity, no pointer
// events; its own <style> sits inside <body> so the sequential print keeps it.
export const BETA_WATERMARK_HTML = BETA_WATERMARK ? `
<style>
  body { position: relative; }
  .beta-wm { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    pointer-events: none; z-index: 9999; overflow: hidden; }
  .beta-wm span { transform: rotate(-35deg); font: 900 34px/1.1 Arial, Helvetica, sans-serif; color: #000;
    opacity: 0.16; letter-spacing: 3px; white-space: nowrap; text-align: center;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
<div class="beta-wm" aria-hidden="true"><span>NOT FOR USE<br/>BETA</span></div>
` : '';
