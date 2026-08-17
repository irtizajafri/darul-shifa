const express = require('express');
const router = express.Router();
const controller = require('./utilities.controller');

// Meters (Billing + Department)
router.get('/meters', controller.listMeters);
router.get('/meters/:id', controller.getMeter);
router.post('/meters', controller.createMeter);
router.patch('/meters/:id', controller.updateMeter);

// Rate history
router.get('/meters/:id/rates', controller.listRates);
router.post('/meters/:id/rates', controller.createRate);
router.delete('/rates/:id', controller.deleteRate);

// Current running estimate (since last actual bill)
router.get('/meters/:id/current-estimate', controller.currentEstimate);

// Daily readings
router.get('/readings', controller.listReadings);
router.get('/readings/last', controller.getLastReading);
router.post('/readings', controller.saveReading);
router.delete('/readings/:id', controller.deleteReading);

// Actual bills (Billing meters only)
router.get('/bills', controller.listActualBills);
router.post('/bills', controller.createActualBill);
router.patch('/bills/:id', controller.updateActualBill);
router.delete('/bills/:id', controller.deleteActualBill);

// Report (per meter, date range)
router.get('/report', controller.getReport);

// Last actual bill posted per utility (electricity/gas/ptcl) — cross-module summary
router.get('/last-bill-summary', controller.lastBillByMeter);

module.exports = router;
