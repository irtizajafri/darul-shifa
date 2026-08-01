const prisma = require('./src/config/db');

async function main() {
  // 1. Create FuelGenerator table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FuelGenerator" (
      "id"        SERIAL PRIMARY KEY,
      "name"      TEXT NOT NULL,
      "modelNo"   TEXT,
      "serialNo"  TEXT,
      "location"  TEXT,
      "status"    TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Add generatorId to FuelGeneratorEntry (nullable)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "FuelGeneratorEntry"
    ADD COLUMN IF NOT EXISTS "generatorId" INTEGER
  `);

  // 3. Add generatorId to GeneratorDailySheet (nullable)
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "GeneratorDailySheet"
    ADD COLUMN IF NOT EXISTS "generatorId" INTEGER
  `);

  // 4. Insert a default generator for existing data
  await prisma.$executeRawUnsafe(`
    INSERT INTO "FuelGenerator" ("name", "status", "createdAt", "updatedAt")
    SELECT 'Main Generator', 'active', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM "FuelGenerator" LIMIT 1)
  `);

  // 5. Assign existing rows to default generator
  const gen = await prisma.$queryRaw`SELECT id FROM "FuelGenerator" ORDER BY id ASC LIMIT 1`;
  const defaultId = gen[0]?.id;
  if (defaultId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "FuelGeneratorEntry" SET "generatorId" = ${defaultId} WHERE "generatorId" IS NULL`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "GeneratorDailySheet" SET "generatorId" = ${defaultId} WHERE "generatorId" IS NULL`
    );
  }

  // 6. Add FK constraint (only if not exists)
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'FuelGeneratorEntry_generatorId_fkey'
      ) THEN
        ALTER TABLE "FuelGeneratorEntry"
        ADD CONSTRAINT "FuelGeneratorEntry_generatorId_fkey"
        FOREIGN KEY ("generatorId") REFERENCES "FuelGenerator"("id") ON DELETE SET NULL;
      END IF;
    END $$
  `);

  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'GeneratorDailySheet_generatorId_fkey'
      ) THEN
        ALTER TABLE "GeneratorDailySheet"
        ADD CONSTRAINT "GeneratorDailySheet_generatorId_fkey"
        FOREIGN KEY ("generatorId") REFERENCES "FuelGenerator"("id") ON DELETE SET NULL;
      END IF;
    END $$
  `);

  console.log('✅ Migration done. Default generator created and existing data assigned.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
