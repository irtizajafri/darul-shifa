const prisma = require('./src/config/db.js');

async function main() {
  console.log('Deleting all Attendance records...');
  await prisma.attendance.deleteMany({});

  console.log('Deleting all Employee records...');
  await prisma.employee.deleteMany({});

  console.log('Database cleared successfully! (Users are kept so you can still log in)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
