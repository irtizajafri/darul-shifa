const express = require('express');
const { save, get } = require('./payslip-snapshot.controller');

const router = express.Router();

router.post('/save', save);
router.get('/', get);

module.exports = router;
