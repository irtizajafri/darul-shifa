const service = require('./employee.service');
const { success, fail } = require('../../utils/response');

function handlePrismaError(err, res) {
  if (err?.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'unique field';
    return fail(res, 409, `Duplicate value for ${target}. Please use a different value.`);
  }

  if (err?.code === 'P2025') {
    return fail(res, 404, 'Employee not found');
  }

  return null;
}

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
    const handled = handlePrismaError(err, res);
    if (handled) return handled;
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const updated = await service.update(req.params.id, req.body);
    if (!updated) return fail(res, 404, 'Employee not found');
    return success(res, updated, 'employee updated');
  } catch (err) {
    const handled = handlePrismaError(err, res);
    if (handled) return handled;
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const ok = await service.remove(req.params.id);
    if (!ok) return fail(res, 404, 'Employee not found');
    return success(res, { id: req.params.id }, 'employee deleted');
  } catch (err) {
    const handled = handlePrismaError(err, res);
    if (handled) return handled;
    next(err);
  }
}

async function listDepartmentHeads(_req, res, next) {
  try {
    const data = await service.listDepartmentHeads();
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function createDepartmentHead(req, res, next) {
  try {
    const created = await service.createDepartmentHead(req.body);
    return success(res, created, 'department created');
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.message || 'error');
    next(err);
  }
}

async function removeDepartmentHead(req, res, next) {
  try {
    const ok = await service.removeDepartmentHead(req.params.departmentId);
    if (!ok) return fail(res, 404, 'Department not found');
    return success(res, { id: Number(req.params.departmentId) }, 'department deleted');
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.message || 'error');
    next(err);
  }
}

async function listDesignationHeads(req, res, next) {
  try {
    const data = await service.listDesignationHeadsByDepartment(req.params.departmentId);
    return success(res, data);
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.message || 'error');
    next(err);
  }
}

async function createDesignationHead(req, res, next) {
  try {
    const created = await service.createDesignationHead(req.body);
    return success(res, created, 'designation created');
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.message || 'error');
    next(err);
  }
}

async function removeDesignationHead(req, res, next) {
  try {
    const ok = await service.removeDesignationHead(req.params.designationId);
    if (!ok) return fail(res, 404, 'Designation not found');
    return success(res, { id: Number(req.params.designationId) }, 'designation deleted');
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.message || 'error');
    next(err);
  }
}

module.exports = {
  ping,
  list,
  get,
  create,
  update,
  remove,
  listDepartmentHeads,
  createDepartmentHead,
  removeDepartmentHead,
  listDesignationHeads,
  createDesignationHead,
  removeDesignationHead,
};
