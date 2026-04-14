const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emp = await prisma.employee.findFirst({
    where: { empCode: '2341' }
  });
  if (!emp) {
    console.log("No emp found for 2341");
    return;
  }
  console.log(`Found Employee: ${emp.firstName} ${emp.lastName}`);
  const att = await prisma.attendance.findMany({
    where: { employeeId: emp.id }
  });
  const filtered = att.filter(a => a.date && a.date.toISOString().startsWith('2026-04'));
  console.log("April Attendance:", filtered.slice(0, 5));
}
main().then(() => prisma.$disconnect()).catch(console.error);
