const express = require('express');
const c = require('./pharmacy.controller');

// Al Shifa Hospital Pharmacy — GD / GIN (separate from /api/inventory).
const router = express.Router();

router.get('/summary', c.getSummary);
router.get('/medicines', c.searchMedicines);
router.get('/gd', c.listGDs);
router.post('/gd', c.createGD);
router.get('/gd/:id', c.getGD);
router.get('/gin', c.listGINs);
router.post('/gin', c.createGIN);
router.get('/gin/:id', c.getGIN);

module.exports = router;
