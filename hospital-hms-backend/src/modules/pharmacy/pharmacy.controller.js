const service = require('./pharmacy.service');
const { success, fail } = require('../../utils/response');
const { requireSubModule } = require('../../middleware/subModuleGuard');

const wrap = (fn) => async (req, res, next) => {
  try { success(res, await fn(req)); } catch (err) {
    if (err.status) return fail(res, err.status, err.message);
    next(err);
  }
};

// Medicine Return / reports (owner, 2026-11-27): checked on the server too —
// User Management → Al Shifa Hospital Pharmacy → "Medicine Return (MRN) —
// request" (mrn), "— verify" (mrn-verify), "Pharmacy Reports" (reports).
const guard = (subs, label) => requireSubModule('pharmacy', subs, `Al Shifa Hospital Pharmacy → ${label}`);
const userName = (req, fallback) => req.user?.name || req.user?.email || fallback || null;

module.exports = {
  getSummary:      wrap(() => service.getSummary()),
  searchMedicines: wrap((req) => service.searchMedicines(req.query.q)),
  createGD:        wrap((req) => service.createGD(req.body || {})),
  listGDs:         wrap((req) => service.listGDs(req.query)),
  getGD:           wrap((req) => service.getGD(req.params.id)),
  createGIN:       wrap((req) => service.createGIN(req.body || {})),
  listGINs:        wrap((req) => service.listGINs(req.query)),
  getGIN:          wrap((req) => service.getGIN(req.params.id)),

  canRequestMRN: guard(['mrn'], 'Medicine Return (MRN) — request'),
  canVerifyMRN:  guard(['mrn-verify'], 'Medicine Return (MRN) — verify'),
  canSeeMRN:     guard(['mrn', 'mrn-verify'], 'Medicine Return (MRN)'),
  canSeeReports: guard(['reports'], 'Pharmacy Reports'),

  returnableMRN: wrap((req) => service.returnableFor(req.query)),
  createMRN:     wrap((req) => service.createMRN({ ...(req.body || {}), requestedByName: userName(req, req.body?.requestedByName) })),
  listMRNs:      wrap((req) => service.listMRNs(req.query)),
  pendingMRNs:   wrap(() => service.pendingMRNs()),
  verifyMRN:     wrap((req) => service.verifyMRN(req.params.id, { ...(req.body || {}), verifiedByName: userName(req, req.body?.verifiedByName) })),
  reportLines:   wrap((req) => service.reportLines(req.query)),
};
