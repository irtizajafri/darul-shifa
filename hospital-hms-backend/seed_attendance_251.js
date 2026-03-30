const prisma = require('./src/config/db.js');

async function seedAttendance() {
  console.log("Seeding 30 days of attendance for Employee 251...");
  
  const employee = await prisma.employee.findFirst({
    where: { empCode: '251' }
  });

  if (!employee) {
    console.log("Employee 251 not found in DB! Please make sure it's added.");
    process.exit(1);
  }

  const attendanceData = [];
  const baseDate = new Date('2025-03-01T00:00:00Z');

  for (let i = 0; i < 30; i++) {
    const currentDate = new Date(baseDate);
    currentDate.setDate(baseDate.getDate() + i);
    
    // Skip Sundays if needed, but let's give him full presence for testing
    // Roster is 08:00 to 16:00
    // Let's add slight variations
    const timeInVar = Math.floor(Math.random() * 15); // 0 to 15 mins
    const timeOutVar = Math.floor(Math.random() * 30); // 0 to 30 mins late leave
    
    // Mostly present, maybe 1 leave or absent
    const status = (i === 15) ? 'absent' : 'present';
    const timeIn = status === 'present' ? `08:${timeInVar.toString().padStart(2, '0')}` : null;
    const timeOut = status === 'present' ? `16:${timeOutVar.toString().padStart(2, '0')}` : null;
    
    // let's do a strict override so it has clean data
    attendanceData.push({
      employeeId: employee.id,
      date: currentDate,
      status: status,
      timeIn: timeIn ? new Date(`${currentDate.toISOString().split('T')[0]}T${timeIn}:00Z`) : null,
      timeOut: timeOut ? new Date(`${currentDate.toISOString().split('T')[0]}T${timeOut}:00Z`) : null,
      lateMinutes: timeInVar,
      overtimeMinutes: timeOutVar,
    });
  }

  for (const record of attendanceData) {
    await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: record.employeeId,
          date: record.date
        }
      },
      update: record,
      create: record
    });
  }

  console.log("Successfully seeded 30 days of attendance for Farhat (251)!");
}

seedAttendance()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
