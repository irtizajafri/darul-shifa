const express = require('express');
const router = express.Router();
const controller = require('./fuel.controller');

// Generators
router.get('/generators', controller.listGenerators);
router.post('/generators', controller.createGenerator);
router.patch('/generators/:id', controller.updateGenerator);

// Vehicles
router.get('/vehicles', controller.listVehicles);
router.post('/vehicles', controller.createVehicle);
router.patch('/vehicles/:id', controller.updateVehicle);

// Vehicle entries
router.get('/vehicle-entries', controller.listVehicleEntries);
router.get('/vehicle-entries/last', controller.getLastVehicleEntry);
router.post('/vehicle-entries', controller.createVehicleEntry);
router.patch('/vehicle-entries/:id', controller.updateVehicleEntry);
router.delete('/vehicle-entries/:id', controller.deleteVehicleEntry);

// Generator entries
router.get('/generator-entries', controller.listGeneratorEntries);
router.get('/generator-entries/last', controller.getLastGeneratorEntry);
router.post('/generator-entries', controller.createGeneratorEntry);
router.patch('/generator-entries/:id', controller.updateGeneratorEntry);
router.delete('/generator-entries/:id', controller.deleteGeneratorEntry);

// Fuel tanks
router.get('/tanks', controller.listTanks);
router.post('/tanks', controller.createTank);
router.patch('/tanks/:id', controller.updateTank);

// Fuel stock, transfers & balance
router.get('/balance', controller.getFuelBalance);
router.get('/stock', controller.listFuelStock);
router.post('/stock', controller.createFuelStock);
router.delete('/stock/:id', controller.deleteFuelStock);
router.get('/transfers', controller.listTransfers);
router.post('/transfers', controller.createTransfer);
router.delete('/transfers/:id', controller.deleteTransfer);

// Daily report — cross-module (tanks/vehicles/generators) day-by-day summary
router.get('/daily-report', controller.getDailyReport);

// Daily sheets
router.get('/daily-sheets', controller.listDailySheets);
router.get('/daily-sheets/last', controller.getLastDailySheet);
router.post('/daily-sheets', controller.createDailySheet);
router.patch('/daily-sheets/:id', controller.updateDailySheet);
router.delete('/daily-sheets/:id', controller.deleteDailySheet);

module.exports = router;
