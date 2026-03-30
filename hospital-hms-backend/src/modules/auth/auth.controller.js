const service = require('./auth.service');

async function ping(_req, res, next) {
  try {
    res.json({ module: 'auth', ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { ping };
