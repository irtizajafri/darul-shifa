const prisma = require('../../config/db');
const bcrypt = require('bcryptjs');

async function list() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      permissions: true,
      isActive: true,
      expiresAt: true,
      lastLogin: true,
      lastActivity: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return users;
}

async function create(data) {
  const { name, email, password, role, department, permissions, isActive, expiresAt } = data;

  if (!name || !email || !password || !role) {
    throw { status: 400, message: 'Name, email, password and role are required' };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw { status: 409, message: 'A user with this email already exists' };
  }

  const hashed = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role,
      department: department || null,
      permissions: permissions || {},
      isActive: isActive !== undefined ? isActive : true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      permissions: true,
      isActive: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return user;
}

async function update(id, data) {
  const { name, email, role, department, permissions, isActive, expiresAt } = data;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw { status: 404, message: 'User not found' };
  }

  // Check email uniqueness if changing
  if (email && email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken) throw { status: 409, message: 'Email already in use by another user' };
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(role !== undefined && { role }),
      ...(department !== undefined && { department: department || null }),
      ...(permissions !== undefined && { permissions }),
      ...(isActive !== undefined && { isActive }),
      expiresAt: expiresAt === null ? null : expiresAt ? new Date(expiresAt) : undefined,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      permissions: true,
      isActive: true,
      expiresAt: true,
      updatedAt: true,
    },
  });

  return updated;
}

async function remove(id) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw { status: 404, message: 'User not found' };
  }
  await prisma.user.delete({ where: { id } });
}

async function toggleActive(id) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw { status: 404, message: 'User not found' };
  }
  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: !existing.isActive },
    select: { id: true, isActive: true },
  });
  return updated;
}

async function changePassword(id, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw { status: 400, message: 'Password must be at least 6 characters' };
  }
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw { status: 404, message: 'User not found' };
  }
  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
}

async function pingActivity(id) {
  await prisma.user.update({
    where: { id },
    data: { lastActivity: new Date() },
  });
}

module.exports = { list, create, update, remove, toggleActive, changePassword, pingActivity };
