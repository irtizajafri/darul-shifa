const express = require('express');
const controller = require('./employee.controller');

const router = express.Router();

router.get('/ping', controller.ping);
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
