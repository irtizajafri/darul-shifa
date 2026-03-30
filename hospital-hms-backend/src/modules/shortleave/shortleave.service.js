const prisma = require('../../config/db');

async function list() {
  return prisma.shortLeave.findMany({
    orderBy: { id: 'desc' },
    include: { employee: true }
  });
}

async function create(payload) {
  const { employeeId, fromTime, toTime, reason, status = 'pending' } = payload;
  
  return prisma.shortLeave.create({
    data: {
      employeeId: parseInt(employeeId),
      fromTime: fromTime ? new Date(fromTime) : null,
      toTime: toTime ? new Date(toTime) : null,
      reason,
      status
    }
  });
}

module.exports = { list, create };
