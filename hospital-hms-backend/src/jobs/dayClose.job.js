const accountsSvc = require('../modules/accounts/accounts.service');

// Hospital's business day runs 8:00 AM to 7:59:59 AM the next calendar day.
// When this fires (at 8:00 AM), the business day that just ended started
// yesterday — that is the date the auto Income Voucher gets booked under.
function businessDayToClose() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function runDayClose() {
  const date = businessDayToClose();
  try {
    const voucher = await accountsSvc.generateAutoIncomeVoucherForDate(date, 'non-corporate');
    if (voucher) {
      console.log(`✅ Day close: auto Income Voucher ${voucher.voucherNo} booked for ${date} (₹${voucher.totalAmount})`);
    } else {
      console.log(`ℹ️  Day close: nothing to book for ${date} (no revenue, or already closed)`);
    }
  } catch (err) {
    console.error(`❌ Day close failed for ${date}:`, err);
  }
}

function msUntilNext8AM() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(8, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

// Self-rescheduling daily timer — no cron dependency needed for a once-a-day job.
function scheduleDayClose() {
  const delay = msUntilNext8AM();
  console.log(`🕗 Day close scheduled in ${Math.round(delay / 60000)} min (next run: ${new Date(Date.now() + delay).toLocaleString()})`);
  setTimeout(async () => {
    await runDayClose();
    scheduleDayClose();
  }, delay);
}

module.exports = { scheduleDayClose, runDayClose };
