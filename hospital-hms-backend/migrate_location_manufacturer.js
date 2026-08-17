const prisma = require('./src/config/db');

async function main() {
  console.log('Running migration: add location to InventoryGD, manufacturer/model to InventoryGRN...');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "InventoryGRN"
    ADD COLUMN IF NOT EXISTS "manufacturer" TEXT,
    ADD COLUMN IF NOT EXISTS "model" TEXT;
  `);
  console.log('✅ InventoryGRN: manufacturer, model added');

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "InventoryGD"
    ADD COLUMN IF NOT EXISTS "location" TEXT;
  `);
  console.log('✅ InventoryGD: location added');

  console.log('Migration complete!');
}

main()
  .catch((e) => { console.error('Migration failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
