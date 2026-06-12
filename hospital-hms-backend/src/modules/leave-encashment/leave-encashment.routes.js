const express = require('express');
const controller = require('./leave-encashment.controller');

const router = express.Router();

router.get('/summary', controller.getSummary);
router.get('/balance/:employeeId', controller.getBalance);
router.get('/records', controller.listRecords);
router.post('/', controller.create);
router.post('/sync-attendance', controller.syncAttendance);
router.delete('/:id', controller.remove);

module.exports = router;
