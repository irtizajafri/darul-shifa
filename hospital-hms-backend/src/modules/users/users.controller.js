const service = require('./users.service');
const { success, fail } = require('../../utils/response');

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
    const user = await service.create(req.body);
    return success(res, user, 'User created successfully');
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const user = await service.update(id, req.body);
    return success(res, user, 'User updated successfully');
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await service.remove(id);
    return success(res, null, 'User deleted successfully');
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function toggleActive(req, res, next) {
  try {
    const { id } = req.params;
    const data = await service.toggleActive(id);
    return success(res, data, `User ${data.isActive ? 'activated' : 'deactivated'} successfully`);
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.message);
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { id } = req.params;
    const { password } = req.body;
    await service.changePassword(id, password);
    return success(res, null, 'Password changed successfully');
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.message);
    next(err);
  }
}

module.exports = { list, create, update, remove, toggleActive, changePassword };
