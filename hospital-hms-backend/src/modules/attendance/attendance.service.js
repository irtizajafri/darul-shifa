const prisma = require('../../config/db');
const { calcRatesFromMonthly, minutesBetween } = require('../../utils/helpers');

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

module.exports = { list, create, update };