const prisma = require('../../config/db');
const accountsService = require('../accounts/accounts.service');

// Advance/Loan is always posted to the Non-Corporate book, Cash mode — the
// specific Sub Account is whatever's linked to the 'advance-loan' system
// head in List Attachments (Accounts → Cash GL → Parameters). Not
// configurable per-record: this module doesn't collect entityType/payment
// mode from the user, by design (see chat with user, 2026-09-09).
const ADVANCE_LOAN_VOUCHER_ENTITY_TYPE = 'non-corporate';

// Creates the auto Voucher Expense for a just-created, already-disbursed
// (status='active') Advance/Loan. Returns { voucherNo } on success, or
// { warning } if the 'advance-loan' head isn't linked to a Sub Account yet
// (List Attachments) — the Advance/Loan record itself is never blocked by
// this; HR can still record it, accounts just needs to finish setup.
async function tryCreateAdvanceLoanVoucher(advanceLoan) {
  try {
    const chain = await accountsService.getAdvanceLoanVoucherAccountChain(ADVANCE_LOAN_VOUCHER_ENTITY_TYPE);
    if (!chain) {
      return { warning: 'Advance/Loan save ho gaya, lekin voucher nahi bana — Accounts → Cash GL → Parameters → List Attachments mein "Employee Advance/Loan" head ko pehle kisi account se link karein.' };
    }
    const employee = advanceLoan.employee;
    const payeeName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : 'Unknown Employee';
    const voucherDate = new Date().toISOString().slice(0, 10);
    const voucher = await accountsService.createVoucherExpense({
      entityType: ADVANCE_LOAN_VOUCHER_ENTITY_TYPE,
      mode: 'cash',
      bankId: null,
      voucherDate,
      entries: [{
        mainGlId:      chain.mainGlId,
        subGlId:       chain.subGlId,
        mainAccountId: chain.mainAccountId,
        subAccountId:  chain.subAccountId,
        accountCode:   chain.accountCode,
        accountName:   chain.accountName,
        payeeName,
        amount:      advanceLoan.amount,
        particulars: `${advanceLoan.type === 'loan' ? 'Loan' : 'Advance'} issued — ${payeeName}`,
      }],
    });
    return { voucherNo: voucher.voucherNo };
  } catch (err) {
    // Never let a voucher-posting failure undo an already-saved Advance/Loan
    // record — HR's record is the source of truth; surface the failure as a
    // warning so accounts can post it manually instead.
    return { warning: `Advance/Loan save ho gaya, lekin voucher banate waqt error aayi: ${err.message}` };
  }
}

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

// ─── Advance → oldest unpaid salary month (owner, designed 2026-10-02) ────────
// An advance is deducted from the employee's OLDEST salary month that Accounts
// hasn't paid yet (EmployeeSalaryPayment, written when a salary voucher is
// posted) — not simply the month it was given in — and can't exceed what the
// employee has earned in that month so far minus the advances already taken
// against it. The month moves on only once that month's salary is paid.
//
// Kept safe for staff whose salaries aren't paid through Voucher Expense yet:
// an employee with no salary payment on record keeps the old rule (the issue
// date's month). Loans are untouched.
const ADVANCE_UNPAID_LOOKBACK_MONTHS = 3; // same backlog window as Accounts' salary lock

function issueMonthKey(issueDate) {
  const m = String(issueDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { key: `${m[1]}-${m[2]}`, day: Number(m[3]) };
  // No date given: today on the PKT clock.
  const pkt = new Date(Date.now() + 5 * 3600 * 1000).toISOString();
  return { key: pkt.slice(0, 7), day: Number(pkt.slice(8, 10)) };
}

function daysInMonthKey(monthKey) {
  const [y, mo] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

// Month an advance given on issueDate belongs to, and how much more can be
// given against it. excludeId leaves one record out of "already taken".
async function getAdvanceTarget({ employeeId, issueDate, excludeId = null }) {
  const empId = parseInt(employeeId, 10);
  if (!empId) throw businessError('Invalid employeeId');
  const employee = await prisma.employee.findUnique({ where: { id: empId }, select: { id: true, empCode: true, salaryMonthly: true } });
  if (!employee) throw businessError('Employee not found', 404);

  const issue = issueMonthKey(issueDate);
  const salaryMonthly = Number(employee.salaryMonthly) || 0;

  // Paid salary months on record, as YYYY-MM.
  const paidRows = employee.empCode
    ? await prisma.employeeSalaryPayment.findMany({ where: { empCode: String(employee.empCode) }, select: { salaryMonth: true, salaryYear: true } })
    : [];
  const paidKeys = new Set(paidRows.map((r) => `${r.salaryYear}-${String(r.salaryMonth).padStart(2, '0')}`));

  let month = issue.key;
  let basis = 'issue-month';
  if (paidKeys.size) {
    // Oldest unpaid month from the lookback window up to the issue month;
    // if those are all paid, the first unpaid month after it.
    let cursor = addMonthsToKey(issue.key, -ADVANCE_UNPAID_LOOKBACK_MONTHS);
    const lastPaid = [...paidKeys].sort().pop();
    // Never before the month after the employee's first-ever paid month
    // window — months before payroll tracking began aren't "unpaid".
    const firstPaid = [...paidKeys].sort()[0];
    if (cursor < firstPaid) cursor = firstPaid;
    while (paidKeys.has(cursor) && cursor <= lastPaid) cursor = addMonthsToKey(cursor, 1);
    month = cursor;
    basis = 'oldest-unpaid';
  }

  // Earned so far in that month as of the issue date: a month already over
  // in full; the issue month up to the issue day; a later month nothing yet.
  let accrued = 0;
  if (month < issue.key) accrued = salaryMonthly;
  else if (month === issue.key) accrued = salaryMonthly * issue.day / daysInMonthKey(month);

  const others = await prisma.advanceLoan.findMany({
    where: { employeeId: empId, type: 'advance', NOT: { status: { in: CLOSED_LOAN_STATUSES } }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { amount: true, reason: true },
  });
  const alreadyTaken = others.reduce((sum, row) => {
    const parsed = parseReason(row.reason);
    const sched = Array.isArray(parsed.baseSchedule) ? parsed.baseSchedule : (Array.isArray(parsed.schedule) ? parsed.schedule : []);
    return sum + sched.filter((e) => e.month === month).reduce((s2, e) => s2 + (Number(e.amount) || 0), 0);
  }, 0);

  return {
    month,
    basis,
    issueMonth: issue.key,
    salaryMonthly,
    accrued: Math.floor(accrued),
    alreadyTaken: round2(alreadyTaken),
    // No salary set on the employee → no limit can be worked out (the
    // advance isn't blocked; the screen says so).
    available: salaryMonthly > 0 ? Math.max(0, Math.floor(accrued - alreadyTaken)) : null,
  };
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
      remarks: parsed.remarks || '',
      issueDate: parsed.issueDate || null,
    };
  });
}

async function create(payload) {
  const { employeeId, amount, type = 'advance', reason, status = 'pending', schedule = [], recoveries = [], remarks, issueDate } = payload;
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

  // Advance: its month and limit come from the salary-payment record (see
  // getAdvanceTarget) — whatever month the screen sent is replaced.
  let advanceSchedule = schedule;
  let advanceRecoveries = recoveries;
  if (normalizedType === 'advance') {
    const target = await getAdvanceTarget({ employeeId: parsedEmployeeId, issueDate });
    if (target.available != null && parsedAmount > target.available) {
      throw businessError(`${target.month} ki tankhwah mein se abhi sirf Rs. ${target.available.toLocaleString('en-PK')} advance ho sakta hai (ab tak ki tankhwah Rs. ${target.accrued.toLocaleString('en-PK')} − pehle se advance Rs. ${target.alreadyTaken.toLocaleString('en-PK')})`);
    }
    advanceSchedule = [{ month: target.month, amount: parsedAmount }];
    advanceRecoveries = [{ month: target.month, receivedAmount: parsedAmount }];
  }

  const baseSchedule = autoShiftSchedule(advanceSchedule, parsedAmount);
  const normalizedRecoveries = normalizeRecoveries(advanceRecoveries);
  const reasonJson = JSON.stringify({
    baseSchedule,
    schedule: baseSchedule,
    recoveries: normalizedRecoveries,
    remarks,
    reason,
    issueDate: issueDate || null,
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

  // 'active' means the money is actually disbursed right now (this module
  // has no separate pending→approved step in current use — the frontend
  // always saves with status:'active' directly) — that's the moment an
  // expense voucher should exist, not later.
  let voucherResult = null;
  if (normalizedStatus === 'active') {
    voucherResult = await tryCreateAdvanceLoanVoucher(created);
  }

  return {
    ...created,
    baseSchedule: view.baseSchedule,
    recoveries: view.recoveries,
    schedule: view.schedule,
    remarks: remarks || '',
    voucherNo: voucherResult?.voucherNo || null,
    voucherWarning: voucherResult?.warning || null,
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
  const nextIssueDate = payload.issueDate !== undefined
    ? payload.issueDate
    : (existingReason.issueDate || null);

  const baseSchedule = autoShiftSchedule(nextSchedule, nextAmount);
  const normalizedRecoveries = normalizeRecoveries(nextRecoveries);

  const reasonJson = JSON.stringify({
    baseSchedule,
    schedule: baseSchedule,
    recoveries: normalizedRecoveries,
    remarks: nextRemarks,
    reason: nextReason,
    issueDate: nextIssueDate,
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

module.exports = { list, create, update, remove, getAdvanceTarget };
