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

// ── Generators ────────────────────────────────────────────────────────────────

async function listGenerators() {
  return prisma.fuelGenerator.findMany({ orderBy: { createdAt: 'asc' } });
}

async function createGenerator({ name, modelNo, serialNo, location, status = 'active' }) {
  if (!name?.trim()) throw new Error('Generator name is required');
  return prisma.fuelGenerator.create({
    data: { name: name.trim(), modelNo: modelNo?.trim() || null, serialNo: serialNo?.trim() || null, location: location?.trim() || null, status },
  });
}

async function updateGenerator(id, { name, modelNo, serialNo, location, status }) {
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (modelNo !== undefined) data.modelNo = modelNo?.trim() || null;
  if (serialNo !== undefined) data.serialNo = serialNo?.trim() || null;
  if (location !== undefined) data.location = location?.trim() || null;
  if (status !== undefined) data.status = status;
  return prisma.fuelGenerator.update({ where: { id: Number(id) }, data });
}

// ── Generator Entries (fuel / oil) ────────────────────────────────────────────

async function listGeneratorEntries({ generatorId, entryType }) {
  return prisma.fuelGeneratorEntry.findMany({
    where: {
      ...(generatorId ? { generatorId: Number(generatorId) } : {}),
      ...(entryType ? { entryType } : {}),
    },
    include: { transfer: { select: { id: true, tankId: true } } },
    orderBy: { date: 'desc' },
  });
}

async function getLastGeneratorEntry(generatorId, entryType) {
  return prisma.fuelGeneratorEntry.findFirst({
    where: {
      ...(generatorId ? { generatorId: Number(generatorId) } : {}),
      ...(entryType ? { entryType } : {}),
    },
    orderBy: { date: 'desc' },
  });
}

async function createGeneratorEntry({ generatorId, entryType, date, quantity, rate, amount, lastHours, currentHours, notes }) {
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
      generatorId: generatorId ? Number(generatorId) : null,
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
  const entry = await prisma.fuelGeneratorEntry.findUnique({ where: { id: Number(id) }, include: { transfer: true } });
  if (!entry) throw new Error('Entry not found');
  if (entry.transfer) {
    throw new Error('Ye entry ek Fuel Transfer se linked hai — isko delete karne ke liye Transfer delete karein');
  }
  return prisma.fuelGeneratorEntry.delete({ where: { id: Number(id) } });
}

// ── Generator Daily Sheets ────────────────────────────────────────────────────

async function listDailySheets(generatorId) {
  return prisma.generatorDailySheet.findMany({
    where: generatorId ? { generatorId: Number(generatorId) } : {},
    orderBy: { date: 'desc' },
  });
}

async function getLastDailySheet(generatorId) {
  return prisma.generatorDailySheet.findFirst({
    where: generatorId ? { generatorId: Number(generatorId) } : {},
    orderBy: { date: 'desc' },
  });
}

async function createDailySheet({ generatorId, date, timeStart, timeClose, fuelGaugeOn, fuelGaugeOff, hourlyFuelAssumption, lastReading, currentReading, notes }) {
  return prisma.generatorDailySheet.create({
    data: {
      generatorId: generatorId ? Number(generatorId) : null,
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

// ── Fuel Tanks ────────────────────────────────────────────────────────────────
// balance = stockedIn + tankTransferIn - genTransferOut - tankTransferOut
// Tank level is always derived — never stored directly.

async function tankBalanceMap(tankIds) {
  const idList = tankIds ?? [];
  const hasFilter = idList.length > 0;

  const [stockRows, genTransferRows, tankOutRows, tankInRows] = await Promise.all([
    prisma.fuelStock.groupBy({
      by: ['tankId'],
      _sum: { quantity: true },
      where: hasFilter ? { tankId: { in: idList, not: null } } : { tankId: { not: null } },
    }),
    prisma.fuelTransfer.groupBy({
      by: ['tankId'],
      _sum: { quantity: true },
      where: hasFilter ? { tankId: { in: idList } } : {},
    }),
    prisma.fuelTankTransfer.groupBy({
      by: ['fromTankId'],
      _sum: { quantity: true },
      where: hasFilter ? { fromTankId: { in: idList } } : {},
    }),
    prisma.fuelTankTransfer.groupBy({
      by: ['toTankId'],
      _sum: { quantity: true },
      where: hasFilter ? { toTankId: { in: idList } } : {},
    }),
  ]);

  const stockByTank    = Object.fromEntries(stockRows.map((r) => [r.tankId,     Number(r._sum.quantity || 0)]));
  const genOutByTank   = Object.fromEntries(genTransferRows.map((r) => [r.tankId,     Number(r._sum.quantity || 0)]));
  const tankOutByTank  = Object.fromEntries(tankOutRows.map((r) => [r.fromTankId, Number(r._sum.quantity || 0)]));
  const tankInByTank   = Object.fromEntries(tankInRows.map((r) => [r.toTankId,   Number(r._sum.quantity || 0)]));

  return { stockByTank, genOutByTank, tankOutByTank, tankInByTank };
}

function calcBalance(id, { stockByTank, genOutByTank, tankOutByTank, tankInByTank }) {
  return (stockByTank[id] || 0)
       + (tankInByTank[id] || 0)
       - (genOutByTank[id] || 0)
       - (tankOutByTank[id] || 0);
}

async function listTanks() {
  const tanks = await prisma.fuelTank.findMany({ orderBy: { createdAt: 'asc' } });
  const maps = await tankBalanceMap(tanks.map((t) => t.id));
  return tanks.map((t) => ({
    ...t,
    stockedIn:      maps.stockByTank[t.id]   || 0,
    genTransferOut: maps.genOutByTank[t.id]  || 0,
    tankTransferOut:maps.tankOutByTank[t.id] || 0,
    tankTransferIn: maps.tankInByTank[t.id]  || 0,
    balance: calcBalance(t.id, maps),
  }));
}

async function getTank(id) {
  const tank = await prisma.fuelTank.findUnique({ where: { id: Number(id) } });
  if (!tank) throw new Error('Tank not found');
  const maps = await tankBalanceMap([tank.id]);
  return {
    ...tank,
    stockedIn:       maps.stockByTank[tank.id]   || 0,
    genTransferOut:  maps.genOutByTank[tank.id]  || 0,
    tankTransferOut: maps.tankOutByTank[tank.id] || 0,
    tankTransferIn:  maps.tankInByTank[tank.id]  || 0,
    balance: calcBalance(tank.id, maps),
  };
}

async function createTank({ name, capacity, status = 'active' }) {
  if (!name?.trim()) throw new Error('Tank name is required');
  return prisma.fuelTank.create({ data: { name: name.trim(), capacity: parseNum(capacity), status } });
}

async function updateTank(id, { name, capacity, status }) {
  const data = {};
  if (name !== undefined) data.name = name.trim();
  if (capacity !== undefined) data.capacity = parseNum(capacity);
  if (status !== undefined) data.status = status;
  return prisma.fuelTank.update({ where: { id: Number(id) }, data });
}

// ── Fuel Stock (purchases / IN, into a tank) ──────────────────────────────────

async function listFuelStock(tankId) {
  return prisma.fuelStock.findMany({
    where: tankId ? { tankId: Number(tankId) } : {},
    include: { tank: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
  });
}

async function createFuelStock({ tankId, date, quantity, rate, amount, supplier, notes }) {
  if (!tankId) throw new Error('Select a tank to add this stock into');
  const qty = requireNum(quantity, 'Quantity');
  const rt = parseNum(rate);
  const amt = parseNum(amount) ?? (rt !== null ? qty * rt : null);
  return prisma.fuelStock.create({
    data: {
      tankId: Number(tankId),
      date: date ? new Date(date) : new Date(),
      quantity: qty,
      rate: rt,
      amount: amt,
      supplier: supplier?.trim() || null,
      notes: notes?.trim() || null,
    },
  });
}

// FIX: balance check before delete — prevent negative tank balance
async function deleteFuelStock(id) {
  const stock = await prisma.fuelStock.findUnique({ where: { id: Number(id) } });
  if (!stock) throw new Error('Entry not found');
  if (stock.tankId) {
    const maps = await tankBalanceMap([stock.tankId]);
    const currentBalance = calcBalance(stock.tankId, maps);
    if (currentBalance - stock.quantity < -0.001) {
      throw new Error(
        `Delete nahi ho sakta — is entry ko hatane se tank ka balance negative (${(currentBalance - stock.quantity).toFixed(2)} L) ho jaega. Pehle transfers delete karein.`
      );
    }
  }
  return prisma.fuelStock.delete({ where: { id: Number(id) } });
}

// ── Fuel Transfers (Tank → Generator) ─────────────────────────────────────────

async function listTransfers({ tankId, generatorId } = {}) {
  return prisma.fuelTransfer.findMany({
    where: {
      ...(tankId ? { tankId: Number(tankId) } : {}),
      ...(generatorId ? { generatorId: Number(generatorId) } : {}),
    },
    include: {
      tank: { select: { id: true, name: true } },
      generator: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });
}

async function createTransfer({ tankId, generatorId, quantity, rate, date, lastHours, currentHours, notes }) {
  if (!tankId) throw new Error('Select a source tank');
  if (!generatorId) throw new Error('Select a destination generator');
  const qty = requireNum(quantity, 'Quantity');

  const maps = await tankBalanceMap([Number(tankId)]);
  const available = calcBalance(Number(tankId), maps);
  if (qty > available + 0.001) {
    throw new Error(`Tank mein sirf ${available.toFixed(2)} L available hai — ${qty} L transfer nahi ho sakta`);
  }

  const rt = parseNum(rate) ?? 0;
  const amt = rt ? qty * rt : 0;
  const lHr = parseNum(lastHours);
  const cHr = parseNum(currentHours);
  const netRunning = (lHr !== null && cHr !== null) ? cHr - lHr : null;
  const avgPerHour = (netRunning !== null && netRunning > 0) ? qty / netRunning : null;
  const when = date ? new Date(date) : new Date();

  return prisma.$transaction(async (tx) => {
    const genEntry = await tx.fuelGeneratorEntry.create({
      data: {
        generatorId: Number(generatorId),
        entryType: 'fuel',
        date: when,
        quantity: qty, rate: rt, amount: amt,
        lastHours: lHr, currentHours: cHr,
        netRunning, avgPerHour,
        notes: notes?.trim() || null,
      },
    });
    return tx.fuelTransfer.create({
      data: {
        tankId: Number(tankId),
        generatorId: Number(generatorId),
        generatorEntryId: genEntry.id,
        quantity: qty,
        date: when,
        notes: notes?.trim() || null,
      },
      include: {
        tank: { select: { id: true, name: true } },
        generator: { select: { id: true, name: true } },
        generatorEntry: true,
      },
    });
  });
}

async function deleteTransfer(id) {
  const transfer = await prisma.fuelTransfer.findUnique({ where: { id: Number(id) } });
  if (!transfer) throw new Error('Transfer not found');
  return prisma.$transaction(async (tx) => {
    await tx.fuelTransfer.delete({ where: { id: Number(id) } });
    if (transfer.generatorEntryId) {
      await tx.fuelGeneratorEntry.delete({ where: { id: transfer.generatorEntryId } }).catch(() => {});
    }
  });
}

// ── Fuel Tank → Tank Transfers ────────────────────────────────────────────────

async function listTankTransfers({ fromTankId, toTankId } = {}) {
  return prisma.fuelTankTransfer.findMany({
    where: {
      ...(fromTankId ? { fromTankId: Number(fromTankId) } : {}),
      ...(toTankId   ? { toTankId:   Number(toTankId)   } : {}),
    },
    include: {
      fromTank: { select: { id: true, name: true } },
      toTank:   { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });
}

async function createTankTransfer({ fromTankId, toTankId, quantity, rate, date, notes }) {
  if (!fromTankId) throw new Error('Source tank select karein');
  if (!toTankId)   throw new Error('Destination tank select karein');
  if (Number(fromTankId) === Number(toTankId)) throw new Error('Source aur destination alag tank honi chahiye');
  const qty = requireNum(quantity, 'Quantity');
  if (qty <= 0) throw new Error('Quantity zero se zyada honi chahiye');

  const maps = await tankBalanceMap([Number(fromTankId)]);
  const available = calcBalance(Number(fromTankId), maps);
  if (qty > available + 0.001) {
    throw new Error(`Tank mein sirf ${available.toFixed(2)} L available hai — ${qty} L transfer nahi ho sakta`);
  }

  return prisma.fuelTankTransfer.create({
    data: {
      fromTankId: Number(fromTankId),
      toTankId:   Number(toTankId),
      quantity:   qty,
      rate:       parseNum(rate),
      date:       date ? new Date(date) : new Date(),
      notes:      notes?.trim() || null,
    },
    include: {
      fromTank: { select: { id: true, name: true } },
      toTank:   { select: { id: true, name: true } },
    },
  });
}

async function deleteTankTransfer(id) {
  const transfer = await prisma.fuelTankTransfer.findUnique({ where: { id: Number(id) } });
  if (!transfer) throw new Error('Transfer not found');
  return prisma.fuelTankTransfer.delete({ where: { id: Number(id) } });
}

// ── Fuel Tank Report ──────────────────────────────────────────────────────────
// Per-tank breakdown: purchases, gen-transfers, tank-to-tank moves, balance.

async function getTankReport({ tankId, from, to } = {}) {
  const dateWhere = (from || to) ? {
    date: {
      ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
      ...(to   ? { lte: new Date(`${to}T23:59:59`)   } : {}),
    },
  } : {};

  const byTank       = tankId ? { tankId:     Number(tankId) } : {};
  const byFromTank   = tankId ? { fromTankId: Number(tankId) } : {};
  const byToTank     = tankId ? { toTankId:   Number(tankId) } : {};

  const [tanks, stock, genTransfers, tankTransfersOut, tankTransfersIn] = await Promise.all([
    prisma.fuelTank.findMany({
      where: tankId ? { id: Number(tankId) } : {},
      orderBy: { createdAt: 'asc' },
    }),
    prisma.fuelStock.findMany({
      where: { ...byTank, ...dateWhere },
      include: { tank: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.fuelTransfer.findMany({
      where: { ...byTank, ...dateWhere },
      include: {
        tank:      { select: { id: true, name: true } },
        generator: { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.fuelTankTransfer.findMany({
      where: { ...byFromTank, ...dateWhere },
      include: {
        fromTank: { select: { id: true, name: true } },
        toTank:   { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.fuelTankTransfer.findMany({
      where: { ...byToTank, ...dateWhere },
      include: {
        fromTank: { select: { id: true, name: true } },
        toTank:   { select: { id: true, name: true } },
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  // Current balance — always cumulative (no date filter)
  const allIds = tanks.map((t) => t.id);
  const maps = await tankBalanceMap(allIds);

  const tanksWithBalance = tanks.map((t) => ({
    id: t.id, name: t.name, capacity: t.capacity, status: t.status,
    balance: calcBalance(t.id, maps),
  }));

  const totalBalance = tanksWithBalance.reduce((s, t) => s + t.balance, 0);

  return {
    tanks: tanksWithBalance,
    stock,
    genTransfers,
    tankTransfersOut,
    tankTransfersIn,
    totals: {
      stockQty:       stock.reduce((s, r) => s + r.quantity, 0),
      stockAmount:    stock.reduce((s, r) => s + Number(r.amount || 0), 0),
      genTransferQty: genTransfers.reduce((s, r) => s + r.quantity, 0),
      tankOutQty:     tankTransfersOut.reduce((s, r) => s + r.quantity, 0),
      tankInQty:      tankTransfersIn.reduce((s, r) => s + r.quantity, 0),
      totalBalance,
    },
  };
}

// ── Overall Fuel Balance ───────────────────────────────────────────────────────

async function getFuelBalance() {
  const [vehicleAgg, generatorAgg, sheets, tanks] = await Promise.all([
    prisma.fuelVehicleEntry.aggregate({ _sum: { quantity: true }, where: { entryType: 'fuel' } }),
    prisma.fuelGeneratorEntry.aggregate({ _sum: { quantity: true }, where: { entryType: 'fuel' } }),
    prisma.generatorDailySheet.findMany({
      select: { fuelGaugeOn: true, fuelGaugeOff: true },
      where: { fuelGaugeOn: { not: null }, fuelGaugeOff: { not: null } },
    }),
    listTanks(),
  ]);
  const totalVehicle = Number(vehicleAgg._sum.quantity || 0);
  const totalGeneratorAdded = Number(generatorAgg._sum.quantity || 0);
  const generatorConsumed = sheets.reduce((sum, s) => {
    const c = Number(s.fuelGaugeOn) - Number(s.fuelGaugeOff);
    return sum + (c > 0 ? c : 0);
  }, 0);
  const totalGenerator = totalGeneratorAdded - generatorConsumed;
  const totalTank = tanks.reduce((sum, t) => sum + t.balance, 0);
  return {
    totalVehicle, totalGenerator, totalTank, generatorConsumed,
    balance: totalVehicle + totalGenerator + totalTank,
  };
}

// ── Daily Report ────────────────────────────────────────────────────────────
function dayKey(d) { return new Date(d).toISOString().slice(0, 10); }

async function getDailyReport({ from, to } = {}) {
  const dateWhere = (from || to) ? {
    date: {
      ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
      ...(to   ? { lte: new Date(`${to}T23:59:59`)   } : {}),
    },
  } : {};

  const [stock, transfers, tankTransfers, vehicleEntries, generatorEntries] = await Promise.all([
    prisma.fuelStock.findMany({ where: dateWhere, include: { tank: { select: { name: true } } } }),
    prisma.fuelTransfer.findMany({ where: dateWhere, include: { tank: { select: { name: true } }, generator: { select: { name: true } } } }),
    prisma.fuelTankTransfer.findMany({ where: dateWhere, include: { fromTank: { select: { name: true } }, toTank: { select: { name: true } } } }),
    prisma.fuelVehicleEntry.findMany({ where: dateWhere, include: { vehicle: { select: { name: true } } } }),
    prisma.fuelGeneratorEntry.findMany({ where: dateWhere, include: { generator: { select: { name: true } } } }),
  ]);

  const byDate = {};
  const ensure = (k) => {
    if (!byDate[k]) {
      byDate[k] = {
        date: k,
        tankStockIn: 0, tankStockAmount: 0,
        transferOut: 0,
        tankToTankOut: 0,
        vehicleFuel: 0, vehicleFuelAmount: 0,
        vehicleOil: 0, vehicleOilAmount: 0,
        generatorOil: 0, generatorOilAmount: 0,
      };
    }
    return byDate[k];
  };

  stock.forEach((s) => { const r = ensure(dayKey(s.date)); r.tankStockIn += s.quantity; r.tankStockAmount += Number(s.amount || 0); });
  transfers.forEach((t) => { const r = ensure(dayKey(t.date)); r.transferOut += t.quantity; });
  tankTransfers.forEach((t) => { const r = ensure(dayKey(t.date)); r.tankToTankOut += t.quantity; });
  vehicleEntries.forEach((e) => {
    const r = ensure(dayKey(e.date));
    if (e.entryType === 'fuel') { r.vehicleFuel += e.quantity; r.vehicleFuelAmount += Number(e.amount || 0); }
    else { r.vehicleOil += e.quantity; r.vehicleOilAmount += Number(e.amount || 0); }
  });
  generatorEntries.forEach((e) => {
    if (e.entryType !== 'oil') return;
    const r = ensure(dayKey(e.date));
    r.generatorOil += e.quantity; r.generatorOilAmount += Number(e.amount || 0);
  });

  const rows = Object.values(byDate)
    .map((r) => ({ ...r, totalAmount: r.tankStockAmount + r.vehicleFuelAmount + r.vehicleOilAmount + r.generatorOilAmount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totals = rows.reduce((acc, r) => {
    Object.keys(r).forEach((k) => { if (k !== 'date') acc[k] = (acc[k] || 0) + r[k]; });
    return acc;
  }, { tankStockIn: 0, tankStockAmount: 0, transferOut: 0, tankToTankOut: 0, vehicleFuel: 0, vehicleFuelAmount: 0, vehicleOil: 0, vehicleOilAmount: 0, generatorOil: 0, generatorOilAmount: 0, totalAmount: 0 });

  return { rows, totals };
}

module.exports = {
  listVehicles, createVehicle, updateVehicle,
  listVehicleEntries, getLastVehicleEntry, createVehicleEntry, updateVehicleEntry, deleteVehicleEntry,
  listGenerators, createGenerator, updateGenerator,
  listGeneratorEntries, getLastGeneratorEntry, createGeneratorEntry, updateGeneratorEntry, deleteGeneratorEntry,
  listDailySheets, getLastDailySheet, createDailySheet, updateDailySheet, deleteDailySheet,
  listTanks, getTank, createTank, updateTank,
  listFuelStock, createFuelStock, deleteFuelStock,
  listTransfers, createTransfer, deleteTransfer,
  listTankTransfers, createTankTransfer, deleteTankTransfer,
  getTankReport,
  getFuelBalance, getDailyReport,
};
