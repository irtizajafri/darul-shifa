const prisma = require('../../config/db');

// Al Shifa Hospital Pharmacy — the 7th module (owner, 2026-11-17).
// Goods Demand (GD) → Goods Issuance (GIN), the same flow as Inventory's, but
// kept fully apart from Inventory: no stock is kept or checked, no suppliers
// or categories. A GIN can't issue more than its GD asked for.
//   Medicines   — Clinic's Medicine List (ClinicMedicine); its retail price
//                 is the GIN's default rate, editable at issue.
//   Department  — Inventory → Master Setup → Departments (required, as in
//                 Inventory's GD; owner 2026-11-17). Only the list is read.
//   Patient     — an Admission # or a Panel Slip # (optional, not both),
//                 checked the way Inventory checks them.
//   Issued To   — an HR employee.
// Nothing reaches patient bills yet (owner: later).

const fail = (status, message) => Object.assign(new Error(message), { status });
const text = (v) => {
  const s = String(v ?? '').trim();
  return s || null;
};
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const PKT_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
const pktToday = () => PKT_DAY.format(new Date());
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const QTY_EPS = 1e-9;

// "YYYYMMDD" + 3-digit number for the day + "-gd" / "-gin", like Inventory
// (20261117001-gd). Made inside the save's transaction; a clash on the
// unique code (two saves at once) is retried.
async function nextCode(tx, model, suffix, day) {
  const prefix = day.replace(/-/g, '');
  const rows = await tx[model].findMany({ where: { code: { startsWith: prefix } }, select: { code: true } });
  const max = rows.reduce((m, r) => {
    const n = Number(String(r.code).split('-')[0].slice(8));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}-${suffix}`;
}
async function withCodeRetry(fn) {
  for (let i = 0; i < 4; i += 1) {
    try {
      return await fn();
    } catch (e) {
      if (e?.code === 'P2002' && i < 3) continue;
      throw e;
    }
  }
  return null;
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

async function searchMedicines(q) {
  const term = String(q || '').trim();
  return prisma.clinicMedicine.findMany({
    where: {
      status: 'active',
      ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { code: { contains: term, mode: 'insensitive' } }] } : {}),
    },
    select: { id: true, code: true, name: true, packSize: true, retailPrice: true },
    orderBy: { name: 'asc' },
    take: 40,
  });
}

// Same rules as Inventory's GD/GIN (assertAdmissionOpenForIssue /
// assertPanelSlipOpenForIssue): a real admission whose file isn't closed or
// wiped out; a real, active panel slip whose company cheque hasn't come in.
async function assertPatient({ admissionNumber, opdSlipNo }) {
  const adm = text(admissionNumber);
  const slip = text(opdSlipNo);
  if (adm && slip) throw fail(400, 'Choose either an Admission # or a Panel Slip #, not both');
  if (adm) {
    const a = await prisma.clinicAdmission.findUnique({ where: { admissionNo: adm }, select: { status: true, patientTitle: true, patientName: true } });
    if (!a) throw fail(400, `Admission # ${adm} not found`);
    if (a.status === 'closed' || a.status === 'wipeout') throw fail(400, `Admission # ${adm} file is ${a.status === 'closed' ? 'closed' : 'wiped out'} — no more medicine can be issued on it`);
    return { admissionNumber: adm, opdSlipNo: null, patientName: `${a.patientTitle || ''} ${a.patientName || ''}`.trim() };
  }
  if (slip) {
    const v = await prisma.clinicOpdVisit.findUnique({ where: { serialNo: slip }, select: { id: true, status: true, paymentType: true, patientType: true, patientName: true } });
    if (!v) throw fail(400, `Slip # ${slip} not found`);
    if (String(v.paymentType || '').toLowerCase() !== 'panel') throw fail(400, `Slip # ${slip} is not a panel slip`);
    if (v.status !== 'active') throw fail(400, `Slip # ${slip} has been cancelled`);
    const cheque = await prisma.clinicPanelChequeReceiptOpdItem.findUnique({ where: { opdVisitId: v.id }, select: { id: true } });
    if (cheque) throw fail(400, `Slip # ${slip}: the panel cheque has come in (bill final) — no more medicine can be issued on it`);
    return { admissionNumber: null, opdSlipNo: slip, patientName: `${v.patientType || ''} ${v.patientName || ''}`.trim() };
  }
  return { admissionNumber: null, opdSlipNo: null, patientName: null };
}

// ─── Goods Demand (GD) ───────────────────────────────────────────────────────

const GD_INCLUDE = {
  items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
  gins: { select: { id: true, code: true, issueDate: true, totalAmount: true }, orderBy: { id: 'asc' } },
};

async function createGD({ requestDate, departmentId, admissionNumber, opdSlipNo, patientName, comment, items, createdByName } = {}) {
  const day = isIsoDate(requestDate) ? requestDate : pktToday();
  if (day > pktToday()) throw fail(400, 'Request Date can\'t be in the future');
  const dept = departmentId ? await prisma.inventoryDepartment.findUnique({ where: { id: Number(departmentId) }, select: { id: true, name: true, status: true } }) : null;
  if (!dept) throw fail(400, 'Select the Department');
  if (dept.status !== 'active') throw fail(400, `Department ${dept.name} is inactive`);
  const patient = await assertPatient({ admissionNumber, opdSlipNo });

  const lines = (Array.isArray(items) ? items : []).map((it, i) => ({ medicineId: Number(it.medicineId), quantity: Number(it.quantity), i }));
  if (!lines.length) throw fail(400, 'Add at least one medicine');
  const bad = lines.find((l) => !Number.isInteger(l.medicineId) || !(l.quantity > 0));
  if (bad) throw fail(400, `Line ${bad.i + 1}: pick a medicine and enter a quantity above 0`);
  const meds = await prisma.clinicMedicine.findMany({ where: { id: { in: lines.map((l) => l.medicineId) } }, select: { id: true, code: true, name: true, packSize: true } });
  const medById = new Map(meds.map((m) => [m.id, m]));
  const missing = lines.find((l) => !medById.has(l.medicineId));
  if (missing) throw fail(400, `Line ${missing.i + 1}: medicine not found in the Medicine List`);

  return withCodeRetry(() => prisma.$transaction(async (tx) => {
    const code = await nextCode(tx, 'pharmacyGD', 'gd', day);
    return tx.pharmacyGD.create({
      data: {
        code,
        requestDate: new Date(`${day}T00:00:00Z`),
        departmentId: dept.id,
        departmentName: dept.name,
        admissionNumber: patient.admissionNumber,
        opdSlipNo: patient.opdSlipNo,
        // A typed name wins; otherwise the admission's / slip's own name.
        patientName: text(patientName) || patient.patientName,
        comment: text(comment),
        createdByName: text(createdByName),
        items: {
          create: lines.map((l, idx) => {
            const m = medById.get(l.medicineId);
            return { medicineId: m.id, medicineCode: m.code, medicineName: m.name, packSize: m.packSize || null, quantityRequested: l.quantity, sortOrder: idx };
          }),
        },
      },
      include: GD_INCLUDE,
    });
  }));
}

function dateRangeWhere(field, from, to) {
  if (!isIsoDate(from) && !isIsoDate(to)) return {};
  const range = {};
  if (isIsoDate(from)) range.gte = new Date(`${from}T00:00:00Z`);
  if (isIsoDate(to)) range.lte = new Date(`${to}T00:00:00Z`);
  return { [field]: range };
}
function patientWhere({ admissionNumber, opdSlipNo, patientType, q }) {
  const and = [];
  if (text(admissionNumber)) and.push({ admissionNumber: { contains: text(admissionNumber), mode: 'insensitive' } });
  if (text(opdSlipNo)) and.push({ opdSlipNo: { contains: text(opdSlipNo), mode: 'insensitive' } });
  if (patientType === 'admission') and.push({ admissionNumber: { not: null } });
  if (patientType === 'panel') and.push({ opdSlipNo: { not: null } });
  if (patientType === 'none') and.push({ admissionNumber: null, opdSlipNo: null });
  const term = text(q);
  if (term) {
    and.push({ OR: [
      { code: { contains: term, mode: 'insensitive' } },
      { patientName: { contains: term, mode: 'insensitive' } },
      { admissionNumber: { contains: term, mode: 'insensitive' } },
      { opdSlipNo: { contains: term, mode: 'insensitive' } },
    ] });
  }
  return and.length ? { AND: and } : {};
}

async function listGDs({ from, to, status, departmentId, admissionNumber, opdSlipNo, patientType, q } = {}) {
  return prisma.pharmacyGD.findMany({
    where: {
      ...dateRangeWhere('requestDate', from, to),
      ...(['open', 'partial', 'closed'].includes(status) ? { status } : status === 'pending' ? { status: { in: ['open', 'partial'] } } : {}),
      ...(departmentId ? { departmentId: Number(departmentId) } : {}),
      ...patientWhere({ admissionNumber, opdSlipNo, patientType, q }),
    },
    include: GD_INCLUDE,
    orderBy: [{ requestDate: 'desc' }, { id: 'desc' }],
    take: 1000,
  });
}

// One GD, each line with the Medicine List's retail price now (the rate a
// GIN would take).
async function getGD(id) {
  const gd = await prisma.pharmacyGD.findUnique({ where: { id: Number(id) }, include: GD_INCLUDE });
  if (!gd) throw fail(404, 'GD not found');
  const ids = gd.items.map((it) => it.medicineId).filter(Boolean);
  const meds = ids.length ? await prisma.clinicMedicine.findMany({ where: { id: { in: ids } }, select: { id: true, retailPrice: true } }) : [];
  const price = new Map(meds.map((m) => [m.id, Number(m.retailPrice) || 0]));
  return { ...gd, items: gd.items.map((it) => ({ ...it, currentRate: price.get(it.medicineId) ?? 0 })) };
}

// ─── Goods Issuance (GIN) ────────────────────────────────────────────────────

const GIN_INCLUDE = { items: { orderBy: { id: 'asc' } }, gd: { select: { id: true, code: true, requestDate: true, comment: true } } };

const lineStatus = (requested, issued) => (issued + QTY_EPS >= requested ? 'issued' : issued > QTY_EPS ? 'partial' : 'pending');

async function createGIN({ gdId, issueDate, issuedToId, items, createdByName } = {}) {
  const day = isIsoDate(issueDate) ? issueDate : pktToday();
  if (day > pktToday()) throw fail(400, 'Issue Date can\'t be in the future');
  const gd = await prisma.pharmacyGD.findUnique({ where: { id: Number(gdId) }, include: { items: true } });
  if (!gd) throw fail(404, 'Select the GD to issue against');
  if (gd.status === 'closed') throw fail(400, `GD ${gd.code} is fully issued`);
  if (day < gd.requestDate.toISOString().slice(0, 10)) throw fail(400, 'Issue Date can\'t be before the GD\'s Request Date');
  // The patient's file / slip must still be open now, as in Inventory.
  await assertPatient({ admissionNumber: gd.admissionNumber, opdSlipNo: gd.opdSlipNo });

  let issuedTo = null;
  if (issuedToId) {
    const e = await prisma.employee.findUnique({ where: { id: Number(issuedToId) }, select: { id: true, firstName: true, lastName: true, empCode: true } });
    if (!e) throw fail(400, 'Issued To: employee not found');
    issuedTo = { id: e.id, name: `${e.firstName || ''} ${e.lastName || ''}`.trim() };
  }
  if (!issuedTo) throw fail(400, 'Select Issued To');

  const itemById = new Map(gd.items.map((it) => [it.id, it]));
  const lines = (Array.isArray(items) ? items : [])
    .map((l) => ({ gdItemId: Number(l.gdItemId), quantity: Number(l.quantity), rate: l.rate === '' || l.rate == null ? null : Number(l.rate) }))
    .filter((l) => l.quantity > 0);
  if (!lines.length) throw fail(400, 'Enter the quantity to issue for at least one medicine');
  for (const l of lines) {
    const it = itemById.get(l.gdItemId);
    if (!it) throw fail(400, 'A line is not on this GD');
    const left = it.quantityRequested - it.quantityIssued;
    if (l.quantity > left + QTY_EPS) throw fail(400, `${it.medicineName}: only ${round2(left)} left to issue on this GD`);
    if (l.rate !== null && !(Number.isFinite(l.rate) && l.rate >= 0)) throw fail(400, `${it.medicineName}: enter a valid rate`);
  }
  const meds = await prisma.clinicMedicine.findMany({
    where: { id: { in: [...new Set(lines.map((l) => itemById.get(l.gdItemId).medicineId).filter(Boolean))] } },
    select: { id: true, retailPrice: true },
  });
  const priceOf = new Map(meds.map((m) => [m.id, Number(m.retailPrice) || 0]));

  return withCodeRetry(() => prisma.$transaction(async (tx) => {
    const code = await nextCode(tx, 'pharmacyGIN', 'gin', day);
    const ginLines = lines.map((l) => {
      const it = itemById.get(l.gdItemId);
      // The rate typed at issue (owner, 2026-11-17), else the list price.
      const rate = round2(l.rate !== null ? l.rate : (priceOf.get(it.medicineId) || 0));
      return {
        gdItemId: it.id, medicineId: it.medicineId, medicineCode: it.medicineCode, medicineName: it.medicineName, packSize: it.packSize,
        quantity: l.quantity, rate, amount: round2(rate * l.quantity),
      };
    });
    const gin = await tx.pharmacyGIN.create({
      data: {
        code, gdId: gd.id, issueDate: new Date(`${day}T00:00:00Z`),
        issuedToId: issuedTo.id, issuedToName: issuedTo.name,
        departmentId: gd.departmentId, departmentName: gd.departmentName,
        admissionNumber: gd.admissionNumber, opdSlipNo: gd.opdSlipNo, patientName: gd.patientName,
        totalAmount: round2(ginLines.reduce((s, l) => s + l.amount, 0)),
        createdByName: text(createdByName),
        items: { create: ginLines },
      },
      include: GIN_INCLUDE,
    });
    // Running issued quantity and status on each GD line, then the GD.
    for (const l of lines) {
      const updated = await tx.pharmacyGDItem.update({ where: { id: l.gdItemId }, data: { quantityIssued: { increment: l.quantity } } });
      if (updated.quantityIssued > updated.quantityRequested + QTY_EPS) throw fail(409, `${updated.medicineName}: issued more than demanded (another GIN was saved at the same time) — try again`);
      await tx.pharmacyGDItem.update({ where: { id: l.gdItemId }, data: { status: lineStatus(updated.quantityRequested, updated.quantityIssued) } });
    }
    const after = await tx.pharmacyGDItem.findMany({ where: { gdId: gd.id }, select: { status: true } });
    const status = after.every((x) => x.status === 'issued') ? 'closed' : after.some((x) => x.status !== 'pending') ? 'partial' : 'open';
    await tx.pharmacyGD.update({ where: { id: gd.id }, data: { status } });
    return gin;
  }));
}

async function listGINs({ from, to, departmentId, admissionNumber, opdSlipNo, patientType, issuedToId, medicine, q } = {}) {
  const med = text(medicine);
  return prisma.pharmacyGIN.findMany({
    where: {
      ...dateRangeWhere('issueDate', from, to),
      ...(departmentId ? { departmentId: Number(departmentId) } : {}),
      ...(issuedToId ? { issuedToId: Number(issuedToId) } : {}),
      ...(med ? { items: { some: { OR: [{ medicineName: { contains: med, mode: 'insensitive' } }, { medicineCode: { contains: med, mode: 'insensitive' } }] } } } : {}),
      ...patientWhere({ admissionNumber, opdSlipNo, patientType, q }),
    },
    include: GIN_INCLUDE,
    orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
    take: 2000,
  });
}

async function getGIN(id) {
  const gin = await prisma.pharmacyGIN.findUnique({ where: { id: Number(id) }, include: GIN_INCLUDE });
  if (!gin) throw fail(404, 'GIN not found');
  return gin;
}

async function getSummary() {
  const today = new Date(`${pktToday()}T00:00:00Z`);
  const [gdToday, ginToday, pendingGDs, todayAmount] = await Promise.all([
    prisma.pharmacyGD.count({ where: { requestDate: today } }),
    prisma.pharmacyGIN.count({ where: { issueDate: today } }),
    prisma.pharmacyGD.count({ where: { status: { in: ['open', 'partial'] } } }),
    prisma.pharmacyGIN.aggregate({ where: { issueDate: today }, _sum: { totalAmount: true } }),
  ]);
  return { gdToday, ginToday, pendingGDs, issuedTodayAmount: Number(todayAmount._sum.totalAmount) || 0 };
}

module.exports = {
  searchMedicines, createGD, listGDs, getGD, createGIN, listGINs, getGIN, getSummary,
};
