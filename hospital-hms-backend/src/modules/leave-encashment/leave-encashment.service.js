const prisma = require('../../config/db');

const START_MONTH = '2026-07';
let isTableReady = false;
let isEmpColumnsReady = false;

async function ensureTable() {
  if (isTableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS leave_encashments (
      id SERIAL PRIMARY KEY,
      employee_id INT NOT NULL,
      month VARCHAR(7) NOT NULL,
      leaves_count DECIMAL(10,2) NOT NULL DEFAULT 1,
      per_day_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      type VARCHAR(20) NOT NULL DEFAULT 'encashment',
      attendance_date VARCHAR(10),
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS leave_encashments_lwp_unique
    ON leave_encashments (employee_id, attendance_date)
    WHERE type = 'leave_with_pay'
  `);
  isTableReady = true;
}

async function ensureEmpColumns() {
  if (isEmpColumnsReady) return;
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "leaveEncashmentEnabled" BOOLEAN DEFAULT FALSE');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "leaveEncashmentRate" DOUBLE PRECISION DEFAULT 0');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "leaveEncashmentPastLeaves" DOUBLE PRECISION DEFAULT 0');
  await prisma.$executeRawUnsafe('ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "leaveEncashmentMonthlyLeaves" DOUBLE PRECISION DEFAULT 2');
  isEmpColumnsReady = true;
}

function daysInMonth(monthKey) {
  const [year, month] = String(monthKey).split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthsElapsed(startKey, endKey) {
  const [sy, sm] = startKey.split('-').map(Number);
  const [ey, em] = endKey.split('-').map(Number);
  return Math.max(0, (ey - sy) * 12 + (em - sm) + 1);
}

function round2(v) {
  return Math.round(Number(v) * 100) / 100;
}

async function summary(filters = {}) {
  await ensureTable();
  await ensureEmpColumns();

  const employees = await prisma.$queryRawUnsafe(`
    SELECT id, "empCode", "firstName", "lastName", "role", "departmentText", "salaryMonthly",
           COALESCE("leaveEncashmentRate", 0) AS "leaveEncashmentRate",
           COALESCE("leaveEncashmentPastLeaves", 0) AS "leaveEncashmentPastLeaves",
           COALESCE("leaveEncashmentMonthlyLeaves", 2) AS "leaveEncashmentMonthlyLeaves"
    FROM "Employee"
    WHERE COALESCE("leaveEncashmentEnabled", false) = true
    ORDER BY "empCode" ASC
  `);

  const usedRows = await prisma.$queryRawUnsafe(`
    SELECT employee_id, SUM(leaves_count) AS total_used
    FROM leave_encashments
    GROUP BY employee_id
  `);
  const usedMap = new Map(usedRows.map((r) => [Number(r.employee_id), round2(r.total_used)]));

  const nowKey = currentMonthKey();
  const elapsed = monthsElapsed(START_MONTH, nowKey);

  let rows = employees.map((emp) => {
    const pastLeaveRate = Number(emp.leaveEncashmentRate) || 0;
    const pastLeaves = Number(emp.leaveEncashmentPastLeaves) || 0;
    const monthlyLeaves = Number(emp.leaveEncashmentMonthlyLeaves) || 2;
    const basicSalary = Number(emp.salaryMonthly || 0);
    const days = daysInMonth(nowKey);
    const perDayRate = days > 0 ? round2(basicSalary / days) : 0;
    const monthlyAccumulated = elapsed * monthlyLeaves;
    const used = usedMap.get(Number(emp.id)) || 0;
    const monthlyAvailable = Math.max(0, round2(monthlyAccumulated - used));
    const pastLeavesValue = round2(pastLeaves * pastLeaveRate);
    const amount = round2(monthlyAvailable * perDayRate + pastLeavesValue);

    return {
      employeeId: Number(emp.id),
      empCode: emp.empCode || '',
      name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      designation: emp.role || '',
      department: emp.departmentText || '',
      months: elapsed,
      leaveEncashmentRate: monthlyLeaves,
      accumulatedLeaves: monthlyAccumulated,
      usedLeaves: used,
      availableLeaves: monthlyAvailable,
      pastLeaves,
      pastLeaveRate,
      pastLeavesValue,
      basicSalary,
      perDayRate,
      amount,
    };
  });

  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    rows = rows.filter(
      (r) => r.name.toLowerCase().includes(q) || String(r.empCode).toLowerCase().includes(q)
    );
  }

  if (filters.month) {
    const mKey = filters.month;
    const mDays = daysInMonth(mKey);
    const monthUsedRows = await prisma.$queryRawUnsafe(`
      SELECT employee_id, SUM(leaves_count) AS total_used
      FROM leave_encashments
      WHERE month = $1
      GROUP BY employee_id
    `, mKey);
    const monthUsedMap = new Map(monthUsedRows.map((r) => [Number(r.employee_id), round2(r.total_used)]));

    rows = rows.map((r) => {
      const perDayRate = mDays > 0 ? round2(r.basicSalary / mDays) : 0;
      const monthUsed = monthUsedMap.get(r.employeeId) || 0;
      const monthAvailable = Math.max(0, round2(r.leaveEncashmentRate - monthUsed));
      return {
        ...r,
        perDayRate,
        accumulatedLeaves: r.leaveEncashmentRate,
        usedLeaves: monthUsed,
        availableLeaves: monthAvailable,
        pastLeavesValue: 0,
        amount: round2(monthAvailable * perDayRate),
      };
    });
  }

  return rows;
}

async function getBalance(employeeId) {
  await ensureTable();
  await ensureEmpColumns();

  const rows = await prisma.$queryRawUnsafe(`
    SELECT id, "empCode", "firstName", "lastName", "role", "departmentText", "salaryMonthly",
           COALESCE("leaveEncashmentRate", 0) AS "leaveEncashmentRate",
           COALESCE("leaveEncashmentPastLeaves", 0) AS "leaveEncashmentPastLeaves",
           COALESCE("leaveEncashmentMonthlyLeaves", 2) AS "leaveEncashmentMonthlyLeaves"
    FROM "Employee" WHERE id = $1
  `, Number(employeeId));
  const emp = rows[0];
  if (!emp) throw Object.assign(new Error('Employee not found'), { statusCode: 404 });

  const usedRows = await prisma.$queryRawUnsafe(
    `SELECT SUM(leaves_count) AS total_used FROM leave_encashments WHERE employee_id = $1`,
    Number(employeeId)
  );
  const used = round2(usedRows[0]?.total_used || 0);
  const nowKey = currentMonthKey();
  const elapsed = monthsElapsed(START_MONTH, nowKey);
  const pastLeaveRate = Number(emp.leaveEncashmentRate) || 0;
  const pastLeaves = Number(emp.leaveEncashmentPastLeaves) || 0;
  const monthlyLeaves = Number(emp.leaveEncashmentMonthlyLeaves) || 2;
  const monthlyAccumulated = elapsed * monthlyLeaves;
  const monthlyAvailable = Math.max(0, round2(monthlyAccumulated - used));
  const basicSalary = Number(emp.salaryMonthly || 0);
  const days = daysInMonth(nowKey);
  const perDayRate = days > 0 ? round2(basicSalary / days) : 0;
  const pastLeavesValue = round2(pastLeaves * pastLeaveRate);

  return {
    employeeId: Number(emp.id),
    empCode: emp.empCode || '',
    name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
    designation: emp.role || '',
    department: emp.departmentText || '',
    basicSalary,
    perDayRate,
    months: elapsed,
    accumulatedLeaves: monthlyAccumulated,
    usedLeaves: used,
    availableLeaves: monthlyAvailable,
    pastLeaves,
    pastLeaveRate,
    pastLeavesValue,
    currentMonth: nowKey,
    daysInCurrentMonth: days,
  };
}

async function listRecords(filters = {}) {
  await ensureTable();

  const params = [];
  const clauses = [];

  if (filters.employeeId) {
    params.push(Number(filters.employeeId));
    clauses.push(`employee_id = $${params.length}`);
  }

  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM leave_encashments${where} ORDER BY id DESC`,
    ...params
  );

  return rows.map((r) => ({
    id: Number(r.id),
    employeeId: Number(r.employee_id),
    month: r.month,
    leavesCount: round2(r.leaves_count),
    perDayRate: round2(r.per_day_rate),
    amount: round2(r.amount),
    type: r.type,
    attendanceDate: r.attendance_date,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

async function create(payload) {
  await ensureTable();

  const { employeeId, leavesCount, notes } = payload;
  const parsedId = Number(employeeId);
  const parsedLeaves = Number(leavesCount);

  if (!parsedId) throw Object.assign(new Error('Invalid employeeId'), { statusCode: 400 });
  if (!parsedLeaves || parsedLeaves <= 0)
    throw Object.assign(new Error('Leaves count must be greater than 0'), { statusCode: 400 });

  const balance = await getBalance(parsedId);
  if (parsedLeaves > balance.availableLeaves) {
    throw Object.assign(
      new Error(`Only ${balance.availableLeaves} leaves available`),
      { statusCode: 400 }
    );
  }

  const nowKey = currentMonthKey();
  const amount = round2(parsedLeaves * balance.perDayRate);

  const result = await prisma.$queryRawUnsafe(
    `INSERT INTO leave_encashments (employee_id, month, leaves_count, per_day_rate, amount, type, notes)
     VALUES ($1, $2, $3, $4, $5, 'encashment', $6)
     RETURNING id`,
    parsedId, nowKey, parsedLeaves, balance.perDayRate, amount, notes || null
  );

  return {
    id: Number(result[0].id),
    employeeId: parsedId,
    month: nowKey,
    leavesCount: parsedLeaves,
    perDayRate: balance.perDayRate,
    amount,
    type: 'encashment',
  };
}

// Called from AttendanceList after saving overrides
async function syncAttendanceLeaves({ empCode, rows }) {
  await ensureTable();

  if (!empCode || !Array.isArray(rows)) return;

  const emp = await prisma.employee.findFirst({ where: { empCode: String(empCode) } });
  if (!emp) return;

  const employeeId = emp.id;
  const basicSalary = Number(emp.salaryMonthly || 0);

  for (const row of rows) {
    const date = String(row.date || '').slice(0, 10);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    if (row.hasLeaveWithPay) {
      const monthKey = date.slice(0, 7);
      const days = daysInMonth(monthKey);
      const perDayRate = days > 0 ? round2(basicSalary / days) : 0;
      const amount = perDayRate;

      await prisma.$executeRawUnsafe(
        `INSERT INTO leave_encashments (employee_id, month, leaves_count, per_day_rate, amount, type, attendance_date)
         VALUES ($1, $2, 1, $3, $4, 'leave_with_pay', $5)
         ON CONFLICT (employee_id, attendance_date) WHERE type = 'leave_with_pay' DO NOTHING`,
        employeeId, monthKey, perDayRate, amount, date
      );
    } else {
      await prisma.$executeRawUnsafe(
        `DELETE FROM leave_encashments
         WHERE employee_id = $1 AND attendance_date = $2 AND type = 'leave_with_pay'`,
        employeeId, date
      );
    }
  }
}

async function getMonthlyTotal(monthKey) {
  const rows = await summary({ month: monthKey || undefined });
  const total = round2(rows.reduce((s, r) => s + (r.amount || 0), 0));
  return {
    total,
    month: monthKey || null,
    count: rows.length,
    employees: rows.map(r => ({ empCode: r.empCode, name: r.name, amount: r.amount })),
  };
}

async function getEmployeeReport(employeeId) {
  await ensureTable();
  await ensureEmpColumns();

  const empRows = await prisma.$queryRawUnsafe(`
    SELECT id, "empCode", "firstName", "lastName", "salaryMonthly",
           COALESCE("leaveEncashmentMonthlyLeaves", 2) AS "leaveEncashmentMonthlyLeaves",
           COALESCE("leaveEncashmentRate", 0)          AS "leaveEncashmentRate",
           COALESCE("leaveEncashmentPastLeaves", 0)    AS "leaveEncashmentPastLeaves"
    FROM "Employee" WHERE id = $1
  `, Number(employeeId));
  const emp = empRows[0];
  if (!emp) throw Object.assign(new Error('Employee not found'), { statusCode: 404 });

  const nowKey = currentMonthKey();
  const monthlyLeaves = Number(emp.leaveEncashmentMonthlyLeaves) || 2;
  const basicSalary = Number(emp.salaryMonthly || 0);

  const breakdown = [];
  let cur = START_MONTH;
  while (cur <= nowKey) {
    const [cy, cm] = cur.split('-').map(Number);
    const days = daysInMonth(cur);
    const rate = days > 0 ? round2(basicSalary / days) : 0;
    breakdown.push({
      month: cur,
      label: new Date(cy, cm - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      leaves: monthlyLeaves,
      rate,
      amount: round2(monthlyLeaves * rate),
    });
    const next = new Date(cy, cm, 1);
    cur = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  }

  const issuedRows = await prisma.$queryRawUnsafe(`
    SELECT id, month, leaves_count, per_day_rate, amount, type, attendance_date, created_at
    FROM leave_encashments WHERE employee_id = $1
    ORDER BY month ASC, created_at ASC
  `, Number(employeeId));

  const issued = issuedRows.map(r => ({
    id: Number(r.id),
    month: r.month,
    leavesCount: round2(Number(r.leaves_count)),
    perDayRate: round2(Number(r.per_day_rate)),
    amount: round2(Number(r.amount)),
    type: r.type,
    attendanceDate: r.attendance_date,
  }));

  const totalAccumulated = round2(breakdown.reduce((s, r) => s + r.leaves, 0));
  const totalIssued = round2(issued.reduce((s, r) => s + r.leavesCount, 0));
  const totalAmountAccumulated = round2(breakdown.reduce((s, r) => s + r.amount, 0));
  const totalAmountIssued = round2(issued.reduce((s, r) => s + r.amount, 0));
  const pastLeaves = Number(emp.leaveEncashmentPastLeaves) || 0;
  const pastLeaveRate = Number(emp.leaveEncashmentRate) || 0;
  const pastLeavesValue = round2(pastLeaves * pastLeaveRate);

  return {
    employee: {
      id: Number(emp.id),
      empCode: emp.empCode,
      name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      basicSalary,
      monthlyLeaves,
      pastLeaves,
      pastLeaveRate,
      pastLeavesValue,
    },
    monthlyBreakdown: breakdown,
    issued,
    balance: {
      totalAccumulated,
      totalIssued,
      remainingLeaves: round2(Math.max(0, totalAccumulated - totalIssued)),
      totalAmountAccumulated,
      totalAmountIssued,
      remainingAmount: round2(Math.max(0, totalAmountAccumulated - totalAmountIssued)),
      pastLeaves,
      pastLeaveRate,
      pastLeavesValue,
    },
  };
}

async function remove(id) {
  await ensureTable();

  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM leave_encashments WHERE id = $1`,
    Number(id)
  );
  if (!existing.length) throw new Error('Record not found');

  await prisma.$executeRawUnsafe(`DELETE FROM leave_encashments WHERE id = $1`, Number(id));
}

module.exports = { summary, getBalance, getMonthlyTotal, getEmployeeReport, listRecords, create, syncAttendanceLeaves, remove };
