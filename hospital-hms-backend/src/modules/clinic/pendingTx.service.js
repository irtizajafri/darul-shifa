const prisma = require('../../config/db');
const clinicSvc = require('./clinic.service');

// Clinic → Transactions → Cash Pending / Credit Pending (owner, 2026-11-17).
//
// Cash Pending: a cash file closed on Discharge and Refund with "Goes to Cash
// Pending" keeps its unpaid balance (ClinicAdmission.dischargeCashPending).
// The patient pays it later here; each receipt is an ordinary admission
// payment (addAdmissionPayment), tagged againstCashPending, so it counts on
// the day it's received everywhere receipts count (Patients List, Daily
// Statement, Revenue Dashboard, Cash Flow).
//
// Credit Pending: CC (credit card) OPD slips wait for the bank. When the bank
// pays, its amount and charges are recorded per slip (ClinicCcSettlement).
// Tracking only — the slips' revenue is counted as before.

const fail = (status, message) => Object.assign(new Error(message), { status });
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const PKT_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
const pktToday = () => PKT_DAY.format(new Date());

// ─── Cash Pending ────────────────────────────────────────────────────────────

async function listCashPending({ q, show } = {}) {
  const term = String(q || '').trim();
  const admissions = await prisma.clinicAdmission.findMany({
    where: {
      dischargeCashPending: { gt: 0 },
      ...(term ? { OR: [
        { admissionNo: { contains: term, mode: 'insensitive' } },
        { patientName: { contains: term, mode: 'insensitive' } },
        { phoneNo: { contains: term } },
      ] } : {}),
    },
    select: {
      id: true, admissionNo: true, patientTitle: true, patientName: true, phoneNo: true, status: true,
      dischargeCashPending: true, dischargeCashPendingBy: true,
      payments: { where: { againstCashPending: true }, orderBy: { receivedAt: 'asc' }, select: { id: true, serialNo: true, amount: true, receivedAt: true } },
    },
    orderBy: { id: 'desc' },
  });
  // When each file was (last) closed.
  const logs = admissions.length
    ? await prisma.clinicAdmissionStatusLog.findMany({
        where: { admissionId: { in: admissions.map((a) => a.id) }, toStatus: 'closed' },
        orderBy: { id: 'asc' },
        select: { admissionId: true, changedAt: true },
      })
    : [];
  const closedAt = new Map(logs.map((l) => [l.admissionId, l.changedAt]));
  const rows = admissions.map((a) => {
    const pending = round2(a.dischargeCashPending);
    const received = round2(a.payments.reduce((s, p) => s + Number(p.amount), 0));
    return {
      admissionId: a.id,
      admissionNo: a.admissionNo,
      patientName: `${a.patientTitle || ''} ${a.patientName || ''}`.trim(),
      phoneNo: a.phoneNo || '',
      status: a.status,
      closedAt: closedAt.get(a.id) || null,
      approvedBy: a.dischargeCashPendingBy || null,
      pending,
      received,
      remaining: round2(Math.max(0, pending - received)),
      receipts: a.payments.map((p) => ({ id: p.id, serialNo: p.serialNo, amount: Number(p.amount), receivedAt: p.receivedAt })),
    };
  });
  const shown = show === 'all' ? rows : show === 'cleared' ? rows.filter((r) => r.remaining <= 0) : rows.filter((r) => r.remaining > 0);
  return {
    rows: shown,
    totalRemaining: round2(rows.reduce((s, r) => s + r.remaining, 0)),
    openCount: rows.filter((r) => r.remaining > 0).length,
  };
}

async function receiveCashPending(admissionId, { amount, serialNo, receivedBy, confirmNotDuplicate, backDate } = {}) {
  const id = Number(admissionId);
  const a = await prisma.clinicAdmission.findUnique({ where: { id }, select: { id: true, dischargeCashPending: true } });
  if (!a || !(Number(a.dischargeCashPending) > 0)) throw fail(404, 'This file has no cash pending');
  const got = await prisma.clinicAdmissionPayment.aggregate({ where: { admissionId: id, againstCashPending: true }, _sum: { amount: true } });
  const remaining = round2(Number(a.dischargeCashPending) - (Number(got._sum.amount) || 0));
  const amt = Number(amount);
  if (!(amt > 0)) throw fail(400, 'Enter the amount received');
  if (amt > remaining + 0.005) throw fail(400, `Only Rs. ${remaining.toLocaleString()} is pending on this file`);
  // Same receipt path as Receiving against Admission (Slip #, back date,
  // the Patients List duplicate check), tagged against the pending balance.
  return clinicSvc.addAdmissionPayment(id, { serialNo, amount: amt, paymentType: 'cash', receivedBy, confirmNotDuplicate, backDate, againstCashPending: true });
}

// Provisional Bill: mark (or unmark) a cash file "Goes to Cash Pending"
// before discharge. Nothing is owed yet — the amount is fixed when the file
// closes on Discharge and Refund.
async function setCashPendingMark(admissionId, { marked, changedBy } = {}) {
  const a = await prisma.clinicAdmission.findUnique({ where: { id: Number(admissionId) }, select: { id: true, status: true, patientCategory: true } });
  if (!a) throw fail(404, 'Admission not found');
  if (a.patientCategory === 'panel') throw fail(400, 'Cash Pending is for cash files — a panel file uses "Goes to Other Income"');
  if (a.status === 'closed' || a.status === 'wipeout') throw fail(400, 'This file is already closed');
  return prisma.clinicAdmission.update({
    where: { id: a.id },
    data: marked
      ? { cashPendingMarked: true, cashPendingMarkedBy: String(changedBy || '').trim() || null, cashPendingMarkedAt: new Date() }
      : { cashPendingMarked: false, cashPendingMarkedBy: null, cashPendingMarkedAt: null },
    select: { id: true, cashPendingMarked: true, cashPendingMarkedBy: true, cashPendingMarkedAt: true },
  });
}

// ─── Credit Pending (CC slips) ───────────────────────────────────────────────

const CC_TYPES = ['cc', 'c card', 'credit card'];

async function listCreditPending({ from, to, q, show } = {}) {
  const term = String(q || '').trim();
  const where = { status: 'active', OR: CC_TYPES.map((t) => ({ paymentType: { equals: t, mode: 'insensitive' } })) };
  if (term) {
    where.AND = [{ OR: [
      { serialNo: { contains: term, mode: 'insensitive' } },
      { patientName: { contains: term, mode: 'insensitive' } },
    ] }];
  } else if (isIsoDate(from) || isIsoDate(to)) {
    // Business days (08:00 → 07:59 PKT).
    const f = isIsoDate(from) ? from : to;
    const t = isIsoDate(to) ? to : f;
    where.createdAt = { gte: new Date(`${f}T08:00:00+05:00`), lt: new Date(Date.parse(`${t}T08:00:00+05:00`) + 86400000) };
  }
  const visits = await prisma.clinicOpdVisit.findMany({
    where,
    select: {
      id: true, serialNo: true, patientType: true, patientName: true, department: true, totalAmount: true, createdAt: true,
      balancePayments: { select: { amount: true } },
      ccSettlements: { orderBy: { id: 'asc' }, select: { id: true, receivedDate: true, receivedAmount: true, bankCharges: true, remarks: true, createdByName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });
  const rows = visits.map((v) => {
    const amount = round2(v.totalAmount);
    // Part already taken through Receive Balance against Slip.
    const balancePaid = round2(v.balancePayments.reduce((s, p) => s + Number(p.amount), 0));
    const settled = round2(v.ccSettlements.reduce((s, x) => s + Number(x.receivedAmount) + Number(x.bankCharges), 0));
    return {
      visitId: v.id, serialNo: v.serialNo, patientName: `${v.patientType || ''} ${v.patientName || ''}`.trim(), department: v.department,
      createdAt: v.createdAt, amount, balancePaid,
      received: round2(v.ccSettlements.reduce((s, x) => s + Number(x.receivedAmount), 0)),
      bankCharges: round2(v.ccSettlements.reduce((s, x) => s + Number(x.bankCharges), 0)),
      pending: round2(Math.max(0, amount - balancePaid - settled)),
      settlements: v.ccSettlements.map((x) => ({ ...x, receivedAmount: Number(x.receivedAmount), bankCharges: Number(x.bankCharges) })),
    };
  });
  const shown = show === 'all' ? rows : show === 'settled' ? rows.filter((r) => r.pending <= 0) : rows.filter((r) => r.pending > 0);
  return { rows: shown, totalPending: round2(rows.reduce((s, r) => s + r.pending, 0)), pendingCount: rows.filter((r) => r.pending > 0).length };
}

// The bank paid for one or more slips: the amount it credited, the rest of
// those slips' pending is its charges, shared in proportion to each slip.
async function settleCreditPending({ visitIds, receivedDate, receivedAmount, remarks, createdByName } = {}) {
  const ids = [...new Set((Array.isArray(visitIds) ? visitIds : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) throw fail(400, 'Tick the slips the bank has paid');
  const day = isIsoDate(receivedDate) ? receivedDate : null;
  if (!day) throw fail(400, 'Select the date the bank paid');
  if (day > pktToday()) throw fail(400, 'The received date can\'t be in the future');
  const { rows } = await listCreditPending({ show: 'all' });
  const byId = new Map(rows.map((r) => [r.visitId, r]));
  const picked = ids.map((id) => byId.get(id));
  if (picked.some((r) => !r)) throw fail(400, 'A ticked slip is not a CC slip');
  const done = picked.find((r) => r.pending <= 0);
  if (done) throw fail(400, `Slip # ${done.serialNo} is already settled`);
  const total = round2(picked.reduce((s, r) => s + r.pending, 0));
  const got = round2(receivedAmount);
  if (!(got > 0)) throw fail(400, 'Enter the amount the bank paid');
  if (got > total + 0.005) throw fail(400, `The bank amount is more than these slips' pending total (Rs. ${total.toLocaleString()})`);
  const charges = round2(total - got);

  // Split received / charges by each slip's pending; the last slip takes the
  // rounding so the parts add up exactly.
  let leftGot = got;
  let leftCharges = charges;
  const parts = picked.map((r, i) => {
    if (i === picked.length - 1) return { r, received: round2(leftGot), charges: round2(leftCharges) };
    const share = total ? r.pending / total : 0;
    const rec = round2(got * share);
    const ch = round2(r.pending - rec);
    leftGot = round2(leftGot - rec);
    leftCharges = round2(leftCharges - ch);
    return { r, received: rec, charges: ch };
  });
  await prisma.$transaction(parts.map((p) => prisma.clinicCcSettlement.create({
    data: {
      visitId: p.r.visitId, receivedDate: new Date(`${day}T00:00:00Z`), receivedAmount: p.received, bankCharges: p.charges,
      remarks: String(remarks || '').trim() || null, createdByName: String(createdByName || '').trim() || null,
    },
  })));
  return { slips: parts.length, received: got, bankCharges: charges };
}

async function undoCreditSettlement(id) {
  const s = await prisma.clinicCcSettlement.findUnique({ where: { id: Number(id) } });
  if (!s) throw fail(404, 'Not found');
  await prisma.clinicCcSettlement.delete({ where: { id: s.id } });
  return { id: s.id };
}

module.exports = { listCashPending, receiveCashPending, setCashPendingMark, listCreditPending, settleCreditPending, undoCreditSettlement };
