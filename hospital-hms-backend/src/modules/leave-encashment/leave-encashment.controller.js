const service = require('./leave-encashment.service');
const { success, fail } = require('../../utils/response');

async function getSummary(req, res, next) {
  try {
    const data = await service.summary({
      search: req.query.search,
      month: req.query.month,
      employeeId: req.query.employeeId ? Number(req.query.employeeId) : undefined,
    });
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function getBalance(req, res, next) {
  try {
    const employeeId = Number(req.params.employeeId);
    if (!employeeId) return fail(res, 400, 'Invalid employeeId');
    const data = await service.getBalance(employeeId);
    return success(res, data);
  } catch (err) {
    if (err?.statusCode) return fail(res, err.statusCode, err.message);
    next(err);
  }
}

async function listRecords(req, res, next) {
  try {
    const data = await service.listRecords({
      employeeId: req.query.employeeId ? Number(req.query.employeeId) : undefined,
    });
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { employeeId, leavesCount } = req.body;
    if (!employeeId) return fail(res, 400, 'employeeId is required');
    if (!leavesCount || Number(leavesCount) <= 0) return fail(res, 400, 'leavesCount must be > 0');
    const record = await service.create(req.body);
    return success(res, record, 'Leave encashment created');
  } catch (err) {
    if (err?.statusCode) return fail(res, err.statusCode, err.message);
    next(err);
  }
}

async function syncAttendance(req, res, next) {
  try {
    await service.syncAttendanceLeaves(req.body);
    return success(res, { ok: true });
  } catch (err) {
    next(err);
  }
}

async function getMonthlyTotal(req, res, next) {
  try {
    const data = await service.getMonthlyTotal(req.query.month || null);
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

async function getEmployeeReport(req, res, next) {
  try {
    const employeeId = Number(req.params.employeeId);
    if (!employeeId) return fail(res, 400, 'Invalid employeeId');
    const data = await service.getEmployeeReport(employeeId);
    return success(res, data);
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
    return success(res, { id }, 'Leave encashment deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary, getBalance, getMonthlyTotal, getEmployeeReport, listRecords, create, syncAttendance, remove };
