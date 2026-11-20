const prisma = require('../../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Token secret — one place, so signing and checking always agree.
const JWT_SECRET = () => process.env.JWT_SECRET || 'hospital_hms_secret_key';
const TOKEN_TTL = '24h';
const signToken = (payload) => jwt.sign(payload, JWT_SECRET(), { expiresIn: TOKEN_TTL });

// Super Admin (owner, 2026-11-20): checked here on the server instead of in
// the website's code, where anyone could read the password. Not a database
// user. Set SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD in .env to change them;
// without them the existing account keeps working (only its bcrypt hash is
// kept here, never the password itself).
const SUPER_ADMIN_EMAIL = () => String(process.env.SUPER_ADMIN_EMAIL || 'ceo@darulshifa.com').trim().toLowerCase();
const SUPER_ADMIN_HASH = '$2a$10$rYg1bMqX8bAYDbx61wxETOU5Tul/RldIyB.Nw9Ff0zzGZ1A0nFTK6';
const SUPER_ADMIN_USER = {
  id: 'super-admin',
  name: 'Dr. Nadeem Abbas',
  role: 'CEO',
  avatar: null,
  isSuperAdmin: true,
  permissions: { all: true },
};
async function superAdminPasswordOk(password) {
  if (process.env.SUPER_ADMIN_PASSWORD) return password === process.env.SUPER_ADMIN_PASSWORD;
  return bcrypt.compare(password, SUPER_ADMIN_HASH);
}

async function login(email, password) {
  if (String(email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL()) {
    if (!(await superAdminPasswordOk(password))) throw { status: 401, message: 'Invalid email or password' };
    const user = { ...SUPER_ADMIN_USER, email: SUPER_ADMIN_EMAIL() };
    return {
      token: signToken({ id: user.id, name: user.name, email: user.email, role: user.role, isSuperAdmin: true }),
      user,
      permissions: user.permissions,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw { status: 401, message: 'Invalid email or password' };
  }

  if (!user.isActive) {
    throw { status: 403, message: 'Your account has been deactivated. Please contact administrator.' };
  }

  // Check expiry
  if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
    throw { status: 403, message: 'Your account has expired. Please contact administrator.' };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw { status: 401, message: 'Invalid email or password' };
  }

  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: now, lastActivity: now },
  });

  const token = signToken({ id: user.id, name: user.name, email: user.email, role: user.role });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeCode: user.employeeCode || null,
      isSuperAdmin: false,
    },
    permissions: user.permissions,
  };
}

async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw { status: 404, message: 'User not found' };

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw { status: 401, message: 'Current password is incorrect' };

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
}

module.exports = { login, changePassword, signToken, JWT_SECRET };
