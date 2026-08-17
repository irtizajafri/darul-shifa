const service = require('./fuel.service');
const { success, fail } = require('../../utils/response');

const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (err) { next(err); }
};

module.exports = {
  // Generators
  listGenerators: wrap(async (req, res) => {
    const data = await service.listGenerators();
    success(res, data);
  }),
  createGenerator: wrap(async (req, res) => {
    const data = await service.createGenerator(req.body);
    success(res, data, 'Generator created');
  }),
  updateGenerator: wrap(async (req, res) => {
    const data = await service.updateGenerator(req.params.id, req.body);
    success(res, data, 'Generator updated');
  }),

  // Vehicles
  listVehicles: wrap(async (req, res) => {
    const data = await service.listVehicles();
    success(res, data);
  }),
  createVehicle: wrap(async (req, res) => {
    const data = await service.createVehicle(req.body);
    success(res, data, 'Vehicle created');
  }),
  updateVehicle: wrap(async (req, res) => {
    const data = await service.updateVehicle(req.params.id, req.body);
    success(res, data, 'Vehicle updated');
  }),

  // Vehicle entries
  listVehicleEntries: wrap(async (req, res) => {
    const data = await service.listVehicleEntries(req.query);
    success(res, data);
  }),
  getLastVehicleEntry: wrap(async (req, res) => {
    const { vehicleId, entryType } = req.query;
    const data = await service.getLastVehicleEntry(vehicleId, entryType);
    success(res, data);
  }),
  createVehicleEntry: wrap(async (req, res) => {
    const data = await service.createVehicleEntry(req.body);
    success(res, data, 'Entry created');
  }),
  updateVehicleEntry: wrap(async (req, res) => {
    const data = await service.updateVehicleEntry(req.params.id, req.body);
    success(res, data, 'Entry updated');
  }),
  deleteVehicleEntry: wrap(async (req, res) => {
    await service.deleteVehicleEntry(req.params.id);
    success(res, null, 'Entry deleted');
  }),

  // Generator entries
  listGeneratorEntries: wrap(async (req, res) => {
    const data = await service.listGeneratorEntries(req.query);
    success(res, data);
  }),
  getLastGeneratorEntry: wrap(async (req, res) => {
    const { generatorId, entryType } = req.query;
    const data = await service.getLastGeneratorEntry(generatorId, entryType);
    success(res, data);
  }),
  createGeneratorEntry: wrap(async (req, res) => {
    const data = await service.createGeneratorEntry(req.body);
    success(res, data, 'Entry created');
  }),
  updateGeneratorEntry: wrap(async (req, res) => {
    const data = await service.updateGeneratorEntry(req.params.id, req.body);
    success(res, data, 'Entry updated');
  }),
  deleteGeneratorEntry: wrap(async (req, res) => {
    await service.deleteGeneratorEntry(req.params.id);
    success(res, null, 'Entry deleted');
  }),

  // Fuel tanks
  listTanks: wrap(async (req, res) => {
    const data = await service.listTanks();
    success(res, data);
  }),
  createTank: wrap(async (req, res) => {
    const data = await service.createTank(req.body);
    success(res, data, 'Tank created');
  }),
  updateTank: wrap(async (req, res) => {
    const data = await service.updateTank(req.params.id, req.body);
    success(res, data, 'Tank updated');
  }),

  // Fuel stock
  listFuelStock: wrap(async (req, res) => {
    const data = await service.listFuelStock(req.query.tankId);
    success(res, data);
  }),
  createFuelStock: wrap(async (req, res) => {
    const data = await service.createFuelStock(req.body);
    success(res, data, 'Fuel stock added');
  }),
  deleteFuelStock: wrap(async (req, res) => {
    await service.deleteFuelStock(req.params.id);
    success(res, null, 'Deleted');
  }),

  // Fuel transfers (Tank → Generator)
  listTransfers: wrap(async (req, res) => {
    const data = await service.listTransfers(req.query);
    success(res, data);
  }),
  createTransfer: wrap(async (req, res) => {
    const data = await service.createTransfer(req.body);
    success(res, data, 'Fuel transferred');
  }),
  deleteTransfer: wrap(async (req, res) => {
    await service.deleteTransfer(req.params.id);
    success(res, null, 'Transfer deleted');
  }),

  getFuelBalance: wrap(async (req, res) => {
    const data = await service.getFuelBalance();
    success(res, data);
  }),

  // Daily sheets
  listDailySheets: wrap(async (req, res) => {
    const { generatorId } = req.query;
    const data = await service.listDailySheets(generatorId);
    success(res, data);
  }),
  getLastDailySheet: wrap(async (req, res) => {
    const { generatorId } = req.query;
    const data = await service.getLastDailySheet(generatorId);
    success(res, data);
  }),
  createDailySheet: wrap(async (req, res) => {
    const data = await service.createDailySheet(req.body);
    success(res, data, 'Daily sheet created');
  }),
  updateDailySheet: wrap(async (req, res) => {
    const data = await service.updateDailySheet(req.params.id, req.body);
    success(res, data, 'Daily sheet updated');
  }),
  deleteDailySheet: wrap(async (req, res) => {
    await service.deleteDailySheet(req.params.id);
    success(res, null, 'Daily sheet deleted');
  }),

  getDailyReport: wrap(async (req, res) => {
    const data = await service.getDailyReport(req.query);
    success(res, data);
  }),
};
