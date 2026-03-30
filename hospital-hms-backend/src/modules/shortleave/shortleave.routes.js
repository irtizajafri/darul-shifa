const express = require('express');
const controller = require('./shortleave.controller');

const router = express.Router();

router.get('/ping', controller.ping);
router.get('/', controller.list);
router.post('/', controller.create);

module.exports = router;
