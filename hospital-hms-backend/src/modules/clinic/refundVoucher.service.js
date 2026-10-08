// Auto Voucher Expense for Slip Refund / Admission Refund — separate module
// (not folded into clinic.service.js) for the same reason advance.service.js
// is separate: accounts.service.js already requires clinic.service.js, so
// clinic.service.js requiring accounts.service.js back would be a circular
// require. clinic.controller.js calls this after the refund itself is
// already saved via clinic.service.js.
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

// Returns { voucherNo } on success, or { warning } if the 'slip-admission-
// refund' head isn't linked to a Sub Account yet for that book (List
// Attachments) — the refund record itself is never blocked by this; front
// desk/accounts can still process it, Accounts just needs to finish setup.
async function tryCreateRefundVoucher({ entityType, payeeName, amount, particulars, voucherDate: requestedDate }) {
  try {
    const chain = await accountsService.getRefundVoucherAccountChain(entityType);
    if (!chain) {
      const book = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';
      return { warning: `Refund save ho gaya, lekin voucher nahi bana — Accounts → ${book} → Parameters → List Attachments mein "Slip/Admission Refund" head ko pehle kisi account se link karein.` };
    }
    // Back-dated voucher (permission-gated, see canBackDate in both refund
    // screens) — falls back to today when the caller doesn't pass one, same
    // as before this option existed.
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
    // Never let a voucher-posting failure undo an already-saved refund
    // record — the refund itself is the source of truth; surface the
    // failure as a warning so accounts can post it manually instead.
    return { warning: `Refund save ho gaya, lekin voucher banate waqt error aayi: ${err.message}` };
  }
}

// Auto Voucher Expense for Cancel Slip — zero-amount voucher for audit record.
// Uses the same 'slip-admission-refund' account chain (no cash out, just a
// trace that a cancellation happened in the books).
async function tryCreateCancelSlipVoucher({ entityType, payeeName, particulars, voucherDate: requestedDate }) {
  try {
    const chain = await accountsService.getRefundVoucherAccountChain(entityType);
    if (!chain) {
      const book = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';
      return { warning: `Slip cancel ho gayi, lekin voucher nahi bana — Accounts → ${book} → Parameters → List Attachments mein "Slip/Admission Refund" head ko pehle kisi account se link karein.` };
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
        amount:        0,
        particulars,
      }],
    });
    return { voucherNo: voucher.voucherNo };
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
