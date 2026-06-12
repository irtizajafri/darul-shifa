const prisma = require('../../config/db');

const START_MONTH = '2026-06';
let isTableReady = false;

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

  const employees = await prisma.employee.findMany({
    orderBy: { empCode: 'asc' },
  });

  const usedRows = await prisma.$queryRawUnsafe(`
    SELECT employee_id, SUM(leaves_count) AS total_used
    FROM leave_encashments
    GROUP BY employee_id
  `);
  const usedMap = new Map(usedRows.map((r) => [Number(r.employee_id), round2(r.total_used)]));

  const nowKey = currentMonthKey();
  const elapsed = monthsElapsed(START_MONTH, nowKey);
  const accumulated = elapsed * 2;

  let rows = employees.map((emp) => {
    const basicSalary = Number(emp.salaryMonthly || 0);
    const days = daysInMonth(nowKey);
    const perDayRate = days > 0 ? round2(basicSalary / days) : 0;
    const used = usedMap.get(emp.id) || 0;
    const available = Math.max(0, round2(accumulated - used));
    const amount = round2(available * perDayRate);

    return {
      employeeId: emp.id,
      empCode: emp.empCode || '',
      name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      designation: emp.role || '',
      department: emp.departmentText || '',
      months: elapsed,
      accumulatedLeaves: accumulated,
      usedLeaves: used,
      availableLeaves: available,
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
    rows = rows.map((r) => {
      const perDayRate = mDays > 0 ? round2(r.basicSalary / mDays) : 0;
      return { ...r, perDayRate, amount: round2(2 * perDayRate) };
    });
  }

  return rows;
}

async function getBalance(employeeId) {
  await ensureTable();

  const emp = await prisma.employee.findUnique({ where: { id: Number(employeeId) } });
  if (!emp) throw Object.assign(new Error('Employee not found'), { statusCode: 404 });

  const usedRows = await prisma.$queryRawUnsafe(
    `SELECT SUM(leaves_count) AS total_used FROM leave_encashments WHERE employee_id = $1`,
    Number(employeeId)
  );
  const used = round2(usedRows[0]?.total_used || 0);
  const nowKey = currentMonthKey();
  const elapsed = monthsElapsed(START_MONTH, nowKey);
  const accumulated = elapsed * 2;
  const available = Math.max(0, round2(accumulated - used));
  const basicSalary = Number(emp.salaryMonthly || 0);
  const days = daysInMonth(nowKey);
  const perDayRate = days > 0 ? round2(basicSalary / days) : 0;

  return {
    employeeId: emp.id,
    empCode: emp.empCode || '',
    name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
    designation: emp.role || '',
    department: emp.departmentText || '',
    basicSalary,
    perDayRate,
    months: elapsed,
    accumulatedLeaves: accumulated,
    usedLeaves: used,
    availableLeaves: available,
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

async function remove(id) {
  await ensureTable();

  const existing = await prisma.$queryRawUnsafe(
    `SELECT id FROM leave_encashments WHERE id = $1`,
    Number(id)
  );
  if (!existing.length) throw new Error('Record not found');

  await prisma.$executeRawUnsafe(`DELETE FROM leave_encashments WHERE id = $1`, Number(id));
}

module.exports = { summary, getBalance, listRecords, create, syncAttendanceLeaves, remove };
