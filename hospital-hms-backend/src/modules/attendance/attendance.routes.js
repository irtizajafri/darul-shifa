const express = require('express');
const controller = require('./attendance.controller');

const router = express.Router();

router.get('/ping', controller.ping);
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/external', controller.fetchExternal);

module.exports = router;
