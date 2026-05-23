const service = require('./auth.service');
const { success, fail } = require('../../utils/response');

async function ping(_req, res, next) {
  try {
    res.json({ module: 'auth', ok: true });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return fail(res, 400, 'Email and password are required');
    }
    const data = await service.login(email, password);
    return success(res, data, 'Login successful');
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.message);
    next(err);
  }
}

module.exports = { ping, login };
