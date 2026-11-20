const express = require('express');
const svc = require('./devices.service');
const { success, fail } = require('../../utils/response');

const router = express.Router();

// Connected PCs — the Super Admin's page. /ping is the open app's heartbeat
// (any logged-in user), so a PC shows "online" even on a quiet screen.
const superAdminOnly = (req, res, next) => (req.user?.isSuperAdmin ? next() : fail(res, 403, 'Sirf Super Admin'));
const who = (req) => ({ myIp: req.clientIp, byName: req.user?.name || req.user?.email || null });
const wrap = (fn) => async (req, res, next) => {
  try { success(res, await fn(req)); } catch (e) { if (e.status) return fail(res, e.status, e.message); next(e); }
};

router.get('/ping', (req, res) => success(res, { ip: req.clientIp }));
router.get('/', superAdminOnly, wrap((req) => svc.listDevices(req.clientIp)));
router.put('/settings', superAdminOnly, wrap((req) => svc.setApprovalMode(Boolean(req.body?.approvalMode), who(req))));
router.put('/:id', superAdminOnly, wrap((req) => svc.updateDevice(req.params.id, req.body || {}, who(req))));
router.delete('/:id', superAdminOnly, wrap((req) => svc.forgetDevice(req.params.id, who(req))));

module.exports = router;
