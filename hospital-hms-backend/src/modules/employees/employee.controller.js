const service = require('./employee.service');
const { success, fail } = require('../../utils/response');

async function ping(_req, res, next) {
  try {
    res.json({ module: 'employees', ok: true });
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

async function get(req, res, next) {
  try {
    const employee = await service.get(req.params.id);
    if (!employee) return fail(res, 404, 'Employee not found');
    return success(res, employee);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const required = ['firstName', 'lastName'];
    const missing = required.filter((k) => req.body[k] === undefined || req.body[k] === null || req.body[k] === '');
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);

    const created = await service.create(req.body);
    return success(res, created, 'employee created');
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const updated = await service.update(req.params.id, req.body);
    if (!updated) return fail(res, 404, 'Employee not found');
    return success(res, updated, 'employee updated');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const ok = await service.remove(req.params.id);
    if (!ok) return fail(res, 404, 'Employee not found');
    return success(res, { id: req.params.id }, 'employee deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = { ping, list, get, create, update, remove };
