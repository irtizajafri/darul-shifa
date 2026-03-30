const service = require('./gatepass.service');
const { success, fail } = require('../../utils/response');

async function ping(_req, res, next) {
  try {
    res.json({ module: 'gatepass', ok: true });
  } catch (err) {
    next(err);
  }
}

async function list(_req, res, next) {
  try {
    const data = await service.list();
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const required = ['employeeId', 'nature'];
    const missing = required.filter((k) => req.body[k] === undefined || req.body[k] === null);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    if (Number.isNaN(parseInt(req.body.employeeId, 10))) {
      return fail(res, 400, 'Invalid employeeId');
    }

    const record = await service.create(req.body);
    return success(res, record, 'gatepass created');
  } catch (err) {
    next(err);
  }
}

async function close(req, res, next) {
  try {
    const record = await service.closeGatepass(req.params.id, req.body || {});
    if (!record) return fail(res, 404, 'Gatepass not found');
    return success(res, record, 'gatepass closed');
  } catch (err) {
    next(err);
  }
}

module.exports = { ping, list, create, close };
