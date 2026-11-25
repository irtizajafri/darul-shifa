const jwt = require('jsonwebtoken');
const { signToken, JWT_SECRET } = require('../modules/auth/auth.service');
const devices = require('../modules/devices/devices.service');

// Every /api call needs the login token (owner, 2026-11-20 — before, any PC
// on the network could call the API without logging in). Only the login
// itself is open. A token older than an hour gets a fresh one back in the
// "x-new-token" header, so a PC in use never runs out; one left unused
// expires after 7 days (auth.service.js TOKEN_TTL; owner, 2026-11-25).
// Emergency switch: API_AUTH=off in .env turns the check off.
const OPEN_PATHS = new Set(['/auth/login', '/auth/ping']);
const REFRESH_AFTER_S = 3600;

function authMiddleware(req, res, next) {
  if (String(process.env.API_AUTH || '').toLowerCase() === 'off') {
    // Check off: still read the token when one is sent, so who's who is known.
    const t = String(req.headers.authorization || '').split(' ')[1];
    if (t) { try { req.user = jwt.verify(t, JWT_SECRET()); } catch { /* ignore */ } }
    if (req.user) devices.note(req.clientIp, { userName: req.user.name, userEmail: req.user.email });
    return next();
  }
  if (req.method === 'OPTIONS' || OPEN_PATHS.has(req.path)) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: 'Login zaroori hai — dobara login karein' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET());
    req.user = decoded;
    devices.note(req.clientIp, { userName: decoded.name, userEmail: decoded.email });
    if (decoded.iat && Date.now() / 1000 - decoded.iat > REFRESH_AFTER_S) {
      const { iat, exp, ...payload } = decoded; // eslint-disable-line no-unused-vars
      res.setHeader('x-new-token', signToken(payload));
    }
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Session khatam ho gaya — dobara login karein' });
  }
}

module.exports = { authMiddleware };
