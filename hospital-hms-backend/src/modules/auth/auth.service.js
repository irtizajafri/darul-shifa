const prisma = require('../../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

async function login(email, password) {
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

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'hospital_hms_secret_key',
    { expiresIn: '24h' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isSuperAdmin: false,
    },
    permissions: user.permissions,
  };
}

module.exports = { login };
