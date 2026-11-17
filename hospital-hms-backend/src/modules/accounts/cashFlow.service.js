const prisma = require('../../config/db');
const clinicSvc = require('../clinic/clinic.service');

// Accounts → Reports → Cash Flow Statement (owner, 2026-11-17), after the
// hospital's Excel sheet. One row per day of the month:
//   Revenue — from the Patients List (Clinic's business day, 08:00 → 07:59):
//     Cash / JazzCash / Bank Online = what was received that day by that
//     payment type; CC-Income = the CC (card) slips' amount on the day they
//     were made (a CC slip's money sits in "balance", not "received").
//     Panel / Staff / Complementary bring no money in and aren't shown.
//   Payments — this book's posted Voucher Expense, one group per Main GL,
//     split by Cash / Online / Cheque.
//   Then Total Paid Cash / Online / Cheque, Total Payments, and Cash
//   Deposited to Bank (Bank Deposit by its "Deposit Of" day) with the
//   deposit date(s).
// Read-only.

const MODES = ['cash', 'online', 'cheque'];
const pad = (n) => String(n).padStart(2, '0');
const dayOf = (d) => new Date(d).toISOString().slice(0, 10);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function revenueKind(paymentType) {
  const t = String(paymentType || '').trim().toLowerCase();
  if (t === 'cash' || t === 'private') return 'cash';
  if (t === 'jazzcash' || t === 'jazz cash') return 'jazzcash';
  if (t === 'online' || t === 'bank online') return 'online';
  if (t === 'cc' || t === 'c card' || t === 'credit card') return 'cc';
  return null;
}

async function getCashFlowStatement({ entityType, year, month } = {}) {
  const book = entityType === 'corporate' ? 'corporate' : 'non-corporate';
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || y < 2000 || y > 2100 || !Number.isInteger(m) || m < 1 || m > 12) {
    throw Object.assign(new Error('Select the month and year'), { status: 400 });
  }
  const first = `${y}-${pad(m)}-01`;
  const last = `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
  const after = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  const days = [];
  for (let d = new Date(`${first}T00:00:00Z`); dayOf(d) <= last; d = new Date(d.getTime() + 864e5)) days.push(dayOf(d));

  const [visits, vouchers, deposits] = await Promise.all([
    // Business days of the month: 08:00 on the 1st → 07:59 after the last day.
    clinicSvc.getPatientVisits({ fromDate: first, toDate: after, fromTime: '08:00:00', toTime: '07:59:59' }),
    prisma.accVoucherExpense.findMany({
      where: { entityType: book, voucherDate: { gte: new Date(`${first}T00:00:00Z`), lte: new Date(`${last}T23:59:59.999Z`) } },
      select: { voucherDate: true, mode: true, entries: { select: { mainGlId: true, amount: true } } },
    }),
    prisma.accBankDeposit.findMany({
      where: { entityType: book, depositOf: { gte: new Date(`${first}T00:00:00Z`), lte: new Date(`${last}T23:59:59.999Z`) } },
      select: { depositOf: true, depositDate: true, amount: true },
    }),
  ]);

  const rowOf = new Map(days.map((d) => [d, {
    date: d,
    revenue: { cash: 0, jazzcash: 0, online: 0, cc: 0 },
    expense: {},
    deposit: { amount: 0, dates: [] },
  }]));

  // Revenue
  for (const v of visits) {
    const row = rowOf.get(v.businessDay);
    if (!row || v.cancelled) continue;
    const kind = revenueKind(v.paymentType);
    if (!kind) continue;
    const received = Number(v.received) || 0;
    row.revenue[kind] += kind === 'cc' ? received + (Number(v.balance) || 0) : received;
  }

  // Payments by Main GL and mode
  const glIds = new Set();
  const modesByGl = new Map();
  for (const v of vouchers) {
    const row = rowOf.get(dayOf(v.voucherDate));
    if (!row) continue;
    const mode = MODES.includes(String(v.mode).toLowerCase()) ? String(v.mode).toLowerCase() : 'cash';
    for (const e of v.entries) {
      const amt = Number(e.amount) || 0;
      if (!amt) continue;
      glIds.add(e.mainGlId);
      if (!modesByGl.has(e.mainGlId)) modesByGl.set(e.mainGlId, new Set());
      modesByGl.get(e.mainGlId).add(mode);
      row.expense[e.mainGlId] = row.expense[e.mainGlId] || { cash: 0, online: 0, cheque: 0 };
      row.expense[e.mainGlId][mode] += amt;
    }
  }
  const gls = glIds.size
    ? await prisma.accMainGL.findMany({ where: { id: { in: [...glIds] } }, select: { id: true, code: true, name: true } })
    : [];
  const groups = gls
    .sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }))
    .map((g) => ({ id: g.id, code: g.code, name: g.name, modes: MODES.filter((md) => modesByGl.get(g.id)?.has(md)) }));

  // Bank deposits by their "Deposit Of" day
  for (const d of deposits) {
    const row = rowOf.get(dayOf(d.depositOf));
    if (!row) continue;
    row.deposit.amount += Number(d.amount) || 0;
    const when = dayOf(d.depositDate);
    if (!row.deposit.dates.includes(when)) row.deposit.dates.push(when);
  }

  // Day totals and the month's totals
  const total = {
    revenue: { cash: 0, jazzcash: 0, online: 0, subtotal: 0, cc: 0, total: 0 },
    expense: {}, groupTotal: {},
    paid: { cash: 0, online: 0, cheque: 0, total: 0 },
    deposit: 0,
  };
  const out = days.map((d) => {
    const r = rowOf.get(d);
    const rev = {
      cash: round2(r.revenue.cash), jazzcash: round2(r.revenue.jazzcash), online: round2(r.revenue.online), cc: round2(r.revenue.cc),
    };
    rev.subtotal = round2(rev.cash + rev.jazzcash + rev.online);
    rev.total = round2(rev.subtotal + rev.cc);
    const paid = { cash: 0, online: 0, cheque: 0 };
    for (const g of groups) {
      const e = r.expense[g.id] || { cash: 0, online: 0, cheque: 0 };
      total.expense[g.id] = total.expense[g.id] || { cash: 0, online: 0, cheque: 0 };
      for (const md of MODES) {
        e[md] = round2(e[md]);
        paid[md] += e[md];
        total.expense[g.id][md] += e[md];
      }
      r.expense[g.id] = e;
    }
    paid.cash = round2(paid.cash); paid.online = round2(paid.online); paid.cheque = round2(paid.cheque);
    paid.total = round2(paid.cash + paid.online + paid.cheque);
    Object.keys(total.revenue).forEach((k) => { total.revenue[k] += rev[k]; });
    Object.keys(total.paid).forEach((k) => { total.paid[k] += paid[k]; });
    total.deposit += r.deposit.amount;
    return { date: d, revenue: rev, expense: r.expense, paid, deposit: { amount: round2(r.deposit.amount), dates: r.deposit.dates.sort() } };
  });
  Object.keys(total.revenue).forEach((k) => { total.revenue[k] = round2(total.revenue[k]); });
  Object.keys(total.paid).forEach((k) => { total.paid[k] = round2(total.paid[k]); });
  total.deposit = round2(total.deposit);
  for (const g of groups) {
    const t = total.expense[g.id] || { cash: 0, online: 0, cheque: 0 };
    MODES.forEach((md) => { t[md] = round2(t[md]); });
    total.expense[g.id] = t;
    total.groupTotal[g.id] = round2(t.cash + t.online + t.cheque);
  }

  return { entityType: book, year: y, month: m, groups, days: out, total };
}

module.exports = { getCashFlowStatement };
