const prisma = require('../../config/db');
// Pure text helpers only (no tables): the same H/L rules as Laboratories.
const { patientGroup, flagFor } = require('../laboratory/laboratory.service');

// Lab Billing (Panels), owner 2026-11-12. Lab reports for panel patients, kept
// fully apart from the Laboratories module: its own test setup
// (PanelLabTest/PanelLabParameter) and its own results (PanelLabResult…).
// Reports come from two places, both read-only here:
//   - Laboratory items added on a Panels → Billing bill (double-click popup),
//     Admission # (ClinicPanelBillingItem) or Slip # (ClinicPanelOpdBillingItem)
//   - panel Laboratory slips made in Clinic (ClinicOpdVisit, paymentType panel)
// One "entry" is one report: a bill's Laboratory items on one day, or one slip.

const fail = (status, message) => Object.assign(new Error(message), { status });

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const LAB_DEPARTMENT = 'Laboratory';
const ROW_KINDS = ['param', 'heading', 'note'];
const RESULT_TYPES = ['number', 'text', 'select'];
const ROWS_ORDER = { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] };

const text = (v) => {
  const s = String(v ?? '').trim();
  return s || null;
};
const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null;
};

async function labDepartmentIds() {
  const depts = await prisma.clinicDepartment.findMany({ select: { id: true, name: true } });
  return depts.filter((d) => norm(d.name) === norm(LAB_DEPARTMENT)).map((d) => d.id);
}

async function labSubDepartments() {
  const ids = await labDepartmentIds();
  if (!ids.length) return [];
  return prisma.clinicSubDepartment.findMany({
    where: { departmentId: { in: ids } },
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' },
  });
}

// ─── Test setup ──────────────────────────────────────────────────────────────

async function listTests() {
  const [subDepts, setups] = await Promise.all([
    labSubDepartments(),
    prisma.panelLabTest.findMany({ include: { _count: { select: { parameters: { where: { isActive: true } } } } } }),
  ]);
  const bySub = new Map(setups.map((t) => [t.subDeptId, t]));
  return subDepts.map((sd) => {
    const t = bySub.get(sd.id);
    return { subDeptId: sd.id, code: sd.code || '', name: sd.name, sampleType: t?.sampleType || null, lineCount: t?._count.parameters || 0 };
  });
}

async function assertLabSubDept(subDeptId) {
  const id = toInt(subDeptId);
  const ids = await labDepartmentIds();
  const sd = id ? await prisma.clinicSubDepartment.findUnique({ where: { id }, select: { id: true, code: true, name: true, departmentId: true } }) : null;
  if (!sd || !ids.includes(sd.departmentId)) throw fail(404, 'Test not found in the Clinic Laboratory list');
  return sd;
}

async function getTestParameters(subDeptId) {
  const sd = await assertLabSubDept(subDeptId);
  const test = await prisma.panelLabTest.findUnique({ where: { subDeptId: sd.id }, include: { parameters: ROWS_ORDER } });
  return {
    subDept: { id: sd.id, code: sd.code || '', name: sd.name },
    sampleType: test?.sampleType || '',
    parameters: test?.parameters || [],
  };
}

function cleanRow(p, i) {
  const kind = ROW_KINDS.includes(p.kind) ? p.kind : 'param';
  const name = text(p.name);
  const noteText = kind === 'note' ? text(p.noteText) : null;
  if (kind === 'note' && !name && !noteText) throw fail(400, `Row ${i + 1}: enter the note text`);
  if (kind !== 'note' && !name) throw fail(400, `Row ${i + 1}: enter the ${kind === 'heading' ? 'heading' : 'test'} name`);
  const resultType = kind === 'param' && RESULT_TYPES.includes(p.resultType) ? p.resultType : 'number';
  const options = kind === 'param' && resultType === 'select'
    ? (Array.isArray(p.options) ? p.options : String(p.options || '').split(','))
      .map((o) => String(o).trim()).filter(Boolean)
    : [];
  if (kind === 'param' && resultType === 'select' && !options.length) throw fail(400, `${name}: enter the dropdown options (separated by commas)`);
  return {
    id: p.id ? Number(p.id) : null,
    data: {
      kind,
      name: name || '',
      unit: kind === 'param' ? text(p.unit) : null,
      referenceRange: kind === 'param' ? (String(p.referenceRange ?? '').trim() || null) : null,
      noteText,
      resultType,
      options,
      sortOrder: i,
      isActive: p.isActive !== false,
    },
  };
}

// The whole form in one go: rows kept by id are updated, new rows created,
// missing rows removed (saved reports keep their own copy).
async function saveTestParameters(subDeptId, { sampleType, parameters } = {}) {
  const sd = await assertLabSubDept(subDeptId);
  const rows = (Array.isArray(parameters) ? parameters : []).map(cleanRow);
  await prisma.$transaction(async (tx) => {
    const test = await tx.panelLabTest.upsert({
      where: { subDeptId: sd.id },
      create: { subDeptId: sd.id, sampleType: text(sampleType) },
      update: { sampleType: text(sampleType) },
      include: { parameters: { select: { id: true } } },
    });
    const ownIds = new Set(test.parameters.map((p) => p.id));
    const keepIds = rows.filter((r) => r.id && ownIds.has(r.id)).map((r) => r.id);
    await tx.panelLabParameter.deleteMany({ where: { testId: test.id, id: { notIn: keepIds } } });
    for (const r of rows) {
      if (r.id && ownIds.has(r.id)) await tx.panelLabParameter.update({ where: { id: r.id }, data: r.data });
      else await tx.panelLabParameter.create({ data: { ...r.data, testId: test.id } });
    }
  });
  return getTestParameters(sd.id);
}

// ─── Entries (reports) ───────────────────────────────────────────────────────

const PKT_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
const pktDay = (d) => PKT_DAY.format(new Date(d));
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const dayCode = (iso) => iso.replace(/-/g, '');
const dayFromCode = (c) => `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;
const dayStart = (iso) => new Date(`${iso}T00:00:00+05:00`);
const dayEnd = (iso) => new Date(`${iso}T23:59:59.999+05:00`);

function ageText(v) {
  const parts = [];
  if (v.age) parts.push(`${v.age}Y`);
  if (v.ageMonths) parts.push(`${v.ageMonths}M`);
  if (v.ageDays) parts.push(`${v.ageDays}D`);
  return parts.join(' ');
}

const CANCELLED = ['cancelled', 'canceled'];
// A Laboratory item on a bill: not a "removed" marker, not an edit of a live
// slip line (the slip itself shows as its own entry).
const billLabItemWhere = { groupInto: { equals: LAB_DEPARTMENT, mode: 'insensitive' }, excluded: false, overridesLiveId: null };
const panelSlipWhere = {
  department: { equals: LAB_DEPARTMENT, mode: 'insensitive' },
  paymentType: { equals: 'panel', mode: 'insensitive' },
  status: 'active',
};
const itemDay = (it) => pktDay(it.date || it.createdAt);
const itemDayWhere = (f, t) => ({
  OR: [
    { date: { gte: dayStart(f), lte: dayEnd(t) } },
    { date: null, createdAt: { gte: dayStart(f), lte: dayEnd(t) } },
  ],
});

const ADMISSION_SELECT = {
  id: true, admissionNo: true, mrNo: true, patientTitle: true, patientName: true, ageYears: true, ageMonths: true, ageDays: true,
  gender: true, referredBy: true, status: true, panelCompanyId: true, panelEmployeeId: true, panelDependentId: true,
};
const VISIT_SELECT = {
  id: true, serialNo: true, mrNo: true, patientType: true, patientName: true, age: true, ageMonths: true, ageDays: true,
  gender: true, referredBy: true, admitNo: true, status: true, createdAt: true,
  panelCompanyId: true, panelEmployeeId: true, panelDependentId: true,
};

// Admission → the shape patientGroup/ageText use for a slip.
const admissionPerson = (a) => ({ ...a, age: a.ageYears, patientType: a.patientTitle });

// Panel company, employee and dependent names for a set of patients.
async function panelInfo(people) {
  const ids = (k) => [...new Set(people.map((p) => p[k]).filter(Boolean))];
  const [companies, employees, dependents] = await Promise.all([
    ids('panelCompanyId').length ? prisma.clinicPanelCompany.findMany({ where: { id: { in: ids('panelCompanyId') } }, select: { id: true, name: true } }) : [],
    ids('panelEmployeeId').length ? prisma.clinicPanelEmployee.findMany({ where: { id: { in: ids('panelEmployeeId') } }, select: { id: true, empCode: true, name: true } }) : [],
    ids('panelDependentId').length ? prisma.clinicPanelEmployeeDependent.findMany({ where: { id: { in: ids('panelDependentId') } }, select: { id: true, name: true, relation: true } }) : [],
  ]);
  const c = new Map(companies.map((x) => [x.id, x]));
  const e = new Map(employees.map((x) => [x.id, x]));
  const d = new Map(dependents.map((x) => [x.id, x]));
  return (p) => ({
    panelName: c.get(p.panelCompanyId)?.name || null,
    empCode: e.get(p.panelEmployeeId)?.empCode || null,
    employeeName: e.get(p.panelEmployeeId)?.name || null,
    dependentName: d.get(p.panelDependentId)?.name || null,
    dependentRelation: d.get(p.panelDependentId)?.relation || null,
  });
}

// Patients matching a search (number, MR # or name), for the bill items.
function personSearch(term, numberField) {
  const n = toInt(term);
  return [
    { [numberField]: { contains: term, mode: 'insensitive' } },
    { patientName: { contains: term, mode: 'insensitive' } },
    ...(n ? [{ mrNo: n }] : []),
  ];
}

const ALL_DATES_LIMIT = 500;

// Every report in the date range (PKT days), or for a search on every date,
// or with no dates the newest ones. source: all | billing | slips.
async function listEntries({ from, to, q, status, source } = {}) {
  const term = String(q || '').trim();
  const f = isIsoDate(from) ? from : isIsoDate(to) ? to : null;
  const t = isIsoDate(to) ? to : f;
  const dated = !term && !!f;
  const wantBills = source !== 'slips';
  const wantSlips = source !== 'billing';

  // Bill items (Admission # and Slip #)
  let admItems = [];
  let opdItems = [];
  if (wantBills) {
    const itemSelect = { id: true, description: true, date: true, createdAt: true };
    let admWhere = { ...billLabItemWhere };
    let opdWhere = { ...billLabItemWhere };
    if (term) {
      const [adms, visits] = await Promise.all([
        prisma.clinicAdmission.findMany({ where: { OR: personSearch(term, 'admissionNo') }, select: { id: true }, take: 500 }),
        prisma.clinicOpdVisit.findMany({ where: { OR: personSearch(term, 'serialNo') }, select: { id: true }, take: 500 }),
      ]);
      admWhere = { ...admWhere, admissionId: { in: adms.map((a) => a.id) } };
      opdWhere = { ...opdWhere, opdVisitId: { in: visits.map((v) => v.id) } };
    } else if (dated) {
      admWhere = { ...admWhere, ...itemDayWhere(f, t) };
      opdWhere = { ...opdWhere, ...itemDayWhere(f, t) };
    }
    const take = dated || term ? 3000 : 1500;
    [admItems, opdItems] = await Promise.all([
      prisma.clinicPanelBillingItem.findMany({ where: admWhere, select: { ...itemSelect, admissionId: true }, orderBy: { id: 'desc' }, take }),
      prisma.clinicPanelOpdBillingItem.findMany({ where: opdWhere, select: { ...itemSelect, opdVisitId: true }, orderBy: { id: 'desc' }, take }),
    ]);
  }

  // Panel lab slips
  let slips = [];
  if (wantSlips) {
    const where = { ...panelSlipWhere };
    if (term) where.OR = [...personSearch(term, 'serialNo'), { admitNo: { contains: term, mode: 'insensitive' } }];
    else if (dated) where.createdAt = { gte: dayStart(f), lte: dayEnd(t) };
    slips = await prisma.clinicOpdVisit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: term ? 200 : dated ? 1000 : ALL_DATES_LIMIT,
      select: { ...VISIT_SELECT, doctors: { orderBy: { id: 'asc' }, select: { id: true, subDeptId: true, subDept: { select: { name: true } } } } },
    });
  }

  const [admissions, owners] = await Promise.all([
    admItems.length
      ? prisma.clinicAdmission.findMany({ where: { id: { in: [...new Set(admItems.map((i) => i.admissionId))] } }, select: ADMISSION_SELECT })
      : [],
    opdItems.length
      ? prisma.clinicOpdVisit.findMany({ where: { id: { in: [...new Set(opdItems.map((i) => i.opdVisitId))] } }, select: VISIT_SELECT })
      : [],
  ]);
  const admById = new Map(admissions.filter((a) => !CANCELLED.includes(String(a.status).toLowerCase())).map((a) => [a.id, a]));
  const ownerById = new Map(owners.filter((v) => !CANCELLED.includes(String(v.status).toLowerCase())).map((v) => [v.id, v]));
  const info = await panelInfo([...admById.values(), ...ownerById.values(), ...slips]);

  // Group bill items into one entry per bill per day.
  const groups = new Map();
  const addItem = (prefix, parentId, it, parent) => {
    const day = itemDay(it);
    const key = `${prefix}-${parentId}-${dayCode(day)}`;
    if (!groups.has(key)) groups.set(key, { key, prefix, parent, day, lines: [] });
    groups.get(key).lines.push({ lineKey: `${prefix}-item:${it.id}`, name: it.description, id: it.id });
  };
  for (const it of admItems) { const a = admById.get(it.admissionId); if (a) addItem('adm', a.id, it, a); }
  for (const it of opdItems) { const v = ownerById.get(it.opdVisitId); if (v) addItem('opd', v.id, it, v); }
  if (dated) for (const [k, g] of groups) if (g.day < f || g.day > t) groups.delete(k);

  const billGroups = [...groups.values()];
  billGroups.forEach((g) => g.lines.sort((a, b) => a.id - b.id));
  const slipGroups = slips.filter((v) => v.doctors.length).map((v) => ({
    key: `slip-${v.id}`, prefix: 'slip', parent: v, day: pktDay(v.createdAt),
    lines: v.doctors.map((d) => ({ lineKey: `slip-line:${d.id}`, name: d.subDept?.name || '', subDeptId: d.subDeptId })),
  }));

  // Saved results: by line, and for slips also by (slip, test) when Full Slip
  // Edit has re-made the slip's test rows.
  const allLines = [...billGroups, ...slipGroups].flatMap((g) => g.lines.map((l) => l.lineKey));
  const slipIds = slipGroups.map((g) => g.parent.id);
  const results = allLines.length
    ? await prisma.panelLabResult.findMany({
        where: { OR: [{ lineKey: { in: allLines } }, ...(slipIds.length ? [{ visitId: { in: slipIds } }] : [])] },
        select: { lineKey: true, visitId: true, subDeptId: true, status: true },
      })
    : [];
  const doneByLine = new Set(results.filter((r) => r.status === 'done').map((r) => r.lineKey));
  const resultsBySlip = new Map();
  for (const r of results) {
    if (!r.visitId) continue;
    if (!resultsBySlip.has(r.visitId)) resultsBySlip.set(r.visitId, []);
    resultsBySlip.get(r.visitId).push(r);
  }

  const rows = [...billGroups, ...slipGroups].map((g) => {
    const p = g.prefix === 'adm' ? admissionPerson(g.parent) : g.parent;
    let tests;
    if (g.prefix === 'slip') {
      const live = new Set(g.lines.map((l) => l.lineKey));
      const spare = (resultsBySlip.get(p.id) || []).filter((r) => !live.has(r.lineKey));
      tests = g.lines.map((l) => {
        if (doneByLine.has(l.lineKey)) return { lineKey: l.lineKey, name: l.name, done: true };
        const i = spare.findIndex((r) => r.subDeptId === l.subDeptId);
        const hit = i >= 0 ? spare.splice(i, 1)[0] : null;
        return { lineKey: l.lineKey, name: l.name, done: hit?.status === 'done' };
      });
    } else {
      tests = g.lines.map((l) => ({ lineKey: l.lineKey, name: l.name, done: doneByLine.has(l.lineKey) }));
    }
    const doneCount = tests.filter((x) => x.done).length;
    const pi = info(p);
    return {
      entryKey: g.key,
      source: g.prefix === 'adm' ? 'admission' : g.prefix === 'opd' ? 'opd-bill' : 'slip',
      numberLabel: g.prefix === 'adm' ? 'Admission #' : 'Slip #',
      number: g.prefix === 'adm' ? p.admissionNo : p.serialNo,
      admitNo: g.prefix === 'slip' ? p.admitNo || null : null,
      mrNo: p.mrNo,
      patientName: `${p.patientType || ''} ${p.patientName || ''}`.trim(),
      age: ageText(p), gender: p.gender,
      panelName: pi.panelName, empCode: pi.empCode,
      sampleDate: g.prefix === 'slip' ? p.createdAt : dayStart(g.day),
      day: g.day,
      tests, doneCount, testCount: tests.length, status: doneCount === tests.length ? 'done' : 'pending',
    };
  });
  rows.sort((a, b) => (a.day === b.day ? new Date(b.sampleDate) - new Date(a.sampleDate) : a.day < b.day ? 1 : -1));
  const limited = !term && !dated ? rows.slice(0, ALL_DATES_LIMIT) : rows;
  return status === 'pending' || status === 'done' ? limited.filter((r) => r.status === status) : limited;
}

// One entry: its patient and its lines, each with the line's test setup.
async function loadEntry(entryKey) {
  const key = String(entryKey || '');
  let m;
  if ((m = /^(adm|opd)-(\d+)-(\d{8})$/.exec(key))) {
    const [, prefix, rawId, code] = m;
    const parentId = toInt(rawId);
    const day = dayFromCode(code);
    if (!parentId || !isIsoDate(day)) throw fail(404, 'Report not found');
    const isAdm = prefix === 'adm';
    const parent = isAdm
      ? await prisma.clinicAdmission.findUnique({ where: { id: parentId }, select: ADMISSION_SELECT })
      : await prisma.clinicOpdVisit.findUnique({ where: { id: parentId }, select: VISIT_SELECT });
    if (!parent || CANCELLED.includes(String(parent.status).toLowerCase())) throw fail(404, 'Bill not found');
    const where = { ...billLabItemWhere, ...(isAdm ? { admissionId: parentId } : { opdVisitId: parentId }), ...itemDayWhere(day, day) };
    const items = isAdm
      ? await prisma.clinicPanelBillingItem.findMany({ where, orderBy: { id: 'asc' } })
      : await prisma.clinicPanelOpdBillingItem.findMany({ where, orderBy: { id: 'asc' } });
    const own = items.filter((it) => itemDay(it) === day);
    if (!own.length) throw fail(404, 'No Laboratory items on this bill for this date');
    const subDepts = await labSubDepartments();
    const byName = new Map();
    for (const sd of subDepts) {
      if (!byName.has(norm(sd.name))) byName.set(norm(sd.name), sd);
    }
    for (const sd of subDepts) {
      if (sd.code && !byName.has(norm(sd.code))) byName.set(norm(sd.code), sd);
    }
    const person = isAdm ? admissionPerson(parent) : parent;
    return {
      key, prefix, person, sampleDate: dayStart(day), visitId: null,
      lines: own.map((it) => {
        const sd = byName.get(norm(it.description)) || null;
        return {
          lineKey: `${prefix}-item:${it.id}`, sourceType: `${prefix}-item`, sourceId: it.id,
          subDeptId: sd?.id || null, code: sd?.code || '', name: it.description,
        };
      }),
    };
  }
  if ((m = /^slip-(\d+)$/.exec(key))) {
    const id = toInt(m[1]);
    const visit = id
      ? await prisma.clinicOpdVisit.findUnique({
          where: { id },
          select: {
            ...VISIT_SELECT, department: true, paymentType: true,
            doctors: { orderBy: { id: 'asc' }, select: { id: true, subDeptId: true, subDept: { select: { id: true, code: true, name: true } } } },
          },
        })
      : null;
    if (!visit || norm(visit.department) !== norm(LAB_DEPARTMENT) || norm(visit.paymentType) !== 'panel') throw fail(404, 'Panel lab slip not found');
    if (visit.status !== 'active') throw fail(400, 'This slip has been cancelled');
    return {
      key, prefix: 'slip', person: visit, sampleDate: visit.createdAt, visitId: visit.id,
      lines: visit.doctors.map((d) => ({
        lineKey: `slip-line:${d.id}`, sourceType: 'slip-line', sourceId: d.id,
        subDeptId: d.subDeptId, code: d.subDept?.code || '', name: d.subDept?.name || '',
      })),
    };
  }
  throw fail(404, 'Report not found');
}

// Each line's saved result: by its own key, and for a slip line whose test
// row was re-made (Full Slip Edit), the slip's spare result for the same test.
async function resultsFor(entry) {
  const results = await prisma.panelLabResult.findMany({
    where: { OR: [{ lineKey: { in: entry.lines.map((l) => l.lineKey) } }, ...(entry.visitId ? [{ visitId: entry.visitId }] : [])] },
    include: { values: { orderBy: { sortOrder: 'asc' } } },
  });
  const byLine = new Map(results.map((r) => [r.lineKey, r]));
  const used = new Set();
  const out = new Map();
  for (const l of entry.lines) {
    const r = byLine.get(l.lineKey);
    if (r) { out.set(l.lineKey, r); used.add(r.id); }
  }
  for (const l of entry.lines) {
    if (out.has(l.lineKey) || !l.subDeptId) continue;
    const spare = results.find((r) => !used.has(r.id) && r.visitId && r.subDeptId === l.subDeptId && !entry.lines.some((x) => x.lineKey === r.lineKey));
    if (spare) { out.set(l.lineKey, spare); used.add(spare.id); }
  }
  return out;
}

async function setupsFor(lines) {
  const ids = [...new Set(lines.map((l) => l.subDeptId).filter(Boolean))];
  const tests = ids.length
    ? await prisma.panelLabTest.findMany({ where: { subDeptId: { in: ids } }, include: { parameters: { where: { isActive: true }, ...ROWS_ORDER } } })
    : [];
  return new Map(tests.map((t) => [t.subDeptId, t]));
}

async function getEntry(entryKey) {
  const entry = await loadEntry(entryKey);
  const [setups, results, info] = await Promise.all([setupsFor(entry.lines), resultsFor(entry), panelInfo([entry.person])]);
  const p = entry.person;
  const pi = info(p);
  return {
    visit: {
      entryKey: entry.key,
      source: entry.prefix === 'adm' ? 'admission' : entry.prefix === 'opd' ? 'opd-bill' : 'slip',
      numberLabel: entry.prefix === 'adm' ? 'Admission #' : 'Slip #',
      serialNo: entry.prefix === 'adm' ? p.admissionNo : p.serialNo,
      admitNo: entry.prefix === 'slip' ? p.admitNo || null : null,
      mrNo: p.mrNo, patientType: p.patientType, patientName: p.patientName,
      age: ageText(p), gender: p.gender, referredBy: p.referredBy || null,
      createdAt: entry.sampleDate, patientGroup: patientGroup(p),
      ...pi,
    },
    tests: entry.lines.map((l) => {
      const setup = l.subDeptId ? setups.get(l.subDeptId) : null;
      const r = results.get(l.lineKey);
      // A saved value is tied to its setup row by id; if that row was removed
      // and made again (new id), tie it back by name.
      const rows = setup?.parameters || [];
      const liveIds = new Set(rows.map((x) => x.id));
      const idByName = new Map(rows.filter((x) => x.kind === 'param').map((x) => [x.name.trim().toLowerCase(), x.id]));
      const linkOf = (v) => (v.parameterId && liveIds.has(v.parameterId)
        ? v.parameterId
        : (v.kind || 'param') === 'param' ? idByName.get(String(v.parameterName || '').trim().toLowerCase()) ?? null : null);
      return {
        lineKey: l.lineKey,
        subDeptId: l.subDeptId,
        code: l.code,
        name: l.name,
        sampleType: setup?.sampleType || null,
        parameters: rows.map((x) => ({
          id: x.id, kind: x.kind, name: x.name, unit: x.unit, referenceRange: x.referenceRange, noteText: x.noteText,
          resultType: x.resultType, options: x.options,
        })),
        result: r ? {
          id: r.id, status: r.status, remarks: r.remarks, enteredByName: r.enteredByName, enteredAt: r.enteredAt,
          updatedByName: r.updatedByName, updatedAt: r.updatedAt, printCount: r.printCount,
          values: r.values.map((v) => ({
            parameterId: linkOf(v), kind: v.kind, parameterName: v.parameterName, unit: v.unit,
            referenceRange: v.referenceRange, noteText: v.noteText, value: v.value, flag: v.flag,
          })),
        } : null,
      };
    }),
  };
}

// What the log compares: typed results and remarks only.
const snapshotOf = (r) => ({
  remarks: r.remarks || null,
  values: (r.values || []).filter((v) => (v.kind || 'param') === 'param' && v.value).map((v) => ({ parameter: v.parameterName, value: v.value })),
});

// Saves every line sent; a line with nothing typed and no saved result is left
// alone. The report rows are stored as they are now with the typed values, so
// a reprint shows the report as saved. Each change to a saved result is logged.
// Bills and slips are only read.
async function saveEntryResults(entryKey, { tests, userId, userName } = {}) {
  const entry = await loadEntry(entryKey);
  const [setups, results] = await Promise.all([setupsFor(entry.lines), resultsFor(entry)]);
  const group = patientGroup(entry.person);
  const lineByKey = new Map(entry.lines.map((l) => [l.lineKey, l]));
  const who = text(userName);

  const plans = [];
  for (const t of Array.isArray(tests) ? tests : []) {
    const line = lineByKey.get(String(t.lineKey || ''));
    if (!line) throw fail(400, 'This test is not on this report');
    const params = (line.subDeptId && setups.get(line.subDeptId)?.parameters) || [];
    const entered = t.values && typeof t.values === 'object' ? t.values : {};
    const values = params.map((p, i) => {
      const value = p.kind === 'param' ? text(entered[p.id]) : null;
      return {
        parameterId: p.id, kind: p.kind, parameterName: p.name, unit: p.unit, referenceRange: p.referenceRange,
        noteText: p.noteText, value,
        flag: p.kind === 'param' && p.resultType === 'number' ? flagFor(value, p.referenceRange, group) : '', sortOrder: i,
      };
    });
    const typed = values.some((v) => v.kind === 'param' && v.value);
    const remarks = text(t.remarks);
    const existing = results.get(line.lineKey);
    if (!existing && !typed && !remarks) continue;
    plans.push({ line, values, remarks, existing, status: typed || remarks ? 'done' : 'pending' });
  }

  await prisma.$transaction(async (tx) => {
    for (const p of plans) {
      const after = snapshotOf({ remarks: p.remarks, values: p.values });
      if (p.existing) {
        const before = snapshotOf(p.existing);
        const where = { id: p.existing.id };
        // Keep the result on its current line and report (a re-made slip
        // test, or a bill item moved to another date).
        const place = { lineKey: p.line.lineKey, entryKey: entry.key, sourceId: p.line.sourceId, sampleDate: entry.sampleDate };
        if (JSON.stringify(before) === JSON.stringify(after)) {
          if (p.existing.lineKey !== place.lineKey || p.existing.entryKey !== place.entryKey) await tx.panelLabResult.update({ where, data: place });
          continue;
        }
        await tx.panelLabResultValue.deleteMany({ where: { resultId: p.existing.id } });
        await tx.panelLabResult.update({
          where,
          data: { ...place, remarks: p.remarks, status: p.status, updatedByName: who, values: { create: p.values } },
        });
        await tx.panelLabResultLog.create({ data: { resultId: p.existing.id, changedByName: who, before, after } });
      } else {
        await tx.panelLabResult.create({
          data: {
            lineKey: p.line.lineKey, entryKey: entry.key, sourceType: p.line.sourceType, sourceId: p.line.sourceId,
            visitId: entry.visitId, subDeptId: p.line.subDeptId, testName: p.line.name || '', sampleDate: entry.sampleDate,
            remarks: p.remarks, status: p.status, enteredByUserId: text(userId), enteredByName: who, updatedByName: who,
            values: { create: p.values },
          },
        });
      }
    }
  });
  return getEntry(entry.key);
}

async function markPrinted(resultIds) {
  const ids = (Array.isArray(resultIds) ? resultIds : []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return { count: 0 };
  const r = await prisma.panelLabResult.updateMany({ where: { id: { in: ids } }, data: { printCount: { increment: 1 } } });
  return { count: r.count };
}

module.exports = {
  listTests, getTestParameters, saveTestParameters,
  listEntries, getEntry, saveEntryResults, markPrinted,
};
