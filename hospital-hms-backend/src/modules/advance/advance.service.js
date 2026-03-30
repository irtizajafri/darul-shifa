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

module.exports = { list, create };
