const express = require('express');
const controller = require('./advance.controller');

const router = express.Router();

router.get('/ping', controller.ping);
router.get('/', controller.list);
router.post('/', controller.create);

module.exports = router;
