const prisma = require('../../config/db');

const CLOSED_LOAN_STATUSES = ['closed', 'completed', 'settled', 'cancelled', 'canceled'];

function parseReason(reasonText) {
  try {
    return reasonText ? JSON.parse(reasonText) : {};
  } catch {
    return {};
  }
}

function round2(value) {
  const n = Number(value) || 0;
  return Math.round(n * 100) / 100;
}

function toMonthDate(monthKey) {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1));
}

function formatMonthKey(dateObj) {
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function addMonthsToKey(monthKey, delta) {
  const dateObj = toMonthDate(monthKey);
  if (!dateObj) return null;
  const shifted = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth() + delta, 1));
  return formatMonthKey(shifted);
}

function normalizeSchedule(inputSchedule) {
  if (!Array.isArray(inputSchedule)) return [];

  const byMonth = new Map();
  inputSchedule.forEach((entry) => {
    const month = String(entry?.month || '').trim();
    if (!toMonthDate(month)) return;
    const amount = Math.max(0, round2(entry?.amount));
    byMonth.set(month, { month, amount });
  });

  return Array.from(byMonth.values()).sort((a, b) => {
    const aDate = toMonthDate(a.month);
    const bDate = toMonthDate(b.month);
    return aDate - bDate;
  });
}

function normalizeRecoveries(inputRecoveries) {
  if (!Array.isArray(inputRecoveries)) return [];

  const byMonth = new Map();
  inputRecoveries.forEach((entry) => {
    const month = String(entry?.month || '').trim();
    if (!toMonthDate(month)) return;
    const rawAmount = entry?.receivedAmount ?? entry?.amount;
    const receivedAmount = Math.max(0, round2(rawAmount));
    byMonth.set(month, { month, receivedAmount });
  });

  return Array.from(byMonth.values()).sort((a, b) => {
    const aDate = toMonthDate(a.month);
    const bDate = toMonthDate(b.month);
    return aDate - bDate;
  });
}

function pickBaseInstallment(totalAmount, schedule) {
  const positives = schedule.map((s) => round2(s.amount)).filter((v) => v > 0);
  if (positives.length > 0) {
    const freq = new Map();
    positives.forEach((value) => {
      const key = value.toFixed(2);
      freq.set(key, (freq.get(key) || 0) + 1);
    });

    const ranked = Array.from(freq.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return Number(b[0]) - Number(a[0]);
    });

    const mode = Number(ranked[0]?.[0] || 0);
    if (mode > 0) return mode;
  }

  const divisor = schedule.length > 0 ? schedule.length : 1;
  return Math.max(1, round2(totalAmount / divisor));
}

function autoShiftSchedule(scheduleInput, totalAmountInput) {
  const totalAmount = Math.max(0, round2(totalAmountInput));
  const schedule = normalizeSchedule(scheduleInput);
  if (!schedule.length) return [];

  const baseInstallment = pickBaseInstallment(totalAmount, schedule);
  let remaining = totalAmount;

  const normalized = schedule.map((entry) => {
    const safeAmount = Math.max(0, round2(entry.amount));
    const allocated = Math.min(safeAmount, remaining);
    remaining = round2(remaining - allocated);
    return { month: entry.month, amount: allocated };
  });

  const lastMonth = normalized[normalized.length - 1]?.month;
  if (!lastMonth) return normalized;

  let monthOffset = 1;
  while (remaining > 0) {
    const month = addMonthsToKey(lastMonth, monthOffset);
    if (!month) break;
    const amount = Math.min(baseInstallment, remaining);
    normalized.push({ month, amount: round2(amount) });
    remaining = round2(remaining - amount);
    monthOffset += 1;
  }

  return normalized;
}

function buildEffectiveScheduleFromRecoveries({ principalSchedule, recoveries }) {
  const normalizedPrincipal = normalizeSchedule(principalSchedule);
  if (!normalizedPrincipal.length) return [];

  const normalizedRecoveries = normalizeRecoveries(recoveries);
  const recoveryMap = new Map(
    normalizedRecoveries.map((entry) => [entry.month, Math.max(0, round2(entry.receivedAmount))])
  );

  let carryForward = 0;
  const effective = normalizedPrincipal.map((entry) => {
    const expectedAmount = round2(entry.amount);
    const receivedRaw = recoveryMap.has(entry.month) ? recoveryMap.get(entry.month) : expectedAmount;
    const receivedAmount = Math.min(expectedAmount, Math.max(0, round2(receivedRaw)));
    carryForward = round2(carryForward + (expectedAmount - receivedAmount));
    return { month: entry.month, amount: receivedAmount };
  });

  const baseInstallment = pickBaseInstallment(
    normalizedPrincipal.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    normalizedPrincipal
  );
  const lastMonth = normalizedPrincipal[normalizedPrincipal.length - 1]?.month;

  if (!lastMonth) return effective;

  let monthOffset = 1;
  while (carryForward > 0) {
    const month = addMonthsToKey(lastMonth, monthOffset);
    if (!month) break;

    const shiftedAmount = Math.min(baseInstallment, carryForward);
    effective.push({ month, amount: round2(shiftedAmount) });
    carryForward = round2(carryForward - shiftedAmount);
    monthOffset += 1;
  }

  return effective;
}

function buildLoanScheduleView(row, parsedReason) {
  const rawBaseSchedule = Array.isArray(parsedReason.baseSchedule)
    ? parsedReason.baseSchedule
    : (Array.isArray(parsedReason.schedule) ? parsedReason.schedule : []);

  const baseSchedule = autoShiftSchedule(rawBaseSchedule, row.amount);
  const recoveries = normalizeRecoveries(parsedReason.recoveries);

  const schedule = String(row.type || '').toLowerCase() === 'loan'
    ? buildEffectiveScheduleFromRecoveries({ principalSchedule: baseSchedule, recoveries })
    : baseSchedule;

  return {
    baseSchedule,
    recoveries,
    schedule,
  };
}

function isUnsettledLoanStatus(status) {
  const key = String(status || '').toLowerCase();
  return !CLOSED_LOAN_STATUSES.includes(key);
}

function businessError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function ensureSingleActiveLoan(employeeId, excludeId = null) {
  const where = {
    employeeId,
    type: 'loan',
    NOT: {
      status: {
        in: CLOSED_LOAN_STATUSES,
      },
    },
  };

  if (excludeId) {
    where.id = { not: excludeId };
  }

  const existing = await prisma.advanceLoan.findFirst({ where, select: { id: true } });
  if (existing) {
    throw businessError('Employee already has an active loan. Close/settle it before creating another.');
  }
}

async function list() {
  const rows = await prisma.advanceLoan.findMany({
    orderBy: { id: 'desc' },
    include: { employee: true }
  });

  return rows.map((row) => {
    const parsed = parseReason(row.reason);
    const view = buildLoanScheduleView(row, parsed);

    return {
      ...row,
      baseSchedule: view.baseSchedule,
      recoveries: view.recoveries,
      schedule: view.schedule,
      remarks: parsed.remarks || ''
    };
  });
}

async function create(payload) {
  const { employeeId, amount, type = 'advance', reason, status = 'pending', schedule = [], recoveries = [], remarks } = payload;
  const normalizedType = String(type || 'advance').toLowerCase();
  const normalizedStatus = String(status || 'pending').toLowerCase();
  const parsedEmployeeId = parseInt(employeeId, 10);
  const parsedAmount = parseFloat(amount);

  if (!parsedEmployeeId || Number.isNaN(parsedEmployeeId)) {
    throw businessError('Invalid employeeId');
  }
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw businessError('Amount must be greater than 0');
  }

  if (normalizedType === 'loan' && isUnsettledLoanStatus(normalizedStatus)) {
    await ensureSingleActiveLoan(parsedEmployeeId);
  }

  const baseSchedule = autoShiftSchedule(schedule, parsedAmount);
  const normalizedRecoveries = normalizeRecoveries(recoveries);
  const reasonJson = JSON.stringify({
    baseSchedule,
    schedule: baseSchedule,
    recoveries: normalizedRecoveries,
    remarks,
    reason,
  });
  
  const created = await prisma.advanceLoan.create({
    data: {
      employeeId: parsedEmployeeId,
      amount: parsedAmount,
      type: normalizedType,
      reason: reasonJson,
      status: normalizedStatus
    },
    include: { employee: true }
  });

  const view = buildLoanScheduleView(created, {
    baseSchedule,
    recoveries: normalizedRecoveries,
    remarks,
  });

  return {
    ...created,
    baseSchedule: view.baseSchedule,
    recoveries: view.recoveries,
    schedule: view.schedule,
    remarks: remarks || ''
  };
}

async function update(id, payload) {
  const existing = await prisma.advanceLoan.findUnique({ where: { id } });
  if (!existing) throw new Error('Record not found');

  const existingReason = parseReason(existing.reason);

  const nextEmployeeId = payload.employeeId !== undefined
    ? parseInt(payload.employeeId, 10)
    : existing.employeeId;
  const nextAmount = payload.amount !== undefined
    ? parseFloat(payload.amount)
    : existing.amount;
  const nextType = String(payload.type || existing.type || 'advance').toLowerCase();
  const nextStatus = String(payload.status || existing.status || 'pending').toLowerCase();

  if (!nextEmployeeId || Number.isNaN(nextEmployeeId)) {
    throw businessError('Invalid employeeId');
  }
  if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
    throw businessError('Amount must be greater than 0');
  }

  if (nextType === 'loan' && isUnsettledLoanStatus(nextStatus)) {
    await ensureSingleActiveLoan(nextEmployeeId, id);
  }

  const nextSchedule = Array.isArray(payload.schedule)
    ? payload.schedule
    : (Array.isArray(existingReason.baseSchedule)
      ? existingReason.baseSchedule
      : (Array.isArray(existingReason.schedule) ? existingReason.schedule : []));
  const nextRecoveries = Array.isArray(payload.recoveries)
    ? payload.recoveries
    : (Array.isArray(existingReason.recoveries) ? existingReason.recoveries : []);
  const nextRemarks = payload.remarks !== undefined
    ? payload.remarks
    : (existingReason.remarks || '');
  const nextReason = payload.reason !== undefined
    ? payload.reason
    : (existingReason.reason || '');

  const baseSchedule = autoShiftSchedule(nextSchedule, nextAmount);
  const normalizedRecoveries = normalizeRecoveries(nextRecoveries);

  const reasonJson = JSON.stringify({
    baseSchedule,
    schedule: baseSchedule,
    recoveries: normalizedRecoveries,
    remarks: nextRemarks,
    reason: nextReason
  });

  const updated = await prisma.advanceLoan.update({
    where: { id },
    data: {
      employeeId: nextEmployeeId,
      amount: nextAmount,
      type: nextType,
      status: nextStatus,
      reason: reasonJson,
    },
    include: { employee: true }
  });

  const view = buildLoanScheduleView(updated, {
    baseSchedule,
    recoveries: normalizedRecoveries,
    remarks: nextRemarks,
  });

  return {
    ...updated,
    baseSchedule: view.baseSchedule,
    recoveries: view.recoveries,
    schedule: view.schedule,
    remarks: nextRemarks
  };
}

async function remove(id) {
  const existing = await prisma.advanceLoan.findUnique({ where: { id } });
  if (!existing) throw new Error('Record not found');
  await prisma.advanceLoan.delete({ where: { id } });
}

module.exports = { list, create, update, remove };
