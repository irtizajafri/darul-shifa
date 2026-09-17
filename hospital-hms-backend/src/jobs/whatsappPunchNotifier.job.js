const prisma = require('../config/db');
const attendanceCtrl = require('../modules/attendance/attendance.controller');
const { sendWhatsAppMessage } = require('../services/whatsapp.service');

const ENABLED = String(process.env.WHATSAPP_PUNCH_ALERTS_ENABLED || '').toLowerCase() === 'true';
const NOTIFY_NUMBER = process.env.WHATSAPP_NOTIFY_NUMBER;
const POLL_INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes

function todayPktStr() {
  // PunchLog stores PKT-converted times; match that same wall-clock day.
  const now = new Date(Date.now() + 5 * 60 * 60 * 1000); // UTC -> PKT (UTC+5)
  return `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${String(now.getUTCDate()).padStart(2, '0')}`;
}

function fmtDateTime(d) {
  const dt = new Date(d);
  const date = `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
  const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} ${time}`;
}

async function runWhatsAppPunchNotifier() {
  if (!ENABLED) return;
  if (!NOTIFY_NUMBER) {
    console.error('⚠️  WhatsApp Punch Notifier — WHATSAPP_NOTIFY_NUMBER not set, skipping.');
    return;
  }

  // Pull today's window from the cloud biometric API first — this is what
  // makes new punches show up here at all without anyone clicking "Get Live
  // Data" in the UI. Mirrors syncPunches' own ±1-day buffer / slash-date
  // format (attendance.controller.js).
  try {
    const today = todayPktStr();
    await attendanceCtrl.syncPunchesToDB(today, today);
  } catch (err) {
    console.error('❌ WhatsApp Punch Notifier — cloud sync failed, will still check for already-pending punches:', err.message);
  }

  const pending = await prisma.punchLog.findMany({
    where: { whatsappNotifiedAt: null },
    orderBy: { punchTime: 'asc' },
  });
  if (!pending.length) return;

  const empCodes = [...new Set(pending.map((p) => p.empCode))];
  const employees = await prisma.employee.findMany({
    where: { empCode: { in: empCodes } },
    select: { empCode: true, firstName: true, lastName: true },
  });
  const nameByCode = new Map(employees.map((e) => [String(e.empCode), `${e.firstName || ''} ${e.lastName || ''}`.trim()]));

  // IN/OUT label is this job's own simple heuristic for message text only —
  // Nth punch today for that employee, odd -> IN, even -> OUT. Deliberately
  // not reusing syncAttendance's own pairing (that one drives payroll
  // late/overtime math and is considerably more involved).
  const seqByEmpDate = new Map(); // `${empCode}|${punchDate}` -> count so far

  for (const punch of pending) {
    const seqKey = `${punch.empCode}|${punch.punchDate}`;
    const seq = (seqByEmpDate.get(seqKey) || 0) + 1;
    seqByEmpDate.set(seqKey, seq);
    const direction = seq % 2 === 1 ? 'IN' : 'OUT';

    const name = nameByCode.get(punch.empCode) || `Employee ${punch.empCode}`;
    const message = `🕐 Attendance — ${name} (${punch.empCode})\n${direction} at ${fmtDateTime(punch.punchTime)}`;

    const sent = await sendWhatsAppMessage(NOTIFY_NUMBER, message);
    if (sent) {
      await prisma.punchLog.update({
        where: { id: punch.id },
        data: { whatsappNotifiedAt: new Date() },
      });
    }
    // On failure: leave whatsappNotifiedAt null so the next tick retries.
  }
}

function scheduleWhatsAppPunchNotifier() {
  if (!ENABLED) {
    console.log('ℹ️  WhatsApp Punch Notifier job not scheduled (WHATSAPP_PUNCH_ALERTS_ENABLED != true).');
    return;
  }
  console.log(`🕑 WhatsApp Punch Notifier scheduled — checking every ${POLL_INTERVAL_MS / 60000} min.`);
  setInterval(() => {
    runWhatsAppPunchNotifier().catch((err) => console.error('❌ WhatsApp Punch Notifier tick failed:', err));
  }, POLL_INTERVAL_MS);
}

module.exports = { scheduleWhatsAppPunchNotifier, runWhatsAppPunchNotifier };
