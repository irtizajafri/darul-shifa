const express = require('express');
const controller = require('./auth.controller');

const router = express.Router();

router.get('/ping', controller.ping);
router.post('/login', controller.login);
router.post('/change-password', controller.changePassword);

module.exports = router;
