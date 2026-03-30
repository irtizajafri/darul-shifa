const express = require('express');
const controller = require('./reports.controller');

const router = express.Router();

router.get('/ping', controller.ping);
router.get('/summary', controller.summary);

module.exports = router;
