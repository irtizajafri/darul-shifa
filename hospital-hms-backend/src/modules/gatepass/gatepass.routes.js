const express = require('express');
const controller = require('./gatepass.controller');

const router = express.Router();

router.get('/ping', controller.ping);
router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id/return', controller.close);

module.exports = router;
