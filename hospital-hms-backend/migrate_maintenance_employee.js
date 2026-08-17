const prisma = require('./src/config/db');
async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "InventoryMaintenance"
    ADD COLUMN IF NOT EXISTS "employeeId" INTEGER,
    ADD COLUMN IF NOT EXISTS "printedBy" TEXT,
    ADD COLUMN IF NOT EXISTS "generatedAt" TIMESTAMP;
  `);
  console.log('✅ InventoryMaintenance: employeeId, printedBy, generatedAt columns added');
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
