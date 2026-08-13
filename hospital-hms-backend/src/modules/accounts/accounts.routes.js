const express = require('express');
const ctrl = require('./accounts.controller');
const router = express.Router();

router.get('/main-gl', ctrl.getMainGLs);
router.post('/main-gl', ctrl.createMainGL);
router.put('/main-gl/:id', ctrl.updateMainGL);
router.delete('/main-gl/:id', ctrl.deleteMainGL);

router.get('/sub-gl', ctrl.getSubGLs);
router.post('/sub-gl', ctrl.createSubGL);
router.put('/sub-gl/:id', ctrl.updateSubGL);
router.delete('/sub-gl/:id', ctrl.deleteSubGL);

router.get('/main-account', ctrl.getMainAccounts);
router.post('/main-account', ctrl.createMainAccount);
router.put('/main-account/:id', ctrl.updateMainAccount);
router.delete('/main-account/:id', ctrl.deleteMainAccount);

router.get('/sub-account', ctrl.getSubAccounts);
router.post('/sub-account', ctrl.createSubAccount);
router.put('/sub-account/:id', ctrl.updateSubAccount);
router.delete('/sub-account/:id', ctrl.deleteSubAccount);

router.get('/payee-heads', ctrl.getPayeeHeads);
router.post('/payee-heads', ctrl.createPayeeHead);
router.put('/payee-heads/:id', ctrl.updatePayeeHead);
router.delete('/payee-heads/:id', ctrl.deletePayeeHead);

router.get('/payee-entries', ctrl.getPayeeEntries);
router.post('/payee-entries', ctrl.createPayeeEntry);
router.post('/payee-entries/bulk-save', ctrl.bulkSavePayeeEntries);
router.delete('/payee-entries/:id', ctrl.deletePayeeEntry);
router.get('/linked/employees', ctrl.getEmployeeList);
router.get('/linked/suppliers', ctrl.getSupplierList);
router.get('/linked/doctors', ctrl.getDoctorList);
router.get('/linked/inventory-subcategories', ctrl.getInventorySubcategories);
router.get('/linked/inventory-items', ctrl.getInventoryItemsBySubcategory);
router.get('/linked/inventory-head-for-main-account', ctrl.getInventoryHeadForMainAccount);

router.get('/bank-accounts', ctrl.getBankAccounts);
router.post('/bank-accounts', ctrl.createBankAccount);
router.put('/bank-accounts/:id', ctrl.updateBankAccount);
router.delete('/bank-accounts/:id', ctrl.deleteBankAccount);

router.get('/cheque-serials', ctrl.getChequeSerials);
router.get('/cheque-serials/next', ctrl.getNextChequeSerial);
router.post('/cheque-serials', ctrl.createChequeSerial);
router.delete('/cheque-serials/:id', ctrl.deleteChequeSerial);

router.get('/payee-entries/all', ctrl.getAllPayeeEntries);
router.get('/supplier-grns', ctrl.getSupplierGRNs);
router.get('/consultant-visits', ctrl.getConsultantVisits);
router.get('/payee-entries/by-sub-account', ctrl.getPayeeEntriesBySubAccount);
router.get('/voucher-expense', ctrl.getVoucherExpenses);
router.post('/voucher-expense', ctrl.createVoucherExpense);

router.get('/income-categories', ctrl.getIncomeCategories);
router.post('/income-categories', ctrl.createIncomeCategory);
router.put('/income-categories/:id', ctrl.updateIncomeCategory);
router.delete('/income-categories/:id', ctrl.deleteIncomeCategory);

router.get('/next-voucher-no', ctrl.getNextVoucherNo);
router.get('/voucher-reprint', ctrl.getVouchersForReprint);
router.get('/voucher-summary', ctrl.getVoucherSummary);
router.get('/voucher-summary-matrix', ctrl.getVoucherSummaryMatrix);

router.get('/voucher-income', ctrl.getVoucherIncomes);
router.post('/voucher-income', ctrl.createVoucherIncome);

router.post('/payee-head-accounts', ctrl.addHeadAccount);
router.delete('/payee-head-accounts/:headId/:subAccountId', ctrl.removeHeadAccount);
router.post('/payee-head-main-accounts', ctrl.addInventoryHeadMainAccount);
router.delete('/payee-head-main-accounts/:headId/:mainAccountId', ctrl.removeInventoryHeadMainAccount);

router.get('/bank-deposits', ctrl.getBankDeposits);
router.get('/bank-deposits/for-date', ctrl.getBankDepositForDate);
router.post('/bank-deposits', ctrl.createBankDeposit);

router.get('/bank-deposit-adjs', ctrl.getBankDepositAdjs);
router.post('/bank-deposit-adjs', ctrl.createBankDepositAdj);

router.get('/inquiry/dashboard', ctrl.getAccountsInquiryDashboard);
router.get('/inquiry/clinic-revenue', ctrl.getClinicRevenueForDate);
router.get('/inquiry/daily-diff', ctrl.getDailyIncomeExpenseDiff);

module.exports = router;
