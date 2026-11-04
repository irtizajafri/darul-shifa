const { autoCloseDayCareFiles } = require('../modules/clinic/clinic.service');

const POLL_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

function scheduleDayCareAutoClose() {
  console.log(`🏥 Day Care Auto-Close scheduled — checking every ${POLL_INTERVAL_MS / 60000} min.`);
  // A big first run can outlast one interval; two at once would close a file twice.
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const { closed } = await autoCloseDayCareFiles();
      if (closed) console.log(`🏥 Day Care Auto-Close: ${closed} file(s) closed.`);
    } catch (err) {
      console.error('❌ Day Care Auto-Close tick failed:', err);
    } finally {
      running = false;
    }
  }, POLL_INTERVAL_MS);
}

module.exports = { scheduleDayCareAutoClose };
