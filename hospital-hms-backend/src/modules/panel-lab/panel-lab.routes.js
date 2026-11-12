const express = require('express');
const c = require('./panel-lab.controller');

// Lab Billing (Panels) — separate from /api/lab (Laboratories module).
const router = express.Router();

router.get('/tests', c.listTests);
router.get('/tests/:subDeptId/parameters', c.getTestParameters);
router.put('/tests/:subDeptId/parameters', c.saveTestParameters);

router.get('/entries', c.listEntries);
router.get('/entries/:entryKey', c.getEntry);
router.put('/entries/:entryKey/results', c.saveEntryResults);
router.post('/results/print', c.markPrinted);

module.exports = router;
