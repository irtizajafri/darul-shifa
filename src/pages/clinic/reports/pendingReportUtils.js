import { REPORT_PRINT_FONT_CSS } from '../../../components/reports/reportFont';
import { openPrintWindow } from '../../../utils/printRelay';

// Shared by the Cash Pending and Credit Pending reports (owner, 2026-11-18):
// A4 portrait, Arial 9pt, fixed column widths in mm (194mm = A4 less 8mm
// margins each side).

const PKT = 'Asia/Karachi';
const parts = (d) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: PKT, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).formatToParts(new Date(d)).map((x) => [x.type, x.value]));

export const fmtIso = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('-') : '');
export const fmtDay = (d) => { if (!d) return ''; const p = parts(d); return `${p.day}-${p.month}-${p.year}`; };
export const fmtTime = (d) => { if (!d) return ''; const p = parts(d); return `${p.hour}:${p.minute}`; };
export const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const amt = (n) => (Number(n) ? fmt2(n) : '-');

export function printPendingReport(title, elementId) {
  const win = openPrintWindow();
  const content = document.getElementById(elementId)?.innerHTML || '';
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>
      @page{size:A4 portrait;margin:8mm;}
      *{box-sizing:border-box;}
      html,body{width:194mm;}
      body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;}
      .ddp-print-header{text-align:center;margin-bottom:3mm;}
      h1{text-transform:uppercase;font-weight:700;margin:0;}
      .pdr-criteria{margin:1mm 0 0 !important;}
      table{width:194mm;border-collapse:collapse;table-layout:fixed;}
      th,td{white-space:normal;overflow-wrap:break-word;vertical-align:top;text-align:left;padding:1px 3px !important;line-height:1.25 !important;}
      .pdr-nowrap{white-space:nowrap !important;}
      th{border-bottom:1px solid #000;}
      td{border-bottom:1px solid #ccc;}
      tr.pdr-has-sub td{border-bottom:none;}
      th.num,.td-num{text-align:right !important;}
      thead{display:table-header-group;}
      tfoot{display:table-row-group;}
      tr{page-break-inside:avoid;break-inside:avoid;}
      .pdr-total-row td{font-weight:700;border-top:1px solid #000;border-bottom:none;}
      .pdr-summary{margin-top:3mm;}
      ${REPORT_PRINT_FONT_CSS}
    </style></head><body>${content}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
