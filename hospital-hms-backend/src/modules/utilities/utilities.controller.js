const service = require('./utilities.service');
const { success } = require('../../utils/response');

const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (err) { next(err); }
};

module.exports = {
  // Meters
  listMeters: wrap(async (req, res) => {
    const data = await service.listMeters(req.query);
    success(res, data);
  }),
  getMeter: wrap(async (req, res) => {
    const data = await service.getMeter(req.params.id);
    success(res, data);
  }),
  createMeter: wrap(async (req, res) => {
    const data = await service.createMeter(req.body);
    success(res, data, 'Meter created');
  }),
  updateMeter: wrap(async (req, res) => {
    const data = await service.updateMeter(req.params.id, req.body);
    success(res, data, 'Meter updated');
  }),

  // Rate history
  listRates: wrap(async (req, res) => {
    const data = await service.listRates(req.params.id);
    success(res, data);
  }),
  createRate: wrap(async (req, res) => {
    const data = await service.createRate(req.params.id, req.body);
    success(res, data, 'Rate added');
  }),
  deleteRate: wrap(async (req, res) => {
    await service.deleteRate(req.params.id);
    success(res, null, 'Rate deleted');
  }),

  // Current running estimate
  currentEstimate: wrap(async (req, res) => {
    const data = await service.currentEstimate(req.params.id);
    success(res, data);
  }),

  // Daily readings
  listReadings: wrap(async (req, res) => {
    const data = await service.listReadings(req.query);
    success(res, data);
  }),
  getLastReading: wrap(async (req, res) => {
    const data = await service.getLastReading(req.query.meterId);
    success(res, data);
  }),
  saveReading: wrap(async (req, res) => {
    const data = await service.upsertReading(req.body);
    success(res, data, 'Reading saved');
  }),
  deleteReading: wrap(async (req, res) => {
    await service.deleteReading(req.params.id);
    success(res, null, 'Reading deleted');
  }),

  // Actual bills
  listActualBills: wrap(async (req, res) => {
    const data = await service.listActualBills(req.query.meterId);
    success(res, data);
  }),
  createActualBill: wrap(async (req, res) => {
    const data = await service.createActualBill(req.body);
    success(res, data, 'Actual bill posted');
  }),
  updateActualBill: wrap(async (req, res) => {
    const data = await service.updateActualBill(req.params.id, req.body);
    success(res, data, 'Actual bill updated');
  }),
  deleteActualBill: wrap(async (req, res) => {
    await service.deleteActualBill(req.params.id);
    success(res, null, 'Actual bill deleted');
  }),

  // Report
  getReport: wrap(async (req, res) => {
    const data = await service.getReport(req.query);
    success(res, data);
  }),

  lastBillByMeter: wrap(async (req, res) => {
    const data = await service.lastBillByMeter();
    success(res, data);
  }),
};
