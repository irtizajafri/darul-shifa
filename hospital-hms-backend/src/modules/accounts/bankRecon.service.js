const prisma = require('../../config/db');

// Bank Reconciliation (owner, 2026-11-18). One bank account at a time:
//   Books side — opening balance + money in (Bank Deposit, bank-mode Voucher
//     Income, panel cheques / CC settlements put into this bank) − money out
//     (cheque / online Voucher Expense entries on this bank).
//   Bank side — uploaded statement lines (AccBankStatementLine).
//   Matching — money out: AccVoucherExpenseEntry.matchedStatementLineId (the
//     cheque reports already use it); money in: AccBankReconLink.
//   BRS — statement balance + deposits in transit − unpresented payments
//     − bank credits not in books + bank debits not in books = book balance.
//   Sign-off locks matching on or before its date until reopened.

const fail = (status, message) => Object.assign(new Error(message), { status });
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
// Calendar day of a stored date in PKT — dates saved from "YYYY-MM-DD" sit at
// midnight UTC (same day), older uploads at PKT midnight (19:00 UTC the day
// before); +5h reads both as the right day.
const dayOf = (d) => (d ? new Date(new Date(d).getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10) : null);
const daysBetween = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
const PKT_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
const pktToday = () => PKT_DAY.format(new Date());

async function loadBank(bankAccountId) {
  const bank = bankAccountId ? await prisma.accBankAccount.findUnique({ where: { id: Number(bankAccountId) } }) : null;
  if (!bank) throw fail(404, 'Select the bank account');
  return bank;
}

// The latest sign-off still in force: matching on or before it is locked.
async function lockDateOf(bankAccountId) {
  const s = await prisma.accBankReconSignoff.findFirst({
    where: { bankAccountId: Number(bankAccountId), reopenedAt: null },
    orderBy: [{ asOfDate: 'desc' }, { id: 'desc' }],
    select: { asOfDate: true },
  });
  return s ? dayOf(s.asOfDate) : null;
}

// ─── Book items ──────────────────────────────────────────────────────────────

// Money out: cheque / online Voucher Expense entries on this bank.
async function bookDebits(bank) {
  const rows = await prisma.accVoucherExpenseEntry.findMany({
    where: { voucher: { bankId: bank.id, mode: { in: ['cheque', 'online'] } } },
    select: {
      id: true, amount: true, chequeNo: true, chequeDate: true, payeeName: true, accountName: true, particulars: true,
      presentedDate: true, matchedStatementLineId: true,
      matchedStatementLine: { select: { id: true, date: true } },
      voucher: { select: { voucherNo: true, voucherDate: true, mode: true, entityType: true } },
    },
  });
  return rows.map((e) => {
    const isCheque = e.voucher.mode === 'cheque';
    const lineDay = e.matchedStatementLine ? dayOf(e.matchedStatementLine.date) : null;
    return {
      key: `exp-${e.id}`, type: 'expense', id: e.id, side: 'out',
      mode: e.voucher.mode,
      date: dayOf(isCheque && e.chequeDate ? e.chequeDate : e.voucher.voucherDate),
      amount: round2(e.amount),
      ref: isCheque ? (e.chequeNo || '') : e.voucher.voucherNo,
      voucherNo: e.voucher.voucherNo,
      description: e.payeeName || e.accountName || e.particulars || '',
      accountName: e.accountName || '',
      book: e.voucher.entityType,
      chequeNo: e.chequeNo || null,
      lineId: e.matchedStatementLineId || null,
      // Cleared by a statement match, or ticked presented by hand.
      clearedDate: lineDay || (e.presentedDate ? dayOf(e.presentedDate) : null),
      clearedBy: lineDay ? 'statement' : e.presentedDate ? 'manual' : null,
    };
  });
}

// Money in: deposits, bank-mode income, panel cheques and CC settlements put
// into this bank.
async function bookCredits(bank) {
  const [deposits, incomes, cheques, ccs, links] = await Promise.all([
    prisma.accBankDeposit.findMany({ where: { bankAccountId: bank.id }, select: { id: true, depositOf: true, depositDate: true, depositSlipNo: true, amount: true } }),
    prisma.accVoucherIncome.findMany({ where: { bankId: bank.id, mode: 'bank', status: 'posted' }, select: { id: true, voucherNo: true, voucherDate: true, totalAmount: true, entityType: true, entries: { select: { particulars: true, incomeCategoryName: true } } } }),
    prisma.clinicPanelChequeReceipt.findMany({ where: { bankAccountId: bank.id }, select: { id: true, chequeNo: true, chequeDate: true, depositDate: true, receivedAmount: true, panelCompanyId: true } }),
    prisma.clinicCcSettlement.findMany({ where: { bankAccountId: bank.id }, select: { id: true, receivedDate: true, receivedAmount: true, visit: { select: { serialNo: true } } } }),
    prisma.accBankReconLink.findMany({ where: { bankAccountId: bank.id }, select: { bookType: true, bookId: true, statementLineId: true, statementLine: { select: { date: true } } } }),
  ]);
  const companyIds = [...new Set(cheques.map((c) => c.panelCompanyId))];
  const companies = companyIds.length ? await prisma.clinicPanelCompany.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } }) : [];
  const coName = new Map(companies.map((c) => [c.id, c.name]));
  const linkOf = new Map(links.map((l) => [`${l.bookType}-${l.bookId}`, l]));
  const withLink = (item) => {
    const l = linkOf.get(`${item.type}-${item.id}`);
    return { ...item, lineId: l?.statementLineId || null, clearedDate: l ? dayOf(l.statementLine.date) : null, clearedBy: l ? 'statement' : null };
  };
  return [
    ...deposits.map((d) => withLink({ key: `deposit-${d.id}`, type: 'deposit', id: d.id, side: 'in', date: dayOf(d.depositDate), amount: round2(d.amount), ref: d.depositSlipNo || '', depositOf: dayOf(d.depositOf), description: `Bank Deposit (of ${dayOf(d.depositOf)})` })),
    ...incomes.map((v) => withLink({ key: `income-${v.id}`, type: 'income', id: v.id, side: 'in', date: dayOf(v.voucherDate), amount: round2(v.totalAmount), ref: v.voucherNo, voucherNo: v.voucherNo, book: v.entityType, description: v.entries.map((e) => e.particulars || e.incomeCategoryName).filter(Boolean).join(', ') || 'Voucher Income (bank)' })),
    ...cheques.map((c) => withLink({ key: `panel-cheque-${c.id}`, type: 'panel-cheque', id: c.id, side: 'in', date: dayOf(c.depositDate || c.chequeDate), amount: round2(c.receivedAmount), ref: c.chequeNo, description: `Panel cheque — ${coName.get(c.panelCompanyId) || ''}`.trim() })),
    ...ccs.map((s) => withLink({ key: `cc-${s.id}`, type: 'cc', id: s.id, side: 'in', date: dayOf(s.receivedDate), amount: round2(s.receivedAmount), ref: s.visit?.serialNo ? `Slip # ${s.visit.serialNo}` : '', description: 'CC settlement' })),
  ];
}

// Book items from the opening date on (earlier ones are inside the opening
// balance) and the statement lines. A line counts as matched only by a book
// entry that still exists (an undone CC receipt or deleted voucher frees it).
async function loadBook(bank) {
  const open = bank.openingDate ? dayOf(bank.openingDate) : null;
  const all = [...await bookDebits(bank), ...await bookCredits(bank)];
  const live = new Set(all.map((i) => i.key));
  const items = all.filter((i) => i.date && (!open || i.date >= open)).sort((a, b) => (a.date === b.date ? a.key.localeCompare(b.key) : a.date < b.date ? -1 : 1));
  return { items, lines: await statementLines(bank, live) };
}

async function statementLines(bank, live) {
  const lines = await prisma.accBankStatementLine.findMany({
    where: { bankAccountId: bank.id },
    select: {
      id: true, date: true, instrumentNo: true, particulars: true, debit: true, credit: true, balance: true, uploadBatchId: true,
      matchedCheques: { select: { id: true } }, reconLinks: { select: { bookType: true, bookId: true } },
    },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });
  return lines.map((l) => {
    const matchedTo = [...l.matchedCheques.map((e) => `exp-${e.id}`), ...l.reconLinks.map((r) => `${r.bookType}-${r.bookId}`)].filter((k) => !live || live.has(k));
    return {
      id: l.id, date: dayOf(l.date), instrumentNo: l.instrumentNo || '', particulars: l.particulars || '',
      debit: round2(l.debit), credit: round2(l.credit), balance: l.balance === null ? null : round2(l.balance), batch: l.uploadBatchId,
      matched: matchedTo.length > 0, matchedTo,
    };
  });
}

const signedAmount = (i) => (i.side === 'in' ? i.amount : -i.amount);

// ─── Bank accounts ───────────────────────────────────────────────────────────

async function saveBankOpening(id, { openingBalance, openingDate, isActive } = {}) {
  const bank = await loadBank(id);
  if (openingDate && !isIsoDate(openingDate)) throw fail(400, 'Opening date is not valid');
  const ob = Number(openingBalance);
  if (openingBalance !== undefined && openingBalance !== '' && !Number.isFinite(ob)) throw fail(400, 'Opening balance is not a number');
  return prisma.accBankAccount.update({
    where: { id: bank.id },
    data: {
      ...(openingBalance !== undefined ? { openingBalance: round2(ob || 0) } : {}),
      ...(openingDate !== undefined ? { openingDate: openingDate ? new Date(`${openingDate}T00:00:00Z`) : null } : {}),
      ...(isActive !== undefined ? { isActive: !!isActive } : {}),
    },
  });
}

// ─── Bank Book / balances ────────────────────────────────────────────────────

function bookBalanceAt(bank, items, day) {
  return round2(Number(bank.openingBalance || 0) + items.filter((i) => i.date <= day).reduce((s, i) => s + signedAmount(i), 0));
}

async function getBankBook({ bankAccountId, from, to } = {}) {
  const bank = await loadBank(bankAccountId);
  const { items } = await loadBook(bank);
  const f = isIsoDate(from) ? from : (bank.openingDate ? dayOf(bank.openingDate) : (items[0]?.date || pktToday()));
  const t = isIsoDate(to) ? to : pktToday();
  const before = items.filter((i) => i.date < f);
  const opening = round2(Number(bank.openingBalance || 0) + before.reduce((s, i) => s + signedAmount(i), 0));
  let running = opening;
  const rows = items.filter((i) => i.date >= f && i.date <= t).map((i) => {
    running = round2(running + signedAmount(i));
    return { ...i, moneyIn: i.side === 'in' ? i.amount : 0, moneyOut: i.side === 'out' ? i.amount : 0, balance: running };
  });
  return {
    bank: { id: bank.id, bankName: bank.bankName, accountNumber: bank.accountNumber, openingBalance: round2(bank.openingBalance), openingDate: dayOf(bank.openingDate) },
    from: f, to: t, opening, rows,
    totalIn: round2(rows.reduce((s, r) => s + r.moneyIn, 0)), totalOut: round2(rows.reduce((s, r) => s + r.moneyOut, 0)), closing: running,
  };
}

function statementBalanceAt(lines, day) {
  const withBal = lines.filter((l) => l.date <= day && l.balance !== null);
  const last = withBal[withBal.length - 1];
  return last ? { balance: last.balance, date: last.date } : null;
}

async function getBankBalances({ entityType, asOf } = {}) {
  const day = isIsoDate(asOf) ? asOf : pktToday();
  const banks = await prisma.accBankAccount.findMany({ where: { entityType: entityType || 'non-corporate' }, orderBy: { id: 'asc' } });
  const rows = [];
  for (const bank of banks) {
    const { items, lines } = await loadBook(bank);
    const st = statementBalanceAt(lines, day);
    const book = bookBalanceAt(bank, items, day);
    rows.push({
      bankAccountId: bank.id, bankName: bank.bankName, accountNumber: bank.accountNumber, isActive: bank.isActive,
      bookBalance: book, statementBalance: st ? st.balance : null, statementDate: st ? st.date : null,
      difference: st ? round2(book - st.balance) : null,
    });
  }
  return { asOf: day, rows, totalBook: round2(rows.reduce((s, r) => s + r.bookBalance, 0)) };
}

// ─── Bank Balance Statement — one bank, one month (owner, 2026-11-21) ────────
// Laid out like the hospital's Excel: the opening balance, then every entry on
// the day the bank booked it — Dr (money out), Cr (money in) and the running
// balance — each amount in a colour category. From the books (Voucher
// Expense / Income, Bank Deposit, panel cheques, CC settlements) plus the
// uploaded statement's lines no book entry is matched to (Unknown).
//   Day: a cheque counts when it clears (statement match or ticked
//   presented); one not cleared by the month's end is listed under
//   Un-presented instead. Everything else counts on the matched statement
//   line's day, else its own day.
//   Category, for statement month M: cheques / online payments by their own
//   month — M, M−1, older (Old Chqs); Bank Deposits by their "Deposit Of"
//   day the same way; Panel (Corporate) entries, CC settlements, bank-mode
//   Voucher Income (Online Deposit), bank charges (Bank) and Unknown have
//   their own. A cheque written for several account lines is one row.
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// Book account names / statement particulars that are the bank's own charges.
const BANK_CHARGE_ACCOUNT = /bank\s*(charge|commission)|excise|\bfed\b|withholding|\bw\.?h\.?t\b|sms\s*(alert|charge)/i;
const BANK_CHARGE_LINE = /charge|commission|excise|\bfed\b|withholding|\bw\.?h\.?\s*tax\b|\bwht\b|sms\s*alert/i;

function bankStatementCategories(ym) {
  const m = Number(ym.slice(5, 7));
  const cur = MON[m - 1];
  const prev = MON[(m + 10) % 12];
  // Order as on the Excel sheet.
  return [
    { key: 'unkDep', label: 'UNKNOWN DEPOSIT', side: 'in' },
    { key: 'unkChq', label: 'UNKNOWN CHQ', side: 'out' },
    { key: 'online', label: 'ONLINE DEPOSIT', side: 'in' },
    { key: 'depPrev', label: `${prev} DEPOSIT`, side: 'in' },
    { key: 'chqPrev', label: `${prev} CHQ`, side: 'out' },
    { key: 'depOld', label: 'OLD DEPOSIT', side: 'in' },
    { key: 'chqOld', label: 'OLD CHQS', side: 'out' },
    { key: 'depCur', label: `${cur} DEPOSIT`, side: 'in' },
    { key: 'chqCur', label: `${cur} CHQ`, side: 'out' },
    { key: 'corpDep', label: 'CORPORATE DEPOSIT', side: 'in' },
    { key: 'corpChq', label: 'CORPORATE CHQ', side: 'out' },
    { key: 'cc', label: 'CREDIT CARD', side: 'in' },
    { key: 'bank', label: 'BANK', side: 'out' },
  ];
}

async function getBankMonthStatement({ bankAccountId, year, month } = {}) {
  const bank = await loadBank(bankAccountId);
  const y = Number(year);
  const mo = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100 || !Number.isInteger(mo) || mo < 1 || mo > 12) throw fail(400, 'Select the month and year');
  const ym = `${y}-${String(mo).padStart(2, '0')}`;
  const prevYm = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
  const first = `${ym}-01`;
  const last = `${ym}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0')}`;
  const open = bank.openingDate ? dayOf(bank.openingDate) : null;
  const { items, lines } = await loadBook(bank);

  const age = (day) => {
    const k = String(day || '').slice(0, 7);
    if (!k || k >= ym) return 'Cur';
    return k === prevYm ? 'Prev' : 'Old';
  };
  const categoryOf = (i) => {
    if (i.type === 'expense') {
      if (BANK_CHARGE_ACCOUNT.test(i.accountName || '')) return 'bank';
      if (i.book === 'corporate') return 'corpChq';
      return `chq${age(i.date)}`;
    }
    if (i.type === 'deposit') return `dep${age(i.depositOf || i.date)}`;
    if (i.type === 'panel-cheque') return 'corpDep';
    if (i.type === 'cc') return 'cc';
    if (i.type === 'income') return i.book === 'corporate' ? 'corpDep' : 'online';
    return i.side === 'in' ? 'unkDep' : 'unkChq';
  };
  // The day the bank booked it; null = a cheque not cleared yet.
  const bankDay = (i) => (i.side === 'out' && i.mode === 'cheque' ? i.clearedDate || null : i.clearedDate || i.date);

  // One row per cheque (its account lines added up); everything else as is.
  const merged = [];
  const byCheque = new Map();
  for (const i of items) {
    const k = i.type === 'expense' && i.mode === 'cheque' && i.chequeNo ? `${i.voucherNo}|${String(i.chequeNo).trim()}` : null;
    if (!k) { merged.push({ ...i }); continue; }
    const g = byCheque.get(k);
    if (!g) { const row = { ...i, descriptions: [i.description] }; byCheque.set(k, row); merged.push(row); continue; }
    g.amount = round2(g.amount + i.amount);
    if (i.description && !g.descriptions.includes(i.description)) g.descriptions.push(i.description);
    if (i.clearedDate && (!g.clearedDate || i.clearedDate > g.clearedDate)) g.clearedDate = i.clearedDate;
    if (!i.clearedDate) g.someUncleared = true;
  }
  merged.forEach((r) => {
    if (r.descriptions) r.description = r.descriptions.join(', ');
    // Every line of a cheque has to be cleared for the cheque to count.
    if (r.someUncleared) r.clearedDate = null;
  });

  const unknown = lines
    .filter((l) => !l.matched && (!open || l.date >= open))
    .map((l) => ({
      key: `line-${l.id}`, type: 'statement', side: l.debit > 0 ? 'out' : 'in', date: l.date,
      amount: l.debit > 0 ? l.debit : l.credit, ref: l.instrumentNo || '', description: l.particulars || '',
      clearedDate: l.date,
      category: l.debit > 0 ? (BANK_CHARGE_LINE.test(l.particulars || '') ? 'bank' : 'unkChq') : 'unkDep',
    }));

  // The Excel's wording for the bank's own entries.
  const short = (iso) => (iso ? `${iso.slice(8, 10)}-${MON[Number(iso.slice(5, 7)) - 1].charAt(0)}${MON[Number(iso.slice(5, 7)) - 1].slice(1).toLowerCase()}-${iso.slice(0, 4)}` : '');
  const describe = (i) => {
    if (i.type === 'deposit') return `Cash Deposit (cash of ${short(i.depositOf)})`;
    if (i.type === 'cc') return `CC — Income${i.ref ? ` (${i.ref})` : ''}`;
    return i.description;
  };
  const entries = [
    ...merged.map((i) => ({ ...i, description: describe(i), day: bankDay(i), category: categoryOf(i) })),
    ...unknown.map((l) => ({ ...l, day: l.date })),
  ];
  const signed = (e) => (e.side === 'in' ? e.amount : -e.amount);
  const opening = round2(Number(bank.openingBalance || 0) + entries.filter((e) => e.day && e.day < first).reduce((s, e) => s + signed(e), 0));

  const cats = bankStatementCategories(ym);
  const totals = Object.fromEntries(cats.map((c) => [c.key, 0]));
  let running = opening;
  const rows = entries
    .filter((e) => e.day && e.day >= first && e.day <= last)
    .sort((a, b) => (a.day === b.day ? a.key.localeCompare(b.key) : a.day < b.day ? -1 : 1))
    .map((e) => {
      running = round2(running + signed(e));
      totals[e.category] = round2((totals[e.category] || 0) + e.amount);
      return {
        key: e.key, date: e.day, description: e.description || '',
        ref: e.type === 'expense' ? (e.chequeNo || e.voucherNo || '') : e.ref || '',
        voucherNo: e.voucherNo || null, type: e.type, category: e.category,
        dr: e.side === 'out' ? e.amount : 0, cr: e.side === 'in' ? e.amount : 0, balance: running,
        ownDate: e.type === 'deposit' ? e.depositOf : e.date,
      };
    });

  const unpresented = merged
    .filter((i) => i.type === 'expense' && i.mode === 'cheque' && i.date <= last && (!i.clearedDate || i.clearedDate > last))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((i) => ({ key: i.key, voucherNo: i.voucherNo, chequeNo: i.chequeNo, chequeDate: i.date, description: i.description, amount: i.amount, category: categoryOf(i) }));

  const totalDr = round2(rows.reduce((s, r) => s + r.dr, 0));
  const totalCr = round2(rows.reduce((s, r) => s + r.cr, 0));
  return {
    bank: { id: bank.id, bankName: bank.bankName, accountNumber: bank.accountNumber, entityType: bank.entityType, openingDate: open },
    year: y, month: mo, from: first, to: last,
    categories: cats.map((c) => ({ ...c, total: totals[c.key] || 0 })),
    opening, rows, totalDr, totalCr, closing: round2(opening + totalCr - totalDr),
    unpresented, unpresentedTotal: round2(unpresented.reduce((s, u) => s + u.amount, 0)),
  };
}

// Uploaded statement lines no book entry is matched to (from the bank's
// opening date on), bank charges marked — for the Income & Expense Summary.
async function unmatchedStatementLines(bankAccountId) {
  const bank = await loadBank(bankAccountId);
  const open = bank.openingDate ? dayOf(bank.openingDate) : null;
  const { lines } = await loadBook(bank);
  return lines
    .filter((l) => !l.matched && (!open || l.date >= open))
    .map((l) => ({ ...l, isCharge: l.debit > 0 && BANK_CHARGE_LINE.test(l.particulars || '') }));
}

// ─── Statement upload batches ────────────────────────────────────────────────

async function listBatches({ bankAccountId } = {}) {
  const bank = await loadBank(bankAccountId);
  const { lines } = await loadBook(bank);
  const m = new Map();
  for (const l of lines) {
    const k = l.batch || '(no batch)';
    if (!m.has(k)) m.set(k, { batch: k, count: 0, from: l.date, to: l.date, matched: 0, debit: 0, credit: 0, closing: null });
    const b = m.get(k);
    b.count += 1; b.debit = round2(b.debit + l.debit); b.credit = round2(b.credit + l.credit);
    if (l.date < b.from) b.from = l.date;
    if (l.date >= b.to) { b.to = l.date; if (l.balance !== null) b.closing = l.balance; }
    if (l.matched) b.matched += 1;
  }
  const out = [...m.values()].map((b) => ({ ...b, uploadedAt: /^bsu-\d+$/.test(b.batch) ? new Date(Number(b.batch.slice(4))) : null }));
  return out.sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
}

async function deleteBatch({ bankAccountId, batch } = {}) {
  const bank = await loadBank(bankAccountId);
  const lines = await prisma.accBankStatementLine.findMany({ where: { bankAccountId: bank.id, uploadBatchId: batch }, select: { id: true, date: true } });
  if (!lines.length) throw fail(404, 'Upload not found');
  const lock = await lockDateOf(bank.id);
  if (lock && lines.some((l) => dayOf(l.date) <= lock)) throw fail(400, `This upload has lines on or before ${lock}, which is signed off. Reopen the sign-off first.`);
  const ids = lines.map((l) => l.id);
  await prisma.$transaction([
    prisma.accVoucherExpenseEntry.updateMany({ where: { matchedStatementLineId: { in: ids } }, data: { matchedStatementLineId: null } }),
    prisma.accBankStatementLine.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return { deleted: ids.length };
}

// ─── Matching ────────────────────────────────────────────────────────────────

const normNo = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '');

// Exact matches by the statement's Instrument No (owner, 2026-11-23):
//   a bank DEBIT to a cheque by its cheque # — a cheque written for several
//     account lines is one debit: its lines (same voucher, same cheque #) go
//     together against their total;
//   a bank CREDIT to a Bank Deposit by its Deposit Slip No — deposits on the
//     same slip go together against their total.
// The amount has to agree too, and exactly one statement line may fit.
// Number match ignores signs, letters and leading zeros (DS-0045 = 45).
function instrumentPairs(freeItems, freeLines) {
  const pairs = [];
  const usedLines = new Set();
  const groupsOf = (list, keyOf) => {
    const m = new Map();
    list.forEach((i) => { const k = keyOf(i); if (k) m.set(k, [...(m.get(k) || []), i]); });
    return [...m.values()];
  };
  const pick = (groups, side, refOf) => {
    for (const group of groups) {
      const no = normNo(refOf(group[0]));
      if (!no) continue;
      const total = round2(group.reduce((sum, i) => sum + i.amount, 0));
      const c = freeLines.filter((l) => !usedLines.has(l.id) && (side === 'out' ? l.debit : l.credit) === total && normNo(l.instrumentNo) === no);
      if (c.length !== 1) continue;
      group.forEach((it) => pairs.push([it, c[0]]));
      usedLines.add(c[0].id);
    }
  };
  pick(groupsOf(freeItems.filter((i) => i.type === 'expense' && i.chequeNo), (i) => `${i.voucherNo}|${String(i.chequeNo).trim()}`), 'out', (i) => i.chequeNo);
  pick(groupsOf(freeItems.filter((i) => i.type === 'deposit' && normNo(i.ref)), (i) => normNo(i.ref)), 'in', (i) => i.ref);
  return pairs;
}

// What a match is saved as: a cheque on its Voucher Expense line, anything
// else as a recon link.
function savePairs(bank, pairs, method, userName) {
  return prisma.$transaction(pairs.map(([it, line]) => (it.type === 'expense'
    ? prisma.accVoucherExpenseEntry.update({ where: { id: it.id }, data: { matchedStatementLineId: line.id } })
    : prisma.accBankReconLink.create({ data: { bankAccountId: bank.id, statementLineId: line.id, bookType: it.type, bookId: it.id, amount: it.amount, method, matchedByName: userName || null } }))));
}

// Book entries / statement lines still open for matching (not matched, not
// ticked presented by hand, after the sign-off date).
async function freeForMatching(bank) {
  const lock = await lockDateOf(bank.id);
  const open = (d) => !lock || d > lock;
  const { items, lines } = await loadBook(bank);
  return {
    freeItems: items.filter((i) => !i.lineId && !(i.type === 'expense' && i.clearedBy === 'manual') && open(i.date)),
    freeLines: lines.filter((l) => !l.matched && open(l.date)),
  };
}

// Statement upload: only the exact Instrument No matches (cheque # / deposit slip #).
async function matchByInstrument({ bankAccountId, userName } = {}) {
  const bank = await loadBank(bankAccountId);
  const { freeItems, freeLines } = await freeForMatching(bank);
  const pairs = instrumentPairs(freeItems, freeLines);
  if (pairs.length) await savePairs(bank, pairs, 'auto', userName);
  return { matched: new Set(pairs.map(([, l]) => l.id)).size };
}

async function autoMatch({ bankAccountId, userName } = {}) {
  const bank = await loadBank(bankAccountId);
  const { freeItems, freeLines } = await freeForMatching(bank);
  const usedItems = new Set();
  const usedLines = new Set();
  const take = (item, line) => { pairs.push([item, line]); usedItems.add(item.key); usedLines.add(line.id); };

  // 1. Exact by Instrument No: cheque # and deposit slip # (see instrumentPairs).
  const pairs = instrumentPairs(freeItems, freeLines);
  pairs.forEach(([it, line]) => { usedItems.add(it.key); usedLines.add(line.id); });
  // 2. By amount within a few days, only where both sides have one candidate.
  const window = (it) => (it.side === 'out' ? (it.mode === 'cheque' ? [0, 7] : [-1, 3]) : [-1, 5]);
  const candidates = (it) => freeLines.filter((l) => {
    if (usedLines.has(l.id)) return false;
    if ((it.side === 'out' ? l.debit : l.credit) !== it.amount) return false;
    const [lo, hi] = window(it);
    const d = daysBetween(l.date, it.date);
    return d >= lo && d <= hi;
  });
  const rest = freeItems.filter((i) => !usedItems.has(i.key));
  for (const it of rest) {
    const c = candidates(it);
    if (c.length !== 1) continue;
    const line = c[0];
    const rivals = rest.filter((o) => !usedItems.has(o.key) && o.side === it.side && candidates(o).some((l) => l.id === line.id));
    if (rivals.length === 1) take(it, line);
  }

  await savePairs(bank, pairs, 'auto', userName);
  const linesUsed = new Set(pairs.map(([, l]) => l.id)).size;
  return { matched: linesUsed, unmatchedItems: freeItems.length - pairs.length, unmatchedLines: freeLines.length - linesUsed };
}

// One statement line with one or more book items of the same direction whose
// total equals the line.
async function manualMatch({ bankAccountId, lineId, itemKeys, userName } = {}) {
  const bank = await loadBank(bankAccountId);
  const lock = await lockDateOf(bank.id);
  const { items, lines } = await loadBook(bank);
  const line = lines.find((l) => l.id === Number(lineId));
  if (!line) throw fail(400, 'Pick one statement line');
  if (line.matched) throw fail(400, 'That statement line is already matched — unmatch it first');
  const picked = (Array.isArray(itemKeys) ? itemKeys : []).map((k) => items.find((i) => i.key === k));
  if (!picked.length || picked.some((i) => !i)) throw fail(400, 'Pick the book entries that make up this line');
  if (picked.some((i) => i.lineId || (i.type === 'expense' && i.clearedBy === 'manual'))) throw fail(400, 'A picked entry is already matched or marked presented');
  const lineSide = line.debit > 0 ? 'out' : 'in';
  if (picked.some((i) => i.side !== lineSide)) throw fail(400, lineSide === 'out' ? 'A bank debit matches payments (cheque / online), not deposits' : 'A bank credit matches deposits / income, not payments');
  const total = round2(picked.reduce((s, i) => s + i.amount, 0));
  const lineAmt = lineSide === 'out' ? line.debit : line.credit;
  if (Math.abs(total - lineAmt) > 0.005) throw fail(400, `Picked entries total Rs. ${total.toLocaleString()}, the line is Rs. ${lineAmt.toLocaleString()}`);
  if (lock && (line.date <= lock || picked.some((i) => i.date <= lock))) throw fail(400, `Signed off up to ${lock} — reopen the sign-off to change it`);
  await prisma.$transaction(picked.map((it) => (it.type === 'expense'
    ? prisma.accVoucherExpenseEntry.update({ where: { id: it.id }, data: { matchedStatementLineId: line.id } })
    : prisma.accBankReconLink.create({ data: { bankAccountId: bank.id, statementLineId: line.id, bookType: it.type, bookId: it.id, amount: it.amount, method: 'manual', matchedByName: userName || null } }))));
  return { matched: picked.length };
}

async function unmatchLine({ bankAccountId, lineId } = {}) {
  const bank = await loadBank(bankAccountId);
  const line = await prisma.accBankStatementLine.findFirst({ where: { id: Number(lineId), bankAccountId: bank.id }, select: { id: true, date: true } });
  if (!line) throw fail(404, 'Statement line not found');
  const lock = await lockDateOf(bank.id);
  if (lock && dayOf(line.date) <= lock) throw fail(400, `Signed off up to ${lock} — reopen the sign-off to change it`);
  await prisma.$transaction([
    prisma.accVoucherExpenseEntry.updateMany({ where: { matchedStatementLineId: line.id }, data: { matchedStatementLineId: null } }),
    prisma.accBankReconLink.deleteMany({ where: { statementLineId: line.id } }),
  ]);
  return { id: line.id };
}

// A statement line that isn't in the books yet (bank charges, profit, a
// direct credit): make the voucher on this bank and match it.
async function addToBooks({ bankAccountId, lineId, mainAccountId, incomeCategoryId, particulars, userName } = {}, accountsSvc) {
  const bank = await loadBank(bankAccountId);
  const { lines } = await loadBook(bank);
  const line = lines.find((l) => l.id === Number(lineId));
  if (!line) throw fail(404, 'Statement line not found');
  if (line.matched) throw fail(400, 'That line is already matched');
  // Links left by a book entry that no longer exists.
  await prisma.accBankReconLink.deleteMany({ where: { statementLineId: line.id } });
  const day = line.date;
  const lock = await lockDateOf(bank.id);
  if (lock && day <= lock) throw fail(400, `Signed off up to ${lock} — reopen the sign-off to change it`);
  const text = String(particulars || line.particulars || '').trim() || null;
  if (Number(line.debit) > 0) {
    const acc = mainAccountId ? await prisma.accMainAccount.findUnique({ where: { id: Number(mainAccountId) }, include: { subGL: { select: { id: true, mainGlId: true } } } }) : null;
    if (!acc) throw fail(400, 'Pick the expense account');
    const v = await accountsSvc.createVoucherExpense({
      entityType: bank.entityType, mode: 'online', bankId: bank.id, voucherDate: day,
      entries: [{ mainGlId: acc.subGL.mainGlId, subGlId: acc.subGlId, mainAccountId: acc.id, accountCode: acc.code, accountName: acc.name, payeeName: text || bank.bankName, amount: round2(line.debit), particulars: text }],
    });
    await prisma.accVoucherExpenseEntry.update({ where: { id: v.entries[0].id }, data: { matchedStatementLineId: line.id } });
    return { voucherNo: v.voucherNo, kind: 'expense' };
  }
  const cat = incomeCategoryId ? await prisma.accIncomeCategory.findUnique({ where: { id: Number(incomeCategoryId) } }) : null;
  if (!cat) throw fail(400, 'Pick the income category');
  const v = await accountsSvc.createVoucherIncome({
    entityType: bank.entityType, mode: 'bank', bankId: bank.id, voucherDate: day,
    entries: [{ incomeCategoryId: cat.id, incomeCategoryName: cat.name, amount: round2(line.credit), particulars: text }],
  });
  await prisma.accBankReconLink.create({ data: { bankAccountId: bank.id, statementLineId: line.id, bookType: 'income', bookId: v.id, amount: round2(line.credit), method: 'manual', matchedByName: userName || null } });
  return { voucherNo: v.voucherNo, kind: 'income' };
}

async function getReconItems({ bankAccountId, from, to } = {}) {
  const bank = await loadBank(bankAccountId);
  const [{ items, lines }, lock] = await Promise.all([loadBook(bank), lockDateOf(bank.id)]);
  const inRange = (d) => (!isIsoDate(from) || d >= from) && (!isIsoDate(to) || d <= to);
  return {
    bank: { id: bank.id, bankName: bank.bankName, accountNumber: bank.accountNumber, entityType: bank.entityType },
    lockDate: lock,
    items: items.filter((i) => inRange(i.date)),
    lines: lines.filter((l) => inRange(l.date)),
  };
}

// ─── BRS ─────────────────────────────────────────────────────────────────────

async function getStatement({ bankAccountId, asOf, statementBalance } = {}) {
  const bank = await loadBank(bankAccountId);
  const day = isIsoDate(asOf) ? asOf : pktToday();
  const [{ items, lines }, lock, signoffs] = await Promise.all([
    loadBook(bank), lockDateOf(bank.id),
    prisma.accBankReconSignoff.findMany({ where: { bankAccountId: bank.id }, orderBy: [{ asOfDate: 'desc' }, { id: 'desc' }], take: 12 }),
  ]);
  const st = statementBalanceAt(lines, day);
  const typed = statementBalance !== undefined && statementBalance !== '' && Number.isFinite(Number(statementBalance));
  const stmtBal = typed ? round2(statementBalance) : st ? st.balance : null;
  const upTo = items.filter((i) => i.date <= day);
  const notCleared = (i) => !i.clearedDate || i.clearedDate > day;
  const unpresented = upTo.filter((i) => i.side === 'out' && notCleared(i));
  const inTransit = upTo.filter((i) => i.side === 'in' && notCleared(i));
  const linesUpTo = lines.filter((l) => l.date <= day && !l.matched);
  const bankCredits = linesUpTo.filter((l) => l.credit > 0);
  const bankDebits = linesUpTo.filter((l) => l.debit > 0);
  const sum = (arr, f) => round2(arr.reduce((s, x) => s + f(x), 0));
  const totals = {
    inTransit: sum(inTransit, (i) => i.amount),
    unpresented: sum(unpresented, (i) => i.amount),
    bankCredits: sum(bankCredits, (l) => l.credit),
    bankDebits: sum(bankDebits, (l) => l.debit),
  };
  const bookBalance = bookBalanceAt(bank, items, day);
  const adjusted = stmtBal === null ? null : round2(stmtBal + totals.inTransit - totals.unpresented - totals.bankCredits + totals.bankDebits);
  return {
    bank: { id: bank.id, bankName: bank.bankName, accountNumber: bank.accountNumber, openingBalance: round2(bank.openingBalance), openingDate: dayOf(bank.openingDate) },
    asOf: day,
    statementBalance: stmtBal, statementBalanceFrom: typed ? 'typed' : st ? `statement line of ${st.date}` : null,
    inTransit, unpresented, bankCredits, bankDebits, totals,
    adjustedBalance: adjusted, bookBalance,
    difference: adjusted === null ? null : round2(bookBalance - adjusted),
    lockDate: lock,
    signoffs: signoffs.map((s) => ({ id: s.id, asOfDate: dayOf(s.asOfDate), statementBalance: round2(s.statementBalance), bookBalance: round2(s.bookBalance), difference: round2(s.difference), signedByName: s.signedByName, signedAt: s.signedAt, reopenedByName: s.reopenedByName, reopenedAt: s.reopenedAt })),
  };
}

async function signOff({ bankAccountId, asOf, statementBalance, userName } = {}) {
  const r = await getStatement({ bankAccountId, asOf, statementBalance });
  if (r.statementBalance === null) throw fail(400, 'No statement balance on that date — upload the statement or type its balance');
  return prisma.accBankReconSignoff.create({
    data: {
      bankAccountId: r.bank.id, asOfDate: new Date(`${r.asOf}T00:00:00Z`),
      statementBalance: r.statementBalance, bookBalance: r.bookBalance, difference: r.difference,
      signedByName: String(userName || '').trim() || null,
    },
  });
}

async function reopenSignOff(id, { userName } = {}) {
  const s = await prisma.accBankReconSignoff.findUnique({ where: { id: Number(id) } });
  if (!s) throw fail(404, 'Sign-off not found');
  if (s.reopenedAt) throw fail(400, 'Already reopened');
  return prisma.accBankReconSignoff.update({ where: { id: s.id }, data: { reopenedAt: new Date(), reopenedByName: String(userName || '').trim() || null } });
}

// Expense accounts for "Add to books" (Main Account with its Sub GL / Main GL).
async function listExpenseAccounts(entityType) {
  const rows = await prisma.accMainAccount.findMany({
    where: { entityType: entityType || 'non-corporate' },
    select: { id: true, code: true, name: true, subGL: { select: { name: true, mainGL: { select: { name: true } } } } },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => ({ id: r.id, code: r.code, name: r.name, path: `${r.subGL?.mainGL?.name || ''} › ${r.subGL?.name || ''}` }));
}

module.exports = {
  saveBankOpening, getBankBook, getBankBalances, getBankMonthStatement, unmatchedStatementLines, listBatches, deleteBatch,
  autoMatch, matchByInstrument, manualMatch, unmatchLine, addToBooks, getReconItems,
  getStatement, signOff, reopenSignOff, listExpenseAccounts, dayOf, lockDateOf,
};
