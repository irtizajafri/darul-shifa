const prisma = require('../../config/db');

let isTableReady = false;

async function ensureTable() {
  if (isTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS payslip_snapshots (
      id SERIAL PRIMARY KEY,
      emp_code VARCHAR(50) NOT NULL,
      month VARCHAR(2) NOT NULL,
      year VARCHAR(4) NOT NULL,
      rows_json TEXT NOT NULL,
      saved_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(emp_code, month, year)
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE payslip_snapshots ADD COLUMN IF NOT EXISTS net_salary NUMERIC(12,2) DEFAULT 0
  `);
  isTableReady = true;
}

async function saveSnapshot(empCode, month, year, rows, netSalary) {
  await ensureTable();
  const rowsJson = JSON.stringify(rows);
  const net = Number(netSalary) || 0;
  await prisma.$executeRawUnsafe(
    `INSERT INTO payslip_snapshots (emp_code, month, year, rows_json, net_salary, saved_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (emp_code, month, year)
     DO UPDATE SET rows_json = $4, net_salary = $5, saved_at = NOW()`,
    empCode, month, year, rowsJson, net
  );
}

async function getSnapshot(empCode, month, year) {
  await ensureTable();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT rows_json, net_salary, saved_at FROM payslip_snapshots WHERE emp_code = $1 AND month = $2 AND year = $3 LIMIT 1`,
    empCode, month, year
  );
  if (!rows.length) return null;
  return {
    rows: JSON.parse(rows[0].rows_json),
    netSalary: Number(rows[0].net_salary) || 0,
    savedAt: rows[0].saved_at,
  };
}

module.exports = { saveSnapshot, getSnapshot };
