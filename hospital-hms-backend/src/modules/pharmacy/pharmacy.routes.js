const express = require('express');
const c = require('./pharmacy.controller');

// Al Shifa Hospital Pharmacy — GD / GIN (separate from /api/inventory).
const router = express.Router();

router.get('/summary', c.getSummary);
router.get('/medicines', c.searchMedicines);
router.get('/gd', c.listGDs);
router.post('/gd', c.createGD);
router.get('/gd/:id', c.getGD);
router.get('/gin', c.listGINs);
router.post('/gin', c.createGIN);
router.get('/gin/:id', c.getGIN);

// Medicine Return (MRN): the ward asks, the pharmacy verifies (owner, 2026-11-27).
router.get('/mrn/returnable', c.canRequestMRN, c.returnableMRN);
router.get('/mrn/pending', c.canVerifyMRN, c.pendingMRNs);
router.get('/mrn', c.canSeeMRN, c.listMRNs);
router.post('/mrn', c.canRequestMRN, c.createMRN);
router.post('/mrn/:id/verify', c.canVerifyMRN, c.verifyMRN);

// Summary reports: every issued / returned line in the dates (owner, 2026-11-27).
router.get('/report-lines', c.canSeeReports, c.reportLines);

module.exports = router;
