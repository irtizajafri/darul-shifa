const express = require('express');
const c = require('./laboratory.controller');
const { requireSubModule } = require('../../middleware/subModuleGuard');

const router = express.Router();

router.get('/summary', c.getSummary);

router.get('/categories', c.listCategories);
router.post('/categories', c.createCategory);
router.put('/categories/:id', c.updateCategory);
router.delete('/categories/:id', c.deleteCategory);

router.get('/clinic-tests', c.listClinicTests);
router.get('/tests', c.listTests);
router.post('/tests', c.createTest);
router.put('/tests/:id', c.updateTest);
router.delete('/tests/:id', c.deleteTest);
router.get('/tests/:id/parameters', c.getTestParameters);
router.put('/tests/:id/parameters', c.saveTestParameters);

router.get('/slips', c.listSlips);
router.get('/slips/:visitId', c.getSlip);
router.put('/slips/:visitId/results', c.saveSlipResults);
router.post('/results/print', c.markPrinted);

// Reports: test-wise, panel / mode of payment, category (owner, 2026-11-27).
router.get('/report-lines', requireSubModule('lab', ['reports'], 'Laboratories → Reports'), c.reportLines);

module.exports = router;
