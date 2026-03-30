const service = require('./reports.service');
const { success } = require('../../utils/response');

async function ping(_req, res, next) {
  try {
    res.json({ module: 'reports', ok: true });
  } catch (err) {
    next(err);
  }
}

async function summary(_req, res, next) {
  try {
    const data = await service.summary();
    return success(res, data);
  } catch (err) {
    next(err);
  }
}

module.exports = { ping, summary };
