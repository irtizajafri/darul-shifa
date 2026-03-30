function success(res, data, message = 'success') {
  return res.json({ ok: true, message, data });
}

function fail(res, status = 400, message = 'error') {
  return res.status(status).json({ ok: false, message });
}

module.exports = { success, fail };
