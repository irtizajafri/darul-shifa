const service = require('./attendance.service');
const { success, fail } = require('../../utils/response');

async function ping(_req, res, next) {
  try {
    res.json({ module: 'attendance', ok: true });
  } catch (err) {
    next(err);
  }
}

async function list(_req, res, next) {
  try {
    const records = await service.list();
    return success(res, records);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const required = ['employeeId', 'scheduledIn', 'scheduledOut', 'actualIn', 'actualOut', 'monthlySalary'];
    const missing = required.filter((k) => req.body[k] === undefined || req.body[k] === null);
    if (missing.length) return fail(res, 400, `Missing fields: ${missing.join(', ')}`);
    const record = await service.create(req.body);
    return success(res, record, 'attendance recorded');
  } catch (err) {
    next(err);
  }
}

async function fetchExternal(req, res, next) {
  try {
    const { Dates, DatesTo } = req.body || {};
    const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Dates, DatesTo })
    });

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = { ping, list, create, fetchExternal };
