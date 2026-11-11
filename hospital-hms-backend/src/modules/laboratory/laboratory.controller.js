const service = require('./laboratory.service');
const { success } = require('../../utils/response');

const wrap = (fn) => async (req, res, next) => {
  try { success(res, await fn(req)); } catch (err) { next(err); }
};

module.exports = {
  listCategories:     wrap(() => service.listCategories()),
  createCategory:     wrap((req) => service.createCategory(req.body || {})),
  updateCategory:     wrap((req) => service.updateCategory(req.params.id, req.body || {})),
  deleteCategory:     wrap((req) => service.deleteCategory(req.params.id)),

  listClinicTests:    wrap(() => service.listClinicTests()),
  listTests:          wrap((req) => service.listTests({ categoryId: req.query.categoryId })),
  createTest:         wrap((req) => service.createTest(req.body || {})),
  updateTest:         wrap((req) => service.updateTest(req.params.id, req.body || {})),
  deleteTest:         wrap((req) => service.deleteTest(req.params.id)),

  getTestParameters:  wrap((req) => service.getTestParameters(req.params.id)),
  saveTestParameters: wrap((req) => service.saveTestParameters(req.params.id, req.body?.parameters)),

  listSlips:          wrap((req) => service.listSlips(req.query)),
  getSlip:            wrap((req) => service.getSlip(req.params.visitId)),
  saveSlipResults:    wrap((req) => service.saveSlipResults(req.params.visitId, req.body || {})),
  markPrinted:        wrap((req) => service.markPrinted(req.body?.resultIds)),
  getSummary:         wrap(() => service.getSummary()),
};
