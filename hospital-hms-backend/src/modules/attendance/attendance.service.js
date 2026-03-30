const prisma = require('../../config/db');
const { calcRatesFromMonthly, minutesBetween } = require('../../utils/helpers');

async function list() {
  return prisma.attendance.findMany({
    orderBy: { date: 'desc' },
    include: { employee: true }
  });
}


async function create(payload) {
  const { employeeId, scheduledIn, scheduledOut, actualIn, actualOut, monthlySalary, note, date } = payload;
  const { perMinute } = calcRatesFromMonthly(monthlySalary);

  const lateMinutes = actualIn && scheduledIn && new Date(actualIn) > new Date(scheduledIn)
    ? minutesBetween(scheduledIn, actualIn)
    : 0;

  const scheduledMinutes = minutesBetween(scheduledIn, scheduledOut);
  const workedMinutes = minutesBetween(actualIn, actualOut);
  const overtimeMinutes = workedMinutes > scheduledMinutes ? workedMinutes - scheduledMinutes : 0;

  const lateDeduction = lateMinutes * perMinute;
  const overtimeAmount = overtimeMinutes * perMinute;
  const netAdjustment = overtimeAmount - lateDeduction;

  const atDate = date ? new Date(date) : new Date();

  return prisma.attendance.create({
    data: {
      employeeId: parseInt(employeeId),
      date: atDate,
      scheduledIn: scheduledIn ? new Date(scheduledIn) : null,
      scheduledOut: scheduledOut ? new Date(scheduledOut) : null,
      actualIn: actualIn ? new Date(actualIn) : null,
      actualOut: actualOut ? new Date(actualOut) : null,
      lateMinutes,
      overtimeMinutes,
      lateDeduction,
      overtimeAmount,
      netAdjustment,
      note,
    }
  });
}

module.exports = {
  list,
  create
};
