const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

prisma.$connect()
  .then(() => {
    console.log('✅ Prisma connected successfully!');
  })
  .catch((err) => {
    console.error('❌ Prisma connection failed:', err.message);
  });

module.exports = prisma;
