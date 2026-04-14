const prisma = require('./src/config/db');

function toDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dtAt(dateObj, hh, mm) {
  const d = new Date(dateObj);
  d.setUTCHours(hh, mm, 0, 0);
  return d;
}

async function main() {
  const empCode = '7777';
  console.log(`Seeding 2-month night-shift dataset for employee ${empCode}...`);

  let emp = await prisma.employee.findFirst({ where: { empCode } });
  if (emp) {
    await prisma.attendance.deleteMany({ where: { employeeId: emp.id } });
    await prisma.advanceLoan.deleteMany({ where: { employeeId: emp.id } });
    await prisma.gatepass.deleteMany({ where: { employeeId: emp.id } });
    await prisma.shortLeave.deleteMany({ where: { employeeId: emp.id } });
    await prisma.employee.delete({ where: { id: emp.id } });
    console.log(`Cleared existing employee ${empCode} and related records.`);
  }

  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  emp = await prisma.employee.create({
    data: {
      empCode,
      firstName: 'Night',
      lastName: 'Verifier',
      fatherName: 'Shift Controller',
      phone: '0300-7777777',
      address: 'Night Shift Street',
      appointmentDate: '2025-01-01',
      status: 'Active',
      role: 'Staff Nurse',
      salaryMonthly: 90000,
      allowances: [],
      dutyType: 'fixed',
      photo: tinyPng,
      dutyRoster: [
        { day: 'Mon', timeIn: '21:00', timeOut: '09:00', hours: 12 },
        { day: 'Tue', timeIn: '21:00', timeOut: '09:00', hours: 12 },
        { day: 'Wed', timeIn: '21:00', timeOut: '09:00', hours: 12 },
        { day: 'Thu', timeIn: '21:00', timeOut: '09:00', hours: 12 },
        { day: 'Fri', timeIn: '21:00', timeOut: '09:00', hours: 12 },
        { day: 'Sat', timeIn: '21:00', timeOut: '09:00', hours: 12 },
        { day: 'Sun', timeIn: 'OFF', timeOut: 'OFF', hours: 0 }
      ]
    }
  });

  const start = new Date(Date.UTC(2026, 2, 1)); // Mar 1, 2026
  const end = new Date(Date.UTC(2026, 4, 1));   // May 1, 2026 (exclusive)

  const records = [];

  for (let d = new Date(start); d < end; d = addDays(d, 1)) {
    const yyyyMmDd = toDateOnly(d);
    const day = d.getUTCDay(); // 0 Sunday

    // Sunday = Off day record
    if (day === 0) {
      records.push({
        employeeId: emp.id,
        date: new Date(`${yyyyMmDd}T00:00:00.000Z`),
        status: 'off',
        scheduledIn: null,
        scheduledOut: null,
        actualIn: null,
        actualOut: null,
        lateMinutes: 0,
        overtimeMinutes: 0,
        lateDeduction: 0,
        overtimeAmount: 0,
        netAdjustment: 0,
      });
      continue;
    }

    // Pattern for testing statuses
    const dayOfMonth = d.getUTCDate();
    let status = 'present';
    if (dayOfMonth % 9 === 0) status = 'absent';
    if (dayOfMonth % 13 === 0) status = 'holiday';

    // Scheduled always night shift for working days
    const scheduledIn = dtAt(d, 21, 0);
    const scheduledOut = dtAt(addDays(d, 1), 9, 0);

    let actualIn = null;
    let actualOut = null;

    if (status === 'present') {
      // Realistic slight variance around 21:00 -> 09:00
      const inMinute = (dayOfMonth % 2 === 0) ? 2 : 7;   // 21:02 / 21:07
      const outMinute = (dayOfMonth % 2 === 0) ? 53 : 10; // 08:53 / 09:10
      actualIn = dtAt(d, 21, inMinute);
      actualOut = dtAt(addDays(d, 1), 8, outMinute);
    }

    records.push({
      employeeId: emp.id,
      date: new Date(`${yyyyMmDd}T00:00:00.000Z`),
      status,
      scheduledIn,
      scheduledOut,
      actualIn,
      actualOut,
      lateMinutes: 0,
      overtimeMinutes: 0,
      lateDeduction: 0,
      overtimeAmount: 0,
      netAdjustment: 0,
    });
  }

  await prisma.attendance.createMany({ data: records });

  const total = await prisma.attendance.count({ where: { employeeId: emp.id } });
  const present = await prisma.attendance.count({ where: { employeeId: emp.id, status: 'present' } });
  const absent = await prisma.attendance.count({ where: { employeeId: emp.id, status: 'absent' } });
  const holiday = await prisma.attendance.count({ where: { employeeId: emp.id, status: 'holiday' } });
  const off = await prisma.attendance.count({ where: { employeeId: emp.id, status: 'off' } });

  const sample = await prisma.attendance.findFirst({
    where: { employeeId: emp.id, status: 'present' },
    orderBy: { date: 'asc' }
  });

  console.log('--- Seed Summary ---');
  console.log(`Employee: ${empCode} (${emp.firstName} ${emp.lastName})`);
  console.log(`Total Records: ${total}`);
  console.log(`Present: ${present}, Absent: ${absent}, Holiday: ${holiday}, Off: ${off}`);
  if (sample) {
    console.log(`Sample IN : ${sample.actualIn?.toISOString()}`);
    console.log(`Sample OUT: ${sample.actualOut?.toISOString()}`);
  }
  console.log('Done. Open Reports and search empCode 7777 for Mar/Apr 2026 payslip checks.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
