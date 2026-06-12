const express = require('express');
const controller = require('./users.controller');

const router = express.Router();

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.patch('/:id/toggle', controller.toggleActive);
router.patch('/:id/password', controller.changePassword);
router.patch('/:id/activity', controller.pingActivity);

module.exports = router;
