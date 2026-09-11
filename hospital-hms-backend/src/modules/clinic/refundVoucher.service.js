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
async function tryCreateRefundVoucher({ entityType, payeeName, amount, particulars }) {
  try {
    const chain = await accountsService.getRefundVoucherAccountChain(entityType);
    if (!chain) {
      const book = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';
      return { warning: `Refund save ho gaya, lekin voucher nahi bana — Accounts → ${book} → Parameters → List Attachments mein "Slip/Admission Refund" head ko pehle kisi account se link karein.` };
    }
    const voucherDate = new Date().toISOString().slice(0, 10);
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

module.exports = { tryCreateRefundVoucher, entityTypeFromPaymentType, entityTypeFromPatientCategory };
