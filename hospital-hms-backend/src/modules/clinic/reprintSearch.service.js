const prisma = require('../../config/db');

// Clinic → Reports → Reprint: the list to pick a record from (owner,
// 2026-11-21). kind 'slip' (OPD slips + Excel Patients List rows — what the
// slip reprint finds), 'admission' (every admission document: Admission
// form, Discharge, Birth, Death, Provisional / Final Bill) or 'antenatal'.
// A number or name typed → searched over all dates (newest first); nothing
// typed → the From–To days' list. `no` is what the reprint looks up.
// Read-only.

const LIMIT = 200;
const isIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
// PKT calendar day → its UTC bounds.
const dayStart = (iso) => new Date(`${iso}T00:00:00+05:00`);
const dayEnd = (iso) => new Date(`${iso}T23:59:59.999+05:00`);
const asInt = (q) => (/^\d+$/.test(q) && Number(q) <= 2147483647 ? Number(q) : null);

async function searchForReprint({ kind, q, from, to } = {}) {
  const term = String(q || '').trim();
  const num = asInt(term);
  const like = { contains: term, mode: 'insensitive' };
  const ranged = !term && isIso(from) && isIso(to);
  if (!term && !ranged) return { kind, rows: [] };
  const created = ranged ? { createdAt: { gte: dayStart(from), lte: dayEnd(to) } } : {};

  if (kind === 'admission') {
    const rows = await prisma.clinicAdmission.findMany({
      where: { ...created, ...(term ? { OR: [{ admissionNo: like }, { patientName: like }, ...(num != null ? [{ mrNo: num }] : [])] } : {}) },
      select: { admissionNo: true, patientTitle: true, patientName: true, patientCategory: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    });
    return {
      kind,
      rows: rows.map((a) => ({
        no: a.admissionNo, date: a.createdAt, patientName: `${a.patientTitle || ''} ${a.patientName || ''}`.trim(),
        detail: [a.patientCategory, a.status].filter(Boolean).join(' · '), amount: null,
      })),
    };
  }

  if (kind === 'antenatal') {
    const rows = await prisma.clinicAntenatal.findMany({
      where: {
        status: { not: 'cancelled' }, antenatalNo: { not: '' }, ...created,
        ...(term ? { OR: [{ antenatalNo: like }, { serialNo: like }, { patientName: like }, { mrNo: like }] } : {}),
      },
      select: { antenatalNo: true, serialNo: true, patientName: true, amount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    });
    return {
      kind,
      rows: rows.map((a) => ({ no: a.antenatalNo, date: a.createdAt, patientName: a.patientName, detail: a.serialNo ? `Slip ${a.serialNo}` : '', amount: Number(a.amount) || 0 })),
    };
  }

  // Slips: OPD slips and Excel rows.
  const [opd, pv] = await Promise.all([
    prisma.clinicOpdVisit.findMany({
      where: { ...created, ...(term ? { OR: [{ serialNo: like }, { patientName: like }, ...(num != null ? [{ mrNo: num }] : [])] } : {}) },
      select: { serialNo: true, patientName: true, department: true, receive: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
    }),
    prisma.patientVisit.findMany({
      where: {
        serialNo: num != null && !/[a-z]/i.test(term) ? undefined : { not: null },
        ...(ranged ? { visitDate: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } } : {}),
        ...(term ? { OR: [{ patientName: like }, ...(num != null ? [{ serialNo: num }] : [])] } : {}),
      },
      select: { serialNo: true, patientName: true, department: true, subDepartment: true, received: true, visitDate: true },
      orderBy: [{ visitDate: 'desc' }, { id: 'desc' }],
      take: LIMIT,
    }),
  ]);
  const rows = [
    ...opd.map((v) => ({
      no: v.serialNo, date: v.createdAt, patientName: v.patientName,
      detail: `${v.department || ''}${String(v.status || '').toLowerCase().startsWith('cancel') ? ' · Cancelled' : ''}`, amount: Number(v.receive) || 0,
    })),
    ...pv.filter((v) => v.serialNo != null).map((v) => ({
      no: String(v.serialNo), date: v.visitDate, patientName: v.patientName,
      detail: `${[v.department, v.subDepartment].filter(Boolean).join(' · ')} (Excel)`, amount: Number(v.received) || 0,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, LIMIT);
  return { kind: 'slip', rows };
}

module.exports = { searchForReprint };
