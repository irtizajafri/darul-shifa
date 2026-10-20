// Clinic refund / cancel → Pending Draft, Admission Discount → voucher —
// separate module
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

const todayPkt = () => new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);

// Cancel Slip / Slip Refund / Admission Refund go to Pending Draft (owner's
// decision 2026-10-20), not straight to a voucher: Day Close posts them with
// the rest of the day, each kind's drafts joined into ONE voucher line
// ("AMOUNT REFUND TO THE PATIENT AGAINST SLIP #a,b,c" — see
// accounts.service saveClinicRefundDraft / mergeClinicRefundDrafts).
// kind 'slip' | 'admission', ref = slip # / admission #.
// Returns { drafted: true } on success, or { warning } if the
// 'slip-admission-refund' head isn't linked to a Sub Account yet for that
// book (List Attachments) — the refund/cancel itself is never blocked by this.
async function tryCreateRefundDraft({ entityType, kind, ref, payeeName, amount, voucherDate, createdByName, what = 'Refund save ho gaya' }) {
  try {
    const chain = await accountsService.getRefundVoucherAccountChain(entityType);
    if (!chain) {
      const book = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';
      return { warning: `${what}, lekin Pending Draft nahi bana — Accounts → ${book} → Parameters → List Attachments mein "Slip/Admission Refund" head ko pehle kisi account se link karein.` };
    }
    // Back Date (permission-gated in the refund screens) sets the draft's
    // business day; otherwise today's.
    const draft = await accountsService.saveClinicRefundDraft({
      entityType, chain, kind, ref, payeeName, amount,
      date: voucherDate ? String(voucherDate).slice(0, 10) : undefined,
      createdByName,
    });
    return { drafted: true, draftId: draft.id };
  } catch (err) {
    return { warning: `${what}, lekin Pending Draft banate waqt error aayi: ${err.message}` };
  }
}

// Auto Voucher Expense for Admission Discount — posts straight away (unlike
// the refund drafts above), on the 'admission-discount' payee head's
// account chain. A discount is a
// waiver (no cash out), but it still needs an accounts entry so the discount
// appears in books. Returns { voucherNo } or { warning }.
async function tryCreateDiscountVoucher({ entityType, payeeName, amount, particulars, voucherDate: requestedDate }) {
  try {
    const chain = await accountsService.getDiscountVoucherAccountChain(entityType);
    if (!chain) {
      const book = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';
      return { warning: `Discount save ho gaya, lekin voucher nahi bana — Accounts → ${book} → Parameters → List Attachments mein "Admission Discount" head ko pehle kisi account se link karein.` };
    }
    const voucherDate = requestedDate ? String(requestedDate).slice(0, 10) : todayPkt();
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

module.exports = { tryCreateRefundDraft, tryCreateDiscountVoucher, entityTypeFromPaymentType, entityTypeFromPatientCategory };
