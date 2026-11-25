const express = require('express');
const prisma = require('../../config/db');
const { success, fail } = require('../../utils/response');
const { listDepositDays, cashOf, isDay, isoDay, pktToday, round2, bookOf, err } = require('./depositDays.service');

// Bank Deposit by day — the screen's API (rules in depositDays.service.js).
const router = express.Router();
const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { if (e.status) return fail(res, e.status, e.message); next(e); }
};

// The last 3 months (or from / to): days with cash to deposit, and days
// already deposited.
router.get('/', wrap(async (req, res) => {
  success(res, await listDepositDays({ entityType: req.query.entityType, from: req.query.from, to: req.query.to }));
}));

// Deposit one or more days under one slip. The amount of each day is its
// cash as worked out here.
router.post('/', wrap(async (req, res) => {
  const b = req.body || {};
  const entityType = bookOf(b.entityType);
  const days = [...new Set((Array.isArray(b.days) ? b.days : []).map(String))].sort();
  if (!days.length) throw err(400, 'Kam az kam ek din chunein');
  if (days.length > 31) throw err(400, 'Ek slip me 31 din se zyada nahi');
  if (days.some((d) => !isDay(d))) throw err(400, 'Din sahi nahi');
  const today = pktToday();
  if (days[days.length - 1] > today) throw err(400, 'Aage ke din ka cash jama nahi ho sakta');
  if (!isDay(b.depositDate)) throw err(400, 'Deposit Date chunein');
  if (b.depositDate > today) throw err(400, 'Deposit Date aage ki nahi ho sakti');
  if (b.depositDate < days[days.length - 1]) throw err(400, 'Deposit Date chune hue dinon se pehle ki nahi ho sakti');
  const bankAccountId = Number(b.bankAccountId);
  const bank = bankAccountId ? await prisma.accBankAccount.findUnique({ where: { id: bankAccountId } }) : null;
  if (!bank) throw err(400, 'Bank chunein');
  if (bank.entityType !== entityType) throw err(400, 'Yeh bank is book ka nahi');

  const cash = await cashOf(entityType, days);
  const empty = days.filter((d) => !(cash.get(d) > 0.004));
  if (empty.length) throw err(400, `In din ka jama karne ko cash nahi: ${empty.join(', ')}`);
  const created = await prisma.$transaction(async (tx) => {
    const already = await tx.accBankDeposit.findMany({ where: { entityType, depositOf: { in: days.map((d) => new Date(d)) } }, select: { depositOf: true } });
    if (already.length) throw err(409, `Yeh din pehle se jama hain: ${[...new Set(already.map((a) => isoDay(a.depositOf)))].join(', ')}`);
    const rows = [];
    for (const d of days) {
      rows.push(await tx.accBankDeposit.create({
        data: {
          bankAccountId,
          depositOf: new Date(d),
          depositDate: new Date(b.depositDate),
          depositSlipNo: String(b.depositSlipNo || '').trim() || null,
          depositedBy: String(b.depositedBy || '').trim() || null,
          amount: cash.get(d),
          entityType,
        },
      }));
    }
    return rows;
  });
  success(res, { count: created.length, amount: round2(created.reduce((s, r) => s + Number(r.amount), 0)) }, 'Deposit save ho gaya');
}));

// Untick: the day goes back to undeposited. Not once the deposit is matched
// to the bank statement.
router.delete('/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const dep = id ? await prisma.accBankDeposit.findUnique({ where: { id } }) : null;
  if (!dep) throw err(404, 'Deposit nahi mila');
  const link = await prisma.accBankReconLink.findUnique({ where: { bookType_bookId: { bookType: 'deposit', bookId: id } } });
  if (link) throw err(409, 'Yeh deposit bank statement se match ho chuka hai — pehle Bank Reconciliation me unmatch karein');
  await prisma.accBankDeposit.delete({ where: { id } });
  success(res, { id }, 'Deposit hata diya');
}));

module.exports = router;
