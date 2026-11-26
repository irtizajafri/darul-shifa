const express = require('express');
const svc = require('./print.service');
const { success, fail } = require('../../utils/response');

// Direct printing (print.service.js): any logged-in PC asks what it can print
// and sends slips; the Super Admin lists the server's printers.
const router = express.Router();
const superAdminOnly = (req, res, next) => (req.user?.isSuperAdmin ? next() : fail(res, 403, 'Sirf Super Admin'));
const wrap = (fn) => async (req, res, next) => {
  try { success(res, await fn(req)); } catch (e) { if (e.status) return fail(res, e.status, e.message); next(e); }
};

router.get('/config', wrap((req) => svc.getConfig(req.clientIp)));
router.get('/printers', superAdminOnly, wrap(() => svc.listServerPrinters()));
router.post('/', wrap((req) => svc.printDocs(req.clientIp, req.body?.docs)));

// Printer setup scripts (public/it/counter-printers / server-printers).
router.post('/register', superAdminOnly, wrap((req) => svc.registerCounter(req.clientIp, req.body || {})));
router.get('/setup', superAdminOnly, async (req, res, next) => {
  try { res.type('text/plain').send(await svc.setupList()); } catch (e) { next(e); }
});
router.post('/setup/:id', superAdminOnly, wrap((req) => svc.setupReport(req.params.id, req.body || {})));

module.exports = router;
