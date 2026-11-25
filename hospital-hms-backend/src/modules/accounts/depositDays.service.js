const prisma = require('../../config/db');
const { getDailyIncomeExpenseDiff } = require('./accounts.service');
const clinicSvc = require('../clinic/clinic.service');

// Bank Deposit by day (owner, 2026-11-24) — like Presented / Unpresented
// Cheques. Each business day's cash for the last 3 months, whether it is in
// the bank yet, and one popup that deposits one or more days under one slip
// (one AccBankDeposit per day, same slip #; Bank Reconciliation adds
// same-slip deposits together). The amount is the day's cash — not typed:
//   Cash GL: the Clinic Revenue Dashboard's "Cash" for that day — the same
//     Patients List rows (payment type Cash, Received, 08:00 → 07:59
//     business day) the dashboard's month calendar adds up;
//   Corporate: that day's income − expense (as the old form filled in).
// Cash GL also shows the day's JazzCash (the dashboard's "JazzCash") next to
// it — only shown: it is never deposited (no slip); depositing the day's cash
// takes the day, JazzCash and all, off the undeposited list (owner).

const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const pktToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(new Date(s).getTime());
const err = (status, message) => Object.assign(new Error(message), { status });
const bookOf = (v) => (v === 'corporate' ? 'corporate' : 'non-corporate');
function threeMonthsBack(today) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 3);
  return isoDay(d);
}
function daysBetween(from, to) {
  const out = [];
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= new Date(`${to}T00:00:00Z`).getTime(); t += 864e5) out.push(isoDay(t));
  return out;
}
// Clinic Revenue Dashboard → Cash (or JazzCash), per business day (see
// RevenueDashboard.jsx month view: Patients List rows filtered by the payment
// type, amount = Received).
async function clinicCashByDay(from, to, paymentType = 'Cash') {
  const next = isoDay(new Date(`${to}T00:00:00Z`).getTime() + 864e5);
  const rows = await clinicSvc.getPatientVisits({ fromDate: from, toDate: next, fromTime: '08:00:00', toTime: '07:59:59', paymentTypes: [paymentType] });
  const out = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const day = r.businessDay;
    if (!day || day < from || day > to) continue;
    out.set(day, round2((out.get(day) || 0) + (Number(r.received) || 0)));
  }
  return out;
}

// The day's cash.
async function cashOf(entityType, days) {
  if (entityType === 'non-corporate') {
    const sorted = [...days].sort();
    const all = await clinicCashByDay(sorted[0], sorted[sorted.length - 1]);
    return new Map(days.map((d) => [d, all.get(d) || 0]));
  }
  const out = new Map();
  for (let i = 0; i < days.length; i += 8) {
    const part = await Promise.all(days.slice(i, i + 8).map((d) => getDailyIncomeExpenseDiff(d, entityType)));
    part.forEach((r) => out.set(r.date, round2(r.diff)));
  }
  return out;
}
const depositView = (d, linked) => ({
  id: d.id,
  bankAccountId: d.bankAccountId,
  bankName: d.bankAccount ? `${d.bankAccount.bankName} (${d.bankAccount.accountNumber})` : '',
  depositDate: isoDay(d.depositDate),
  depositSlipNo: d.depositSlipNo || '',
  depositedBy: d.depositedBy || '',
  amount: round2(d.amount),
  reconciled: linked.has(d.id),
});

// The days of from…to with cash, and which are in the bank. asOf (a day):
// only deposits made by then count — for a past month's report.
async function listDepositDays({ entityType: et, from: f, to: t, asOf } = {}) {
  const entityType = bookOf(et);
  const today = pktToday();
  const to = isDay(t) && t <= today ? t : today;
  const from = isDay(f) ? f : threeMonthsBack(to);
  if (from > to) throw err(400, 'From date To se pehle honi chahiye');
  const days = daysBetween(from, to);
  if (days.length > 200) throw err(400, '200 din se zyada ek saath nahi');
  const [cash, jazz, deposits] = await Promise.all([
    cashOf(entityType, days),
    entityType === 'non-corporate' ? clinicCashByDay(from, to, 'JazzCash') : new Map(),
    prisma.accBankDeposit.findMany({
      where: {
        entityType,
        depositOf: { gte: new Date(from), lte: new Date(to) },
        ...(isDay(asOf) ? { depositDate: { lte: new Date(asOf) } } : {}),
      },
      include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
      orderBy: { id: 'asc' },
    }),
  ]);
  const linked = new Set((await prisma.accBankReconLink.findMany({
    where: { bookType: 'deposit', bookId: { in: deposits.map((d) => d.id) } }, select: { bookId: true },
  })).map((l) => l.bookId));
  const byDay = new Map();
  deposits.forEach((d) => { const k = isoDay(d.depositOf); byDay.set(k, [...(byDay.get(k) || []), depositView(d, linked)]); });
  const rows = days.map((date) => {
    const list = byDay.get(date) || [];
    return { date, cash: cash.get(date) || 0, jazzcash: jazz.get(date) || 0, deposited: list.length > 0, depositedAmount: round2(list.reduce((s, d) => s + d.amount, 0)), deposits: list };
  }).filter((r) => r.cash > 0.004 || r.deposited).reverse();
  const pending = rows.filter((r) => !r.deposited);
  return {
    from, to, rows,
    undepositedCount: pending.length,
    undepositedAmount: round2(pending.reduce((s, r) => s + r.cash, 0)),
    undepositedJazzcash: round2(pending.reduce((s, r) => s + r.jazzcash, 0)),
  };
}

module.exports = { listDepositDays, cashOf, isDay, isoDay, pktToday, round2, bookOf, err };
