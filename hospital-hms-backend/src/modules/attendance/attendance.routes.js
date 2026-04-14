const express = require('express');
const controller = require('./attendance.controller');

const router = express.Router();

router.get('/ping', controller.ping);
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/external', controller.fetchExternal);
router.post('/test-pairing', controller.testPairing);
router.post('/test-raw-punches', controller.testRawPunches);
router.post('/sync-external', controller.syncAttendance);

module.exports = router;
