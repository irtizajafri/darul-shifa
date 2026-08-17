/**
 * MRN Migration — InventoryMRN + InventoryMRNItem tables banata hai
 * Run: node migrate_mrn.js
 */
const prisma = require('./src/config/db');

async function main() {
  console.log('📦 Creating InventoryMRN table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "InventoryMRN" (
      "id"           SERIAL PRIMARY KEY,
      "code"         TEXT NOT NULL,
      "ginId"        INTEGER NOT NULL REFERENCES "InventoryGIN"("id"),
      "departmentId" INTEGER NOT NULL REFERENCES "InventoryDepartment"("id"),
      "returnDate"   TIMESTAMP(3) NOT NULL,
      "receivedBy"   TEXT,
      "notes"        TEXT,
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "InventoryMRN_code_key" UNIQUE ("code")
    )
  `);

  console.log('📦 Creating InventoryMRNItem table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "InventoryMRNItem" (
      "id"          SERIAL PRIMARY KEY,
      "mrnId"       INTEGER NOT NULL REFERENCES "InventoryMRN"("id") ON DELETE CASCADE,
      "itemId"      INTEGER NOT NULL REFERENCES "InventoryItem"("id"),
      "ginItemId"   INTEGER,
      "returnedQty" DOUBLE PRECISION NOT NULL,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('📦 Creating indexes...');
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InventoryMRN_ginId_idx"        ON "InventoryMRN"("ginId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InventoryMRN_departmentId_idx" ON "InventoryMRN"("departmentId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InventoryMRN_returnDate_idx"   ON "InventoryMRN"("returnDate")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InventoryMRNItem_mrnId_idx"    ON "InventoryMRNItem"("mrnId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InventoryMRNItem_itemId_idx"   ON "InventoryMRNItem"("itemId")`);

  console.log('✅ MRN migration complete!');
}

main()
  .catch((e) => { console.error('❌ Migration failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
