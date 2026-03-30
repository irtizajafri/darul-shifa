const express = require('express');
const controller = require('./auth.controller');

const router = express.Router();

router.get('/ping', controller.ping);

module.exports = router;
