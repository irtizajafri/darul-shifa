const prisma = require('./src/config/db');

async function main() {
  let emp = await prisma.employee.findFirst({ where: { empCode: "999" } });
  
  if (!emp) {
    emp = await prisma.employee.create({
      data: {
        empCode: "999",
        firstName: "Test",
        lastName: "DualShift",
        fatherName: "Test Father",
        address: "Test Address",
        dob: "1990-01-01",
        phone: "000-0000000",
        appointmentDate: "2020-01-01",
        salaryMonthly: 60000, // 2000 per day (for 30 days)
        allowances: [],
        dutyType: "split",
        dutyRoster: [
          { day: "Mon", splitShift: true, timeIn: "08:00", shift1End: "14:00", shift1Hours: 6, shift2Start: "16:00", timeOut: "22:00", shift2Hours: 6, hours: 12 },
          { day: "Tue", splitShift: true, timeIn: "08:00", shift1End: "14:00", shift1Hours: 6, shift2Start: "16:00", timeOut: "22:00", shift2Hours: 6, hours: 12 },
          { day: "Wed", splitShift: true, timeIn: "08:00", shift1End: "14:00", shift1Hours: 6, shift2Start: "16:00", timeOut: "22:00", shift2Hours: 6, hours: 12 },
          { day: "Thu", splitShift: true, timeIn: "08:00", shift1End: "14:00", shift1Hours: 6, shift2Start: "16:00", timeOut: "22:00", shift2Hours: 6, hours: 12 },
          { day: "Fri", splitShift: true, timeIn: "08:00", shift1End: "14:00", shift1Hours: 6, shift2Start: "16:00", timeOut: "22:00", shift2Hours: 6, hours: 12 },
          { day: "Sat", splitShift: true, timeIn: "08:00", shift1End: "14:00", shift1Hours: 6, shift2Start: "16:00", timeOut: "22:00", shift2Hours: 6, hours: 12 },
          { day: "Sun", splitShift: false, timeIn: "OFF", timeOut: "OFF", hours: 0 }
        ],
        status: "Active"
      }
    });
    console.log("Created Employee 999 (Dual Shift)");
  } else {
    console.log("Employee 999 already exists");
  }

  const startDate = new Date('2026-03-01T00:00:00.000Z');
  const attendances = [];

  for (let i = 0; i < 30; i++) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);

    if (d.getUTCDay() === 0) continue; 

    // Simulation: comes at 07:55, leaves at 22:15
    const actualIn = new Date(d);
    actualIn.setUTCHours(7, 55, 0); 
    
    const actualOut = new Date(d);
    actualOut.setUTCHours(22, 15, 0); 

    attendances.push({
      employeeId: emp.id,
      date: d,
      status: "present",
      scheduledIn: new Date(new Date(d).setUTCHours(8, 0, 0)),
      scheduledOut: new Date(new Date(d).setUTCHours(22, 0, 0)),
      actualIn: actualIn,
      actualOut: actualOut,
      lateMinutes: 0,
      overtimeMinutes: 0,
      lateDeduction: 0,
      overtimeAmount: 0,
      netAdjustment: 0,
    });
  }

  await prisma.attendance.deleteMany({
    where: { employeeId: emp.id }
  });

  await prisma.attendance.createMany({
    data: attendances
  });

  console.log(`Created ${attendances.length} dual-shift attendance records for Employee 999`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
