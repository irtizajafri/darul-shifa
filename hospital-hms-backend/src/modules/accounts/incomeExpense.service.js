const prisma = require('../../config/db');
const recon = require('./bankRecon.service');
const cashFlow = require('./cashFlow.service');

// Accounts → Reports → Income & Expense Summary (owner, 2026-11-21), after
// the hospital's "INCOME & EXPENDITURE SUMMARY" sheet. One book (Cash GL or
// Panel), one month:
//   Receipts — Opening Balance; posted Voucher Income by Income Category
//     (as on the Income Summary Matrix).
//   Other deposits — Voucher Income still pending (not posted), CC
//     settlements and panel cheques put into this book's banks, bank
//     credits not in the books (uploaded statement), Extra Deposit and
//     Cheq W/O (typed).
//   Payments — Voucher Expense by Main GL; bank debits not in the books:
//     Bank Charges and Not Make Voucher.
//   Closing = Opening + Receipts + Other deposits − (Payments + Out Dated
//     Cheques + A/c Receivable B/F), as on the sheet.
//   Below Payments, as on the sheet (owner, 2026-11-23): Un-presented
//     Cheques at the month's end (the Un-Presented Cheque List's rule as it
//     stood on the last day), then the closing balances — Petty Cash and
//     Cash at JazzCash (typed), each other bank's closing on the Bank Balance
//     Statement, Cash in Hand this month and last (Cash In Hand Statement).
//     TOTAL each side: Opening + Receipts + Other deposits | Payments −
//     Un-presented + closing balances, and their difference. Credit Card
//     Slip Amount / Received Amount are shown for information only.
//   Reconciliation — the same balances (+ A/c Receivable B/F) less the
//     un-presented cheques; the difference from Closing is shown.
// Opening: typed once (AccMonthSummaryInput, migration 081); after that each
// month opens with the month before's closing unless one is typed for it.
// Read-only apart from saving the typed figures.

const KEYS = ['openingBalance', 'extraDeposit', 'chequeWriteOff', 'outDatedCheques', 'receivableBF', 'pettyCash', 'jazzCash'];
// JazzCash's balance is typed (owner, 2026-11-23) — a JazzCash bank account isn't counted again.
const isJazzCash = (bank) => /jazz/i.test(String(bank?.bankName || ''));
const MAX_CHAIN = 36; // months a carried opening looks back for the typed one
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fail = (status, message) => Object.assign(new Error(message), { status });
const pad = (n) => String(n).padStart(2, '0');
const addMonths = (ym, n) => {
  const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
};
const lastDayOf = (ym) => `${ym}-${pad(new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate())}`;
const sum = (list) => round2(list.reduce((s, x) => s + (Number(x.amount) || 0), 0));

function bookOf(entityType) {
  return entityType === 'corporate' ? 'corporate' : 'non-corporate';
}
function monthOf(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) throw fail(400, 'Select the month and year');
  return `${y}-${pad(m)}`;
}

async function loadInputs(book, fromYm, toYm) {
  const rows = await prisma.accMonthSummaryInput.findMany({ where: { entityType: book, month: { gte: fromYm, lte: toYm } } });
  const out = new Map();
  for (const r of rows) {
    if (!out.has(r.month)) out.set(r.month, {});
    out.get(r.month)[r.key] = round2(r.amount);
  }
  return out;
}

// Every month's movements from fromYm to toYm, in one pass.
async function monthFigures(book, fromYm, toYm) {
  const first = `${fromYm}-01`;
  const last = lastDayOf(toYm);
  // A day's margin either side: stored dates sit at UTC or PKT midnight.
  const range = { gte: new Date(Date.parse(`${first}T00:00:00Z`) - 864e5), lte: new Date(Date.parse(`${last}T23:59:59Z`) + 864e5) };
  const inRange = (day) => day && day >= first && day <= last;
  const banks = await prisma.accBankAccount.findMany({ where: { entityType: book }, orderBy: { id: 'asc' } });
  const bankIds = banks.map((b) => b.id);
  const [incomes, expenses, ccs, cheques, lineSets] = await Promise.all([
    prisma.accVoucherIncome.findMany({
      where: { entityType: book, status: { in: ['posted', 'pending'] }, voucherDate: range },
      select: { voucherDate: true, status: true, entries: { select: { incomeCategoryId: true, incomeCategoryName: true, amount: true } } },
    }),
    prisma.accVoucherExpense.findMany({
      where: { entityType: book, voucherDate: range },
      select: { voucherDate: true, entries: { select: { mainGlId: true, amount: true } } },
    }),
    bankIds.length ? prisma.clinicCcSettlement.findMany({ where: { bankAccountId: { in: bankIds }, receivedDate: range }, select: { receivedDate: true, receivedAmount: true } }) : [],
    bankIds.length ? prisma.clinicPanelChequeReceipt.findMany({ where: { bankAccountId: { in: bankIds } }, select: { depositDate: true, chequeDate: true, receivedAmount: true } }) : [],
    Promise.all(banks.map((b) => recon.unmatchedStatementLines(b.id))),
  ]);

  const figs = new Map();
  const fig = (day) => {
    const k = day.slice(0, 7);
    if (!figs.has(k)) figs.set(k, { income: new Map(), notPosted: 0, cc: 0, panel: 0, bankIn: 0, expense: new Map(), bankCharges: 0, bankOut: 0 });
    return figs.get(k);
  };
  for (const v of incomes) {
    const day = recon.dayOf(v.voucherDate);
    if (!inRange(day)) continue;
    const f = fig(day);
    for (const e of v.entries) {
      const amt = Number(e.amount) || 0;
      if (v.status === 'pending') { f.notPosted += amt; continue; }
      const k = e.incomeCategoryId ? `id-${e.incomeCategoryId}` : `name-${String(e.incomeCategoryName || 'Other').trim().toUpperCase()}`;
      const cur = f.income.get(k) || { id: e.incomeCategoryId || null, name: e.incomeCategoryName || 'Other', amount: 0 };
      cur.amount += amt;
      f.income.set(k, cur);
    }
  }
  for (const v of expenses) {
    const day = recon.dayOf(v.voucherDate);
    if (!inRange(day)) continue;
    const f = fig(day);
    for (const e of v.entries) f.expense.set(e.mainGlId, (f.expense.get(e.mainGlId) || 0) + (Number(e.amount) || 0));
  }
  for (const c of ccs) {
    const day = recon.dayOf(c.receivedDate);
    if (inRange(day)) fig(day).cc += Number(c.receivedAmount) || 0;
  }
  for (const c of cheques) {
    const day = recon.dayOf(c.depositDate || c.chequeDate);
    if (inRange(day)) fig(day).panel += Number(c.receivedAmount) || 0;
  }
  for (const lines of lineSets) {
    for (const l of lines) {
      if (!inRange(l.date)) continue;
      const f = fig(l.date);
      if (l.credit > 0) f.bankIn += l.credit;
      else if (l.isCharge) f.bankCharges += l.debit;
      else f.bankOut += l.debit;
    }
  }
  return { figs, banks };
}

const EMPTY = { income: new Map(), notPosted: 0, cc: 0, panel: 0, bankIn: 0, expense: new Map(), bankCharges: 0, bankOut: 0 };

// One month's sections from its movements and typed figures.
function sections(f = EMPTY, inp = {}, names = {}) {
  const receipts = [...f.income.values()]
    .map((c) => ({ name: (c.id && names.cat?.get(c.id)) || c.name, amount: round2(c.amount) }))
    .filter((c) => c.amount)
    .sort((a, b) => a.name.localeCompare(b.name));
  const otherDeposits = [
    { key: 'notPosted', name: 'Not Posted Income (pending vouchers)', amount: round2(f.notPosted) },
    { key: 'cc', name: 'Credit Card (CC settlements)', amount: round2(f.cc) },
    { key: 'panel', name: 'Panel Cheques Deposited', amount: round2(f.panel) },
    // Bank statement credits matched to no Bank Deposit / CC / panel cheque / income entry.
    { key: 'bankIn', name: 'Others Bank Deposit (bank statement, not matched)', amount: round2(f.bankIn) },
    { key: 'extraDeposit', name: 'Extra Deposit', amount: round2(inp.extraDeposit), typed: true },
    { key: 'chequeWriteOff', name: 'Cheq W/O', amount: round2(inp.chequeWriteOff), typed: true },
  ];
  const payments = [...f.expense.entries()]
    .map(([id, amount]) => ({ id, name: names.gl?.get(id)?.name || `Main GL #${id}`, code: names.gl?.get(id)?.code || '', amount: round2(amount) }))
    .filter((p) => p.amount)
    .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));
  const bankPayments = [
    { key: 'bankOut', name: 'Not Make Voucher (bank debits not in books)', amount: round2(f.bankOut) },
    { key: 'bankCharges', name: 'Bank Charges (not in books)', amount: round2(f.bankCharges) },
  ];
  const receiptsTotal = sum(receipts);
  const otherTotal = sum(otherDeposits);
  const paymentsTotal = round2(sum(payments) + sum(bankPayments));
  const outDated = round2(inp.outDatedCheques);
  const receivable = round2(inp.receivableBF);
  return {
    receipts, otherDeposits, payments, bankPayments, receiptsTotal, otherTotal, paymentsTotal, outDated, receivable,
    net: round2(receiptsTotal + otherTotal - paymentsTotal - outDated - receivable),
  };
}

// Un-presented at the month's end — the Un-Presented Cheque List's rule
// (this book's cheque vouchers with a cheque # and date, not matched to the
// bank statement and not ticked presented) as it stood on the last day, so
// an old month's figure doesn't change later.
async function unpresentedAt(book, last) {
  const rows = await prisma.accVoucherExpenseEntry.findMany({
    where: {
      chequeNo: { not: null },
      chequeDate: { not: null, lte: new Date(Date.parse(`${last}T23:59:59Z`) + 864e5) },
      voucher: { entityType: book, mode: 'cheque' },
    },
    select: { amount: true, chequeNo: true, chequeDate: true, presentedDate: true, matchedStatementLine: { select: { date: true } } },
  });
  let total = 0;
  const cheques = new Set();
  for (const e of rows) {
    if (recon.dayOf(e.chequeDate) > last) continue;
    const cleared = (e.matchedStatementLine && recon.dayOf(e.matchedStatementLine.date) <= last)
      || (e.presentedDate && recon.dayOf(e.presentedDate) <= last);
    if (cleared) continue;
    total += Number(e.amount) || 0;
    cheques.add(String(e.chequeNo).trim().toUpperCase());
  }
  return { total: round2(total), count: cheques.size };
}

async function getIncomeExpenseSummary({ entityType, year, month } = {}) {
  const book = bookOf(entityType);
  const ym = monthOf(year, month);
  const oldest = addMonths(ym, -MAX_CHAIN);
  const inputs = await loadInputs(book, oldest, ym);
  let anchor = null;
  for (let k = ym; k >= oldest; k = addMonths(k, -1)) {
    if (inputs.get(k)?.openingBalance !== undefined) { anchor = k; break; }
  }
  const from = anchor || ym;
  const { figs, banks } = await monthFigures(book, from, ym);

  const glIds = new Set();
  const catIds = new Set();
  for (const f of figs.values()) {
    f.expense.forEach((_, id) => glIds.add(id));
    f.income.forEach((c) => { if (c.id) catIds.add(c.id); });
  }
  const [gls, cats] = await Promise.all([
    glIds.size ? prisma.accMainGL.findMany({ where: { id: { in: [...glIds] } }, select: { id: true, code: true, name: true } }) : [],
    catIds.size ? prisma.accIncomeCategory.findMany({ where: { id: { in: [...catIds] } }, select: { id: true, name: true } }) : [],
  ]);
  const names = { gl: new Map(gls.map((g) => [g.id, g])), cat: new Map(cats.map((c) => [c.id, c.name])) };

  // Opening: the typed one, carried month by month to this month.
  let opening = anchor ? inputs.get(anchor).openingBalance : 0;
  for (let k = from; k < ym; k = addMonths(k, 1)) opening = round2(opening + sections(figs.get(k), inputs.get(k) || {}, names).net);
  const inp = inputs.get(ym) || {};
  const s = sections(figs.get(ym), inp, names);
  const closing = round2(opening + s.net);

  // Reconciliation
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  const prev = addMonths(ym, -1);
  const cashBook = book === 'non-corporate';
  const statementBanks = banks.filter((b) => !isJazzCash(b));
  const [cihNow, cihPrev, bankStmts, unp] = await Promise.all([
    cashBook ? cashFlow.getCashInHandStatement({ entityType: book, year: y, month: m }) : null,
    cashBook ? cashFlow.getCashInHandStatement({ entityType: book, year: Number(prev.slice(0, 4)), month: Number(prev.slice(5, 7)) }) : null,
    Promise.all(statementBanks.map((b) => recon.getBankMonthStatement({ bankAccountId: b.id, year: y, month: m }))),
    unpresentedAt(book, lastDayOf(ym)),
  ]);
  const bankRows = bankStmts
    .map((st, i) => ({ id: statementBanks[i].id, name: `${statementBanks[i].bankName} — ${statementBanks[i].accountNumber}`, active: statementBanks[i].isActive, closing: st.closing }))
    .filter((b) => b.active || b.closing);
  const cashInHand = cihNow ? round2(cihNow.total.inHand) : null;
  const cashInHandLastMonth = cihPrev ? round2(cihPrev.total.inHand) : null;
  const pettyCash = round2(inp.pettyCash);
  const jazzCash = round2(inp.jazzCash);
  const unpresented = unp.total;
  const banksTotal = round2(bankRows.reduce((t, b) => t + b.closing, 0));
  const balancesTotal = round2(pettyCash + banksTotal + jazzCash + (cashInHand || 0) + (cashInHandLastMonth || 0));
  const reconTotal = round2(balancesTotal + s.receivable - unpresented);
  // TOTAL on each side, as on the sheet.
  const receiptsSide = round2(opening + s.receiptsTotal + s.otherTotal);
  const paymentsSide = round2(s.paymentsTotal - unpresented + balancesTotal);
  const ccReceived = s.otherDeposits.find((l) => l.key === 'cc')?.amount || 0;
  const ccSlips = cihNow ? round2(cihNow.total.ccSlips) : null;

  return {
    entityType: book, year: y, month: m,
    opening: { amount: opening, source: anchor === ym ? 'typed' : anchor ? 'carried' : 'missing', from: anchor },
    receipts: { lines: s.receipts, total: s.receiptsTotal },
    otherDeposits: { lines: s.otherDeposits, total: s.otherTotal },
    payments: { lines: s.payments, bankLines: s.bankPayments, total: s.paymentsTotal },
    closing: {
      opening, receipts: s.receiptsTotal, otherDeposits: s.otherTotal, payments: s.paymentsTotal,
      outDatedCheques: s.outDated, receivableBF: s.receivable, amount: closing,
    },
    closingBalances: {
      unpresented, unpresentedCheques: unp.count,
      pettyCash, banks: bankRows, jazzCash, cashInHand, cashInHandLastMonth, total: balancesTotal,
    },
    totals: { receipts: receiptsSide, payments: paymentsSide, difference: round2(receiptsSide - paymentsSide) },
    creditCard: ccSlips === null ? null : { slips: ccSlips, received: ccReceived, difference: round2(ccSlips - ccReceived) },
    reconciliation: {
      cashInHand, cashInHandLastMonth, pettyCash, jazzCash, receivableBF: s.receivable,
      banks: bankRows, banksTotal, unpresented, total: reconTotal, difference: round2(closing - reconTotal),
    },
    inputs: Object.fromEntries(KEYS.map((k) => [k, inp[k] === undefined ? null : inp[k]])),
  };
}

// Saves the typed figures for one book and month; a blank clears one (a
// cleared opening goes back to last month's closing).
async function saveIncomeExpenseInputs({ entityType, year, month, values, userName } = {}) {
  const book = bookOf(entityType);
  const ym = monthOf(year, month);
  const v = values && typeof values === 'object' ? values : {};
  const ops = [];
  for (const key of KEYS) {
    if (!(key in v)) continue;
    const raw = v[key];
    if (raw === '' || raw === null || raw === undefined) {
      ops.push(prisma.accMonthSummaryInput.deleteMany({ where: { entityType: book, month: ym, key } }));
      continue;
    }
    const amount = Number(String(raw).replace(/,/g, ''));
    if (!Number.isFinite(amount)) throw fail(400, `${key} is not a number`);
    const data = { amount: round2(amount), updatedByName: String(userName || '').trim() || null, updatedAt: new Date() };
    ops.push(prisma.accMonthSummaryInput.upsert({
      where: { entityType_month_key: { entityType: book, month: ym, key } },
      create: { entityType: book, month: ym, key, ...data },
      update: data,
    }));
  }
  if (ops.length) await prisma.$transaction(ops);
  return getIncomeExpenseSummary({ entityType: book, year, month });
}

module.exports = { getIncomeExpenseSummary, saveIncomeExpenseInputs };
