const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FuelStock" (
      id SERIAL PRIMARY KEY,
      date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      quantity DOUBLE PRECISION NOT NULL,
      rate DOUBLE PRECISION,
      amount DOUBLE PRECISION,
      supplier TEXT,
      notes TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('FuelStock table created (or already exists)');
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
