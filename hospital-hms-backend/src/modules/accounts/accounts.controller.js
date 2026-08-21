const svc = require('./accounts.service');
const { success, fail } = require('../../utils/response');

const et = (req) => req.query.entityType || 'non-corporate';

async function getMainGLs(req, res, next) { try { success(res, await svc.getMainGLs(et(req))); } catch (e) { next(e); } }
async function createMainGL(req, res, next) { try { success(res, await svc.createMainGL(req.body), 'created'); } catch (e) { next(e); } }
async function updateMainGL(req, res, next) { try { success(res, await svc.updateMainGL(req.params.id, req.body), 'updated'); } catch (e) { next(e); } }
async function deleteMainGL(req, res, next) { try { await svc.deleteMainGL(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }

async function getSubGLs(req, res, next) { try { success(res, await svc.getSubGLs(et(req), req.query.mainGlId)); } catch (e) { next(e); } }
async function createSubGL(req, res, next) { try { success(res, await svc.createSubGL(req.body), 'created'); } catch (e) { next(e); } }
async function updateSubGL(req, res, next) { try { success(res, await svc.updateSubGL(req.params.id, req.body), 'updated'); } catch (e) { next(e); } }
async function deleteSubGL(req, res, next) { try { await svc.deleteSubGL(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }

async function getMainAccounts(req, res, next) { try { success(res, await svc.getMainAccounts(et(req), req.query.subGlId)); } catch (e) { next(e); } }
async function createMainAccount(req, res, next) { try { success(res, await svc.createMainAccount(req.body), 'created'); } catch (e) { next(e); } }
async function updateMainAccount(req, res, next) { try { success(res, await svc.updateMainAccount(req.params.id, req.body), 'updated'); } catch (e) { next(e); } }
async function deleteMainAccount(req, res, next) { try { await svc.deleteMainAccount(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }

async function getSubAccounts(req, res, next) { try { success(res, await svc.getSubAccounts(et(req), req.query.mainAccountId)); } catch (e) { next(e); } }
async function createSubAccount(req, res, next) { try { success(res, await svc.createSubAccount(req.body), 'created'); } catch (e) { next(e); } }
async function updateSubAccount(req, res, next) { try { success(res, await svc.updateSubAccount(req.params.id, req.body), 'updated'); } catch (e) { next(e); } }
async function deleteSubAccount(req, res, next) { try { await svc.deleteSubAccount(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }

async function getPayeeHeads(req, res, next) { try { success(res, await svc.getPayeeHeads(et(req))); } catch (e) { next(e); } }
async function createPayeeHead(req, res, next) { try { success(res, await svc.createPayeeHead(req.body), 'created'); } catch (e) { next(e); } }
async function updatePayeeHead(req, res, next) { try { success(res, await svc.updatePayeeHead(req.params.id, req.body), 'updated'); } catch (e) { next(e); } }
async function deletePayeeHead(req, res, next) { try { await svc.deletePayeeHead(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }

async function getPayeeEntries(req, res, next) { try { success(res, await svc.getPayeeEntries(req.query.headId, req.query.subAccountId)); } catch (e) { next(e); } }
async function createPayeeEntry(req, res, next) { try { success(res, await svc.createPayeeEntry(req.body), 'created'); } catch (e) { next(e); } }
async function deletePayeeEntry(req, res, next) { try { await svc.deletePayeeEntry(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }
async function bulkSavePayeeEntries(req, res, next) { try { success(res, await svc.bulkSavePayeeEntries(req.body), 'saved'); } catch (e) { next(e); } }
async function getEmployeeList(req, res, next) { try { success(res, await svc.getEmployeeList()); } catch (e) { next(e); } }
async function getSupplierList(req, res, next) { try { success(res, await svc.getSupplierList()); } catch (e) { next(e); } }
async function getDoctorList(req, res, next) { try { success(res, await svc.getDoctorList()); } catch (e) { next(e); } }
async function getInventorySubcategories(req, res, next) { try { success(res, await svc.getInventorySubcategories()); } catch (e) { next(e); } }
async function getInventoryItemsBySubcategory(req, res, next) { try { success(res, await svc.getInventoryItemsBySubcategory(req.query.subcategoryId)); } catch (e) { next(e); } }
async function getInventoryHeadForMainAccount(req, res, next) { try { success(res, await svc.getInventoryHeadForMainAccount(req.query.mainAccountId)); } catch (e) { next(e); } }

async function getBankAccounts(req, res, next) { try { success(res, await svc.getBankAccounts(et(req))); } catch (e) { next(e); } }
async function createBankAccount(req, res, next) { try { success(res, await svc.createBankAccount(req.body), 'created'); } catch (e) { next(e); } }
async function updateBankAccount(req, res, next) { try { success(res, await svc.updateBankAccount(req.params.id, req.body), 'updated'); } catch (e) { next(e); } }
async function deleteBankAccount(req, res, next) { try { await svc.deleteBankAccount(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }

async function getChequeSerials(req, res, next) { try { success(res, await svc.getChequeSerials(et(req), req.query.bankAccountId)); } catch (e) { next(e); } }
async function createChequeSerial(req, res, next) { try { success(res, await svc.createChequeSerial(req.body), 'created'); } catch (e) { next(e); } }
async function deleteChequeSerial(req, res, next) { try { await svc.deleteChequeSerial(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }
async function getNextChequeSerial(req, res, next) { try { success(res, { nextSerial: await svc.getNextChequeSerial(req.query.bankAccountId) }); } catch (e) { next(e); } }
async function getNextCashSerial(req, res, next) { try { success(res, { nextSerial: await svc.getNextCashSerial(et(req)) }); } catch (e) { next(e); } }

async function getAllPayeeEntries(req, res, next) { try { success(res, await svc.getAllPayeeEntries(et(req))); } catch (e) { next(e); } }
async function getPayeeEntriesBySubAccount(req, res, next) { try { success(res, await svc.getPayeeEntriesBySubAccount(req.query.subAccountId, et(req))); } catch (e) { next(e); } }
async function createVoucherExpense(req, res, next) { try { success(res, await svc.createVoucherExpense(req.body), 'created'); } catch (e) { next(e); } }
async function getVoucherExpenses(req, res, next) { try { success(res, await svc.getVoucherExpenses(et(req))); } catch (e) { next(e); } }
async function updateVoucherExpense(req, res, next) {
  try { success(res, await svc.updateVoucherExpense(req.params.id, req.body), 'updated'); }
  catch (e) { if (e.status) return fail(res, e.status, e.message); next(e); }
}

async function getIncomeCategories(req, res, next) { try { success(res, await svc.getIncomeCategories(et(req))); } catch (e) { next(e); } }
async function createIncomeCategory(req, res, next) { try { success(res, await svc.createIncomeCategory(req.body), 'created'); } catch (e) { next(e); } }
async function updateIncomeCategory(req, res, next) { try { success(res, await svc.updateIncomeCategory(req.params.id, req.body), 'updated'); } catch (e) { next(e); } }
async function deleteIncomeCategory(req, res, next) { try { await svc.deleteIncomeCategory(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }

async function getSupplierGRNs(req, res, next) { try { success(res, await svc.getSupplierGRNs(req.query.supplierId)); } catch (e) { next(e); } }
async function getConsultantVisits(req, res, next) { try { const { doctorName, dateFrom, dateTo } = req.query; success(res, await svc.getConsultantVisits(doctorName, dateFrom, dateTo)); } catch (e) { next(e); } }

async function createBankDeposit(req, res, next) {
  try { success(res, await svc.createBankDeposit({ ...req.body, entityType: et(req) }), 'saved'); } catch (e) { next(e); }
}
async function getBankDeposits(req, res, next) {
  try { success(res, await svc.getBankDeposits(et(req))); } catch (e) { next(e); }
}
async function getBankDepositForDate(req, res, next) {
  try {
    const { bankAccountId, depositOf } = req.query;
    success(res, await svc.getBankDepositForDate({ entityType: et(req), bankAccountId, depositOf }));
  } catch (e) { next(e); }
}
async function createBankDepositAdj(req, res, next) {
  try { success(res, await svc.createBankDepositAdj({ ...req.body, entityType: et(req) }), 'saved'); } catch (e) { next(e); }
}
async function getBankDepositAdjs(req, res, next) {
  try { success(res, await svc.getBankDepositAdjs(et(req))); } catch (e) { next(e); }
}

async function addHeadAccount(req, res, next) {
  try {
    const { headId, subAccountId } = req.body;
    success(res, await svc.addHeadAccount(headId, subAccountId), 'linked');
  } catch (e) { next(e); }
}

async function removeHeadAccount(req, res, next) {
  try {
    const { headId, subAccountId } = req.params;
    await svc.removeHeadAccount(headId, subAccountId);
    success(res, null, 'unlinked');
  } catch (e) { next(e); }
}

async function addInventoryHeadMainAccount(req, res, next) {
  try {
    const { headId, mainAccountId } = req.body;
    success(res, await svc.addInventoryHeadMainAccount(headId, mainAccountId), 'linked');
  } catch (e) { next(e); }
}

async function removeInventoryHeadMainAccount(req, res, next) {
  try {
    const { headId, mainAccountId } = req.params;
    await svc.removeInventoryHeadMainAccount(headId, mainAccountId);
    success(res, null, 'unlinked');
  } catch (e) { next(e); }
}

async function getSurgeryHeadForMainAccount(req, res, next) { try { success(res, await svc.getSurgeryHeadForMainAccount(req.query.mainAccountId)); } catch (e) { next(e); } }
async function getSurgeryPayeesForHead(req, res, next) { try { success(res, await svc.getSurgeryPayeesForHead(req.query.headId, req.query.staffCategoryId)); } catch (e) { next(e); } }
async function addPayeeHeadStaffCategory(req, res, next) {
  try {
    const { headId, staffCategoryId } = req.body;
    success(res, await svc.addPayeeHeadStaffCategory(headId, staffCategoryId), 'linked');
  } catch (e) { next(e); }
}
async function removePayeeHeadStaffCategory(req, res, next) {
  try {
    const { headId, staffCategoryId } = req.params;
    await svc.removePayeeHeadStaffCategory(headId, staffCategoryId);
    success(res, null, 'unlinked');
  } catch (e) { next(e); }
}

async function saveDraftExpenseEntry(req, res, next) { try { success(res, await svc.saveDraftExpenseEntry({ ...req.body, entityType: et(req) }), 'Draft saved'); } catch (e) { next(e); } }
async function getDraftExpenses(req, res, next) { try { success(res, await svc.getDraftExpenses(et(req))); } catch (e) { next(e); } }
async function deleteDraftExpense(req, res, next) { try { await svc.deleteDraftExpense(req.params.id); success(res, null, 'Draft deleted'); } catch (e) { next(e); } }
async function flashDraftsNow(req, res, next) {
  try {
    const { date } = req.query; // optional — default today's business date
    const d = date || (() => { const n = new Date(); if (n.getHours() < 8) n.setDate(n.getDate() - 1); return n.toISOString().slice(0, 10); })();
    const vouchers = await svc.flashDraftsToVouchers(d, et(req));
    success(res, { date: d, vouchersCreated: vouchers.length, vouchers }, vouchers.length ? `${vouchers.length} voucher(s) created` : 'No pending drafts');
  } catch (e) { next(e); }
}

async function createVoucherIncome(req, res, next) { try { success(res, await svc.createVoucherIncome(req.body), 'Voucher saved'); } catch (e) { next(e); } }
async function getVoucherIncomes(req, res, next) { try { success(res, await svc.getVoucherIncomes(et(req))); } catch (e) { next(e); } }
async function updateVoucherIncome(req, res, next) {
  try { success(res, await svc.updateVoucherIncome(req.params.id, req.body), 'updated'); }
  catch (e) { if (e.status) return fail(res, e.status, e.message); next(e); }
}

async function getVouchersForReprint(req, res, next) {
  try {
    const { type, entityType, voucherFrom, voucherTo, dateFrom, dateTo } = req.query;
    success(res, await svc.getVouchersForReprint({ type, entityType, voucherFrom, voucherTo, dateFrom, dateTo }));
  } catch (e) { next(e); }
}

async function getVoucherSummaryMatrix(req, res, next) {
  try {
    const { entityType, dateFrom, dateTo } = req.query;
    success(res, await svc.getVoucherSummaryMatrix({ entityType, dateFrom, dateTo }));
  } catch (e) { next(e); }
}

async function getVoucherSummary(req, res, next) {
  try {
    const { entityType, voucherFrom, voucherTo, supplierId, mainAccountId, dateFrom, dateTo } = req.query;
    success(res, await svc.getVoucherSummary({ entityType, voucherFrom, voucherTo, supplierId, mainAccountId, dateFrom, dateTo }));
  } catch (e) { next(e); }
}

async function getNextVoucherNo(req, res, next) {
  try {
    const { type, entityType, date } = req.query;
    const voucherNo = await svc.getNextVoucherNo(type, entityType, date || new Date().toISOString());
    success(res, { voucherNo });
  } catch (e) { next(e); }
}

async function getAccountsInquiryDashboard(req, res, next) {
  try {
    const { entityType, period, year, month } = req.query;
    success(res, await svc.getAccountsInquiryDashboard({ entityType, period, year, month }));
  } catch (e) { next(e); }
}

async function getClinicRevenueForDate(req, res, next) {
  try {
    success(res, await svc.getClinicRevenueForDate(req.query.date));
  } catch (e) {
    if (e.status) return fail(res, e.status, e.message);
    next(e);
  }
}

async function getDailyIncomeExpenseDiff(req, res, next) {
  try {
    success(res, await svc.getDailyIncomeExpenseDiff(req.query.date, req.query.entityType));
  } catch (e) {
    if (e.status) return fail(res, e.status, e.message);
    next(e);
  }
}

module.exports = {
  getMainGLs, createMainGL, updateMainGL, deleteMainGL,
  getSubGLs, createSubGL, updateSubGL, deleteSubGL,
  getMainAccounts, createMainAccount, updateMainAccount, deleteMainAccount,
  getSubAccounts, createSubAccount, updateSubAccount, deleteSubAccount,
  getPayeeHeads, createPayeeHead, updatePayeeHead, deletePayeeHead,
  getPayeeEntries, createPayeeEntry, deletePayeeEntry, bulkSavePayeeEntries, getEmployeeList, getSupplierList, getDoctorList, getInventorySubcategories, getInventoryItemsBySubcategory, getInventoryHeadForMainAccount,
  getSurgeryHeadForMainAccount, getSurgeryPayeesForHead, addPayeeHeadStaffCategory, removePayeeHeadStaffCategory,
  getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
  getChequeSerials, createChequeSerial, deleteChequeSerial, getNextChequeSerial, getNextCashSerial,
  getIncomeCategories, createIncomeCategory, updateIncomeCategory, deleteIncomeCategory,
  getAllPayeeEntries, createVoucherExpense, getVoucherExpenses, updateVoucherExpense,
  getPayeeEntriesBySubAccount, getSupplierGRNs, getConsultantVisits,
  createVoucherIncome, getVoucherIncomes, updateVoucherIncome,
  getNextVoucherNo,
  getVouchersForReprint, getVoucherSummary, getVoucherSummaryMatrix,
  saveDraftExpenseEntry, getDraftExpenses, deleteDraftExpense, flashDraftsNow,
  addHeadAccount, removeHeadAccount, addInventoryHeadMainAccount, removeInventoryHeadMainAccount,
  createBankDeposit, getBankDeposits, getBankDepositForDate,
  createBankDepositAdj, getBankDepositAdjs,
  getAccountsInquiryDashboard,
  getClinicRevenueForDate,
  getDailyIncomeExpenseDiff,
};
