const service = require('./panel-lab.service');
const { success } = require('../../utils/response');

const wrap = (fn) => async (req, res, next) => {
  try { success(res, await fn(req)); } catch (err) { next(err); }
};

module.exports = {
  listTests:          wrap(() => service.listTests()),
  getTestParameters:  wrap((req) => service.getTestParameters(req.params.subDeptId)),
  saveTestParameters: wrap((req) => service.saveTestParameters(req.params.subDeptId, req.body || {})),

  listEntries:        wrap((req) => service.listEntries(req.query)),
  getEntry:           wrap((req) => service.getEntry(req.params.entryKey)),
  saveEntryResults:   wrap((req) => service.saveEntryResults(req.params.entryKey, req.body || {})),
  markPrinted:        wrap((req) => service.markPrinted(req.body?.resultIds)),
};
