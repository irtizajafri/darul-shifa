const prisma = require('../../config/db');

async function summary() {
  const [
    employees,
    attendance,
    gatePass,
    shortLeave,
    advanceLoan
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.attendance.count(),
    prisma.gatePass.count(),
    prisma.shortLeave.count(),
    prisma.advanceLoan.count(),
  ]);

  return {
    employees,
    attendance,
    gatepass: gatePass,
    shortleave: shortLeave,
    advanceLoan,
  };
}

module.exports = { summary };
