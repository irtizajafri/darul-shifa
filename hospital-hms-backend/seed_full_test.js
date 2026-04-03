const prisma = require('./src/config/db');

async function main() {
  const empCode = "5555";
  console.log(`Starting full end-to-end test seed for Employee ${empCode}...`);

  // Clear existing to avoid unique constraint issues
  let emp = await prisma.employee.findFirst({ where: { empCode } });
  if (emp) {
    await prisma.attendance.deleteMany({ where: { employeeId: emp.id } });
    await prisma.advanceLoan.deleteMany({ where: { employeeId: emp.id } });
    await prisma.gatepass.deleteMany({ where: { employeeId: emp.id } });
    await prisma.shortLeave.deleteMany({ where: { employeeId: emp.id } });
    await prisma.employee.delete({ where: { id: emp.id } });
    console.log(`Cleared existing data for ${empCode}.`);
  }

  // 1. Create Employee
  // Tiny 1x1 transparent PNG base64 for photo test
  const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  
  emp = await prisma.employee.create({
    data: {
      empCode,
      firstName: "Master",
      lastName: "Tester",
      fatherName: "Test Father",
      address: "123 Security Blvd",
      dob: "1985-05-05",
      phone: "0300-1234567",
      appointmentDate: "2024-01-01",
      salaryMonthly: 120000, 
      allowances: [],
      dutyType: "fixed",
      photo: tinyPng,
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
  console.log(`1. Created Employee ${empCode} with Photo, 120k Salary, and 8hr fixed roster.`);

  // 2. Create Attendance (March 2026 - 31 Days)
  // Let's make him late 1 day, absent 1 day. Standard timing otherwise.
  const attendances = [];
  for (let i = 1; i <= 31; i++) {
    const d = new Date(Date.UTC(2026, 2, i)); // March (0-indexed month=2)
    const isSunday = d.getUTCDay() === 0;

    let timeIn = new Date(d);
    timeIn.setUTCHours(8, 0, 0); // 08:00 normally
    let timeOut = new Date(d);
    timeOut.setUTCHours(16, 0, 0); // 16:00 normally
    let status = isSunday ? "holiday" : "present";

    // 5th March: Late by 2 hours (10:00)
    if (i === 5) {
      timeIn.setUTCHours(10, 0, 0);
    }
    
    // 10th March: Absent
    if (i === 10) {
      status = "absent";
      timeIn = null;
      timeOut = null;
    }

    if (!isSunday) {
      attendances.push({
        employeeId: emp.id,
        date: d,
        status,
        scheduledIn: new Date(d).setUTCHours(8, 0, 0) ? new Date(new Date(d).setUTCHours(8,0,0)) : null,
        scheduledOut: new Date(d).setUTCHours(16, 0, 0) ? new Date(new Date(d).setUTCHours(16,0,0)) : null,
        actualIn: timeIn,
        actualOut: timeOut,
      });
    }
  }
  await prisma.attendance.createMany({ data: attendances });
  console.log(`2. Created Attendance: 31 days (1 Late, 1 Absent).`);

  // 3. Create Advance (5,000 deduction this month)
  // Store reason with schedule to match the format of Reports.jsx
  const advanceSchedule = [{ month: "2026-02", amount: 5000 }, { month: "2026-03", amount: 5000 }];
  await prisma.advanceLoan.create({
    data: {
      employeeId: emp.id,
      amount: 10000,
      type: "advance",
      status: "Active", // Needs to match 'active' in filter
      reason: JSON.stringify({ schedule: advanceSchedule, reason: "Need cash" })
    }
  });
  console.log(`3. Created Advance: 10,000 total, 5,000 scheduled for deduction in 2026-03.`);

  // 4. Create Loan (10,000 deduction this month)
  const loanSchedule = [{ month: "2026-03", amount: 10000 }, { month: "2026-04", amount: 10000 }];
  await prisma.advanceLoan.create({
    data: {
      employeeId: emp.id,
      amount: 20000,
      type: "loan",
      status: "Active",
      reason: JSON.stringify({ schedule: loanSchedule, reason: "Car repair" })
    }
  });
  console.log(`4. Created Loan: 20,000 total, 10,000 scheduled for deduction in 2026-03.`);

  // 5. Create Gatepass (Issued and Closed) - Suppose 1 hour was taken personal
  await prisma.gatepass.create({
    data: {
      employeeId: emp.id,
      issuedAt: new Date("2026-03-15T12:00:00.000Z"),
      validTill: new Date("2026-03-15T13:30:00.000Z"), // 1.5 hours gatepass
      status: "closed",
      reason: JSON.stringify({ nature: "Personal", purpose: "Lunch", permissionBy: "HR" })
    }
  });
  console.log(`5. Created closed Gatepass (1.5 hours personal).`);

  // 6. Create Shortleave (2 hours)
  await prisma.shortLeave.create({
    data: {
      employeeId: emp.id,
      fromTime: new Date("2026-03-20T14:00:00.000Z"),
      toTime: new Date("2026-03-20T16:00:00.000Z"), // 2 hours
      status: "approved",
      reason: "Doctor appointment"
    }
  });
  console.log(`6. Created approved Shortleave (2 hours).`);

  console.log("\nSuccess! E2E Test data seeded.");
  console.log("Check the Reports page for Mar 2026 -> Employee 5555.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
