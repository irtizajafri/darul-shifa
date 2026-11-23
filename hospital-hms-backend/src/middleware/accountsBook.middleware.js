const prisma = require('../config/db');

// Accounts books on the server (owner, 2026-11-23). Cash GL ('non-corporate')
// and Corporate ('corporate') have their own permissions: "Accounts — Cash GL"
// (permissions.accounts) and "Accounts — Corporate"
// (permissions['accounts-corporate']). Every /api/accounts request is checked
// against the book(s) it touches:
//   - the book named in the request (entityType in query or body), the bank's
//     book (bankAccountId), or the record's book (an id in the path or body —
//     voucher, draft, cheque, GL, account, payee head, sign-off …);
//   - no book named: a user holding only Corporate is kept to Corporate
//     (entityType is set for the request), so a book-less call can't reach
//     Cash GL; a Cash GL-only user stays on the controllers' default, Cash GL.
// Left alone: the Super Admin; the bank-account list (Clinic's Credit Pending
// and Panel Cheque screens list both books' banks); and requests with no user
// (API_AUTH=off). Clinic's "General Payment" opens Cash GL's Voucher Expense
// form, so it counts as Cash GL here. Only the book is checked on the server
// — the screens check the tabs.

const CACHE_MS = 30 * 1000;
const cache = new Map(); // userId -> { perms, at }

async function permissionsOf(userId) {
  const k = String(userId);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.perms;
  const u = await prisma.user.findUnique({ where: { id: k }, select: { permissions: true } }).catch(() => null);
  const perms = u && u.permissions && typeof u.permissions === 'object' ? u.permissions : {};
  cache.set(k, { perms, at: Date.now() });
  return perms;
}
// User Management saved new permissions: read them afresh next time.
const forgetPermissions = (userId) => cache.delete(String(userId));

const hasModule = (perms, mod) => {
  const p = perms?.[mod];
  if (Array.isArray(p)) return p.length > 0;
  return !!p && typeof p === 'object' && Object.keys(p).length > 0;
};
const hasGeneralPayment = (perms) => {
  const c = perms?.clinic;
  if (Array.isArray(c)) return c.includes('transactions');
  const t = c?.transactions;
  return t === true || (Array.isArray(t) && t.includes('general-payment'));
};
const bookOf = (v) => (v === 'corporate' ? 'corporate' : v === 'non-corporate' ? 'non-corporate' : null);
const num = (v) => (/^\d+$/.test(String(v ?? '')) ? Number(v) : null);
const BOOK_LABEL = { 'non-corporate': 'Accounts — Cash GL', corporate: 'Accounts — Corporate' };

// Finding a record's book.
const entityOf = (model) => async (id) => (await prisma[model].findUnique({ where: { id }, select: { entityType: true } }))?.entityType;
const bankBook = entityOf('accBankAccount');
const headBook = entityOf('accPayeeHead');
const entryBook = async (id) => (await prisma.accVoucherExpenseEntry.findUnique({ where: { id }, select: { voucher: { select: { entityType: true } } } }))?.voucher?.entityType;
const BY_PATH = [
  [/^\/main-gl\/(\d+)/, entityOf('accMainGL')],
  [/^\/sub-gl\/(\d+)/, entityOf('accSubGL')],
  [/^\/main-account\/(\d+)/, entityOf('accMainAccount')],
  [/^\/sub-account\/(\d+)/, entityOf('accSubAccount')],
  [/^\/bank-accounts\/(\d+)/, bankBook],
  [/^\/cheque-serials\/(\d+)/, async (id) => { const s = await prisma.accChequeSerial.findUnique({ where: { id }, select: { bankAccountId: true } }); return s ? bankBook(s.bankAccountId) : null; }],
  [/^\/payee-heads\/(\d+)/, headBook],
  [/^\/payee-entries\/(\d+)/, async (id) => { const e = await prisma.accPayeeEntry.findUnique({ where: { id }, select: { payeeHeadId: true } }); return e ? headBook(e.payeeHeadId) : null; }],
  [/^\/payee-head-(?:accounts|main-accounts|staff-categories|linked-custom-heads)\/(\d+)/, headBook],
  [/^\/voucher-expense\/(\d+)/, entityOf('accVoucherExpense')],
  [/^\/voucher-income\/(\d+)/, entityOf('accVoucherIncome')],
  [/^\/income-drafts\/(\d+)/, entityOf('accVoucherIncome')],
  [/^\/expense-drafts\/(\d+)/, entityOf('accVoucherExpenseDraft')],
  [/^\/income-categories\/(\d+)/, entityOf('accIncomeCategory')],
  [/^\/cheques\/(\d+)/, entryBook],
  [/^\/bank-recon\/signoff\/(\d+)/, async (id) => { const s = await prisma.accBankReconSignoff.findUnique({ where: { id }, select: { bankAccountId: true } }); return s ? bankBook(s.bankAccountId) : null; }],
];

async function booksOf(req) {
  const q = req.query || {};
  const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const books = new Set();
  const add = (v) => { const x = bookOf(v); if (x) books.add(x); };
  add(q.entityType);
  add(b.entityType);
  for (const id of [q.bankAccountId, b.bankAccountId].map(num).filter(Boolean)) add(await bankBook(id).catch(() => null));
  for (const [re, find] of BY_PATH) {
    const m = re.exec(req.path);
    if (m) { add(await find(Number(m[1])).catch(() => null)); break; }
  }
  for (const id of [b.payeeHeadId, b.headId].map(num).filter(Boolean)) add(await headBook(id).catch(() => null));
  const entryId = num(b.voucherExpenseEntryId);
  if (entryId) add(await entryBook(entryId).catch(() => null));
  return books;
}

const deny = (res, message) => res.status(403).json({ ok: false, code: 'ACCOUNTS_BOOK', message });

async function accountsBookGuard(req, res, next) {
  try {
    const user = req.user;
    if (!user || user.isSuperAdmin || req.method === 'OPTIONS') return next();
    if (req.method === 'GET' && req.path === '/bank-accounts') return next();

    const perms = await permissionsOf(user.id);
    const can = {
      'non-corporate': hasModule(perms, 'accounts') || hasGeneralPayment(perms),
      corporate: hasModule(perms, 'accounts-corporate'),
    };
    if (!can['non-corporate'] && !can.corporate) return deny(res, 'Aap ko Accounts ki ijazat nahi — Super Admin se rabta karein');

    const books = await booksOf(req);
    for (const book of books) {
      if (!can[book]) return deny(res, `Aap ko "${BOOK_LABEL[book]}" ki ijazat nahi — Super Admin se rabta karein`);
    }
    if (!books.size && can.corporate && !can['non-corporate']) {
      // A Corporate-only user's book-less call stays in Corporate.
      req.query.entityType = 'corporate';
      if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) && req.method !== 'GET' && !req.body.entityType) req.body.entityType = 'corporate';
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { accountsBookGuard, forgetPermissions };
