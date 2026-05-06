const express = require('express');
const controller = require('./attendance.controller');

const router = express.Router();

router.get('/ping', controller.ping);
router.get('/', controller.list);
router.get('/overrides', controller.listOverrides);
router.post('/', controller.create);
router.post('/overrides/upsert', controller.upsertOverride);
router.post('/overrides/bulk-upsert', controller.bulkUpsertOverrides);
router.post('/overrides/replace-dates', controller.replaceOverridesForDates);
router.post('/external', controller.fetchExternal);
router.post('/test-pairing', controller.testPairing);
router.post('/test-raw-punches', controller.testRawPunches);
router.post('/sync-external', controller.syncAttendance);

module.exports = router;
