const express = require('express');
const controller = require('./employee.controller');

const router = express.Router();

router.get('/ping', controller.ping);
router.get('/departments', controller.listDepartmentHeads);
router.post('/departments', controller.createDepartmentHead);
router.delete('/departments/:departmentId', controller.removeDepartmentHead);
router.get('/departments/:departmentId/designations', controller.listDesignationHeads);
router.post('/designations', controller.createDesignationHead);
router.delete('/designations/:designationId', controller.removeDesignationHead);
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

router.get('/:id/roster-history', controller.getRosterHistory);
router.get('/:id/dependents', controller.getDependents);
router.post('/:id/dependents', controller.addDependent);
router.put('/:id/dependents/:depId', controller.updateDependent);
router.delete('/:id/dependents/:depId', controller.deleteDependent);

module.exports = router;
