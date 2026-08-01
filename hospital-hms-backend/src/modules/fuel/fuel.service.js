const prisma = require('../../config/db');

function parseNum(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
function requireNum(v, label) {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) throw new Error(`${label} must be a valid number`);
  return n;
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

async function listVehicles() {
  return prisma.fuelVehicle.findMany({ orderBy: { createdAt: 'asc' } });
}

async function createVehicle({ name, plateNo, type = 'van' }) {
  if (!name?.trim()) throw new Error('Vehicle name is required');
  return prisma.fuelVehicle.create({
    data: { name: name.trim(), plateNo: plateNo?.trim() || null, type },
  });
}

async function updateVehicle(id, { name, plateNo, type, status }) {
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (plateNo !== undefined) data.plateNo = plateNo?.trim() || null;
  if (type !== undefined) data.type = type;
  if (status !== undefined) data.status = status;
  return prisma.fuelVehicle.update({ where: { id: Number(id) }, data });
}

// ── Vehicle Entries (fuel / oil) ──────────────────────────────────────────────

async function listVehicleEntries({ vehicleId, entryType }) {
  return prisma.fuelVehicleEntry.findMany({
    where: {
      ...(vehicleId ? { vehicleId: Number(vehicleId) } : {}),
      ...(entryType ? { entryType } : {}),
    },
    orderBy: { date: 'desc' },
  });
}

async function getLastVehicleEntry(vehicleId, entryType) {
  return prisma.fuelVehicleEntry.findFirst({
    where: { vehicleId: Number(vehicleId), entryType },
    orderBy: { date: 'desc' },
  });
}

async function createVehicleEntry({ vehicleId, entryType, date, driverName, quantity, rate, amount, lastKm, currentKm, notes }) {
  if (!vehicleId) throw new Error('vehicleId is required');
  if (!['fuel', 'oil'].includes(entryType)) throw new Error('entryType must be fuel or oil');

  const qty = requireNum(quantity, 'Quantity');
  const rt = requireNum(rate, 'Rate');
  const amt = requireNum(amount, 'Amount');
  const lKm = parseNum(lastKm);
  const cKm = parseNum(currentKm);
  const netRunning = (lKm !== null && cKm !== null) ? cKm - lKm : null;
  const avgPerLiter = (netRunning !== null && qty > 0) ? netRunning / qty : null;

  return prisma.fuelVehicleEntry.create({
    data: {
      vehicleId: Number(vehicleId), entryType,
      date: date ? new Date(date) : new Date(),
      driverName: driverName?.trim() || null,
      quantity: qty, rate: rt, amount: amt,
      lastKm: lKm, currentKm: cKm,
      netRunning, avgPerLiter,
      notes: notes?.trim() || null,
    },
  });
}

async function updateVehicleEntry(id, payload) {
  const entry = await prisma.fuelVehicleEntry.findUnique({ where: { id: Number(id) } });
  if (!entry) throw new Error('Entry not found');

  const qty = payload.quantity !== undefined ? requireNum(payload.quantity, 'Quantity') : entry.quantity;
  const rt = payload.rate !== undefined ? requireNum(payload.rate, 'Rate') : entry.rate;
  const amt = payload.amount !== undefined ? requireNum(payload.amount, 'Amount') : entry.amount;
  const lKm = payload.lastKm !== undefined ? parseNum(payload.lastKm) : entry.lastKm;
  const cKm = payload.currentKm !== undefined ? parseNum(payload.currentKm) : entry.currentKm;
  const netRunning = (lKm !== null && cKm !== null) ? cKm - lKm : null;
  const avgPerLiter = (netRunning !== null && qty > 0) ? netRunning / qty : null;

  return prisma.fuelVehicleEntry.update({
    where: { id: Number(id) },
    data: {
      date: payload.date ? new Date(payload.date) : undefined,
      driverName: payload.driverName !== undefined ? (payload.driverName?.trim() || null) : undefined,
      quantity: qty, rate: rt, amount: amt,
      lastKm: lKm, currentKm: cKm,
      netRunning, avgPerLiter,
      notes: payload.notes !== undefined ? (payload.notes?.trim() || null) : undefined,
    },
  });
}

async function deleteVehicleEntry(id) {
  return prisma.fuelVehicleEntry.delete({ where: { id: Number(id) } });
}

// ── Generator Entries (fuel / oil) ────────────────────────────────────────────

async function listGeneratorEntries({ entryType }) {
  return prisma.fuelGeneratorEntry.findMany({
    where: entryType ? { entryType } : {},
    orderBy: { date: 'desc' },
  });
}

async function getLastGeneratorEntry(entryType) {
  return prisma.fuelGeneratorEntry.findFirst({
    where: { entryType },
    orderBy: { date: 'desc' },
  });
}

async function createGeneratorEntry({ entryType, date, quantity, rate, amount, lastHours, currentHours, notes }) {
  if (!['fuel', 'oil'].includes(entryType)) throw new Error('entryType must be fuel or oil');

  const qty = requireNum(quantity, 'Quantity');
  const rt = requireNum(rate, 'Rate');
  const amt = requireNum(amount, 'Amount');
  const lHr = parseNum(lastHours);
  const cHr = parseNum(currentHours);
  const netRunning = (lHr !== null && cHr !== null) ? cHr - lHr : null;
  const avgPerHour = (netRunning !== null && netRunning > 0) ? qty / netRunning : null;

  return prisma.fuelGeneratorEntry.create({
    data: {
      entryType,
      date: date ? new Date(date) : new Date(),
      quantity: qty, rate: rt, amount: amt,
      lastHours: lHr, currentHours: cHr,
      netRunning, avgPerHour,
      notes: notes?.trim() || null,
    },
  });
}

async function updateGeneratorEntry(id, payload) {
  const entry = await prisma.fuelGeneratorEntry.findUnique({ where: { id: Number(id) } });
  if (!entry) throw new Error('Entry not found');

  const qty = payload.quantity !== undefined ? requireNum(payload.quantity, 'Quantity') : entry.quantity;
  const rt = payload.rate !== undefined ? requireNum(payload.rate, 'Rate') : entry.rate;
  const amt = payload.amount !== undefined ? requireNum(payload.amount, 'Amount') : entry.amount;
  const lHr = payload.lastHours !== undefined ? parseNum(payload.lastHours) : entry.lastHours;
  const cHr = payload.currentHours !== undefined ? parseNum(payload.currentHours) : entry.currentHours;
  const netRunning = (lHr !== null && cHr !== null) ? cHr - lHr : null;
  const avgPerHour = (netRunning !== null && netRunning > 0) ? qty / netRunning : null;

  return prisma.fuelGeneratorEntry.update({
    where: { id: Number(id) },
    data: {
      date: payload.date ? new Date(payload.date) : undefined,
      quantity: qty, rate: rt, amount: amt,
      lastHours: lHr, currentHours: cHr,
      netRunning, avgPerHour,
      notes: payload.notes !== undefined ? (payload.notes?.trim() || null) : undefined,
    },
  });
}

async function deleteGeneratorEntry(id) {
  return prisma.fuelGeneratorEntry.delete({ where: { id: Number(id) } });
}

// ── Generator Daily Sheets ────────────────────────────────────────────────────

async function listDailySheets() {
  return prisma.generatorDailySheet.findMany({ orderBy: { date: 'desc' } });
}

async function getLastDailySheet() {
  return prisma.generatorDailySheet.findFirst({ orderBy: { date: 'desc' } });
}

async function createDailySheet({ date, timeStart, timeClose, fuelGaugeOn, fuelGaugeOff, hourlyFuelAssumption, lastReading, currentReading, notes }) {
  return prisma.generatorDailySheet.create({
    data: {
      date: date ? new Date(date) : new Date(),
      timeStart: timeStart || null,
      timeClose: timeClose || null,
      fuelGaugeOn: parseNum(fuelGaugeOn),
      fuelGaugeOff: parseNum(fuelGaugeOff),
      hourlyFuelAssumption: parseNum(hourlyFuelAssumption),
      lastReading: parseNum(lastReading),
      currentReading: parseNum(currentReading),
      notes: notes?.trim() || null,
    },
  });
}

async function updateDailySheet(id, payload) {
  const data = {};
  if (payload.date) data.date = new Date(payload.date);
  if (payload.timeStart !== undefined) data.timeStart = payload.timeStart || null;
  if (payload.timeClose !== undefined) data.timeClose = payload.timeClose || null;
  if (payload.fuelGaugeOn !== undefined) data.fuelGaugeOn = parseNum(payload.fuelGaugeOn);
  if (payload.fuelGaugeOff !== undefined) data.fuelGaugeOff = parseNum(payload.fuelGaugeOff);
  if (payload.hourlyFuelAssumption !== undefined) data.hourlyFuelAssumption = parseNum(payload.hourlyFuelAssumption);
  if (payload.lastReading !== undefined) data.lastReading = parseNum(payload.lastReading);
  if (payload.currentReading !== undefined) data.currentReading = parseNum(payload.currentReading);
  if (payload.notes !== undefined) data.notes = payload.notes?.trim() || null;
  return prisma.generatorDailySheet.update({ where: { id: Number(id) }, data });
}

async function deleteDailySheet(id) {
  return prisma.generatorDailySheet.delete({ where: { id: Number(id) } });
}

// ── Fuel Stock (purchases / IN) ───────────────────────────────────────────────

async function listFuelStock() {
  return prisma.fuelStock.findMany({ orderBy: { date: 'desc' } });
}

async function createFuelStock({ date, quantity, rate, amount, supplier, notes }) {
  const qty = requireNum(quantity, 'Quantity');
  const rt = parseNum(rate);
  const amt = parseNum(amount) ?? (rt !== null ? qty * rt : null);
  return prisma.fuelStock.create({
    data: {
      date: date ? new Date(date) : new Date(),
      quantity: qty,
      rate: rt,
      amount: amt,
      supplier: supplier?.trim() || null,
      notes: notes?.trim() || null,
    },
  });
}

async function deleteFuelStock(id) {
  return prisma.fuelStock.delete({ where: { id: Number(id) } });
}

async function getFuelBalance() {
  const [vehicleAgg, generatorAgg, sheets] = await Promise.all([
    prisma.fuelVehicleEntry.aggregate({ _sum: { quantity: true }, where: { entryType: 'fuel' } }),
    prisma.fuelGeneratorEntry.aggregate({ _sum: { quantity: true }, where: { entryType: 'fuel' } }),
    prisma.generatorDailySheet.findMany({
      select: { fuelGaugeOn: true, fuelGaugeOff: true },
      where: { fuelGaugeOn: { not: null }, fuelGaugeOff: { not: null } },
    }),
  ]);
  const totalVehicle = Number(vehicleAgg._sum.quantity || 0);
  const totalGeneratorAdded = Number(generatorAgg._sum.quantity || 0);
  const generatorConsumed = sheets.reduce((sum, s) => {
    const c = Number(s.fuelGaugeOn) - Number(s.fuelGaugeOff);
    return sum + (c > 0 ? c : 0);
  }, 0);
  const totalGenerator = totalGeneratorAdded - generatorConsumed;
  return { totalVehicle, totalGenerator, generatorConsumed, balance: totalVehicle + totalGenerator };
}

module.exports = {
  listVehicles, createVehicle, updateVehicle,
  listVehicleEntries, getLastVehicleEntry, createVehicleEntry, updateVehicleEntry, deleteVehicleEntry,
  listGeneratorEntries, getLastGeneratorEntry, createGeneratorEntry, updateGeneratorEntry, deleteGeneratorEntry,
  listDailySheets, getLastDailySheet, createDailySheet, updateDailySheet, deleteDailySheet,
  listFuelStock, createFuelStock, deleteFuelStock, getFuelBalance,
};
