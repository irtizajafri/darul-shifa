const prisma = require('./src/config/db');

async function main() {
  // Check if emp 251 already exists
  let emp = await prisma.employee.findFirst({ where: { empCode: "251" } });
  
  if (!emp) {
    emp = await prisma.employee.create({
      data: {
        empCode: "251",
        firstName: "SYED Farhat Ata",
        lastName: "Zaidi",
        fatherName: "Syed Abu Jaffar Zaidi",
        address: "A-93/22, S.no. 640 J.T.C.H.S, Mlir",
        dob: "1961-03-13",
        phone: "021-34408291",
        appointmentDate: "1993-10-16",
        salaryMonthly: 35000,
        allowances: [
          { type: "Conveyance", amount: 5000 },
          { type: "House Rent", amount: 5000 },
          { type: "Medical", amount: 10000 },
          { type: "PG Allowance", amount: 11000 }
        ],
        dutyType: "normal",
        dutyRoster: [
          { day: "Mon", timeIn: "08:00", timeOut: "16:00", hours: 8 },
          { day: "Tue", timeIn: "08:00", timeOut: "16:00", hours: 8 },
          { day: "Wed", timeIn: "08:00", timeOut: "16:00", hours: 8 },
          { day: "Thu", timeIn: "08:00", timeOut: "16:00", hours: 8 },
          { day: "Fri", timeIn: "08:00", timeOut: "16:00", hours: 8 },
          { day: "Sat", timeIn: "08:00", timeOut: "16:00", hours: 8 },
          { day: "Sun", timeIn: "OFF", timeOut: "OFF", hours: 0 }
        ],
        status: "Active"
      }
    });
    console.log("Created Employee 251");
  } else {
    console.log("Employee 251 already exists");
  }

  // Generate 30 days of attendance
  // Assuming March 2026
  const startDate = new Date('2026-03-01T00:00:00.000Z');
  const attendances = [];

  for (let i = 0; i < 30; i++) {
    const d = new Date(startDate);
    d.setUTCDate(d.getUTCDate() + i);

    // Skip Sundays (0)
    if (d.getUTCDay() === 0) continue; 

    const actualIn = new Date(d);
    actualIn.setUTCHours(8, Math.floor(Math.random() * 10), 0); // 08:00 - 08:09
    
    const actualOut = new Date(d);
    actualOut.setUTCHours(16, 5 + Math.floor(Math.random() * 15), 0); // 16:05 - 16:20

    attendances.push({
      employeeId: emp.id,
      date: d,
      status: "present",
      scheduledIn: new Date(new Date(d).setUTCHours(8, 0, 0)),
      scheduledOut: new Date(new Date(d).setUTCHours(16, 0, 0)),
      actualIn: actualIn,
      actualOut: actualOut,
      lateMinutes: 0,
      overtimeMinutes: 0,
      lateDeduction: 0,
      overtimeAmount: 0,
      netAdjustment: 0,
    });
  }

  // Delete existing attendance for this employee if running again
  await prisma.attendance.deleteMany({
    where: { employeeId: emp.id }
  });

  await prisma.attendance.createMany({
    data: attendances
  });

  console.log(`Created ${attendances.length} attendance records for Employee 251`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
