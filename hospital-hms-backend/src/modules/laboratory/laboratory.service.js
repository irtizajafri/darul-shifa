const prisma = require('../../config/db');

// Laboratories module (owner, 2026-11-11). Tests are Clinic's own LABORATORY
// sub-departments (the list /clinic/laboratory shows); this module only puts
// them in categories, gives each its report rows (test lines with unit and a
// free-text reference range, headings, fixed notes), and keeps the results
// entered against Clinic lab slips (ClinicOpdVisit, department 'Laboratory').

const fail = (status, message) => Object.assign(new Error(message), { status });

// Same loose match getAvailableDoctors uses for the department, so the list
// here is always the one the Laboratory page shows, whatever the DB id.
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const LAB_DEPARTMENT = 'Laboratory';
const ROW_KINDS = ['param', 'heading', 'note'];
const RESULT_TYPES = ['number', 'text', 'select'];
// Under this age a "Children:" range applies, for the H/L flag.
const CHILD_UNDER_YEARS = 12;

async function labDepartmentIds() {
  const depts = await prisma.clinicDepartment.findMany({ select: { id: true, name: true } });
  return depts.filter((d) => norm(d.name) === norm(LAB_DEPARTMENT)).map((d) => d.id);
}

const text = (v) => {
  const s = String(v ?? '').trim();
  return s || null;
};
const num = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

// ─── Categories ──────────────────────────────────────────────────────────────

async function listCategories() {
  const rows = await prisma.labCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { tests: true } } },
  });
  return rows.map(({ _count, ...c }) => ({ ...c, testCount: _count.tests }));
}

async function assertCategoryNameFree(name, exceptId = null) {
  const clash = await prisma.labCategory.findFirst({
    where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
  if (clash) throw fail(409, `A category named "${clash.name}" already exists`);
}

async function createCategory({ name, sortOrder }) {
  const n = text(name);
  if (!n) throw fail(400, 'Enter a category name');
  await assertCategoryNameFree(n);
  return prisma.labCategory.create({ data: { name: n, sortOrder: Number(sortOrder) || 0 } });
}

async function updateCategory(id, { name, sortOrder, isActive }) {
  const cid = Number(id);
  const n = text(name);
  if (!n) throw fail(400, 'Enter a category name');
  await assertCategoryNameFree(n, cid);
  return prisma.labCategory.update({
    where: { id: cid },
    data: { name: n, sortOrder: Number(sortOrder) || 0, ...(isActive === undefined ? {} : { isActive: !!isActive }) },
  });
}

async function deleteCategory(id) {
  const cid = Number(id);
  const count = await prisma.labTest.count({ where: { categoryId: cid } });
  if (count) throw fail(409, `This category has ${count} test${count === 1 ? '' : 's'} — remove them or move them to another category first`);
  await prisma.labCategory.delete({ where: { id: cid } });
  return { id: cid };
}

// ─── Tests (sub category) ────────────────────────────────────────────────────

async function listClinicTests() {
  const ids = await labDepartmentIds();
  if (!ids.length) return [];
  const rows = await prisma.clinicSubDepartment.findMany({
    where: { departmentId: { in: ids } },
    select: { id: true, code: true, name: true, labTest: { select: { id: true, categoryId: true, category: { select: { name: true } } } } },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id, code: r.code, name: r.name,
    labTestId: r.labTest?.id || null,
    categoryId: r.labTest?.categoryId || null,
    categoryName: r.labTest?.category?.name || null,
  }));
}

async function listTests({ categoryId } = {}) {
  const rows = await prisma.labTest.findMany({
    where: categoryId ? { categoryId: Number(categoryId) } : {},
    include: {
      subDept: { select: { id: true, code: true, name: true } },
      category: { select: { id: true, name: true } },
      _count: { select: { parameters: true } },
    },
    orderBy: [{ category: { sortOrder: 'asc' } }, { category: { name: 'asc' } }, { sortOrder: 'asc' }, { subDept: { name: 'asc' } }],
  });
  return rows.map(({ _count, ...t }) => ({ ...t, parameterCount: _count.parameters }));
}

async function assertLabSubDept(subDeptId) {
  const ids = await labDepartmentIds();
  const sd = await prisma.clinicSubDepartment.findUnique({ where: { id: Number(subDeptId) }, select: { id: true, departmentId: true, name: true } });
  if (!sd || !ids.includes(sd.departmentId)) throw fail(400, 'This test is not in the Clinic Laboratory list');
  return sd;
}

async function createTest({ categoryId, subDeptId, sampleType, sortOrder }) {
  if (!categoryId) throw fail(400, 'Select a category');
  if (!subDeptId) throw fail(400, 'Select a test');
  const sd = await assertLabSubDept(subDeptId);
  const existing = await prisma.labTest.findUnique({ where: { subDeptId: sd.id }, include: { category: true } });
  if (existing) throw fail(409, `"${sd.name}" is already in the "${existing.category.name}" category`);
  return prisma.labTest.create({
    data: { categoryId: Number(categoryId), subDeptId: sd.id, sampleType: text(sampleType), sortOrder: Number(sortOrder) || 0 },
  });
}

async function updateTest(id, { categoryId, sampleType, sortOrder }) {
  if (!categoryId) throw fail(400, 'Select a category');
  return prisma.labTest.update({
    where: { id: Number(id) },
    data: { categoryId: Number(categoryId), sampleType: text(sampleType), sortOrder: Number(sortOrder) || 0 },
  });
}

// Parameters go with the test; results already saved keep their copied names
// and ranges.
async function deleteTest(id) {
  await prisma.labTest.delete({ where: { id: Number(id) } });
  return { id: Number(id) };
}

// ─── Parameters (report rows) ────────────────────────────────────────────────

const ROWS_ORDER = { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] };

async function getTestParameters(testId) {
  const test = await prisma.labTest.findUnique({
    where: { id: Number(testId) },
    include: {
      subDept: { select: { id: true, code: true, name: true } },
      category: { select: { id: true, name: true } },
      parameters: ROWS_ORDER,
    },
  });
  if (!test) throw fail(404, 'Test not found');
  return test;
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
      // Kept as typed, line breaks too; it prints exactly like this.
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
// missing rows removed (saved results keep their own copy).
async function saveTestParameters(testId, parameters) {
  const tid = Number(testId);
  const test = await prisma.labTest.findUnique({ where: { id: tid }, include: { parameters: { select: { id: true } } } });
  if (!test) throw fail(404, 'Test not found');
  const rows = (Array.isArray(parameters) ? parameters : []).map(cleanRow);
  const ownIds = new Set(test.parameters.map((p) => p.id));
  const keepIds = rows.filter((r) => r.id && ownIds.has(r.id)).map((r) => r.id);

  await prisma.$transaction(async (tx) => {
    await tx.labParameter.deleteMany({ where: { labTestId: tid, id: { notIn: keepIds } } });
    for (const r of rows) {
      if (r.id && ownIds.has(r.id)) await tx.labParameter.update({ where: { id: r.id }, data: r.data });
      else await tx.labParameter.create({ data: { ...r.data, labTestId: tid } });
    }
  });
  return getTestParameters(tid);
}

// ─── Reference range → H/L flag ──────────────────────────────────────────────

// A plain range in the reference text drives the flag: "13.0-17.0",
// "4.5 - 5.5", "< 200", "<= 41", "Up to 41", "> 40". One per line (or split
// by " / " or ";"), optionally labelled "Male:", "Female:", "Children:".
// Anything else ("Negative", a sentence) just prints, with no flag.
const LABEL_GROUPS = [
  [/^(male|males|men|man|m)$/i, 'male'],
  [/^(female|females|women|woman|f)$/i, 'female'],
  [/^(child|children|kids?|infants?|newborns?|paediatric|pediatric)$/i, 'child'],
  [/^(adults?|all)$/i, 'all'],
];
const N = '(-?\\d+(?:\\.\\d+)?)';
const RE_BETWEEN = new RegExp(`^${N}\\s*(?:-|–|to)\\s*${N}`, 'i');
const RE_UPTO = new RegExp(`^(?:<=?|≤|up\\s*to|upto|less\\s+than|below)\\s*${N}`, 'i');
const RE_FROM = new RegExp(`^(?:>=?|≥|more\\s+than|greater\\s+than|above)\\s*${N}`, 'i');

function parseReference(ref) {
  if (!ref) return [];
  return String(ref)
    .replace(/(\d),(?=\d{3})/g, '$1')
    .split(/\r?\n|;|\s\/\s/)
    .map((line) => {
      let body = line.trim();
      let group = 'all';
      const colon = body.indexOf(':');
      if (colon > 0) {
        const label = body.slice(0, colon).trim();
        const hit = LABEL_GROUPS.find(([re]) => re.test(label));
        group = hit ? hit[1] : null;
        body = body.slice(colon + 1).trim();
      }
      if (!group) return null;
      let m = RE_BETWEEN.exec(body);
      if (m) return { group, low: Number(m[1]), high: Number(m[2]) };
      m = RE_UPTO.exec(body);
      if (m) return { group, low: null, high: Number(m[1]) };
      m = RE_FROM.exec(body);
      if (m) return { group, low: Number(m[1]), high: null };
      return null;
    })
    .filter(Boolean);
}

// The patient's own group for the H/L flag. Age 0 with no months or days is
// an unfilled age, not a newborn.
function patientGroup(visit) {
  const years = visit.age;
  const isChild = years !== null && years !== undefined && (
    (years > 0 && years < CHILD_UNDER_YEARS) || (years === 0 && ((visit.ageMonths || 0) > 0 || (visit.ageDays || 0) > 0))
  );
  if (isChild) return 'child';
  return String(visit.gender || '').toLowerCase() === 'female' ? 'female' : 'male';
}

function flagFor(value, referenceRange, group) {
  const v = num(value);
  if (v === null) return '';
  const ranges = parseReference(referenceRange);
  const r = ranges.find((x) => x.group === group) || ranges.find((x) => x.group === 'all');
  if (!r) return '';
  if (r.low !== null && v < r.low) return 'L';
  if (r.high !== null && v > r.high) return 'H';
  return '';
}

// ─── Slips ───────────────────────────────────────────────────────────────────

const pktToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

function ageText(v) {
  const parts = [];
  if (v.age) parts.push(`${v.age}Y`);
  if (v.ageMonths) parts.push(`${v.ageMonths}M`);
  if (v.ageDays) parts.push(`${v.ageDays}D`);
  return parts.join(' ');
}

const slipWhereBase = { department: { equals: LAB_DEPARTMENT, mode: 'insensitive' }, status: 'active' };

// A search (Slip #, MR #, name) looks at every date, like Voucher Reprint's
// number search. Otherwise the PKT calendar days from..to, or, with no dates,
// the newest slips of every date (owner, 2026-11-11: slips must show on open).
const ALL_DATES_LIMIT = 500;
async function listSlips({ from, to, q, status } = {}) {
  const term = String(q || '').trim();
  const where = { ...slipWhereBase };
  if (term) {
    const n = Number(term);
    where.OR = [
      { serialNo: { contains: term, mode: 'insensitive' } },
      { patientName: { contains: term, mode: 'insensitive' } },
      { admitNo: { contains: term, mode: 'insensitive' } },
      ...(Number.isInteger(n) && n > 0 && n <= 2147483647 ? [{ mrNo: n }] : []),
    ];
  } else if (isIsoDate(from) || isIsoDate(to)) {
    const f = isIsoDate(from) ? from : to;
    const t = isIsoDate(to) ? to : f;
    where.createdAt = { gte: new Date(`${f}T00:00:00+05:00`), lte: new Date(`${t}T23:59:59.999+05:00`) };
  }
  const dated = !term && !!where.createdAt;

  const visits = await prisma.clinicOpdVisit.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: term ? 200 : dated ? 1000 : ALL_DATES_LIMIT,
    select: {
      id: true, serialNo: true, mrNo: true, patientType: true, patientName: true, age: true, ageMonths: true, ageDays: true,
      gender: true, admitNo: true, referredBy: true, createdAt: true,
      doctors: { orderBy: { id: 'asc' }, select: { id: true, subDept: { select: { name: true } } } },
      labResults: { select: { visitDoctorId: true, status: true } },
    },
  });

  const rows = visits
    .filter((v) => v.doctors.length)
    .map((v) => {
      const done = new Set(v.labResults.filter((r) => r.status === 'done').map((r) => r.visitDoctorId));
      const tests = v.doctors.map((d) => ({ visitDoctorId: d.id, name: d.subDept?.name || '', done: done.has(d.id) }));
      const doneCount = tests.filter((t) => t.done).length;
      return {
        id: v.id, serialNo: v.serialNo, mrNo: v.mrNo, patientName: `${v.patientType || ''} ${v.patientName || ''}`.trim(),
        age: ageText(v), gender: v.gender, admitNo: v.admitNo || null, referredBy: v.referredBy || null, createdAt: v.createdAt,
        tests, doneCount, testCount: tests.length, status: doneCount === tests.length ? 'done' : 'pending',
      };
    });
  return status === 'pending' || status === 'done' ? rows.filter((r) => r.status === status) : rows;
}

async function loadLabSlip(visitId) {
  const visit = await prisma.clinicOpdVisit.findUnique({
    where: { id: Number(visitId) },
    include: {
      doctors: { orderBy: { id: 'asc' }, include: { subDept: { select: { id: true, code: true, name: true } } } },
      labResults: { include: { values: { orderBy: { sortOrder: 'asc' } } } },
    },
  });
  if (!visit || norm(visit.department) !== norm(LAB_DEPARTMENT)) throw fail(404, 'Lab slip not found');
  if (visit.status !== 'active') throw fail(400, 'This slip has been cancelled');
  const subDeptIds = [...new Set(visit.doctors.map((d) => d.subDeptId))];
  const labTests = subDeptIds.length
    ? await prisma.labTest.findMany({
        where: { subDeptId: { in: subDeptIds } },
        include: {
          category: { select: { name: true } },
          parameters: { where: { isActive: true }, ...ROWS_ORDER },
        },
      })
    : [];
  return { visit, testBySubDept: new Map(labTests.map((t) => [t.subDeptId, t])) };
}

async function getSlip(visitId) {
  const { visit, testBySubDept } = await loadLabSlip(visitId);
  const group = patientGroup(visit);
  const resultByLine = new Map(visit.labResults.map((r) => [r.visitDoctorId, r]));
  return {
    visit: {
      id: visit.id, serialNo: visit.serialNo, mrNo: visit.mrNo, patientType: visit.patientType, patientName: visit.patientName,
      age: ageText(visit), gender: visit.gender, admitNo: visit.admitNo || null, referredBy: visit.referredBy || null,
      phoneNo: visit.phoneNo || null, createdAt: visit.createdAt, patientGroup: group,
    },
    tests: visit.doctors.map((d) => {
      const lt = testBySubDept.get(d.subDeptId);
      const r = resultByLine.get(d.id);
      // A saved value is tied to its setup row by id; if that row was removed
      // and made again (new id), tie it back by name, so the box isn't shown
      // empty — an empty box saved again would wipe the result.
      const rows = lt?.parameters || [];
      const liveIds = new Set(rows.map((p) => p.id));
      const idByName = new Map(rows.filter((p) => p.kind === 'param').map((p) => [p.name.trim().toLowerCase(), p.id]));
      const linkOf = (v) => (v.parameterId && liveIds.has(v.parameterId)
        ? v.parameterId
        : (v.kind || 'param') === 'param' ? idByName.get(String(v.parameterName || '').trim().toLowerCase()) ?? null : null);
      return {
        visitDoctorId: d.id,
        subDeptId: d.subDeptId,
        code: d.subDept?.code || '',
        name: d.subDept?.name || '',
        labTestId: lt?.id || null,
        categoryName: lt?.category?.name || null,
        sampleType: lt?.sampleType || null,
        parameters: (lt?.parameters || []).map((p) => ({
          id: p.id, kind: p.kind, name: p.name, unit: p.unit, referenceRange: p.referenceRange, noteText: p.noteText,
          resultType: p.resultType, options: p.options,
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

// Saves every test line sent; a line with nothing typed and no saved result is
// left alone. The test's report rows are stored as they are now (headings,
// notes, units, reference ranges) with the typed results, so a reprint shows
// the report as saved. Each change to a saved result is logged.
async function saveSlipResults(visitId, { tests, userId, userName } = {}) {
  const { visit, testBySubDept } = await loadLabSlip(visitId);
  const group = patientGroup(visit);
  const lineById = new Map(visit.doctors.map((d) => [d.id, d]));
  const resultByLine = new Map(visit.labResults.map((r) => [r.visitDoctorId, r]));
  const who = text(userName);

  const plans = [];
  for (const t of Array.isArray(tests) ? tests : []) {
    const line = lineById.get(Number(t.visitDoctorId));
    if (!line) throw fail(400, 'This test is not on this slip');
    const lt = testBySubDept.get(line.subDeptId);
    const params = lt?.parameters || [];
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
    const existing = resultByLine.get(line.id);
    if (!existing && !typed && !remarks) continue;
    plans.push({ line, values, remarks, existing, status: typed || remarks ? 'done' : 'pending' });
  }

  await prisma.$transaction(async (tx) => {
    for (const p of plans) {
      const after = snapshotOf({ remarks: p.remarks, values: p.values });
      if (p.existing) {
        const before = snapshotOf(p.existing);
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        await tx.labResultValue.deleteMany({ where: { resultId: p.existing.id } });
        await tx.labResult.update({
          where: { id: p.existing.id },
          data: { remarks: p.remarks, status: p.status, updatedByName: who, values: { create: p.values } },
        });
        await tx.labResultLog.create({ data: { resultId: p.existing.id, changedByName: who, before, after } });
      } else {
        await tx.labResult.create({
          data: {
            visitId: visit.id, visitDoctorId: p.line.id, subDeptId: p.line.subDeptId, testName: p.line.subDept?.name || '',
            remarks: p.remarks, status: p.status, enteredByUserId: text(userId), enteredByName: who, updatedByName: who,
            values: { create: p.values },
          },
        });
      }
    }
  });
  return getSlip(visit.id);
}

async function markPrinted(resultIds) {
  const ids = (Array.isArray(resultIds) ? resultIds : []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return { count: 0 };
  const r = await prisma.labResult.updateMany({ where: { id: { in: ids } }, data: { printCount: { increment: 1 } } });
  return { count: r.count };
}

async function getSummary() {
  const today = await listSlips({ from: pktToday(), to: pktToday() });
  const ids = await labDepartmentIds();
  const [categories, tests, withParams, clinicTests] = await Promise.all([
    prisma.labCategory.count(),
    prisma.labTest.count(),
    prisma.labTest.count({ where: { parameters: { some: {} } } }),
    ids.length ? prisma.clinicSubDepartment.count({ where: { departmentId: { in: ids } } }) : 0,
  ]);
  return {
    todaySlips: today.length,
    todayPendingTests: today.reduce((s, r) => s + (r.testCount - r.doneCount), 0),
    categories, tests, testsWithParameters: withParams, clinicTests,
  };
}

module.exports = {
  listCategories, createCategory, updateCategory, deleteCategory,
  listClinicTests, listTests, createTest, updateTest, deleteTest,
  getTestParameters, saveTestParameters,
  listSlips, getSlip, saveSlipResults, markPrinted, getSummary,
  // exported for tests
  parseReference, patientGroup, flagFor,
};
