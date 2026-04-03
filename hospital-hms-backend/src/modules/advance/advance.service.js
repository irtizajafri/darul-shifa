const prisma = require('../../config/db');

async function list() {
  const rows = await prisma.advanceLoan.findMany({
    orderBy: { id: 'desc' },
    include: { employee: true }
  });

  return rows.map((row) => {
    let parsed = {};
    try {
      parsed = row.reason ? JSON.parse(row.reason) : {};
    } catch {
      parsed = {};
    }
    return {
      ...row,
      schedule: Array.isArray(parsed.schedule) ? parsed.schedule : [],
      remarks: parsed.remarks || ''
    };
  });
}

async function create(payload) {
  const { employeeId, amount, type = 'advance', reason, status = 'pending', schedule = [], remarks } = payload;
  const reasonJson = JSON.stringify({ schedule, remarks, reason });
  
  return prisma.advanceLoan.create({
    data: {
      employeeId: parseInt(employeeId),
      amount: parseFloat(amount),
      type,
      reason: reasonJson,
      status
    }
  });
}

async function update(id, payload) {
  const existing = await prisma.advanceLoan.findUnique({ where: { id } });
  if (!existing) throw new Error('Record not found');

  let existingReason = {};
  try {
    existingReason = existing.reason ? JSON.parse(existing.reason) : {};
  } catch {
    existingReason = {};
  }

  const nextSchedule = Array.isArray(payload.schedule)
    ? payload.schedule
    : (Array.isArray(existingReason.schedule) ? existingReason.schedule : []);
  const nextRemarks = payload.remarks !== undefined
    ? payload.remarks
    : (existingReason.remarks || '');
  const nextReason = payload.reason !== undefined
    ? payload.reason
    : (existingReason.reason || '');

  const reasonJson = JSON.stringify({
    schedule: nextSchedule,
    remarks: nextRemarks,
    reason: nextReason
  });

  const updated = await prisma.advanceLoan.update({
    where: { id },
    data: {
      employeeId: payload.employeeId !== undefined ? parseInt(payload.employeeId, 10) : existing.employeeId,
      amount: payload.amount !== undefined ? parseFloat(payload.amount) : existing.amount,
      type: payload.type || existing.type,
      status: payload.status || existing.status,
      reason: reasonJson,
    },
    include: { employee: true }
  });

  return {
    ...updated,
    schedule: nextSchedule,
    remarks: nextRemarks
  };
}

async function remove(id) {
  const existing = await prisma.advanceLoan.findUnique({ where: { id } });
  if (!existing) throw new Error('Record not found');
  await prisma.advanceLoan.delete({ where: { id } });
}

module.exports = { list, create, update, remove };
