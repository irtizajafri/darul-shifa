// Auto Voucher Expense for Slip Refund / Admission Refund — separate module
// (not folded into clinic.service.js) for the same reason advance.service.js
// is separate: accounts.service.js already requires clinic.service.js, so
// clinic.service.js requiring accounts.service.js back would be a circular
// require. clinic.controller.js calls this after the refund itself is
// already saved via clinic.service.js.
const prisma = require('../../config/db');
const accountsService = require('../accounts/accounts.service');

// entityType follows the ORIGINAL slip/admission's own category — Panel
// stays in the Corporate book, everything else (Cash/Staff/Complementary/
// CC/JazzCash) goes to Non-Corporate — same Cash-vs-Panel convention used
// everywhere else in Clinic/Accounts this session.
function entityTypeFromPaymentType(paymentType) {
  return String(paymentType || '').toLowerCase() === 'panel' ? 'corporate' : 'non-corporate';
}
function entityTypeFromPatientCategory(patientCategory) {
  return String(patientCategory || '').toLowerCase() === 'panel' ? 'corporate' : 'non-corporate';
}

// Slip Cancel / Slip Refund collect into ONE voucher per day per book instead
// of one voucher each (owner's decision 2026-10-19): the day's first one
// creates the voucher, every later one that day is added to it as a new line
// and the total grows. AccVoucherExpense.source tells the two day-vouchers
// apart ('slip-cancel' / 'slip-refund') so neither ever mixes with a manual
// voucher. Calls are queued so two at the same moment can't both create one
// (single backend process).
const dayVoucherQueue = new Map();
function queued(key, fn) {
  const run = (dayVoucherQueue.get(key) || Promise.resolve()).catch(() => {}).then(fn);
  dayVoucherQueue.set(key, run);
  run.catch(() => {}).finally(() => { if (dayVoucherQueue.get(key) === run) dayVoucherQueue.delete(key); });
  return run;
}

async function addToDayVoucher({ source, entityType, voucherDate, chain, payeeName, amount, particulars }) {
  // Queued per book+date (not per source) so a Slip Cancel and a Slip Refund
  // creating their day-vouchers at the same moment can't draw the same
  // voucher number either.
  return queued(`${entityType}|${voucherDate}`, async () => {
    const line = {
      mainGlId:      chain.mainGlId,
      subGlId:       chain.subGlId,
      mainAccountId: chain.mainAccountId,
      subAccountId:  chain.subAccountId,
      accountCode:   chain.accountCode,
      accountName:   chain.accountName,
      payeeName,
      amount,
      particulars,
    };
    const existing = await prisma.accVoucherExpense.findFirst({
      where: { source, entityType, voucherDate: new Date(voucherDate) },
      orderBy: { id: 'asc' },
    });
    if (existing) {
      await prisma.$transaction([
        prisma.accVoucherExpenseEntry.create({
          data: {
            voucherId: existing.id,
            ...line,
            mainGlId: Number(line.mainGlId), subGlId: Number(line.subGlId), mainAccountId: Number(line.mainAccountId),
            subAccountId: line.subAccountId ? Number(line.subAccountId) : null,
            payeeName: payeeName || null, amount: Number(amount), particulars: particulars || null,
          },
        }),
        prisma.accVoucherExpense.update({ where: { id: existing.id }, data: { totalAmount: { increment: Number(amount) } } }),
      ]);
      return existing.voucherNo;
    }
    const create = () => accountsService.createVoucherExpense({
      entityType, mode: 'cash', bankId: null, voucherDate, entries: [line],
    });
    // A manual voucher saved in the same instant can still take the number
    // generateVoucherNo picked — one retry draws the next one.
    const voucher = await create().catch((err) => {
      if (err?.code === 'P2002') return create();
      throw err;
    });
    await prisma.accVoucherExpense.update({ where: { id: voucher.id }, data: { source } });
    return voucher.voucherNo;
  });
}

const todayPkt = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);

// Returns { voucherNo } on success, or { warning } if the 'slip-admission-
// refund' head isn't linked to a Sub Account yet for that book (List
// Attachments) — the refund record itself is never blocked by this; front
// desk/accounts can still process it, Accounts just needs to finish setup.
async function tryCreateRefundVoucher({ entityType, payeeName, amount, particulars, voucherDate: requestedDate, dayVoucherSource }) {
  try {
    const chain = await accountsService.getRefundVoucherAccountChain(entityType);
    if (!chain) {
      const book = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';
      return { warning: `Refund save ho gaya, lekin voucher nahi bana — Accounts → ${book} → Parameters → List Attachments mein "Slip/Admission Refund" head ko pehle kisi account se link karein.` };
    }
    // Back-dated voucher (permission-gated, see canBackDate in both refund
    // screens) — falls back to today when the caller doesn't pass one, same
    // as before this option existed.
    const voucherDate = requestedDate ? String(requestedDate).slice(0, 10) : todayPkt();
    // Slip Refund → the day's one refund voucher; Admission Refund keeps its
    // own voucher per refund (no dayVoucherSource).
    if (dayVoucherSource) {
      const voucherNo = await addToDayVoucher({ source: dayVoucherSource, entityType, voucherDate, chain, payeeName, amount, particulars });
      return { voucherNo };
    }
    const voucher = await accountsService.createVoucherExpense({
      entityType,
      mode: 'cash',
      bankId: null,
      voucherDate,
      entries: [{
        mainGlId:      chain.mainGlId,
        subGlId:       chain.subGlId,
        mainAccountId: chain.mainAccountId,
        subAccountId:  chain.subAccountId,
        accountCode:   chain.accountCode,
        accountName:   chain.accountName,
        payeeName,
        amount,
        particulars,
      }],
    });
    return { voucherNo: voucher.voucherNo };
  } catch (err) {
    // Never let a voucher-posting failure undo an already-saved refund
    // record — the refund itself is the source of truth; surface the
    // failure as a warning so accounts can post it manually instead.
    return { warning: `Refund save ho gaya, lekin voucher banate waqt error aayi: ${err.message}` };
  }
}

// Auto Voucher Expense for Cancel Slip — zero-amount line for audit record,
// added to the day's one Slip Cancel voucher (see addToDayVoucher).
// Uses the same 'slip-admission-refund' account chain (no cash out, just a
// trace that a cancellation happened in the books).
async function tryCreateCancelSlipVoucher({ entityType, payeeName, particulars, voucherDate: requestedDate }) {
  try {
    const chain = await accountsService.getRefundVoucherAccountChain(entityType);
    if (!chain) {
      const book = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';
      return { warning: `Slip cancel ho gayi, lekin voucher nahi bana — Accounts → ${book} → Parameters → List Attachments mein "Slip/Admission Refund" head ko pehle kisi account se link karein.` };
    }
    const voucherDate = requestedDate ? String(requestedDate).slice(0, 10) : todayPkt();
    const voucherNo = await addToDayVoucher({ source: 'slip-cancel', entityType, voucherDate, chain, payeeName, amount: 0, particulars });
    return { voucherNo };
  } catch (err) {
    return { warning: `Slip cancel ho gayi, lekin voucher banate waqt error aayi: ${err.message}` };
  }
}

// Auto Voucher Expense for Admission Discount — mirrors tryCreateRefundVoucher
// but uses the 'admission-discount' payee head account chain. A discount is a
// waiver (no cash out), but it still needs an accounts entry so the discount
// appears in books. Returns { voucherNo } or { warning }.
async function tryCreateDiscountVoucher({ entityType, payeeName, amount, particulars, voucherDate: requestedDate }) {
  try {
    const chain = await accountsService.getDiscountVoucherAccountChain(entityType);
    if (!chain) {
      const book = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';
      return { warning: `Discount save ho gaya, lekin voucher nahi bana — Accounts → ${book} → Parameters → List Attachments mein "Admission Discount" head ko pehle kisi account se link karein.` };
    }
    const voucherDate = requestedDate ? String(requestedDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const voucher = await accountsService.createVoucherExpense({
      entityType,
      mode: 'cash',
      bankId: null,
      voucherDate,
      entries: [{
        mainGlId:      chain.mainGlId,
        subGlId:       chain.subGlId,
        mainAccountId: chain.mainAccountId,
        subAccountId:  chain.subAccountId,
        accountCode:   chain.accountCode,
        accountName:   chain.accountName,
        payeeName,
        amount,
        particulars,
      }],
    });
    return { voucherNo: voucher.voucherNo };
  } catch (err) {
    return { warning: `Discount save ho gaya, lekin voucher banate waqt error aayi: ${err.message}` };
  }
}

module.exports = { tryCreateRefundVoucher, tryCreateDiscountVoucher, tryCreateCancelSlipVoucher, entityTypeFromPaymentType, entityTypeFromPatientCategory };
