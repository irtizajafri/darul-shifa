const service = require('./shortleave.service');
const { success, fail } = require('../../utils/response');

async function ping(_req, res, next) {
  try {
    res.json({ module: 'shortleave', ok: true });
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
    const required = ['employeeId', 'fromTime', 'toTime', 'reason'];
    const missing = required.filter((k) => req.body[k] === undefined || req.body[k] === null);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const record = await service.create(req.body);
    return success(res, record, 'short leave created');
  } catch (err) {
    next(err);
  }
}

module.exports = { ping, list, create };
