const prisma = require('../../config/db');

function parseNum(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
function requireNum(v, label) {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a valid number`);
  return n;
}
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ── Meters (Billing + Department) ──────────────────────────────────────────────
// Billing Meters are what the electricity company actually bills. Department
// Meters are internal sub-meters, each linked to the Billing Meter they sit
// under, tracked for cost allocation only.

async function listMeters({ type, utility, billingMeterId, status } = {}) {
  return prisma.utilityMeter.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(utility ? { utility } : {}),
      ...(billingMeterId ? { billingMeterId: Number(billingMeterId) } : {}),
      ...(status ? { status } : {}),
    },
    include: { billingMeter: { select: { id: true, meterNo: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

async function getMeter(id) {
  const meter = await prisma.utilityMeter.findUnique({
    where: { id: Number(id) },
    include: { billingMeter: { select: { id: true, meterNo: true } } },
  });
  if (!meter) throw new Error('Meter not found');
  return meter;
}

async function createMeter({ type, utility = 'electricity', meterNo, departmentName, billingMeterId, location, status = 'active' }) {
  if (!['billing', 'department'].includes(type)) throw new Error('type must be billing or department');
  if (!['electricity', 'gas', 'ptcl'].includes(utility)) throw new Error('utility must be electricity, gas or ptcl');
  if (utility !== 'electricity' && type !== 'billing') throw new Error(`${utility} entries cannot be department-type`);
  if (type === 'billing') {
    if (!meterNo?.trim()) throw new Error(utility === 'ptcl' ? 'Phone number is required' : 'Meter number is required');
  } else {
    if (!departmentName?.trim()) throw new Error('Department name is required');
  }
  return prisma.utilityMeter.create({
    data: {
      type,
      utility,
      meterNo: type === 'billing' ? meterNo.trim() : null,
      departmentName: type === 'department' ? departmentName.trim() : null,
      billingMeterId: (type === 'department' && billingMeterId) ? Number(billingMeterId) : null,
      location: location?.trim() || null,
      status,
    },
  });
}

async function updateMeter(id, { meterNo, departmentName, billingMeterId, location, status }) {
  const data = {};
  if (meterNo !== undefined) data.meterNo = meterNo?.trim() || null;
  if (departmentName !== undefined) data.departmentName = departmentName?.trim() || null;
  if (billingMeterId !== undefined) data.billingMeterId = billingMeterId ? Number(billingMeterId) : null;
  if (location !== undefined) data.location = location?.trim() || null;
  if (status !== undefined) data.status = status;
  return prisma.utilityMeter.update({ where: { id: Number(id) }, data });
}

// ── Rate history ────────────────────────────────────────────────────────────────

async function listRates(meterId) {
  return prisma.utilityMeterRate.findMany({
    where: { meterId: Number(meterId) },
    orderBy: { effectiveFrom: 'desc' },
  });
}

async function createRate(meterId, { rate, effectiveFrom }) {
  const rt = requireNum(rate, 'Rate');
  return prisma.utilityMeterRate.create({
    data: { meterId: Number(meterId), rate: rt, effectiveFrom: effectiveFrom ? startOfDay(effectiveFrom) : startOfDay(new Date()) },
  });
}

async function deleteRate(id) {
  return prisma.utilityMeterRate.delete({ where: { id: Number(id) } });
}

// Rate applicable on a given date = latest rate row with effectiveFrom <= date.
// If the date is before every recorded rate, falls back to the earliest known rate.
function rateAtDate(sortedRatesDesc, date) {
  const t = new Date(date).getTime();
  for (const r of sortedRatesDesc) {
    if (new Date(r.effectiveFrom).getTime() <= t) return r.rate;
  }
  return sortedRatesDesc.length ? sortedRatesDesc[sortedRatesDesc.length - 1].rate : 0;
}

// ── Daily readings (Day + Night, each Start/End) ──────────────────────────────

function computeUnits({ dayStart, dayEnd, nightStart, nightEnd }) {
  const dayUnits = (dayStart != null && dayEnd != null) ? Math.max(0, dayEnd - dayStart) : null;
  const nightUnits = (nightStart != null && nightEnd != null) ? Math.max(0, nightEnd - nightStart) : null;
  if (dayUnits == null && nightUnits == null) return { dayUnits: null, nightUnits: null, totalUnits: null };
  return { dayUnits, nightUnits, totalUnits: (dayUnits || 0) + (nightUnits || 0) };
}

async function listReadings({ meterId, from, to }) {
  return prisma.utilityMeterReading.findMany({
    where: {
      ...(meterId ? { meterId: Number(meterId) } : {}),
      ...((from || to) ? { date: { ...(from ? { gte: startOfDay(from) } : {}), ...(to ? { lte: startOfDay(to) } : {}) } } : {}),
    },
    orderBy: { date: 'desc' },
  });
}

async function getLastReading(meterId) {
  return prisma.utilityMeterReading.findFirst({
    where: { meterId: Number(meterId) },
    orderBy: { date: 'desc' },
  });
}

// One row per meter per day — calling this again for the same date updates
// that day's row (so Start can be saved first, End filled in later).
async function upsertReading({ meterId, date, dayStart, dayEnd, nightStart, nightEnd, notes }) {
  if (!meterId) throw new Error('meterId is required');
  if (!date) throw new Error('date is required');
  const dS = parseNum(dayStart), dE = parseNum(dayEnd), nS = parseNum(nightStart), nE = parseNum(nightEnd);
  if (dS != null && dE != null && dE < dS) throw new Error('Day End reading, Day Start se kam nahi ho sakti');
  if (nS != null && nE != null && nE < nS) throw new Error('Night End reading, Night Start se kam nahi ho sakti');
  const units = computeUnits({ dayStart: dS, dayEnd: dE, nightStart: nS, nightEnd: nE });
  const d = startOfDay(date);
  return prisma.utilityMeterReading.upsert({
    where: { meterId_date: { meterId: Number(meterId), date: d } },
    create: { meterId: Number(meterId), date: d, dayStart: dS, dayEnd: dE, nightStart: nS, nightEnd: nE, ...units, notes: notes?.trim() || null },
    update: { dayStart: dS, dayEnd: dE, nightStart: nS, nightEnd: nE, ...units, notes: notes?.trim() || null },
  });
}

async function deleteReading(id) {
  return prisma.utilityMeterReading.delete({ where: { id: Number(id) } });
}

// ── Actual bills (Billing meters only, posted per monthly cycle) ────────────────

async function listActualBills(meterId) {
  return prisma.utilityActualBill.findMany({
    where: meterId ? { meterId: Number(meterId) } : {},
    orderBy: { fromDate: 'desc' },
  });
}

async function createActualBill({ meterId, fromDate, toDate, amount, unitsCharges, fixedCharges, notes }) {
  if (!meterId) throw new Error('meterId is required');
  const meter = await prisma.utilityMeter.findUnique({ where: { id: Number(meterId) } });
  if (!meter) throw new Error('Meter not found');
  if (meter.type !== 'billing') throw new Error('Actual bill sirf Billing Meter pe post ho sakta hai');
  if (!fromDate || !toDate) throw new Error('From aur To date dono required hain');
  const amt = requireNum(amount, 'Amount');
  return prisma.utilityActualBill.create({
    data: {
      meterId: Number(meterId),
      fromDate: startOfDay(fromDate), toDate: startOfDay(toDate),
      amount: amt,
      unitsCharges: parseNum(unitsCharges),
      fixedCharges: parseNum(fixedCharges),
      notes: notes?.trim() || null,
    },
  });
}

async function updateActualBill(id, payload) {
  const data = {};
  if (payload.fromDate) data.fromDate = startOfDay(payload.fromDate);
  if (payload.toDate) data.toDate = startOfDay(payload.toDate);
  if (payload.amount !== undefined) data.amount = requireNum(payload.amount, 'Amount');
  if (payload.unitsCharges !== undefined) data.unitsCharges = parseNum(payload.unitsCharges);
  if (payload.fixedCharges !== undefined) data.fixedCharges = parseNum(payload.fixedCharges);
  if (payload.notes !== undefined) data.notes = payload.notes?.trim() || null;
  return prisma.utilityActualBill.update({ where: { id: Number(id) }, data });
}

async function deleteActualBill(id) {
  return prisma.utilityActualBill.delete({ where: { id: Number(id) } });
}

// ── Estimate / Report ────────────────────────────────────────────────────────────

async function estimateForRange(meterId, from, to) {
  const [readings, rates] = await Promise.all([
    prisma.utilityMeterReading.findMany({
      where: {
        meterId: Number(meterId),
        ...((from || to) ? { date: { ...(from ? { gte: startOfDay(from) } : {}), ...(to ? { lte: startOfDay(to) } : {}) } } : {}),
      },
      orderBy: { date: 'asc' },
    }),
    prisma.utilityMeterRate.findMany({ where: { meterId: Number(meterId) }, orderBy: { effectiveFrom: 'desc' } }),
  ]);
  let totalUnits = 0;
  let estimatedAmount = 0;
  const rows = readings.map((r) => {
    const units = r.totalUnits || 0;
    const rate = rateAtDate(rates, r.date);
    const amount = units * rate;
    totalUnits += units;
    estimatedAmount += amount;
    return { ...r, rateApplied: rate, estimatedAmount: amount };
  });
  return { readings: rows, totalUnits, estimatedAmount };
}

// "Ab tak ka bill kitna ban raha hai" — sums readings since the last posted
// Actual Bill's toDate (or since the very first reading, if none posted yet).
async function currentEstimate(meterId) {
  const meter = await getMeter(meterId);
  const lastBill = meter.type === 'billing'
    ? await prisma.utilityActualBill.findFirst({ where: { meterId: Number(meterId) }, orderBy: { toDate: 'desc' } })
    : null;
  const since = lastBill ? new Date(lastBill.toDate.getTime() + 86400000) : null;
  const { totalUnits, estimatedAmount } = await estimateForRange(meterId, since, null);
  return { sinceDate: since, totalUnits, estimatedAmount, lastBillId: lastBill?.id ?? null };
}

async function getReport({ meterId, from, to }) {
  const meter = await getMeter(meterId);
  const { readings, totalUnits, estimatedAmount } = await estimateForRange(meterId, from, to);
  if (meter.type !== 'billing') {
    return { meter, readings, totalUnits, estimatedAmount };
  }
  const actualBills = await prisma.utilityActualBill.findMany({
    where: {
      meterId: Number(meterId),
      ...((from || to) ? {
        ...(to ? { fromDate: { lte: startOfDay(to) } } : {}),
        ...(from ? { toDate: { gte: startOfDay(from) } } : {}),
      } : {}),
    },
    orderBy: { fromDate: 'desc' },
  });
  const totalActual = actualBills.reduce((s, b) => s + b.amount, 0);
  const difference = totalActual - estimatedAmount;
  return { meter, readings, totalUnits, estimatedAmount, actualBills, totalActual, difference };
}

// Every billing-type meter (electricity/gas/ptcl) with its own most recent
// Actual Bill — used by Accounts > List Attachments so expanding a Utility
// Provider entry (e.g. "k-electric") shows each meter's bill separately
// (803, 804, ... each with its own posted date), not one merged figure.
async function lastBillByMeter() {
  const [meters, bills] = await Promise.all([
    prisma.utilityMeter.findMany({
      where: { type: 'billing' },
      select: { id: true, meterNo: true, utility: true },
      orderBy: { meterNo: 'asc' },
    }),
    prisma.utilityActualBill.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);
  const lastByMeter = {};
  for (const b of bills) {
    if (!lastByMeter[b.meterId]) lastByMeter[b.meterId] = b; // first hit = most recent (bills ordered desc)
  }
  return meters.map((m) => {
    const b = lastByMeter[m.id];
    return {
      meterId: m.id,
      meterNo: m.meterNo,
      utility: m.utility,
      lastBill: b ? { postedAt: b.createdAt, amount: b.amount, fromDate: b.fromDate, toDate: b.toDate } : null,
    };
  });
}

module.exports = {
  listMeters, getMeter, createMeter, updateMeter,
  listRates, createRate, deleteRate,
  listReadings, getLastReading, upsertReading, deleteReading,
  listActualBills, createActualBill, updateActualBill, deleteActualBill,
  currentEstimate, getReport, lastBillByMeter,
};
