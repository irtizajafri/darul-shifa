const prisma = require('../../config/db');
// Same shared Prisma client — reusing Clinic's own revenue aggregation here
// (rather than re-deriving it) so "Income" for the Non-Corporate entity always
// matches what the Clinic Revenue Dashboard itself shows for patient revenue.
const clinicSvc = require('../clinic/clinic.service');

// ── Main GL ───────────────────────────────────────────────────────────────────

async function getMainGLs(entityType) {
  return prisma.accMainGL.findMany({
    where: { entityType },
    orderBy: { id: 'asc' },
  });
}

async function createMainGL({ name, entityType }) {
  // `code` is globally unique (not scoped by entityType — see schema), so the
  // sequence has to be counted across ALL Main GLs, not just this entityType's
  // — counting only this entityType's rows would regenerate "E-1" for the
  // first Corporate Main GL even though Non-Corporate already has one.
  const count = await prisma.accMainGL.count();
  const code = `E-${count + 1}`;
  return prisma.accMainGL.create({ data: { code, name: name.trim(), entityType } });
}

async function updateMainGL(id, { name }) {
  return prisma.accMainGL.update({
    where: { id: Number(id) },
    data: { name: name.trim() },
  });
}

async function deleteMainGL(id) {
  return prisma.accMainGL.delete({ where: { id: Number(id) } });
}

// ── Sub GL ────────────────────────────────────────────────────────────────────

async function getSubGLs(entityType, mainGlId) {
  return prisma.accSubGL.findMany({
    where: {
      entityType,
      ...(mainGlId ? { mainGlId: Number(mainGlId) } : {}),
    },
    include: { mainGL: { select: { id: true, code: true, name: true } } },
    orderBy: { id: 'asc' },
  });
}

async function createSubGL({ name, mainGlId, entityType }) {
  const parent = await prisma.accMainGL.findUnique({ where: { id: Number(mainGlId) } });
  if (!parent) throw new Error('Main GL not found');
  const count = await prisma.accSubGL.count({ where: { mainGlId: Number(mainGlId) } });
  const code = `${parent.code}.${count + 1}`;
  return prisma.accSubGL.create({ data: { code, name: name.trim(), mainGlId: Number(mainGlId), entityType } });
}

async function updateSubGL(id, { name }) {
  return prisma.accSubGL.update({ where: { id: Number(id) }, data: { name: name.trim() } });
}

async function deleteSubGL(id) {
  return prisma.accSubGL.delete({ where: { id: Number(id) } });
}

// ── Main Account ──────────────────────────────────────────────────────────────

async function getMainAccounts(entityType, subGlId) {
  return prisma.accMainAccount.findMany({
    where: {
      entityType,
      ...(subGlId ? { subGlId: Number(subGlId) } : {}),
    },
    include: { subGL: { select: { id: true, code: true, name: true } } },
    orderBy: { id: 'asc' },
  });
}

async function createMainAccount({ name, subGlId, entityType }) {
  const parent = await prisma.accSubGL.findUnique({ where: { id: Number(subGlId) } });
  if (!parent) throw new Error('Sub GL not found');
  const count = await prisma.accMainAccount.count({ where: { subGlId: Number(subGlId) } });
  const code = `${parent.code}.${count + 1}`;
  return prisma.accMainAccount.create({ data: { code, name: name.trim(), subGlId: Number(subGlId), entityType } });
}

async function updateMainAccount(id, { name }) {
  return prisma.accMainAccount.update({ where: { id: Number(id) }, data: { name: name.trim() } });
}

async function deleteMainAccount(id) {
  return prisma.accMainAccount.delete({ where: { id: Number(id) } });
}

// ── Sub Account ───────────────────────────────────────────────────────────────

async function getSubAccounts(entityType, mainAccountId) {
  return prisma.accSubAccount.findMany({
    where: {
      entityType,
      ...(mainAccountId ? { mainAccountId: Number(mainAccountId) } : {}),
    },
    include: { mainAccount: { select: { id: true, code: true, name: true } } },
    orderBy: { id: 'asc' },
  });
}

async function createSubAccount({ name, mainAccountId, entityType }) {
  const parent = await prisma.accMainAccount.findUnique({ where: { id: Number(mainAccountId) } });
  if (!parent) throw new Error('Main Account not found');
  const count = await prisma.accSubAccount.count({ where: { mainAccountId: Number(mainAccountId) } });
  const code = `${parent.code}.${count + 1}`;
  return prisma.accSubAccount.create({ data: { code, name: name.trim(), mainAccountId: Number(mainAccountId), entityType } });
}

async function updateSubAccount(id, { name }) {
  return prisma.accSubAccount.update({ where: { id: Number(id) }, data: { name: name.trim() } });
}

async function deleteSubAccount(id) {
  return prisma.accSubAccount.delete({ where: { id: Number(id) } });
}

// ── Payee Heads ───────────────────────────────────────────────────────────────

const SYSTEM_HEAD_DEFS = [
  { sourceType: 'employee', name: 'Employees' },
  { sourceType: 'vendor',   name: 'Vendors / Suppliers' },
  { sourceType: 'doctor',   name: 'Doctors / Consultants' },
];

async function ensureSystemHeads(entityType) {
  for (const def of SYSTEM_HEAD_DEFS) {
    const exists = await prisma.accPayeeHead.findFirst({ where: { sourceType: def.sourceType, entityType } });
    if (!exists) await prisma.accPayeeHead.create({ data: { name: def.name, sourceType: def.sourceType, entityType } });
  }
}

const LINKED_ACCOUNTS_INCLUDE = {
  linkedAccounts: {
    orderBy: { id: 'asc' },
    include: {
      subAccount: {
        select: {
          id: true, code: true, name: true,
          mainAccount: {
            select: {
              id: true, code: true, name: true,
              subGL: {
                select: {
                  id: true, code: true, name: true,
                  mainGL: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
  inventorySubcategory: { select: { id: true, code: true, name: true, category: { select: { id: true, name: true } } } },
  linkedMainAccounts: {
    orderBy: { id: 'asc' },
    include: { mainAccount: { select: { id: true, code: true, name: true } } },
  },
  staffCategoryLinks: {
    orderBy: { id: 'asc' },
    include: { staffCategory: { select: { id: true, name: true } } },
  },
  // sourceType='inventory' only — Custom (manual) Heads merged into this
  // head's own Payee list (see linkCustomHeadToInventoryHead).
  linkedCustomHeads: {
    orderBy: { id: 'asc' },
    include: { customHead: { select: { id: true, name: true } } },
  },
};

async function getPayeeHeads(entityType) {
  await ensureSystemHeads(entityType);
  return prisma.accPayeeHead.findMany({
    where: { entityType },
    orderBy: { id: 'asc' },
    include: LINKED_ACCOUNTS_INCLUDE,
  });
}

async function createPayeeHead({ name, sourceType = 'manual', entityType, inventorySubcategoryId, mainAccountId }) {
  const data = { name: name.trim(), sourceType, entityType };
  if (inventorySubcategoryId) data.inventorySubcategoryId = Number(inventorySubcategoryId);
  if (mainAccountId)          data.mainAccountId          = Number(mainAccountId);
  return prisma.accPayeeHead.create({ data, include: LINKED_ACCOUNTS_INCLUDE });
}

async function getInventoryHeadForMainAccount(mainAccountId) {
  const link = await prisma.accPayeeHeadMainAccount.findFirst({
    where: { mainAccountId: Number(mainAccountId) },
    include: { payeeHead: { select: { id: true, name: true, inventorySubcategoryId: true, sourceType: true } } },
  });
  if (!link?.payeeHead || link.payeeHead.sourceType !== 'inventory') return null;
  return link.payeeHead;
}

// ── Surgery/Anesthesia payee head (sourceType='surgery') ───────────────────
// Same shape as the Inventory head above, but the "catalog" is Clinic staff
// categories (Surgeon, Anaesthetic, …) instead of an inventory subcategory —
// reuses the exact same AccPayeeHeadMainAccount link, so no new link route
// was needed for it.

async function getSurgeryHeadForMainAccount(mainAccountId) {
  const link = await prisma.accPayeeHeadMainAccount.findFirst({
    where: { mainAccountId: Number(mainAccountId) },
    include: {
      payeeHead: {
        select: {
          id: true, name: true, sourceType: true,
          staffCategoryLinks: { include: { staffCategory: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!link?.payeeHead || link.payeeHead.sourceType !== 'surgery') return null;
  return link.payeeHead;
}

async function addPayeeHeadStaffCategory(headId, staffCategoryId) {
  return prisma.accPayeeHeadStaffCategory.create({
    data: { payeeHeadId: Number(headId), staffCategoryId: Number(staffCategoryId) },
    include: { staffCategory: { select: { id: true, name: true } } },
  });
}

async function removePayeeHeadStaffCategory(headId, staffCategoryId) {
  return prisma.accPayeeHeadStaffCategory.deleteMany({
    where: { payeeHeadId: Number(headId), staffCategoryId: Number(staffCategoryId) },
  });
}

// Payee list for a surgery/anesthesia head — doctors whose staff category is
// one of the ones linked to this head, tagged with that category's name so
// the picker can show e.g. "Dr X (Surgeon)". Pass staffCategoryId to narrow
// it down to just that one role (e.g. the user picked "Surgery" vs
// "Anesthesia" for this particular payment) — must still be one of the
// categories actually linked to this head.
async function getSurgeryPayeesForHead(headId, staffCategoryId) {
  const links = await prisma.accPayeeHeadStaffCategory.findMany({
    where: { payeeHeadId: Number(headId) },
    select: { staffCategoryId: true },
  });
  let categoryIds = links.map((l) => l.staffCategoryId);
  if (staffCategoryId && categoryIds.includes(Number(staffCategoryId))) {
    categoryIds = [Number(staffCategoryId)];
  }
  if (categoryIds.length === 0) return [];
  const rows = await prisma.clinicDoctor.findMany({
    where: { status: 'active', staffCategoryId: { in: categoryIds } },
    select: { id: true, name: true, code: true, staffCategory: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  return rows.map((d) => ({ id: d.id, name: d.name, code: d.code, categoryName: d.staffCategory?.name || null }));
}

// ── IPD Consultant Fee payee head (sourceType='ipd-consultant') ────────────
// Same Main-Account link + staff-category filter as Surgery/Anesthesia above
// (reuses getSurgeryPayeesForHead as-is — it only cares about linked staff
// categories, not sourceType). What's different is where the Amount comes
// from: not typed by hand, but summed from that consultant's own unpaid
// Const Fee doctorFee rows already sitting in admissions' Final Bills.
async function getIpdConsultantHeadForMainAccount(mainAccountId) {
  const link = await prisma.accPayeeHeadMainAccount.findFirst({
    where: { mainAccountId: Number(mainAccountId) },
    include: {
      payeeHead: {
        select: {
          id: true, name: true, sourceType: true,
          staffCategoryLinks: { include: { staffCategory: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!link?.payeeHead || link.payeeHead.sourceType !== 'ipd-consultant') return null;
  return link.payeeHead;
}

// Unpaid Const Fee rows for one doctor, optionally narrowed to a date range
// (matched against when that row was added to the Final Bill) — each is a
// single admission's Doctor Fee share, already split, ready to pick into a
// payment.
async function getPendingConsultantFees(doctorId, fromDate, toDate) {
  const where = {
    doctorId: Number(doctorId),
    isPaid: false,
    doctorFee: { not: null },
  };
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(`${fromDate}T00:00:00`);
    if (toDate) where.createdAt.lte = new Date(`${toDate}T23:59:59`);
  }
  const rows = await prisma.clinicDischargeBillItem.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { admission: { select: { id: true, admissionNo: true, patientTitle: true, patientName: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    admissionId: r.admission?.id,
    admissionNo: r.admission?.admissionNo || '',
    patientName: r.admission ? `${r.admission.patientTitle || ''} ${r.admission.patientName}`.trim() : '',
    date: r.createdAt,
    amount: Number(r.doctorFee) || 0,
  }));
}

async function getInventorySubcategories() {
  return prisma.inventorySubcategory.findMany({
    where: { status: 'active' },
    select: { id: true, code: true, name: true, category: { select: { id: true, name: true } } },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
  });
}

async function getInventoryItemsBySubcategory(subcategoryId) {
  return prisma.inventoryItem.findMany({
    where: { subcategoryId: Number(subcategoryId), status: 'active' },
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' },
  });
}

// Inventory Head's picker list = its own inventory items PLUS the manually-
// typed entries of every Custom Head linked to it (see
// AccPayeeHeadLinkedCustomHead) — merged into one list. `optionValue` is a
// prefixed string (not the raw numeric id) since InventoryItem ids and
// AccPayeeEntry ids are separate id spaces that can collide; the frontend
// matches on this instead of id, and `kind` tells it whether picking that
// row should fill Account Name/Code (an item) or Payee Name (a person).
async function getInventoryItemsForHead(headId) {
  const head = await prisma.accPayeeHead.findUnique({
    where: { id: Number(headId) },
    include: { linkedCustomHeads: { select: { customHeadId: true } } },
  });
  if (!head) throw Object.assign(new Error('Head not found'), { status: 404 });

  const [items, entries] = await Promise.all([
    head.inventorySubcategoryId ? getInventoryItemsBySubcategory(head.inventorySubcategoryId) : [],
    head.linkedCustomHeads.length
      ? prisma.accPayeeEntry.findMany({
          where: { payeeHeadId: { in: head.linkedCustomHeads.map((l) => l.customHeadId) } },
          orderBy: { name: 'asc' },
        })
      : [],
  ]);

  return [
    ...items.map((i) => ({ optionValue: `item-${i.id}`, id: i.id, code: i.code, name: i.name, kind: 'item' })),
    ...entries.map((e) => ({ optionValue: `payee-${e.id}`, id: e.id, code: '', name: e.name, kind: 'payee' })),
  ];
}

async function linkCustomHeadToInventoryHead(headId, customHeadId) {
  const [head, customHead] = await Promise.all([
    prisma.accPayeeHead.findUnique({ where: { id: Number(headId) } }),
    prisma.accPayeeHead.findUnique({ where: { id: Number(customHeadId) } }),
  ]);
  if (!head || head.sourceType !== 'inventory') throw Object.assign(new Error('Target head must be an Inventory Head'), { status: 400 });
  if (!customHead || customHead.sourceType !== 'manual') throw Object.assign(new Error('Linked head must be a Custom Head'), { status: 400 });

  return prisma.accPayeeHeadLinkedCustomHead.create({
    data: { headId: Number(headId), customHeadId: Number(customHeadId) },
  });
}

async function unlinkCustomHeadFromInventoryHead(headId, customHeadId) {
  return prisma.accPayeeHeadLinkedCustomHead.deleteMany({
    where: { headId: Number(headId), customHeadId: Number(customHeadId) },
  });
}

async function updatePayeeHead(id, body) {
  const data = {};
  if (body.name !== undefined) data.name = body.name.trim();
  return prisma.accPayeeHead.update({
    where: { id: Number(id) },
    data,
    include: LINKED_ACCOUNTS_INCLUDE,
  });
}

async function addInventoryHeadMainAccount(headId, mainAccountId) {
  return prisma.accPayeeHeadMainAccount.create({
    data: { payeeHeadId: Number(headId), mainAccountId: Number(mainAccountId) },
    include: { mainAccount: { select: { id: true, code: true, name: true } } },
  });
}

async function removeInventoryHeadMainAccount(headId, mainAccountId) {
  return prisma.accPayeeHeadMainAccount.deleteMany({
    where: { payeeHeadId: Number(headId), mainAccountId: Number(mainAccountId) },
  });
}

async function deletePayeeHead(id) {
  return prisma.accPayeeHead.delete({ where: { id: Number(id) } });
}

async function addHeadAccount(headId, subAccountId) {
  return prisma.accPayeeHeadAccount.create({
    data: { payeeHeadId: Number(headId), subAccountId: Number(subAccountId) },
    include: {
      subAccount: { select: { id: true, code: true, name: true } },
    },
  });
}

async function removeHeadAccount(headId, subAccountId) {
  return prisma.accPayeeHeadAccount.deleteMany({
    where: { payeeHeadId: Number(headId), subAccountId: Number(subAccountId) },
  });
}

// Mirrors the frontend's prevMonthInfo() (VoucherExpenseForm.jsx) — the
// Salary modal always pays out *last* calendar month's payslip, so "already
// paid" has to be checked against that same month/year.
function getPrevMonthYear() {
  const now = new Date();
  const m = now.getMonth(); // 0-11
  const month = String(m === 0 ? 12 : m).padStart(2, '0');
  const year = String(m === 0 ? now.getFullYear() - 1 : now.getFullYear());
  return { month, year };
}

async function getPayeeEntriesBySubAccount(subAccountId, entityType) {
  const link = await prisma.accPayeeHeadAccount.findFirst({
    where: { subAccountId: Number(subAccountId), payeeHead: { entityType } },
    include: { payeeHead: { include: { inventorySubcategory: { select: { id: true, name: true } } } } },
  });
  const head = link?.payeeHead;
  if (!head) return { type: null, headName: null, headId: null, entries: [], checkedNames: [] };

  if (head.sourceType === 'employee') {
    const checkedEntries = await prisma.accPayeeEntry.findMany({
      where: { payeeHeadId: head.id, subAccountId: Number(subAccountId) },
      select: { name: true },
    });
    const checkedNames = checkedEntries.map((e) => e.name);
    const rows = await prisma.employee.findMany({
      where: { status: 'Active' },
      select: { id: true, firstName: true, lastName: true, empCode: true },
      orderBy: { firstName: 'asc' },
    });
    const allEmps = rows.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, code: e.empCode }));
    // Once an employee's previous-month salary voucher has been paid, drop
    // them from the pay-list — they only reappear once a new (unpaid) month
    // rolls around, same idea as the isPaid gates below for vendor/doctor.
    const { month: prevMonth, year: prevYear } = getPrevMonthYear();
    const paidRows = await prisma.employeeSalaryPayment.findMany({
      where: { salaryMonth: prevMonth, salaryYear: prevYear },
      select: { empCode: true },
    });
    const paidCodes = new Set(paidRows.map((r) => r.empCode));
    const dueEmps = allEmps.filter((e) => !paidCodes.has(e.code));
    const filteredEntries = checkedNames.length > 0
      ? dueEmps.filter((e) => checkedNames.includes(e.name))
      : dueEmps;
    return { type: 'employee', headName: head.name, headId: head.id, entries: filteredEntries, allEntries: dueEmps, checkedNames };
  }

  if (head.sourceType === 'vendor') {
    const checkedEntries = await prisma.accPayeeEntry.findMany({
      where: { payeeHeadId: head.id, subAccountId: Number(subAccountId) },
      select: { name: true },
    });
    const checkedNames = checkedEntries.map((e) => e.name);
    const allSuppliers = await prisma.inventorySupplier.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    // Only suppliers with at least one unpaid GRN belong in the pay-list —
    // once every GRN is paid off, the supplier drops out until a new GRN
    // comes in.
    const dueSupplierRows = await prisma.inventoryGRN.findMany({
      where: { isPaid: false },
      select: { supplierId: true },
      distinct: ['supplierId'],
    });
    const dueSupplierIds = new Set(dueSupplierRows.map((r) => r.supplierId));
    const dueSuppliers = allSuppliers.filter((s) => dueSupplierIds.has(s.id));
    const filteredEntries = checkedNames.length > 0
      ? dueSuppliers.filter((s) => checkedNames.includes(s.name))
      : dueSuppliers;
    return { type: 'vendor', headName: head.name, headId: head.id, entries: filteredEntries, allSuppliers: dueSuppliers, checkedNames };
  }

  if (head.sourceType === 'doctor') {
    const checkedEntries = await prisma.accPayeeEntry.findMany({
      where: { payeeHeadId: head.id, subAccountId: Number(subAccountId) },
      select: { name: true },
    });
    const checkedNames = checkedEntries.map((e) => e.name);
    const rows = await prisma.clinicDoctor.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    const allDoctors = rows.map((d) => ({ id: d.id, name: d.name, code: d.code }));
    // Same idea as vendor above — a doctor only belongs in the pay-list while
    // they have at least one unpaid, non-Panel visit (mirrors the exact
    // filter getConsultantVisits uses, so "shows in list" always means
    // "clicking it shows something to pay").
    const dueDoctorRows = await prisma.patientVisit.findMany({
      where: { isPaid: false, paymentType: { not: 'Panel' }, doctor: { not: null } },
      select: { doctor: true },
      distinct: ['doctor'],
    });
    const dueDoctorNames = new Set(dueDoctorRows.map((r) => r.doctor));
    const dueDoctors = allDoctors.filter((d) => dueDoctorNames.has(d.name));
    const filteredEntries = checkedNames.length > 0
      ? dueDoctors.filter((d) => checkedNames.includes(d.name))
      : dueDoctors;
    return { type: 'doctor', headName: head.name, headId: head.id, entries: filteredEntries, allEntries: dueDoctors, checkedNames };
  }

  if (head.sourceType === 'inventory') {
    if (!head.inventorySubcategoryId) return { type: 'inventory', headName: head.name, headId: head.id, entries: [], checkedNames: [] };
    const rows = await prisma.inventoryItem.findMany({
      where: { subcategoryId: head.inventorySubcategoryId, status: 'active' },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
    return { type: 'inventory', headName: head.name, headId: head.id, entries: rows.map((i) => ({ id: i.id, name: i.name, code: i.code })), checkedNames: [] };
  }

  const rows = await prisma.accPayeeEntry.findMany({ where: { payeeHeadId: head.id }, orderBy: { name: 'asc' } });
  return { type: 'manual', headName: head.name, entries: rows.map((e) => ({ id: e.id, name: e.name, code: null })) };
}

// ── Payee Entries ─────────────────────────────────────────────────────────────

async function getPayeeEntries(headId, subAccountId) {
  const where = { payeeHeadId: Number(headId) };
  if (subAccountId) where.subAccountId = Number(subAccountId);
  return prisma.accPayeeEntry.findMany({ where, orderBy: { id: 'asc' } });
}

async function createPayeeEntry({ payeeHeadId, name }) {
  return prisma.accPayeeEntry.create({ data: { payeeHeadId: Number(payeeHeadId), name: name.trim() } });
}

async function deletePayeeEntry(id) {
  return prisma.accPayeeEntry.delete({ where: { id: Number(id) } });
}

async function bulkSavePayeeEntries({ payeeHeadId, subAccountId, names }) {
  const where = { payeeHeadId: Number(payeeHeadId) };
  if (subAccountId) where.subAccountId = Number(subAccountId);
  await prisma.accPayeeEntry.deleteMany({ where });
  if (names && names.length > 0) {
    await prisma.accPayeeEntry.createMany({
      data: names.map((name) => ({
        payeeHeadId: Number(payeeHeadId),
        subAccountId: subAccountId ? Number(subAccountId) : null,
        name: name.trim(),
      })),
    });
  }
  return { saved: names?.length || 0 };
}

async function getEmployeeList() {
  return prisma.employee.findMany({
    select: { id: true, firstName: true, lastName: true },
    orderBy: { firstName: 'asc' },
  });
}

async function getSupplierList() {
  return prisma.inventorySupplier.findMany({
    where: { status: 'active' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

async function getDoctorList() {
  return prisma.clinicDoctor.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  });
}

// ── Bank Accounts ─────────────────────────────────────────────────────────────

async function getBankAccounts(entityType) {
  return prisma.accBankAccount.findMany({ where: { entityType }, orderBy: { id: 'asc' } });
}

async function createBankAccount({ bankName, accountNumber, entityType }) {
  return prisma.accBankAccount.create({ data: { bankName: bankName.trim(), accountNumber: accountNumber.trim(), entityType } });
}

async function updateBankAccount(id, { bankName, accountNumber }) {
  return prisma.accBankAccount.update({
    where: { id: Number(id) },
    data: { bankName: bankName.trim(), accountNumber: accountNumber.trim() },
  });
}

async function deleteBankAccount(id) {
  return prisma.accBankAccount.delete({ where: { id: Number(id) } });
}

// ── Cheque Serials ────────────────────────────────────────────────────────────

async function getChequeSerials(entityType, bankAccountId) {
  return prisma.accChequeSerial.findMany({
    where: bankAccountId
      ? { bankAccountId: Number(bankAccountId) }
      : { bankAccount: { entityType } },
    include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
    orderBy: { id: 'asc' },
  });
}

async function createChequeSerial({ bankAccountId, fromSerial, toSerial }) {
  return prisma.accChequeSerial.create({
    data: { bankAccountId: Number(bankAccountId), fromSerial: fromSerial.trim(), toSerial: toSerial.trim() },
    include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
  });
}

async function deleteChequeSerial(id) {
  return prisma.accChequeSerial.delete({ where: { id: Number(id) } });
}

async function getNextChequeSerial(bankAccountId) {
  const ranges = await prisma.accChequeSerial.findMany({
    where: { bankAccountId: Number(bankAccountId) },
    orderBy: { id: 'asc' },
  });
  if (ranges.length === 0) return null;

  const lastEntry = await prisma.accVoucherExpenseEntry.findFirst({
    where: { voucher: { bankId: Number(bankAccountId) }, chequeNo: { not: null } },
    orderBy: { id: 'desc' },
    select: { chequeNo: true },
  });

  if (!lastEntry?.chequeNo) return ranges[0].fromSerial;

  const lastNum = parseInt(lastEntry.chequeNo, 10);
  if (isNaN(lastNum)) return ranges[0].fromSerial;

  const next = lastNum + 1;
  for (const range of ranges) {
    const from = parseInt(range.fromSerial, 10);
    const to   = parseInt(range.toSerial,   10);
    if (!isNaN(from) && !isNaN(to) && next >= from && next <= to) {
      return String(next);
    }
  }
  return String(next);
}

// ── Income Categories ─────────────────────────────────────────────────────────

// ── Voucher Expense ───────────────────────────────────────────────────────────

async function getNextCashSerial(entityType) {
  const lastEntry = await prisma.accVoucherExpenseEntry.findFirst({
    where: { voucher: { mode: 'cash', entityType } },
    orderBy: { id: 'desc' },
    select: { chequeNo: true },
  });
  const last = lastEntry?.chequeNo ? parseInt(lastEntry.chequeNo, 10) : 0;
  return isNaN(last) ? 1 : last + 1;
}

async function getAllPayeeEntries(entityType) {
  return prisma.accPayeeEntry.findMany({
    where: { payeeHead: { entityType } },
    include: { payeeHead: { select: { name: true } } },
    orderBy: [{ payeeHead: { name: 'asc' } }, { name: 'asc' }],
  });
}

// ─── Business Date Helper ─────────────────────────────────────────────────────
// Hospital day runs 8 AM → 7:59:59 AM next day. Entries made before 8 AM
// still belong to the previous business day.
function getBusinessDate() {
  const now = new Date();
  if (now.getHours() < 8) now.setDate(now.getDate() - 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// ─── Expense Draft ────────────────────────────────────────────────────────────

async function saveDraftExpenseEntry({ entityType, mode, bankId, mainGlId, mainGlName, subGlId, subGlName, mainAccountId, accountCode, accountName, subAccountId, subAccountName, payeeName, amount, chequeNo, chequeDate, chequeType, particulars }) {
  const businessDate = getBusinessDate();
  return prisma.accVoucherExpenseDraft.create({
    data: {
      businessDate, entityType, mode: mode || 'cash',
      bankId: bankId ? Number(bankId) : null,
      mainGlId: Number(mainGlId), mainGlName: mainGlName || '',
      subGlId: Number(subGlId),   subGlName:  subGlName  || '',
      mainAccountId: Number(mainAccountId), accountCode: accountCode || '', accountName: accountName || '',
      subAccountId:  subAccountId ? Number(subAccountId) : null, subAccountName: subAccountName || null,
      payeeName: payeeName || null,
      amount: Number(amount),
      chequeNo: chequeNo || null, chequeDate: chequeDate ? new Date(chequeDate) : null, chequeType: chequeType || null,
      particulars: particulars || null,
    },
  });
}

async function getDraftExpenses(entityType) {
  const businessDate = getBusinessDate();
  return prisma.accVoucherExpenseDraft.findMany({
    where: { entityType, businessDate, status: 'pending' },
    orderBy: [{ mainGlName: 'asc' }, { createdAt: 'asc' }],
  });
}

async function deleteDraftExpense(id) {
  const draft = await prisma.accVoucherExpenseDraft.findUnique({ where: { id: Number(id) } });
  if (!draft) throw Object.assign(new Error('Draft not found'), { status: 404 });
  if (draft.status === 'posted') throw Object.assign(new Error('Posted draft cannot be deleted'), { status: 400 });
  return prisma.accVoucherExpenseDraft.delete({ where: { id: Number(id) } });
}

// Called by day-close job: groups pending drafts by Main GL → one voucher each.
async function flashDraftsToVouchers(date, entityType = 'non-corporate') {
  const drafts = await prisma.accVoucherExpenseDraft.findMany({
    where: { entityType, businessDate: date, status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });
  if (!drafts.length) return [];

  // Group by mainGlId
  const groups = {};
  for (const d of drafts) {
    const key = String(d.mainGlId);
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  }

  const vouchers = [];
  for (const entries of Object.values(groups)) {
    const totalAmount = entries.reduce((s, e) => s + Number(e.amount), 0);
    const voucherNo   = await generateVoucherNo(entityType, date);
    const voucher = await prisma.accVoucherExpense.create({
      data: {
        voucherNo, voucherType: 'CASH', voucherDate: new Date(date),
        mode: 'cash', entityType, totalAmount, source: 'draft-auto',
        entries: {
          create: entries.map((e) => ({
            mainGlId:     e.mainGlId,     subGlId:      e.subGlId,
            mainAccountId: e.mainAccountId, subAccountId: e.subAccountId,
            accountCode:  e.accountCode,  accountName:  e.accountName,
            payeeName:    e.payeeName,    amount:       Number(e.amount),
            chequeNo:     e.chequeNo,     chequeDate:   e.chequeDate,
            chequeType:   e.chequeType,   particulars:  e.particulars,
          })),
        },
      },
    });
    // Mark all group's drafts as posted
    await prisma.accVoucherExpenseDraft.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data:  { status: 'posted', postedVoucherId: voucher.id },
    });
    vouchers.push({ voucherNo: voucher.voucherNo, mainGlName: entries[0].mainGlName, entriesCount: entries.length, totalAmount });
  }
  return vouchers;
}

async function generateVoucherNo(entityType, voucherDate) {
  const d = new Date(voucherDate);
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `VE-${dateStr}`;
  const count = await prisma.accVoucherExpense.count({ where: { voucherNo: { startsWith: prefix }, entityType } });
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}

async function createVoucherExpense({ entityType, mode, bankId, voucherDate, entries }) {
  const voucherType = mode === 'cash' ? 'CASH' : 'BANK';
  const voucherNo = await generateVoucherNo(entityType, voucherDate);
  const totalAmount = entries.reduce((s, e) => s + Number(e.amount), 0);

  const voucher = await prisma.accVoucherExpense.create({
    data: {
      voucherNo, voucherType,
      voucherDate: new Date(voucherDate),
      mode,
      bankId: bankId ? Number(bankId) : null,
      entityType, totalAmount,
      entries: {
        create: entries.map((e) => ({
          mainGlId: Number(e.mainGlId),
          subGlId: Number(e.subGlId),
          mainAccountId: Number(e.mainAccountId),
          subAccountId: e.subAccountId ? Number(e.subAccountId) : null,
          accountCode: e.accountCode,
          accountName: e.accountName,
          payeeName: e.payeeName || null,
          amount: Number(e.amount),
          chequeNo: e.chequeNo || null,
          chequeDate: e.chequeDate ? new Date(e.chequeDate) : null,
          chequeType: e.chequeType || null,
          particulars: e.particulars || null,
          admissionNo: e.admissionNo || null,
        })),
      },
    },
    include: { entries: true },
  });

  const visitIds = entries.flatMap((e) => Array.isArray(e.visitIds) ? e.visitIds.map(Number) : []).filter(Boolean);
  if (visitIds.length > 0) {
    await prisma.patientVisit.updateMany({ where: { id: { in: visitIds } }, data: { isPaid: true } });
  }

  const grnIds = entries.flatMap((e) => Array.isArray(e.grnIds) ? e.grnIds.map(Number) : []).filter(Boolean);
  if (grnIds.length > 0) {
    await prisma.inventoryGRN.updateMany({ where: { id: { in: grnIds } }, data: { isPaid: true } });
  }

  for (const e of entries) {
    if (e.salaryEmpCode && e.salaryMonth && e.salaryYear) {
      await prisma.employeeSalaryPayment.upsert({
        where: { empCode_salaryMonth_salaryYear: { empCode: e.salaryEmpCode, salaryMonth: e.salaryMonth, salaryYear: e.salaryYear } },
        update: {},
        create: { empCode: e.salaryEmpCode, salaryMonth: e.salaryMonth, salaryYear: e.salaryYear, voucherNo: voucher.voucherNo },
      });
    }
  }

  await linkConsultantFeeItems(entries, voucher.entries);

  return voucher;
}

// IPD Consultant Fee payee type — an entry can carry which Final Bill Const
// Fee rows (ClinicDischargeBillItem) its Amount was summed from (multiple
// admissions picked into one payment); record that link and flip each one
// isPaid so it stops showing as still-owed. `createdEntries` must be in the
// same order as `entries` — true for a fresh nested `create`, which always
// preserves input order.
async function linkConsultantFeeItems(entries, createdEntries) {
  for (let i = 0; i < entries.length; i++) {
    const itemIds = Array.isArray(entries[i].consultantFeeItemIds)
      ? entries[i].consultantFeeItemIds.map(Number).filter(Boolean)
      : [];
    if (!itemIds.length) continue;
    const items = await prisma.clinicDischargeBillItem.findMany({ where: { id: { in: itemIds } } });
    await prisma.accVoucherExpenseEntryConsultantFee.createMany({
      data: items.map((it) => ({
        voucherExpenseEntryId: createdEntries[i].id,
        dischargeBillItemId: it.id,
        amount: Number(it.doctorFee) || 0,
      })),
    });
    await prisma.clinicDischargeBillItem.updateMany({ where: { id: { in: itemIds } }, data: { isPaid: true } });
  }
}

async function getVoucherExpenses(entityType) {
  return prisma.accVoucherExpense.findMany({
    where: { entityType },
    include: { entries: true },
    orderBy: { createdAt: 'desc' },
  });
}

// Voucher # is never reassigned on edit — only the date/mode/bank/entries can
// change. Entries are replaced wholesale (delete + recreate) since there's no
// stable per-entry id coming back from the form.
async function updateVoucherExpense(id, { mode, bankId, voucherDate, entries }) {
  const existing = await prisma.accVoucherExpense.findUnique({ where: { id: Number(id) } });
  if (!existing) throw Object.assign(new Error('Voucher not found'), { status: 404 });
  if (!Array.isArray(entries) || entries.length === 0) {
    throw Object.assign(new Error('At least one entry is required'), { status: 400 });
  }

  const voucherType = mode === 'cash' ? 'CASH' : 'BANK';
  const totalAmount = entries.reduce((s, e) => s + Number(e.amount), 0);

  // Entries get wholesale deleted/recreated below — any Const Fee rows this
  // voucher had previously marked isPaid must go back to unpaid first, or
  // they'd be stuck "paid" forever even if this edit drops them from the form.
  const oldLinks = await prisma.accVoucherExpenseEntryConsultantFee.findMany({
    where: { voucherExpenseEntry: { voucherId: Number(id) } },
    select: { dischargeBillItemId: true },
  });
  if (oldLinks.length) {
    await prisma.clinicDischargeBillItem.updateMany({
      where: { id: { in: oldLinks.map((l) => l.dischargeBillItemId) } },
      data: { isPaid: false },
    });
  }

  await prisma.accVoucherExpenseEntry.deleteMany({ where: { voucherId: Number(id) } });

  const voucher = await prisma.accVoucherExpense.update({
    where: { id: Number(id) },
    data: {
      voucherType,
      voucherDate: new Date(voucherDate),
      mode,
      bankId: bankId ? Number(bankId) : null,
      totalAmount,
      entries: {
        create: entries.map((e) => ({
          mainGlId: Number(e.mainGlId),
          subGlId: Number(e.subGlId),
          mainAccountId: Number(e.mainAccountId),
          subAccountId: e.subAccountId ? Number(e.subAccountId) : null,
          accountCode: e.accountCode,
          accountName: e.accountName,
          payeeName: e.payeeName || null,
          amount: Number(e.amount),
          chequeNo: e.chequeNo || null,
          chequeDate: e.chequeDate ? new Date(e.chequeDate) : null,
          chequeType: e.chequeType || null,
          particulars: e.particulars || null,
          admissionNo: e.admissionNo || null,
        })),
      },
    },
    include: { entries: true },
  });

  await linkConsultantFeeItems(entries, voucher.entries);

  return voucher;
}

async function getIncomeCategories(entityType) {
  return prisma.accIncomeCategory.findMany({ where: { entityType }, orderBy: { id: 'asc' } });
}

async function createIncomeCategory({ name, entityType }) {
  return prisma.accIncomeCategory.create({ data: { name: name.trim(), entityType } });
}

async function updateIncomeCategory(id, { name }) {
  return prisma.accIncomeCategory.update({ where: { id: Number(id) }, data: { name: name.trim() } });
}

async function deleteIncomeCategory(id) {
  return prisma.accIncomeCategory.delete({ where: { id: Number(id) } });
}

function normDoctorRateName(s) {
  return String(s || '').toLowerCase().replace(/[-._]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function getConsultantVisits(doctorName, dateFrom, dateTo) {
  // Panel patients are billed to the panel/company, not paid in cash by the
  // patient — the doctor/consultant is not paid out of these visits, so they
  // must never show up (or count toward the amount) in the voucher expense
  // payment list.
  const where = { doctor: doctorName, isPaid: false, paymentType: { not: 'Panel' } };
  if (dateFrom) where.visitDate = { ...(where.visitDate || {}), gte: new Date(dateFrom) };
  if (dateTo)   where.visitDate = { ...(where.visitDate || {}), lte: new Date(dateTo) };

  const [visits, rateRows] = await Promise.all([
    prisma.patientVisit.findMany({
      where,
      orderBy: [{ visitDate: 'asc' }, { visitTime: 'asc' }],
      select: { id: true, serialNo: true, visitDate: true, visitTime: true, patientName: true, subDepartment: true, paymentType: true, received: true },
    }),
    // Same doctor/sub-department fee-share table the Consultant Wise Report
    // uses (Clinic → Doctors → Sub-Department Rates) — reused here so the
    // voucher amount matches that report instead of paying out the full
    // patient-collected amount.
    clinicSvc.getDoctorSubDeptRates(),
  ]);

  const dk = normDoctorRateName(doctorName);
  const bySubDept = {};
  let firstRate = null;
  for (const r of rateRows) {
    if (normDoctorRateName(r.doctorName) !== dk) continue;
    const sk = normDoctorRateName(r.subDeptName);
    if (!bySubDept[sk]) bySubDept[sk] = r;
    if (!firstRate) firstRate = r;
  }

  return visits.map((v) => {
    const received = Number(v.received || 0);
    const rate = bySubDept[normDoctorRateName(v.subDepartment)] || firstRate;
    const hasRate = !!(rate && rate.normalFees);
    const payableAmount = hasRate
      ? (rate.paymentType === 'percent' ? received * rate.normalFees / 100 : rate.normalFees)
      : received;
    return { ...v, received, payableAmount, hasRate, ratePercent: hasRate && rate.paymentType === 'percent' ? rate.normalFees : null };
  });
}

async function getSupplierGRNs(supplierId) {
  return prisma.inventoryGRN.findMany({
    where: { supplierId: Number(supplierId), isPaid: false },
    include: { item: { select: { name: true } } },
    orderBy: { receivedDate: 'desc' },
  });
}

// ── Voucher Income ────────────────────────────────────────────────────────────

async function generateIncomeVoucherNo(entityType, voucherDate) {
  const d = new Date(voucherDate);
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = `VI-${dateStr}`;
  const count = await prisma.accVoucherIncome.count({ where: { voucherNo: { startsWith: prefix }, entityType } });
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}

async function createVoucherIncome({ entityType, mode, bankId, voucherDate, entries }) {
  const voucherType = mode === 'cash' ? 'CASH' : mode === 'card' ? 'CARD' : 'BANK';
  const voucherNo = await generateIncomeVoucherNo(entityType, voucherDate);
  const totalAmount = entries.reduce((s, e) => s + Number(e.amount), 0);
  return prisma.accVoucherIncome.create({
    data: {
      voucherNo, voucherType,
      voucherDate: new Date(voucherDate),
      mode,
      bankId: bankId ? Number(bankId) : null,
      entityType, totalAmount,
      entries: {
        create: entries.map((e) => ({
          incomeCategoryId:   e.incomeCategoryId ? Number(e.incomeCategoryId) : null,
          incomeCategoryName: e.incomeCategoryName || null,
          amount:             Number(e.amount),
          particulars:        e.particulars || null,
        })),
      },
    },
    include: { entries: true },
  });
}

async function getVoucherIncomes(entityType) {
  return prisma.accVoucherIncome.findMany({
    where: { entityType },
    include: { entries: true },
    orderBy: { createdAt: 'desc' },
  });
}

// Auto-generated (Day Close) vouchers are meant to stay frozen — reject the
// edit outright rather than silently letting one drift from what was booked.
async function updateVoucherIncome(id, { mode, bankId, voucherDate, entries }) {
  const existing = await prisma.accVoucherIncome.findUnique({ where: { id: Number(id) } });
  if (!existing) throw Object.assign(new Error('Voucher not found'), { status: 404 });
  if (existing.source === 'auto') {
    throw Object.assign(new Error('Auto-generated (Day Close) vouchers cannot be edited'), { status: 403 });
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    throw Object.assign(new Error('At least one entry is required'), { status: 400 });
  }

  const voucherType = mode === 'cash' ? 'CASH' : mode === 'card' ? 'CARD' : 'BANK';
  const totalAmount = entries.reduce((s, e) => s + Number(e.amount), 0);

  await prisma.accVoucherIncomeEntry.deleteMany({ where: { voucherId: Number(id) } });

  return prisma.accVoucherIncome.update({
    where: { id: Number(id) },
    data: {
      voucherType,
      voucherDate: new Date(voucherDate),
      mode,
      bankId: bankId ? Number(bankId) : null,
      totalAmount,
      entries: {
        create: entries.map((e) => ({
          incomeCategoryId:   e.incomeCategoryId ? Number(e.incomeCategoryId) : null,
          incomeCategoryName: e.incomeCategoryName || null,
          amount:             Number(e.amount),
          particulars:        e.particulars || null,
        })),
      },
    },
    include: { entries: true },
  });
}

async function getVouchersForReprint({ type, entityType, voucherFrom, voucherTo, dateFrom, dateTo }) {
  const where = { entityType };
  if (voucherFrom || voucherTo) {
    where.voucherNo = {};
    if (voucherFrom) where.voucherNo.gte = voucherFrom;
    if (voucherTo)   where.voucherNo.lte = voucherTo;
  }
  if (dateFrom || dateTo) {
    where.voucherDate = {};
    if (dateFrom) where.voucherDate.gte = new Date(dateFrom);
    if (dateTo)   where.voucherDate.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }

  if (type === 'expense') {
    const vouchers = await prisma.accVoucherExpense.findMany({
      where, include: { entries: true }, orderBy: { voucherNo: 'desc' },
    });

    const allEntries = vouchers.flatMap((v) => v.entries);
    const mainGlIds  = [...new Set(allEntries.map((e) => e.mainGlId).filter(Boolean))];
    const subGlIds   = [...new Set(allEntries.map((e) => e.subGlId).filter(Boolean))];
    const mainAccIds = [...new Set(allEntries.map((e) => e.mainAccountId).filter(Boolean))];
    const subAccIds  = [...new Set(allEntries.map((e) => e.subAccountId).filter(Boolean))];

    const [mainGLs, subGLs, mainAccs, subAccs] = await Promise.all([
      mainGlIds.length  ? prisma.accMainGL.findMany({ where: { id: { in: mainGlIds } } })        : [],
      subGlIds.length   ? prisma.accSubGL.findMany({ where: { id: { in: subGlIds } } })          : [],
      mainAccIds.length ? prisma.accMainAccount.findMany({ where: { id: { in: mainAccIds } } })  : [],
      subAccIds.length  ? prisma.accSubAccount.findMany({ where: { id: { in: subAccIds } } })    : [],
    ]);

    const mgMap = Object.fromEntries(mainGLs.map((x) => [x.id, x.name]));
    const sgMap = Object.fromEntries(subGLs.map((x) => [x.id, x.name]));
    const maMap = Object.fromEntries(mainAccs.map((x) => [x.id, x.name]));
    const saMap = Object.fromEntries(subAccs.map((x) => [x.id, x.name]));

    return vouchers.map((v) => ({
      ...v,
      entries: v.entries.map((e) => ({
        ...e,
        mainGlName:      mgMap[e.mainGlId]      || '',
        subGlName:       sgMap[e.subGlId]       || '',
        mainAccountName: maMap[e.mainAccountId] || '',
        subAccountName:  saMap[e.subAccountId]  || '',
      })),
    }));
  }

  return prisma.accVoucherIncome.findMany({ where, include: { entries: true }, orderBy: { voucherNo: 'desc' } });
}

async function getNextVoucherNo(type, entityType, voucherDate) {
  if (type === 'expense') return generateVoucherNo(entityType, voucherDate);
  if (type === 'income')  return generateIncomeVoucherNo(entityType, voucherDate);
  throw new Error('Invalid type');
}

async function createBankDeposit({ bankAccountId, depositOf, depositDate, depositSlipNo, depositedBy, amount, entityType }) {
  return prisma.accBankDeposit.create({
    data: {
      bankAccountId: Number(bankAccountId),
      depositOf:     new Date(depositOf),
      depositDate:   new Date(depositDate),
      depositSlipNo: depositSlipNo?.trim() || null,
      depositedBy:   depositedBy?.trim()   || null,
      amount:        Number(amount),
      entityType,
    },
    include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
  });
}

// Looks up the actual recorded Bank Deposit for a bank+date so the Deposit
// Adjustment form can auto-fill its "POSTED" column instead of having the
// user re-type numbers that already exist in the system.
async function getBankDepositForDate({ entityType, bankAccountId, depositOf }) {
  if (!bankAccountId || !depositOf) return null;
  return prisma.accBankDeposit.findFirst({
    where: { entityType, bankAccountId: Number(bankAccountId), depositOf: new Date(depositOf) },
    orderBy: { createdAt: 'desc' },
  });
}

async function createBankDepositAdj({ bankAccountId, postedDepositOf, postedDepositDate, postedDepositSlipNo, postedDepositedBy, postedAmount, adjDepositDate, adjDepositSlipNo, adjDepositedBy, adjAmount, adjustedBy, entityType }) {
  return prisma.accBankDepositAdj.create({
    data: {
      bankAccountId:      Number(bankAccountId),
      postedDepositOf:    new Date(postedDepositOf),
      postedDepositDate:  new Date(postedDepositDate),
      postedDepositSlipNo: postedDepositSlipNo?.trim() || null,
      postedDepositedBy:  postedDepositedBy?.trim()   || null,
      postedAmount:       Number(postedAmount),
      adjDepositDate:     new Date(adjDepositDate),
      adjDepositSlipNo:   adjDepositSlipNo?.trim()    || null,
      adjDepositedBy:     adjDepositedBy?.trim()      || null,
      adjAmount:          Number(adjAmount),
      adjustedBy:         adjustedBy?.trim()          || null,
      entityType,
    },
    include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
  });
}

async function getBankDepositAdjs(entityType) {
  return prisma.accBankDepositAdj.findMany({
    where: { entityType },
    orderBy: { createdAt: 'desc' },
    include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
  });
}

async function getVoucherSummaryMatrix({ entityType, dateFrom, dateTo }) {
  const where = { entityType };
  if (dateFrom) where.voucherDate = { ...(where.voucherDate || {}), gte: new Date(dateFrom) };
  if (dateTo)   where.voucherDate = { ...(where.voucherDate || {}), lte: new Date(dateTo + 'T23:59:59') };

  const vouchers = await prisma.accVoucherExpense.findMany({
    where,
    include: { entries: true },
    orderBy: { voucherDate: 'asc' },
  });

  const glMap = {};
  const glNames = {};
  for (const v of vouchers) {
    const day = v.voucherDate.toISOString().slice(0, 10);
    if (!glMap[day]) glMap[day] = {};
    for (const e of v.entries) {
      const glId = e.mainGlId;
      if (!glId) continue;
      if (!glMap[day][glId]) glMap[day][glId] = 0;
      glMap[day][glId] += Number(e.amount);
      if (!glNames[glId]) {
        const gl = await prisma.accMainGL.findUnique({ where: { id: glId }, select: { name: true, code: true } });
        glNames[glId] = gl ? `${gl.code} — ${gl.name}` : String(glId);
      }
    }
  }

  const rows = Object.entries(glMap).map(([date, heads]) => ({
    date,
    heads: Object.entries(heads).map(([glId, amount]) => ({ glId: Number(glId), glName: glNames[glId], amount })),
    total: Object.values(heads).reduce((s, a) => s + a, 0),
  }));

  return { rows, glNames };
}

async function getBankDeposits(entityType) {
  return prisma.accBankDeposit.findMany({
    where: { entityType },
    orderBy: { createdAt: 'desc' },
    include: { bankAccount: { select: { bankName: true, accountNumber: true } } },
  });
}

// ─── Inquiry Dashboard (Expense + Income vouchers, calendar-style) ────────────
// Same shape as the Clinic Revenue Dashboard's response (date/totalPatients/
// totalAmount/cashPatients.../panelPatients...) so the frontend calendar
// component ports over almost unchanged — "cash" slot carries Expense,
// "panel" slot carries Income here.
async function getAccountsInquiryDashboard({ entityType, period, year, month }) {
  entityType = entityType || 'non-corporate';
  year   = parseInt(year)  || new Date().getFullYear();
  month  = parseInt(month) || (new Date().getMonth() + 1);
  period = period || 'monthly_daily';

  let dateFrom = null, dateTo = null;
  if (period === 'monthly_daily') {
    const daysInMonth = new Date(year, month, 0).getDate();
    dateFrom = new Date(year, month - 1, 1);
    dateTo   = new Date(year, month - 1, daysInMonth, 23, 59, 59, 999);
  } else if (period === 'yearly_monthly' || period === 'yearly_daily') {
    dateFrom = new Date(year, 0, 1);
    dateTo   = new Date(year, 11, 31, 23, 59, 59, 999);
  }

  const where = { entityType };
  if (dateFrom && dateTo) where.voucherDate = { gte: dateFrom, lte: dateTo };

  const [expenses, incomes] = await Promise.all([
    prisma.accVoucherExpense.findMany({ where, select: { voucherDate: true, totalAmount: true } }),
    prisma.accVoucherIncome.findMany({ where, select: { voucherDate: true, totalAmount: true, source: true } }),
  ]);

  // Dates that already have an auto day-close voucher — the real voucher above
  // (via the `incomes` loop) already carries that day's Clinic revenue, so the
  // live Clinic merge below must skip these dates to avoid double-counting.
  const closedDates = new Set(
    incomes.filter((v) => v.source === 'auto').map((v) => v.voucherDate.toISOString().slice(0, 10))
  );

  const bucketKey = (d) => {
    const dt = new Date(d);
    if (period === 'monthly_daily') return dt.toISOString().slice(0, 10);
    if (period === 'yearly_monthly' || period === 'yearly_daily') return dt.getMonth() + 1;
    return dt.getFullYear();
  };

  const map = new Map();
  // clinicPatients is tracked separately from incomeCount (which mixes voucher
  // counts with patient counts for the calendar's "In" badge) — it exists purely
  // so the summary bar can show a real patient headcount alongside the amounts.
  function bumpKey(key, count, amount, isExpense, clinicPatientCount = 0) {
    if (!map.has(key)) map.set(key, { key, totalCount: 0, totalAmount: 0, expenseCount: 0, expenseAmount: 0, incomeCount: 0, incomeAmount: 0, clinicPatients: 0 });
    const e = map.get(key);
    e.totalCount += count;
    e.totalAmount += amount;
    if (isExpense) { e.expenseCount += count; e.expenseAmount += amount; }
    else { e.incomeCount += count; e.incomeAmount += amount; }
    e.clinicPatients += clinicPatientCount;
  }
  function bump(dateVal, amount, isExpense) {
    bumpKey(bucketKey(dateVal), 1, amount, isExpense);
  }
  for (const v of expenses) bump(v.voucherDate, Number(v.totalAmount) || 0, true);
  for (const v of incomes)  bump(v.voucherDate, Number(v.totalAmount) || 0, false);

  // "Income" for the Non-Corporate entity also includes Clinic patient revenue
  // (OPD + Admission), on top of manually-entered Voucher Income — pulled
  // straight from the Clinic Revenue Dashboard's own aggregation so the two
  // always agree.
  if (entityType === 'non-corporate') {
    const clinicRes = await clinicSvc.getRevenueDashboard({
      period, year, month,
      department: 'ALL', subDept: 'ALL', consultant: 'ALL', paymentType: 'ALL',
    });
    const keyField = period === 'monthly_daily' ? 'date' : period === 'multi_year' ? 'year' : 'month';
    for (const row of clinicRes.data) {
      const patients = Number(row.totalPatients) || 0;
      if (period === 'monthly_daily' && closedDates.has(row.date)) {
        // Amount is already booked via the real auto voucher (summed above) —
        // only add the live patient headcount so "Total Patients" stays accurate.
        bumpKey(row[keyField], 0, 0, false, patients);
        continue;
      }
      bumpKey(row[keyField], patients, Number(row.totalAmount) || 0, false, patients);
    }
  }

  // "Income" for the Corporate entity also includes Panel Cheque receipts
  // (see receivePanelCheque) — the actual received amount posted against a
  // panel/insurance company's cheque, keyed by that cheque's own Cheque Date
  // (same convention as Voucher's own voucherDate driving the calendar, not
  // when it was entered into the system).
  if (entityType === 'corporate') {
    const chequeWhere = {};
    if (dateFrom && dateTo) chequeWhere.chequeDate = { gte: dateFrom, lte: dateTo };
    const cheques = await prisma.clinicPanelChequeReceipt.findMany({
      where: chequeWhere,
      select: { chequeDate: true, receivedAmount: true },
    });
    for (const c of cheques) {
      bump(c.chequeDate, Number(c.receivedAmount) || 0, false);
    }
  }

  const toRow = (e, keyField) => ({
    [keyField]: e.key,
    totalPatients: e.totalCount, totalAmount: e.totalAmount,
    cashPatients: e.expenseCount, cashAmount: e.expenseAmount,
    panelPatients: e.incomeCount, panelAmount: e.incomeAmount,
    clinicPatients: e.clinicPatients,
    ccPatients: 0, ccAmount: 0,
  });

  let data = [];
  if (period === 'monthly_daily') {
    data = [...map.values()].map(e => toRow(e, 'date')).sort((a, b) => a.date.localeCompare(b.date));
  } else if (period === 'yearly_monthly' || period === 'yearly_daily') {
    for (let m = 1; m <= 12; m++) {
      const e = map.get(m) || { key: m, totalCount: 0, totalAmount: 0, expenseCount: 0, expenseAmount: 0, incomeCount: 0, incomeAmount: 0 };
      data.push(toRow(e, 'month'));
    }
  } else {
    data = [...map.values()].map(e => toRow(e, 'year')).sort((a, b) => a.year - b.year);
  }

  const totalAmount = data.reduce((s, d) => s + d.totalAmount, 0);
  const totalPatients  = data.reduce((s, d) => s + (d.clinicPatients || 0), 0);
  const incomeAmount   = data.reduce((s, d) => s + d.panelAmount, 0);
  const expenseAmount  = data.reduce((s, d) => s + d.cashAmount, 0);
  const netAmount       = incomeAmount - expenseAmount;
  const daysWithData = data.filter(d => d.totalAmount > 0).length;
  const dailyAvg = daysWithData > 0 ? totalAmount / daysWithData : 0;

  // Prognosis (monthly_daily only): today's run-rate projected across the month.
  let prognosis = 0;
  if (period === 'monthly_daily') {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
    const dayOfMonth = isCurrentMonth ? today.getDate() : new Date(year, month, 0).getDate();
    const soFar = data.filter(d => Number(d.date.slice(-2)) <= dayOfMonth).reduce((s, d) => s + d.totalAmount, 0);
    const daysInMonth = new Date(year, month, 0).getDate();
    prognosis = dayOfMonth > 0 ? (soFar / dayOfMonth) * daysInMonth : 0;
  }

  // Same month, previous year — for the sidebar comparison box.
  const lastYearWhere = { entityType };
  let lastYearAmount = 0;
  if (period === 'monthly_daily') {
    const lyFrom = new Date(year - 1, month - 1, 1);
    const lyTo   = new Date(year - 1, month - 1, new Date(year - 1, month, 0).getDate(), 23, 59, 59, 999);
    lastYearWhere.voucherDate = { gte: lyFrom, lte: lyTo };
    const [lyExp, lyInc] = await Promise.all([
      prisma.accVoucherExpense.findMany({ where: lastYearWhere, select: { totalAmount: true } }),
      prisma.accVoucherIncome.findMany({ where: lastYearWhere, select: { totalAmount: true } }),
    ]);
    lastYearAmount = [...lyExp, ...lyInc].reduce((s, v) => s + (Number(v.totalAmount) || 0), 0);

    if (entityType === 'non-corporate') {
      const lyClinic = await clinicSvc.getRevenueDashboard({
        period: 'monthly_daily', year: year - 1, month,
        department: 'ALL', subDept: 'ALL', consultant: 'ALL', paymentType: 'ALL',
      });
      lastYearAmount += lyClinic.data.reduce((s, d) => s + (Number(d.totalAmount) || 0), 0);
    }

    if (entityType === 'corporate') {
      const lyCheques = await prisma.clinicPanelChequeReceipt.findMany({
        where: { chequeDate: { gte: lyFrom, lte: lyTo } },
        select: { receivedAmount: true },
      });
      lastYearAmount += lyCheques.reduce((s, c) => s + (Number(c.receivedAmount) || 0), 0);
    }
  }

  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const trendData = period === 'monthly_daily'
    ? data.map(d => ({ label: d.date.slice(-2), totalPatients: d.totalPatients, totalAmount: d.totalAmount }))
    : period === 'multi_year'
    ? data.map(d => ({ label: String(d.year), totalPatients: d.totalPatients, totalAmount: d.totalAmount }))
    : data.map(d => ({ label: MN[d.month - 1], totalPatients: d.totalPatients, totalAmount: d.totalAmount }));

  return {
    period, year, month, data,
    summary: { totalPatients, totalAmount, incomeAmount, expenseAmount, netAmount, dailyAvg, prognosis, lastYearAmount, daysWithData },
    trendData,
  };
}

// Thin passthrough to Clinic's own per-department daily statement — used by
// the Inquiry calendar's double-click modal to show WHERE the Clinic-side
// "Income" for that day actually came from. Once a day is auto-closed, that
// revenue is already booked as a real Voucher Income (shown as its own card
// in the modal) — return null so it isn't shown/counted twice.
async function getClinicRevenueForDate(date) {
  const autoVoucher = await prisma.accVoucherIncome.findFirst({
    where: { entityType: 'non-corporate', source: 'auto', voucherDate: new Date(date) },
    select: { id: true },
  });
  if (autoVoucher) return null;
  return clinicSvc.getDailyDepartmentStatement(date);
}

// Corporate's equivalent of getClinicRevenueForDate above — used by the
// Inquiry calendar's double-click modal to show WHICH Panel Cheques made up
// that day's Income (see getAccountsInquiryDashboard's Corporate merge).
// Each cheque can cover several admissions' Panel Billing at once — that
// count, plus the cheque's own totalAmount/deduction, is included so the
// modal shows exactly what was posted, not just a bare total.
async function getPanelChequeRevenueForDate(date) {
  const receipts = await prisma.clinicPanelChequeReceipt.findMany({
    where: { chequeDate: new Date(date) },
    include: { items: { select: { id: true } } },
    orderBy: { id: 'asc' },
  });
  if (!receipts.length) return { rows: [], total: { amount: 0, count: 0 } };

  // ClinicPanelChequeReceipt.panelCompanyId has no declared Prisma relation
  // (raw FK only) — same manual join clinic.service.js's own
  // getPanelChequeSummary already uses for this exact table.
  const companyIds = [...new Set(receipts.map((r) => r.panelCompanyId).filter(Boolean))];
  const companies = companyIds.length
    ? await prisma.clinicPanelCompany.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } })
    : [];
  const companyById = new Map(companies.map((c) => [c.id, c.name]));

  const rows = receipts.map((r) => ({
    id: r.id,
    companyName: companyById.get(r.panelCompanyId) || '—',
    chequeNo: r.chequeNo,
    billingMonth: r.billingMonth,
    billingYear: r.billingYear,
    admissionsCount: r.items.length,
    totalAmount: Number(r.totalAmount) || 0,
    receivedAmount: Number(r.receivedAmount) || 0,
    deduction: Number(r.deduction) || 0,
  }));

  const total = { amount: rows.reduce((s, r) => s + r.receivedAmount, 0), count: rows.length };
  return { rows, total };
}

// Single-day Income/Expense/Diff — same numbers the Inquiry calendar's day
// cell shows for that date, used to pre-fill the read-only diff hint on the
// Bank Deposit form when a "Deposit Of" date is picked.
async function getDailyIncomeExpenseDiff(date, entityType) {
  if (!date) throw Object.assign(new Error('Date is required'), { status: 400 });
  entityType = entityType || 'non-corporate';

  const where = { entityType, voucherDate: new Date(date) };
  const [expenses, incomes] = await Promise.all([
    prisma.accVoucherExpense.findMany({ where, select: { totalAmount: true } }),
    prisma.accVoucherIncome.findMany({ where, select: { totalAmount: true, source: true } }),
  ]);
  const expenseAmount = expenses.reduce((s, v) => s + (Number(v.totalAmount) || 0), 0);
  let incomeAmount = incomes.reduce((s, v) => s + (Number(v.totalAmount) || 0), 0);

  // Once the day is auto-closed, its Clinic revenue is already inside `incomes`
  // above (the frozen auto voucher) — only live-merge for still-open days.
  const alreadyClosed = incomes.some((v) => v.source === 'auto');
  if (entityType === 'non-corporate' && !alreadyClosed) {
    const clinic = await clinicSvc.getDailyDepartmentStatement(date);
    incomeAmount += Number(clinic.total.amount) || 0;
  }

  return { date, entityType, incomeAmount, expenseAmount, diff: incomeAmount - expenseAmount };
}

// ─── Day Close — auto Income Voucher generation ───────────────────────────────
// Every night at 8:00 AM (the hospital's business-day boundary) the previous
// business day is "closed": its Clinic patient revenue is booked as a real,
// frozen Voucher Income (one line per department) instead of being merged
// live into the dashboard on every request. See dayClose.job.js for the
// scheduler that calls this once a day.

async function ensureClinicIncomeCategories(entityType, departmentNames) {
  const names = [...new Set(departmentNames)];
  if (!names.length) return new Map();
  const existing = await prisma.accIncomeCategory.findMany({ where: { entityType, name: { in: names } } });
  const byName = new Map(existing.map((c) => [c.name, c]));
  for (const name of names) {
    if (byName.has(name)) continue;
    const created = await prisma.accIncomeCategory.create({ data: { name, entityType } });
    byName.set(name, created);
  }
  return byName;
}

async function generateAutoIncomeVoucherForDate(date, entityType = 'non-corporate') {
  const existing = await prisma.accVoucherIncome.findFirst({
    where: { entityType, source: 'auto', voucherDate: new Date(date) },
    include: { entries: true },
  });
  if (existing) return existing;

  const stmt = await clinicSvc.getDailyDepartmentStatement(date);
  const amount = Number(stmt.total.amount) || 0;
  if (amount <= 0) return null;

  const rows = stmt.rows.filter((r) => Number(r.amount) > 0);
  const categories = await ensureClinicIncomeCategories(entityType, rows.map((r) => r.department));
  const voucherNo = await generateIncomeVoucherNo(entityType, date);

  return prisma.accVoucherIncome.create({
    data: {
      voucherNo,
      voucherType: 'AUTO',
      voucherDate: new Date(date),
      mode: 'system',
      entityType,
      totalAmount: amount,
      source: 'auto',
      entries: {
        create: rows.map((r) => ({
          incomeCategoryId:   categories.get(r.department)?.id || null,
          incomeCategoryName: r.department,
          amount:             r.amount,
          particulars:        `Auto day-close — ${r.count} patient(s)`,
        })),
      },
    },
    include: { entries: true },
  });
}

module.exports = {
  getMainGLs, createMainGL, updateMainGL, deleteMainGL,
  getSubGLs, createSubGL, updateSubGL, deleteSubGL,
  getMainAccounts, createMainAccount, updateMainAccount, deleteMainAccount,
  getSubAccounts, createSubAccount, updateSubAccount, deleteSubAccount,
  getPayeeHeads, createPayeeHead, updatePayeeHead, deletePayeeHead, addHeadAccount, removeHeadAccount, addInventoryHeadMainAccount, removeInventoryHeadMainAccount,
  getSurgeryHeadForMainAccount, addPayeeHeadStaffCategory, removePayeeHeadStaffCategory, getSurgeryPayeesForHead,
  getIpdConsultantHeadForMainAccount, getPendingConsultantFees,
  getPayeeEntries, createPayeeEntry, deletePayeeEntry, bulkSavePayeeEntries, getEmployeeList, getSupplierList, getDoctorList, getInventorySubcategories, getInventoryItemsBySubcategory, getInventoryItemsForHead, linkCustomHeadToInventoryHead, unlinkCustomHeadFromInventoryHead, getInventoryHeadForMainAccount,
  getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
  getChequeSerials, createChequeSerial, deleteChequeSerial, getNextChequeSerial, getNextCashSerial,
  getIncomeCategories, createIncomeCategory, updateIncomeCategory, deleteIncomeCategory,
  getAllPayeeEntries, createVoucherExpense, getVoucherExpenses, updateVoucherExpense,
  saveDraftExpenseEntry, getDraftExpenses, deleteDraftExpense, flashDraftsToVouchers,
  getPayeeEntriesBySubAccount, getSupplierGRNs, getConsultantVisits,
  createVoucherIncome, getVoucherIncomes, updateVoucherIncome,
  getNextVoucherNo,
  getVouchersForReprint, getVoucherSummaryMatrix,
  createBankDeposit, getBankDeposits, getBankDepositForDate,
  createBankDepositAdj, getBankDepositAdjs,
  getVoucherSummary,
  getAccountsInquiryDashboard,
  getClinicRevenueForDate,
  getPanelChequeRevenueForDate,
  getDailyIncomeExpenseDiff,
  generateAutoIncomeVoucherForDate,
};

async function getVoucherSummary({ entityType, voucherFrom, voucherTo, supplierId, mainAccountId, dateFrom, dateTo }) {
  const where = { entityType };
  if (voucherFrom || voucherTo) {
    where.voucherNo = {};
    if (voucherFrom) where.voucherNo.gte = voucherFrom;
    if (voucherTo)   where.voucherNo.lte = voucherTo;
  }
  if (dateFrom || dateTo) {
    where.voucherDate = {};
    if (dateFrom) where.voucherDate.gte = new Date(dateFrom);
    if (dateTo)   where.voucherDate.lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
  }

  let vouchers = await prisma.accVoucherExpense.findMany({
    where,
    include: { entries: true },
    orderBy: [{ voucherDate: 'asc' }, { voucherNo: 'asc' }],
  });

  if (supplierId) {
    const supplier = await prisma.inventorySupplier.findUnique({ where: { id: Number(supplierId) }, select: { name: true } });
    if (supplier) {
      vouchers = vouchers.filter((v) => v.entries.some((e) => e.payeeName === supplier.name));
    }
  }

  if (mainAccountId) {
    vouchers = vouchers.filter((v) => v.entries.some((e) => e.mainAccountId === Number(mainAccountId)));
  }

  if (!vouchers.length) return [];

  const allEntries = vouchers.flatMap((v) => v.entries);
  const mainGlIds  = [...new Set(allEntries.map((e) => e.mainGlId).filter(Boolean))];
  const subGlIds   = [...new Set(allEntries.map((e) => e.subGlId).filter(Boolean))];
  const mainAccIds = [...new Set(allEntries.map((e) => e.mainAccountId).filter(Boolean))];
  const subAccIds  = [...new Set(allEntries.map((e) => e.subAccountId).filter(Boolean))];

  const [mainGLs, subGLs, mainAccs, subAccs] = await Promise.all([
    mainGlIds.length  ? prisma.accMainGL.findMany({ where: { id: { in: mainGlIds } } })       : [],
    subGlIds.length   ? prisma.accSubGL.findMany({ where: { id: { in: subGlIds } } })         : [],
    mainAccIds.length ? prisma.accMainAccount.findMany({ where: { id: { in: mainAccIds } } }) : [],
    subAccIds.length  ? prisma.accSubAccount.findMany({ where: { id: { in: subAccIds } } })   : [],
  ]);

  const mgMap = Object.fromEntries(mainGLs.map((x) => [x.id, x.name]));
  const sgMap = Object.fromEntries(subGLs.map((x) => [x.id, x.name]));
  const maMap = Object.fromEntries(mainAccs.map((x) => [x.id, x.name]));
  const saMap = Object.fromEntries(subAccs.map((x) => [x.id, x.name]));

  return vouchers.map((v) => ({
    ...v,
    entries: v.entries.map((e) => ({
      ...e,
      mainGlName:      mgMap[e.mainGlId]      || '',
      subGlName:       sgMap[e.subGlId]       || '',
      mainAccountName: maMap[e.mainAccountId] || '',
      subAccountName:  saMap[e.subAccountId]  || '',
    })),
  }));
}
