import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../../config';
import { openPrintWindow } from '../../../utils/printRelay';
import { REPORT_PRINT_BW_CSS } from '../../../components/reports/reportFont';

// Shared by Bank Book, Bank Reconciliation, Bank Reconciliation Statement and
// Bank Balance Statement (Accounts, owner 2026-11-18).

export const API = `${API_BASE_URL}/api/accounts`;
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const pktToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const monthStart = (iso) => `${iso.slice(0, 8)}01`;
export const fmtDay = (iso) => (iso ? `${iso.slice(8, 10)}-${SHORT[Number(iso.slice(5, 7)) - 1]}-${iso.slice(0, 4)}` : '');
export const money = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
export const moneyOrBlank = (n) => (Number(n) ? money(n) : '');

export const BOOK_TYPE = {
  expense: 'Payment',
  deposit: 'Bank Deposit',
  income: 'Voucher Income',
  'panel-cheque': 'Panel Cheque',
  cc: 'CC Settlement',
};
export const itemTypeLabel = (i) => (i.type === 'expense' ? (i.mode === 'cheque' ? 'Cheque' : 'Online payment') : BOOK_TYPE[i.type] || i.type);

export async function getJson(url, opts) {
  const res = await fetch(url, opts);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Request failed');
  return j.data;
}
export const postJson = (url, body) => getJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });

export const bankLabel = (b) => (b ? `${b.bankName} — ${b.accountNumber}` : '');

// Bank accounts of this book; the first active one is picked when there's only one.
export function useBanks(entityType) {
  const [banks, setBanks] = useState([]);
  useEffect(() => {
    let off = false;
    getJson(`${API}/bank-accounts?entityType=${entityType}`)
      .then((d) => { if (!off) setBanks(d || []); })
      .catch((e) => toast.error(e.message || 'Bank accounts did not load'));
    return () => { off = true; };
  }, [entityType]);
  return banks;
}

// A4 portrait, Arial, black & white — the printable block's HTML.
export function printA4(title, html, extraCss = '') {
  const win = openPrintWindow();
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif !important; }
    body { margin: 0; font-size: 9pt; color: #000; }
    h1 { font-size: 13pt; margin: 0 0 1mm; }
    .brc-print-sub { font-size: 9pt; margin: 0 0 4mm; }
    table { width: 100%; border-collapse: collapse; }
    th, td { font-size: 8.5pt !important; padding: 2px 4px; border: 1px solid #888; vertical-align: top; }
    th { text-align: left; }
    .n, td.n, th.n { text-align: right; white-space: nowrap; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    .no-print, button { display: none !important; }
    ${extraCss}
    ${REPORT_PRINT_BW_CSS}
  </style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

// Bank accounts of both books, for screens outside Accounts that say which
// bank money went into (Panel Cheque Transaction, Credit Pending). Labelled
// with the book; inactive ones left out.
export function useAllBanks() {
  const [banks, setBanks] = useState([]);
  useEffect(() => {
    let off = false;
    Promise.all(['corporate', 'non-corporate'].map((et) => getJson(`${API}/bank-accounts?entityType=${et}`).catch(() => [])))
      .then(([corp, cash]) => {
        if (off) return;
        const tag = (list, book) => (list || []).filter((b) => b.isActive !== false).map((b) => ({ ...b, label: `${b.bankName} — ${b.accountNumber} (${book})` }));
        setBanks([...tag(corp, 'Panel'), ...tag(cash, 'Cash GL')]);
      });
    return () => { off = true; };
  }, []);
  return banks;
}
