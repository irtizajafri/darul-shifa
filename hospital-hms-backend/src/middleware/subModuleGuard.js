const { permissionsOf } = require('./accountsBook.middleware');
const { fail } = require('../utils/response');

// A screen's permission checked on the server too (owner, 2026-11-27):
// User Management → <module> → <sub-module> (any of its tabs). The Super
// Admin always; a request with no user only when API_AUTH=off.
async function hasSubModule(req, mod, sub) {
  if (!req.user?.id || req.user.isSuperAdmin) return true;
  const p = (await permissionsOf(req.user.id))?.[mod];
  if (Array.isArray(p)) return p.includes(sub);
  const s = p?.[sub];
  return s === true || (Array.isArray(s) && s.length > 0);
}

// Lets the request through when the user has any of `subs`.
const requireSubModule = (mod, subs, label) => async (req, res, next) => {
  try {
    for (const s of subs) if (await hasSubModule(req, mod, s)) return next();
    return fail(res, 403, `You don't have the "${label}" permission (User Management)`);
  } catch (err) { next(err); }
};

module.exports = { hasSubModule, requireSubModule };
