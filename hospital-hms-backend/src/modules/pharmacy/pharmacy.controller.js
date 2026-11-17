const service = require('./pharmacy.service');
const { success, fail } = require('../../utils/response');

const wrap = (fn) => async (req, res, next) => {
  try { success(res, await fn(req)); } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
};

module.exports = {
  getSummary:      wrap(() => service.getSummary()),
  searchMedicines: wrap((req) => service.searchMedicines(req.query.q)),
  createGD:        wrap((req) => service.createGD(req.body || {})),
  listGDs:         wrap((req) => service.listGDs(req.query)),
  getGD:           wrap((req) => service.getGD(req.params.id)),
  createGIN:       wrap((req) => service.createGIN(req.body || {})),
  listGINs:        wrap((req) => service.listGINs(req.query)),
  getGIN:          wrap((req) => service.getGIN(req.params.id)),
};
