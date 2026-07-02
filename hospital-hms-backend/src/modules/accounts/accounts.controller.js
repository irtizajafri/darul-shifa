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

async function getPayeeEntries(req, res, next) { try { success(res, await svc.getPayeeEntries(req.query.headId)); } catch (e) { next(e); } }
async function createPayeeEntry(req, res, next) { try { success(res, await svc.createPayeeEntry(req.body), 'created'); } catch (e) { next(e); } }
async function deletePayeeEntry(req, res, next) { try { await svc.deletePayeeEntry(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }
async function getEmployeeList(req, res, next) { try { success(res, await svc.getEmployeeList()); } catch (e) { next(e); } }
async function getSupplierList(req, res, next) { try { success(res, await svc.getSupplierList()); } catch (e) { next(e); } }

async function getBankAccounts(req, res, next) { try { success(res, await svc.getBankAccounts(et(req))); } catch (e) { next(e); } }
async function createBankAccount(req, res, next) { try { success(res, await svc.createBankAccount(req.body), 'created'); } catch (e) { next(e); } }
async function updateBankAccount(req, res, next) { try { success(res, await svc.updateBankAccount(req.params.id, req.body), 'updated'); } catch (e) { next(e); } }
async function deleteBankAccount(req, res, next) { try { await svc.deleteBankAccount(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }

async function getChequeSerials(req, res, next) { try { success(res, await svc.getChequeSerials(et(req), req.query.bankAccountId)); } catch (e) { next(e); } }
async function createChequeSerial(req, res, next) { try { success(res, await svc.createChequeSerial(req.body), 'created'); } catch (e) { next(e); } }
async function deleteChequeSerial(req, res, next) { try { await svc.deleteChequeSerial(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }
async function getNextChequeSerial(req, res, next) { try { success(res, { nextSerial: await svc.getNextChequeSerial(req.query.bankAccountId) }); } catch (e) { next(e); } }

async function getAllPayeeEntries(req, res, next) { try { success(res, await svc.getAllPayeeEntries(et(req))); } catch (e) { next(e); } }
async function getPayeeEntriesBySubAccount(req, res, next) { try { success(res, await svc.getPayeeEntriesBySubAccount(req.query.subAccountId, et(req))); } catch (e) { next(e); } }
async function createVoucherExpense(req, res, next) { try { success(res, await svc.createVoucherExpense(req.body), 'created'); } catch (e) { next(e); } }
async function getVoucherExpenses(req, res, next) { try { success(res, await svc.getVoucherExpenses(et(req))); } catch (e) { next(e); } }

async function getIncomeCategories(req, res, next) { try { success(res, await svc.getIncomeCategories(et(req))); } catch (e) { next(e); } }
async function createIncomeCategory(req, res, next) { try { success(res, await svc.createIncomeCategory(req.body), 'created'); } catch (e) { next(e); } }
async function updateIncomeCategory(req, res, next) { try { success(res, await svc.updateIncomeCategory(req.params.id, req.body), 'updated'); } catch (e) { next(e); } }
async function deleteIncomeCategory(req, res, next) { try { await svc.deleteIncomeCategory(req.params.id); success(res, null, 'deleted'); } catch (e) { next(e); } }

async function getSupplierGRNs(req, res, next) { try { success(res, await svc.getSupplierGRNs(req.query.supplierId)); } catch (e) { next(e); } }

async function createBankDeposit(req, res, next) {
  try { success(res, await svc.createBankDeposit({ ...req.body, entityType: et(req) }), 'saved'); } catch (e) { next(e); }
}
async function getBankDeposits(req, res, next) {
  try { success(res, await svc.getBankDeposits(et(req))); } catch (e) { next(e); }
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

async function createVoucherIncome(req, res, next) { try { success(res, await svc.createVoucherIncome(req.body), 'Voucher saved'); } catch (e) { next(e); } }
async function getVoucherIncomes(req, res, next) { try { success(res, await svc.getVoucherIncomes(et(req))); } catch (e) { next(e); } }

async function getVouchersForReprint(req, res, next) {
  try {
    const { type, entityType, voucherFrom, voucherTo, dateFrom, dateTo } = req.query;
    success(res, await svc.getVouchersForReprint({ type, entityType, voucherFrom, voucherTo, dateFrom, dateTo }));
  } catch (e) { next(e); }
}

async function getNextVoucherNo(req, res, next) {
  try {
    const { type, entityType, date } = req.query;
    const voucherNo = await svc.getNextVoucherNo(type, entityType, date || new Date().toISOString());
    success(res, { voucherNo });
  } catch (e) { next(e); }
}

module.exports = {
  getMainGLs, createMainGL, updateMainGL, deleteMainGL,
  getSubGLs, createSubGL, updateSubGL, deleteSubGL,
  getMainAccounts, createMainAccount, updateMainAccount, deleteMainAccount,
  getSubAccounts, createSubAccount, updateSubAccount, deleteSubAccount,
  getPayeeHeads, createPayeeHead, updatePayeeHead, deletePayeeHead,
  getPayeeEntries, createPayeeEntry, deletePayeeEntry, getEmployeeList, getSupplierList,
  getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
  getChequeSerials, createChequeSerial, deleteChequeSerial, getNextChequeSerial,
  getIncomeCategories, createIncomeCategory, updateIncomeCategory, deleteIncomeCategory,
  getAllPayeeEntries, createVoucherExpense, getVoucherExpenses,
  getPayeeEntriesBySubAccount, getSupplierGRNs,
  createVoucherIncome, getVoucherIncomes,
  getNextVoucherNo,
  getVouchersForReprint,
  addHeadAccount, removeHeadAccount,
  createBankDeposit, getBankDeposits,
  createBankDepositAdj, getBankDepositAdjs,
};
