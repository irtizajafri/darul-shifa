const service = require('./advance.service');
const { success, fail } = require('../../utils/response');

async function ping(_req, res, next) {
  try {
    res.json({ module: 'advance', ok: true });
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
    const required = ['employeeId', 'amount'];
    const missing = required.filter((k) => req.body[k] === undefined || req.body[k] === null);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const record = await service.create(req.body);
    return success(res, record, 'advance/loan created');
  } catch (err) {
    if (err?.statusCode) return fail(res, err.statusCode, err.message);
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, 'Invalid id');

    const record = await service.update(id, req.body || {});
    return success(res, record, 'advance/loan updated');
  } catch (err) {
    if (err?.statusCode) return fail(res, err.statusCode, err.message);
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, 'Invalid id');

    await service.remove(id);
    return success(res, { id }, 'advance/loan deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = { ping, list, create, update, remove };
