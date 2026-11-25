const prisma = require('../../config/db');
const clinicSvc = require('./clinic.service');

// Clinic → Transactions → Cash Pending / Credit Pending (owner, 2026-11-17).
//
// Cash Pending: a cash file closed on Discharge and Refund with "Goes to Cash
// Pending". What it owes is its Provisional Bill's Balance (owner,
// 2026-11-18) — the screen shows the Provisional Bill's Bill Amount /
// Discount / Received / Balance, live. The patient pays it later here; each
// receipt is an ordinary admission payment (addAdmissionPayment), tagged
// againstCashPending, so it counts on the day it's received everywhere
// receipts count and lowers the Provisional Bill's Balance.
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
  // Each file's Provisional Bill figures, live.
  const bills = await Promise.all(admissions.map((a) => clinicSvc.getProvisionalBillDetail(a.id).then((d) => d.balanceInfo).catch(() => null)));
  const rows = admissions.map((a, i) => {
    const b = bills[i] || {};
    return {
      admissionId: a.id,
      admissionNo: a.admissionNo,
      patientName: `${a.patientTitle || ''} ${a.patientName || ''}`.trim(),
      phoneNo: a.phoneNo || '',
      status: a.status,
      closedAt: closedAt.get(a.id) || null,
      approvedBy: a.dischargeCashPendingBy || null,
      pendingAtClose: round2(a.dischargeCashPending),
      billAmount: round2(b.billAmount),
      discount: round2(b.discount),
      received: round2(b.amountReceived),
      balance: round2(Math.max(0, Number(b.balance) || 0)),
      receipts: a.payments.map((p) => ({ id: p.id, serialNo: p.serialNo, amount: Number(p.amount), receivedAt: p.receivedAt })),
    };
  });
  const shown = show === 'all' ? rows : show === 'cleared' ? rows.filter((r) => r.balance <= 0) : rows.filter((r) => r.balance > 0);
  return {
    rows: shown,
    totalRemaining: round2(rows.reduce((s, r) => s + r.balance, 0)),
    openCount: rows.filter((r) => r.balance > 0).length,
  };
}

async function receiveCashPending(admissionId, { amount, serialNo, receivedBy, confirmNotDuplicate, backDate, paymentType } = {}, actor = null) {
  const id = Number(admissionId);
  const a = await prisma.clinicAdmission.findUnique({ where: { id }, select: { id: true, dischargeCashPending: true } });
  if (!a || !(Number(a.dischargeCashPending) > 0)) throw fail(404, 'This file has no cash pending');
  // What's owed = the Provisional Bill's Balance now.
  const prov = await clinicSvc.getProvisionalBillDetail(id);
  const remaining = round2(Math.max(0, Number(prov.balanceInfo?.balance) || 0));
  if (!(remaining > 0)) throw fail(400, 'Nothing is pending on this file — its Provisional Bill balance is 0');
  const amt = Number(amount);
  if (!(amt > 0)) throw fail(400, 'Enter the amount received');
  if (amt > remaining + 0.005) throw fail(400, `Only Rs. ${remaining.toLocaleString()} is pending on this file`);
  // Same receipt path as Receiving against Admission (Slip #, back date,
  // the Patients List duplicate check), tagged against the pending balance.
  return clinicSvc.addAdmissionPayment(id, { serialNo, amount: amt, paymentType: paymentType || 'cash', receivedBy, confirmNotDuplicate, backDate, againstCashPending: true, actor });
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

// `dateAndTerm`: the report applies the slip dates and the search together
// (the screen's search looks across all dates).
async function listCreditPending({ from, to, q, show, dateAndTerm = false, take = 2000 } = {}) {
  const term = String(q || '').trim();
  const where = { status: 'active', OR: CC_TYPES.map((t) => ({ paymentType: { equals: t, mode: 'insensitive' } })) };
  if (term) {
    where.AND = [{ OR: [
      { serialNo: { contains: term, mode: 'insensitive' } },
      { patientName: { contains: term, mode: 'insensitive' } },
    ] }];
  }
  if ((!term || dateAndTerm) && (isIsoDate(from) || isIsoDate(to))) {
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
      ccSettlements: { orderBy: { id: 'asc' }, select: { id: true, receivedDate: true, receivedAmount: true, bankCharges: true, bankAccountId: true, remarks: true, createdByName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take,
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
async function settleCreditPending({ visitIds, receivedDate, receivedAmount, remarks, createdByName, bankAccountId } = {}) {
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
  // Optional (Bank Reconciliation, 077): the bank account the money came into.
  const bankId = bankAccountId ? Number(bankAccountId) : null;
  if (bankId && !(await prisma.accBankAccount.findUnique({ where: { id: bankId }, select: { id: true } }))) throw fail(400, 'Bank Account not found');

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
      bankAccountId: bankId,
      remarks: String(remarks || '').trim() || null, createdByName: String(createdByName || '').trim() || null,
    },
  })));
  return { slips: parts.length, received: got, bankCharges: charges };
}

async function undoCreditSettlement(id) {
  const s = await prisma.clinicCcSettlement.findUnique({ where: { id: Number(id) } });
  if (!s) throw fail(404, 'Not found');
  // A bank-statement match on it goes too (the statement line is unmatched).
  await prisma.$transaction([
    prisma.accBankReconLink.deleteMany({ where: { bookType: 'cc', bookId: s.id } }),
    prisma.clinicCcSettlement.delete({ where: { id: s.id } }),
  ]);
  return { id: s.id };
}

// ─── Reports (Clinic → Reports, owner 2026-11-18) ───────────────────────────
// Same figures as the two Transactions screens, as printable reports.

const PKT_DATE = (d) => (d ? PKT_DAY.format(new Date(d)) : null);
const inDates = (day, from, to) => (!isIsoDate(from) || (day && day >= from)) && (!isIsoDate(to) || (day && day <= to));
const sumBy = (rows, k) => round2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));

// Cash Pending files; From / To = the day the file was closed (blank = all).
async function cashPendingReport({ from, to, show = 'pending', q } = {}) {
  const { rows: all } = await listCashPending({ q, show: 'all' });
  const rows = all
    .filter((r) => inDates(PKT_DATE(r.closedAt), from, to))
    .filter((r) => (show === 'all' ? true : show === 'cleared' ? r.balance <= 0 : r.balance > 0))
    .sort((a, b) => (new Date(a.closedAt || 0) - new Date(b.closedAt || 0)) || String(a.admissionNo).localeCompare(String(b.admissionNo)));
  rows.forEach((r) => { r.receivedAgainstPending = round2(r.receipts.reduce((s, p) => s + p.amount, 0)); });
  return {
    filters: { from: isIsoDate(from) ? from : null, to: isIsoDate(to) ? to : null, show, q: String(q || '').trim() || null },
    rows,
    totals: {
      files: rows.length,
      billAmount: sumBy(rows, 'billAmount'), discount: sumBy(rows, 'discount'), received: sumBy(rows, 'received'),
      balance: sumBy(rows, 'balance'), pendingAtClose: sumBy(rows, 'pendingAtClose'), receivedAgainstPending: sumBy(rows, 'receivedAgainstPending'),
    },
  };
}

// CC slips; From / To = the slip's business day (blank = all).
async function creditPendingReport({ from, to, show = 'pending', q } = {}) {
  const { rows: all } = await listCreditPending({ from, to, q, show: 'all', dateAndTerm: true, take: 20000 });
  const rows = all
    .filter((r) => (show === 'all' ? true : show === 'settled' ? r.pending <= 0 : r.pending > 0))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const bankIds = [...new Set(rows.flatMap((r) => r.settlements.map((x) => x.bankAccountId)).filter(Boolean))];
  const banks = bankIds.length ? await prisma.accBankAccount.findMany({ where: { id: { in: bankIds } }, select: { id: true, bankName: true } }) : [];
  const bankName = new Map(banks.map((b) => [b.id, b.bankName]));
  rows.forEach((r) => r.settlements.forEach((x) => { x.bankName = x.bankAccountId ? bankName.get(x.bankAccountId) || null : null; }));
  return {
    filters: { from: isIsoDate(from) ? from : null, to: isIsoDate(to) ? to : null, show, q: String(q || '').trim() || null },
    rows,
    totals: {
      slips: rows.length,
      amount: sumBy(rows, 'amount'), balancePaid: sumBy(rows, 'balancePaid'), received: sumBy(rows, 'received'),
      bankCharges: sumBy(rows, 'bankCharges'), pending: sumBy(rows, 'pending'),
    },
  };
}

module.exports = {
  listCashPending, receiveCashPending, setCashPendingMark, listCreditPending, settleCreditPending, undoCreditSettlement,
  cashPendingReport, creditPendingReport,
};
