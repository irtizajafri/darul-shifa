const prisma = require('../../config/db');

// Accounts → Reports → Slip & Admission Refund Statement (owner, 2026-11-21).
// Every money refund the Clinic gave in the date range, for one book (Panel
// slips / admissions → Corporate, everything else → Cash GL), with the
// voucher it went out on.
//   Since 20-Oct-2026 each Slip Refund / Admission Refund saves a Pending
//   Draft (clinicRefundKind 'slip' | 'admission'); Day Close posts it — one
//   row per refund, its voucher # or "Pending".
//   Refunds with no draft (before then, or while the refund head wasn't
//   linked): the slip's refund as recorded on it (a slip keeps one running
//   total), and Admission Refund rows with their own voucher #. Their voucher
//   # is otherwise found from the voucher line "…AGAINST SLIP / ADMISSION
//   #a,b,c".
//   Cancel Slip (no money back) isn't listed.
// Day = the draft's business day, else the 8 AM business day of the refund.
// Read-only.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fail = (status, message) => Object.assign(new Error(message), { status });
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
// 8:00 AM PKT business day of a stored UTC time: +5h − 8h.
const bizDay = (d) => (d ? new Date(new Date(d).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10) : null);
const voucherDay = (d) => (d ? new Date(new Date(d).getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10) : null);
const bookOfPayment = (paymentType) => (String(paymentType || '').toLowerCase() === 'panel' ? 'corporate' : 'non-corporate');
const normRef = (s) => String(s || '').trim().replace(/^0+(?=\d)/, '').toUpperCase();

// "…REFUND TO THE PATIENT AGAINST SLIP #12,15" → voucher # per slip / admission.
async function voucherRefIndex(book) {
  const entries = await prisma.accVoucherExpenseEntry.findMany({
    where: { particulars: { contains: 'REFUND TO THE PATIENT AGAINST', mode: 'insensitive' }, voucher: { entityType: book } },
    select: { particulars: true, voucher: { select: { voucherNo: true, voucherDate: true } } },
  });
  const idx = new Map();
  for (const e of entries) {
    const m = /AGAINST\s+(SLIP|ADMISSION)\s*#\s*([^\n]+)/i.exec(e.particulars || '');
    if (!m) continue;
    const kind = m[1].toLowerCase();
    for (const ref of m[2].split(/[,\s]+/).map(normRef).filter(Boolean)) {
      const k = `${kind}|${ref}`;
      if (!idx.has(k)) idx.set(k, { voucherNo: e.voucher.voucherNo, voucherDate: voucherDay(e.voucher.voucherDate) });
    }
  }
  return idx;
}

async function getRefundStatement({ entityType, from, to } = {}) {
  const book = entityType === 'corporate' ? 'corporate' : 'non-corporate';
  if (!isIso(from) || !isIso(to) || from > to) throw fail(400, 'Select the From and To dates');
  const inRange = (d) => d && d >= from && d <= to;
  // A day's margin either side for stored times; trimmed by business day below.
  const wide = { gte: new Date(Date.parse(`${from}T00:00:00Z`) - 864e5), lte: new Date(Date.parse(`${to}T23:59:59Z`) + 864e5) };

  const [drafts, opdSlips, pvSlips, admRefunds, vIndex] = await Promise.all([
    prisma.accVoucherExpenseDraft.findMany({
      where: { entityType: book, clinicRefundKind: { in: ['slip', 'admission'] }, amount: { gt: 0 }, businessDate: { gte: from, lte: to } },
      select: {
        id: true, businessDate: true, amount: true, payeeName: true, status: true, createdByName: true,
        clinicRefundKind: true, clinicRefundRef: true,
        postedVoucher: { select: { voucherNo: true, voucherDate: true } },
      },
      orderBy: [{ businessDate: 'asc' }, { id: 'asc' }],
    }),
    prisma.clinicOpdVisit.findMany({
      where: { refund: { gt: 0 }, refundedAt: wide },
      select: { serialNo: true, patientName: true, department: true, paymentType: true, refund: true, refundReason: true, refundedAt: true, refundedBy: true },
    }),
    prisma.patientVisit.findMany({
      where: { refund: { gt: 0 }, refundedAt: wide },
      select: { serialNo: true, patientName: true, department: true, paymentType: true, refund: true, refundReason: true, refundedAt: true, refundedBy: true },
    }),
    prisma.clinicAdmissionDiscountRefund.findMany({
      where: { refundAmount: { gt: 0 }, createdAt: wide },
      select: {
        id: true, refundAmount: true, voucherNo: true, permissionBy: true, createdByName: true, createdAt: true,
        admission: { select: { admissionNo: true, patientName: true, patientCategory: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    voucherRefIndex(book),
  ]);

  // Slip / admission details for the draft rows.
  const slipRefs = [...new Set(drafts.filter((d) => d.clinicRefundKind === 'slip').map((d) => String(d.clinicRefundRef || '').trim()).filter(Boolean))];
  const admRefs = [...new Set(drafts.filter((d) => d.clinicRefundKind === 'admission').map((d) => String(d.clinicRefundRef || '').trim()).filter(Boolean))];
  const pvNos = slipRefs.map(Number).filter((n) => Number.isInteger(n));
  const [slipInfoOpd, slipInfoPv, admInfo] = await Promise.all([
    slipRefs.length ? prisma.clinicOpdVisit.findMany({ where: { serialNo: { in: slipRefs } }, select: { serialNo: true, patientName: true, department: true, refundReason: true } }) : [],
    pvNos.length ? prisma.patientVisit.findMany({ where: { serialNo: { in: pvNos } }, select: { serialNo: true, patientName: true, department: true, refundReason: true } }) : [],
    admRefs.length ? prisma.clinicAdmission.findMany({ where: { admissionNo: { in: admRefs } }, select: { admissionNo: true, patientName: true } }) : [],
  ]);
  const slipInfo = new Map([...slipInfoPv, ...slipInfoOpd].map((v) => [normRef(v.serialNo), v]));
  const admName = new Map(admInfo.map((a) => [normRef(a.admissionNo), a.patientName]));

  const rows = drafts.map((d) => {
    const ref = String(d.clinicRefundRef || '').trim();
    const info = d.clinicRefundKind === 'slip' ? slipInfo.get(normRef(ref)) : null;
    return {
      key: `draft-${d.id}`, date: d.businessDate, kind: d.clinicRefundKind, ref,
      patientName: d.payeeName || info?.patientName || admName.get(normRef(ref)) || '',
      department: info?.department || '', reason: info?.refundReason || '',
      refundedBy: d.createdByName || '', amount: round2(d.amount),
      voucherNo: d.postedVoucher?.voucherNo || null,
      voucherDate: d.postedVoucher ? voucherDay(d.postedVoucher.voucherDate) : null,
      voucherStatus: d.postedVoucher ? 'posted' : d.status === 'pending' ? 'pending' : 'none',
    };
  });

  // Refunds with no draft at all (any date) — older ones, or the head unlinked.
  const draftedRefs = new Set((await prisma.accVoucherExpenseDraft.findMany({
    where: { clinicRefundKind: { in: ['slip', 'admission'] }, amount: { gt: 0 } },
    select: { clinicRefundKind: true, clinicRefundRef: true },
  })).map((d) => `${d.clinicRefundKind}|${normRef(d.clinicRefundRef)}`));
  const fromIndex = (kind, ref) => vIndex.get(`${kind}|${normRef(ref)}`) || null;

  for (const v of [...opdSlips, ...pvSlips]) {
    const ref = String(v.serialNo ?? '').trim();
    const day = bizDay(v.refundedAt);
    if (!ref || !inRange(day) || bookOfPayment(v.paymentType) !== book || draftedRefs.has(`slip|${normRef(ref)}`)) continue;
    const vch = fromIndex('slip', ref);
    rows.push({
      key: `slip-${ref}`, date: day, kind: 'slip', ref, patientName: v.patientName || '', department: v.department || '',
      reason: v.refundReason || '', refundedBy: v.refundedBy || '', amount: round2(v.refund),
      voucherNo: vch?.voucherNo || null, voucherDate: vch?.voucherDate || null, voucherStatus: vch ? 'posted' : 'none',
    });
  }
  for (const a of admRefunds) {
    const ref = String(a.admission?.admissionNo || '').trim();
    const day = bizDay(a.createdAt);
    if (!inRange(day) || bookOfPayment(a.admission?.patientCategory) !== book || draftedRefs.has(`admission|${normRef(ref)}`)) continue;
    const vch = a.voucherNo ? { voucherNo: a.voucherNo, voucherDate: null } : fromIndex('admission', ref);
    rows.push({
      key: `adm-${a.id}`, date: day, kind: 'admission', ref, patientName: a.admission?.patientName || '', department: 'Admission',
      reason: a.permissionBy ? `Permission: ${a.permissionBy}` : '', refundedBy: a.createdByName || '', amount: round2(a.refundAmount),
      voucherNo: vch?.voucherNo || null, voucherDate: vch?.voucherDate || null, voucherStatus: vch ? 'posted' : 'none',
    });
  }

  rows.sort((a, b) => (a.date === b.date ? a.key.localeCompare(b.key) : a.date < b.date ? -1 : 1));
  const total = (list) => round2(list.reduce((s, r) => s + r.amount, 0));
  return {
    entityType: book, from, to, rows,
    totals: {
      count: rows.length, amount: total(rows),
      slip: total(rows.filter((r) => r.kind === 'slip')), admission: total(rows.filter((r) => r.kind === 'admission')),
      pending: total(rows.filter((r) => r.voucherStatus === 'pending')),
    },
  };
}

module.exports = { getRefundStatement };
