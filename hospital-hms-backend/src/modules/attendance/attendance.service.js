const prisma = require('../../config/db');
const { randomUUID } = require('crypto');
const { calcRatesFromMonthly, minutesBetween } = require('../../utils/helpers');

let isAttendanceOverridesTableReady = false;

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'y', 'on'].includes(normalized);
}

function normalizeDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  const direct = s.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (direct) return direct[1];
  const pref = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (pref) return pref[1];

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeTime(value) {
  if (value === undefined || value === null) return '';
  const s = String(value).trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return '';
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function normalizeNumberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeOverridePayload(payload = {}) {
  const empCode = String(payload.empCode || '').trim();
  const dateIn = normalizeDateOnly(payload.dateIn || payload.date);
  const dateOut = normalizeDateOnly(payload.dateOut);

  if (!empCode) {
    const err = new Error('empCode is required');
    err.status = 400;
    throw err;
  }
  if (!dateIn) {
    const err = new Error('dateIn is required (YYYY-MM-DD)');
    err.status = 400;
    throw err;
  }

  return {
    id: payload.id ? String(payload.id) : null,
    empCode,
    dateIn,
    dateOut,
    timeIn: normalizeTime(payload.timeIn),
    timeOut: normalizeTime(payload.timeOut),
    status: String(payload.status || 'present').trim() || 'present',
    manualWrkHrs: normalizeNumberOrNull(payload.manualWrkHrs),
    manualOvertime: normalizeNumberOrNull(payload.manualOvertime),
    manualDeduction: normalizeNumberOrNull(payload.manualDeduction),
    manualTotal: normalizeNumberOrNull(payload.manualTotal),
    waiveDeduction: normalizeBoolean(payload.waiveDeduction, false),
  };
}

function mapOverrideRow(row) {
  const dateIn = normalizeDateOnly(row?.date_in || row?.dateIn || row?.date);
  const dateOut = normalizeDateOnly(row?.date_out || row?.dateOut);
  return {
    id: String(row.id),
    empCode: String(row.emp_code || row.empCode || ''),
    date: dateIn,
    dateIn,
    dateOut,
    timeIn: row.time_in || row.timeIn || '',
    timeOut: row.time_out || row.timeOut || '',
    status: row.status || 'present',
    manualWrkHrs: row.manual_wrk_hrs ?? row.manualWrkHrs ?? null,
    manualOvertime: row.manual_overtime ?? row.manualOvertime ?? null,
    manualDeduction: row.manual_deduction ?? row.manualDeduction ?? null,
    manualTotal: row.manual_total ?? row.manualTotal ?? null,
    waiveDeduction: Boolean(row.waive_deduction ?? row.waiveDeduction),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  };
}

async function ensureAttendanceOverridesTable() {
  if (isAttendanceOverridesTableReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS attendance_overrides (
      id TEXT PRIMARY KEY,
      emp_code TEXT NOT NULL,
      date_in DATE NOT NULL,
      date_out DATE,
      time_in TEXT,
      time_out TEXT,
      status TEXT NOT NULL DEFAULT 'present',
      manual_wrk_hrs DOUBLE PRECISION,
      manual_overtime DOUBLE PRECISION,
      manual_deduction DOUBLE PRECISION,
      manual_total DOUBLE PRECISION,
      waive_deduction BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_attendance_overrides_emp_date ON attendance_overrides(emp_code, date_in)');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_attendance_overrides_date_in ON attendance_overrides(date_in)');

  isAttendanceOverridesTableReady = true;
}

async function listOverrides(filters = {}) {
  await ensureAttendanceOverridesTable();

  const conditions = [];
  const empCode = String(filters.empCode || '').trim();
  const month = Number.parseInt(String(filters.month || ''), 10);
  const year = Number.parseInt(String(filters.year || ''), 10);

  if (empCode) conditions.push(`emp_code = '${empCode.replace(/'/g, "''")}'`);
  if (Number.isInteger(month) && month >= 1 && month <= 12) {
    conditions.push(`EXTRACT(MONTH FROM date_in) = ${month}`);
  }
  if (Number.isInteger(year) && year >= 2000 && year <= 9999) {
    conditions.push(`EXTRACT(YEAR FROM date_in) = ${year}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await prisma.$queryRawUnsafe(`
    SELECT *
    FROM attendance_overrides
    ${whereClause}
    ORDER BY date_in ASC, created_at ASC
  `);

  return rows.map(mapOverrideRow);
}

async function upsertOverride(payload = {}) {
  await ensureAttendanceOverridesTable();
  const normalized = normalizeOverridePayload(payload);
  const id = normalized.id || randomUUID();

  await prisma.$executeRaw`
    INSERT INTO attendance_overrides (
      id, emp_code, date_in, date_out, time_in, time_out, status,
      manual_wrk_hrs, manual_overtime, manual_deduction, manual_total,
      waive_deduction, created_at, updated_at
    ) VALUES (
      ${id},
      ${normalized.empCode},
      ${normalized.dateIn}::date,
  ${normalized.dateOut},
      ${normalized.timeIn},
      ${normalized.timeOut},
      ${normalized.status},
      ${normalized.manualWrkHrs},
      ${normalized.manualOvertime},
      ${normalized.manualDeduction},
      ${normalized.manualTotal},
      ${normalized.waiveDeduction},
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      emp_code = EXCLUDED.emp_code,
      date_in = EXCLUDED.date_in,
      date_out = EXCLUDED.date_out,
      time_in = EXCLUDED.time_in,
      time_out = EXCLUDED.time_out,
      status = EXCLUDED.status,
      manual_wrk_hrs = EXCLUDED.manual_wrk_hrs,
      manual_overtime = EXCLUDED.manual_overtime,
      manual_deduction = EXCLUDED.manual_deduction,
      manual_total = EXCLUDED.manual_total,
      waive_deduction = EXCLUDED.waive_deduction,
      updated_at = NOW()
  `;

  const [saved] = await prisma.$queryRaw`
    SELECT * FROM attendance_overrides WHERE id = ${id}
  `;

  return mapOverrideRow(saved);
}

async function bulkUpsertOverrides(rows = []) {
  if (!Array.isArray(rows)) {
    const err = new Error('rows must be an array');
    err.status = 400;
    throw err;
  }

  const saved = [];
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop
    const item = await upsertOverride(row);
    saved.push(item);
  }
  return saved;
}

async function replaceOverridesForDates(payload = {}) {
  await ensureAttendanceOverridesTable();

  const empCode = String(payload.empCode || '').trim();
  if (!empCode) {
    const err = new Error('empCode is required');
    err.status = 400;
    throw err;
  }

  const dates = Array.from(new Set((Array.isArray(payload.dates) ? payload.dates : [])
    .map((d) => normalizeDateOnly(d))
    .filter(Boolean)));

  if (!dates.length) {
    const err = new Error('dates are required');
    err.status = 400;
    throw err;
  }

  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const normalizedRows = rows.map((row) => {
    const normalized = normalizeOverridePayload({ ...row, empCode: row.empCode || empCode });
    if (normalized.empCode !== empCode) {
      const err = new Error('All rows must belong to same empCode');
      err.status = 400;
      throw err;
    }
    return { ...normalized, id: normalized.id || randomUUID() };
  });

  await prisma.$transaction(async (tx) => {
    for (const dateIn of dates) {
      // eslint-disable-next-line no-await-in-loop
      await tx.$executeRaw`
        DELETE FROM attendance_overrides
        WHERE emp_code = ${empCode}
          AND date_in = ${dateIn}::date
      `;
    }

    for (const row of normalizedRows) {
      // eslint-disable-next-line no-await-in-loop
      await tx.$executeRaw`
        INSERT INTO attendance_overrides (
          id, emp_code, date_in, date_out, time_in, time_out, status,
          manual_wrk_hrs, manual_overtime, manual_deduction, manual_total,
          waive_deduction, created_at, updated_at
        ) VALUES (
          ${row.id},
          ${row.empCode},
          ${row.dateIn}::date,
          ${row.dateOut},
          ${row.timeIn},
          ${row.timeOut},
          ${row.status},
          ${row.manualWrkHrs},
          ${row.manualOvertime},
          ${row.manualDeduction},
          ${row.manualTotal},
          ${row.waiveDeduction},
          NOW(),
          NOW()
        )
      `;
    }
  });

  return listOverrides({ empCode });
}

async function list() {
  return prisma.attendance.findMany({
    orderBy: { date: 'desc' },
    include: { employee: true }
  });
}

// ─── HELPER: Minutes between two dates ───────────────────────────────────────
function minsBetween(a, b) {
  if (!a || !b) return 0;
  const diff = (new Date(b) - new Date(a)) / 60000;
  return diff > 0 ? Math.round(diff) : 0;
}

// ─── HELPER: Night shift cross-midnight fix ───────────────────────────────────
// Sirf tab +1 day karo jab ACTUALLY cout < cin ho (raw times)
// Agar already +1 day lag chuka hai (DB se aa raha hai) toh dobara mat lagao
function fixCrossMidnight(inTime, outTime) {
  const cin  = inTime  ? new Date(inTime)  : null;
  const cout = outTime ? new Date(outTime) : null;

  if (cin && cout && cout < cin) {
    cout.setDate(cout.getDate() + 1);
  }

  return { cin, cout };
}

// ─── HELPER: Roster se scheduled minutes nikalo ───────────────────────────────
// Agar DB mein scheduledIn/scheduledOut null hain (sync se aaya record)
// toh employee ke dutyRoster se calculate karo
function getRosterMinutes(employee, dateObj) {
  if (!employee?.dutyRoster || !Array.isArray(employee.dutyRoster)) return 0;
  
  const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayKey = dayMap[new Date(dateObj).getDay()];
  const roster = employee.dutyRoster.find(d => d.day === dayKey);
  
  if (!roster) return 0;
  if (roster.hours !== undefined && Number(roster.hours) > 0) {
    return Number(roster.hours) * 60;
  }
  if (roster.timeIn && roster.timeOut && roster.timeIn !== 'OFF' && roster.timeOut !== 'OFF') {
    const diff = (new Date(`1970-01-01T${roster.timeOut}`) - new Date(`1970-01-01T${roster.timeIn}`)) / 60000;
    return diff > 0 ? diff : 0;
  }
  return 0;
}

// ─── SHARED: Salary calculations ─────────────────────────────────────────────
function calcAttendanceFields({ status, sIn, sOut, aIn, aOut, perMinute, scheduledMinutesOverride }) {
  const currentStatus = status || 'present';

  let lateMinutes      = 0;
  let scheduledMinutes = 0;
  let workedMinutes    = 0;
  let overtimeMinutes  = 0;

  // Worked minutes — actual time kaam kiya
  if (aIn && aOut) {
    workedMinutes = minsBetween(aIn, aOut);
  }

  // Scheduled minutes — roster ya scheduledIn/Out se
  if (sIn && sOut) {
    scheduledMinutes = minsBetween(sIn, sOut);
  } else if (scheduledMinutesOverride > 0) {
    // DB mein scheduledIn/Out null hain — roster se lo
    scheduledMinutes = scheduledMinutesOverride;
  }

  // Late minutes — sirf present ke liye
  if (aIn && sIn && new Date(aIn) > new Date(sIn)) {
    lateMinutes = minsBetween(sIn, aIn);
  }

  if (currentStatus === 'off_not_avail' || currentStatus === 'holiday_not_avail') {
    // Off day par aaya — poora din overtime
    overtimeMinutes  = workedMinutes;
    lateMinutes      = 0;
    scheduledMinutes = 0;
  } else if (currentStatus === 'off_avail' || currentStatus === 'holiday_avail') {
    // Off day — salary milti hai, OT nahi
    lateMinutes      = 0;
    overtimeMinutes  = 0;
    scheduledMinutes = 0;
  } else if (currentStatus === 'absent' || currentStatus === 'leave') {
    workedMinutes    = 0;
    lateMinutes      = 0;
    overtimeMinutes  = 0;
  } else {
    // Normal present — sirf scheduled se zyada waqt OT hai
    overtimeMinutes = workedMinutes > scheduledMinutes
      ? workedMinutes - scheduledMinutes
      : 0;
  }

  const lateDeduction  = lateMinutes     * perMinute;
  const overtimeAmount = overtimeMinutes * perMinute;
  const netAdjustment  = overtimeAmount  - lateDeduction;

  return {
    lateMinutes,
    scheduledMinutes,
    workedMinutes,
    overtimeMinutes,
    lateDeduction,
    overtimeAmount,
    netAdjustment,
  };
}

// ─── CREATE ───────────────────────────────────────────────────────────────────
async function create(payload) {
  const {
    employeeId, scheduledIn, scheduledOut,
    actualIn, actualOut, monthlySalary,
    note, date, status
  } = payload;

  const { perMinute } = calcRatesFromMonthly(monthlySalary || 30000);

  const { cin: sIn, cout: sOut } = fixCrossMidnight(scheduledIn, scheduledOut);
  const { cin: aIn, cout: aOut } = fixCrossMidnight(actualIn, actualOut);

  const fields = calcAttendanceFields({
    status: status || 'present',
    sIn, sOut, aIn, aOut,
    perMinute,
    scheduledMinutesOverride: 0,
  });

  return prisma.attendance.create({
    data: {
      employeeId:    parseInt(employeeId),
      date:          date ? new Date(date) : new Date(),
      scheduledIn:   sIn,
      scheduledOut:  sOut,
      actualIn:      aIn,
      actualOut:     aOut,
      status:        status || 'present',
      ...fields,
      note,
    }
  });
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────
async function update(id, payload) {
  const existing = await prisma.attendance.findUnique({
    where:   { id: parseInt(id) },
    include: { employee: true },  // roster ke liye employee bhi lo
  });
  if (!existing) throw new Error("Attendance record not found");

  // Payload se lo, warna DB wala use karo
  const rawSchIn  = payload.scheduledIn  !== undefined ? payload.scheduledIn  : existing.scheduledIn;
  const rawSchOut = payload.scheduledOut !== undefined ? payload.scheduledOut : existing.scheduledOut;
  const rawActIn  = payload.actualIn     !== undefined ? payload.actualIn     : existing.actualIn;
  const rawActOut = payload.actualOut    !== undefined ? payload.actualOut     : existing.actualOut;
  const status    = payload.status       !== undefined ? payload.status        : existing.status;

  const monthlySalary = payload.monthlySalary || 30000;
  const { perMinute } = calcRatesFromMonthly(monthlySalary);

  // Night shift crossing fix
  const { cin: sIn, cout: sOut } = fixCrossMidnight(rawSchIn, rawSchOut);
  const { cin: aIn, cout: aOut } = fixCrossMidnight(rawActIn, rawActOut);

  // Agar scheduledIn/Out null hain (sync se aaya record) toh roster se lo
  let scheduledMinutesOverride = 0;
  if (!sIn || !sOut) {
    scheduledMinutesOverride = getRosterMinutes(existing.employee, existing.date);
  }

  const fields = calcAttendanceFields({
    status,
    sIn, sOut, aIn, aOut,
    perMinute,
    scheduledMinutesOverride,
  });

  return prisma.attendance.update({
    where: { id: parseInt(id) },
    data: {
      scheduledIn:  sIn,
      scheduledOut: sOut,
      actualIn:     aIn,
      actualOut:    aOut,
      status,
      ...fields,
      note: payload.note !== undefined ? payload.note : existing.note,
    }
  });
}

module.exports = {
  list,
  create,
  update,
  listOverrides,
  upsertOverride,
  bulkUpsertOverrides,
  replaceOverridesForDates,
};