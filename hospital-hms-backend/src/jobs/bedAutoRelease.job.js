const prisma = require('../config/db');

const POLL_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const DELAY_MS = 6 * 60 * 60 * 1000; // 6 hours

async function runBedAutoRelease() {
  const cutoff = new Date(Date.now() - DELAY_MS);
  const due = await prisma.clinicBed.findMany({
    where: { vacatedAt: { not: null, lte: cutoff }, roomCategory: { autoReleaseEnabled: true } },
    select: { id: true },
  });
  if (!due.length) return;

  await prisma.clinicBed.updateMany({
    where: { id: { in: due.map((b) => b.id) } },
    data: { status: 'available', vacatedAt: null },
  });
}

function scheduleBedAutoRelease() {
  console.log(`🛏️  Bed Auto-Release scheduled — checking every ${POLL_INTERVAL_MS / 60000} min.`);
  setInterval(() => {
    runBedAutoRelease().catch((err) => console.error('❌ Bed Auto-Release tick failed:', err));
  }, POLL_INTERVAL_MS);
}

module.exports = { scheduleBedAutoRelease, runBedAutoRelease };
