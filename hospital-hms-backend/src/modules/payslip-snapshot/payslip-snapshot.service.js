const prisma = require('../../config/db');

async function saveSnapshot(empCode, month, year, rows, netSalary) {
  const rowsJson = JSON.stringify(rows);
  const net = Number(netSalary) || 0;

  await prisma.payslipSnapshot.upsert({
    where: { empCode_month_year: { empCode, month, year } },
    update: { rowsJson, netSalary: net, savedAt: new Date() },
    create: { empCode, month, year, rowsJson, netSalary: net, savedAt: new Date() },
  });
}

async function getSnapshot(empCode, month, year) {
  const record = await prisma.payslipSnapshot.findUnique({
    where: { empCode_month_year: { empCode, month, year } },
  });
  if (!record) return null;
  return {
    rows: JSON.parse(record.rowsJson),
    netSalary: Number(record.netSalary) || 0,
    savedAt: record.savedAt,
  };
}

module.exports = { saveSnapshot, getSnapshot };
