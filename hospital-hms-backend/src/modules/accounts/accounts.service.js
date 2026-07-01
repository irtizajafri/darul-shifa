const prisma = require('../../config/db');

// ── Main GL ───────────────────────────────────────────────────────────────────

async function getMainGLs(entityType) {
  return prisma.accMainGL.findMany({
    where: { entityType },
    orderBy: { id: 'asc' },
  });
}

async function createMainGL({ name, entityType }) {
  const count = await prisma.accMainGL.count({ where: { entityType } });
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

const SUB_ACCOUNT_INCLUDE = {
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
};

async function getPayeeHeads(entityType) {
  await ensureSystemHeads(entityType);
  return prisma.accPayeeHead.findMany({
    where: { entityType },
    orderBy: { id: 'asc' },
    include: SUB_ACCOUNT_INCLUDE,
  });
}

async function createPayeeHead({ name, sourceType = 'manual', entityType }) {
  return prisma.accPayeeHead.create({
    data: { name: name.trim(), sourceType, entityType },
    include: SUB_ACCOUNT_INCLUDE,
  });
}

async function updatePayeeHead(id, body) {
  const data = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.subAccountId !== undefined) data.subAccountId = body.subAccountId ? Number(body.subAccountId) : null;
  return prisma.accPayeeHead.update({
    where: { id: Number(id) },
    data,
    include: SUB_ACCOUNT_INCLUDE,
  });
}

async function deletePayeeHead(id) {
  return prisma.accPayeeHead.delete({ where: { id: Number(id) } });
}

async function getPayeeEntriesBySubAccount(subAccountId, entityType) {
  const head = await prisma.accPayeeHead.findFirst({ where: { subAccountId: Number(subAccountId), entityType } });
  if (!head) return { type: null, headName: null, entries: [] };

  if (head.sourceType === 'employee') {
    const rows = await prisma.employee.findMany({
      select: { id: true, firstName: true, lastName: true, empCode: true },
      orderBy: { firstName: 'asc' },
    });
    return { type: 'employee', headName: head.name, entries: rows.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, code: e.empCode })) };
  }

  if (head.sourceType === 'vendor') {
    const rows = await prisma.inventorySupplier.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    return { type: 'vendor', headName: head.name, entries: rows };
  }

  if (head.sourceType === 'doctor') {
    const rows = await prisma.clinicDoctor.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    return { type: 'doctor', headName: head.name, entries: rows };
  }

  const rows = await prisma.accPayeeEntry.findMany({ where: { payeeHeadId: head.id }, orderBy: { name: 'asc' } });
  return { type: 'manual', headName: head.name, entries: rows.map((e) => ({ id: e.id, name: e.name, code: null })) };
}

// ── Payee Entries ─────────────────────────────────────────────────────────────

async function getPayeeEntries(headId) {
  return prisma.accPayeeEntry.findMany({ where: { payeeHeadId: Number(headId) }, orderBy: { id: 'asc' } });
}

async function createPayeeEntry({ payeeHeadId, name }) {
  return prisma.accPayeeEntry.create({ data: { payeeHeadId: Number(payeeHeadId), name: name.trim() } });
}

async function deletePayeeEntry(id) {
  return prisma.accPayeeEntry.delete({ where: { id: Number(id) } });
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

async function getAllPayeeEntries(entityType) {
  return prisma.accPayeeEntry.findMany({
    where: { payeeHead: { entityType } },
    include: { payeeHead: { select: { name: true } } },
    orderBy: [{ payeeHead: { name: 'asc' } }, { name: 'asc' }],
  });
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
  return prisma.accVoucherExpense.create({
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
        })),
      },
    },
    include: { entries: true },
  });
}

async function getVoucherExpenses(entityType) {
  return prisma.accVoucherExpense.findMany({
    where: { entityType },
    include: { entries: true },
    orderBy: { createdAt: 'desc' },
  });
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

async function getSupplierGRNs(supplierId) {
  return prisma.inventoryGRN.findMany({
    where: { supplierId: Number(supplierId) },
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
      where, include: { entries: true }, orderBy: { voucherNo: 'asc' },
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

  return prisma.accVoucherIncome.findMany({ where, include: { entries: true }, orderBy: { voucherNo: 'asc' } });
}

async function getNextVoucherNo(type, entityType, voucherDate) {
  if (type === 'expense') return generateVoucherNo(entityType, voucherDate);
  if (type === 'income')  return generateIncomeVoucherNo(entityType, voucherDate);
  throw new Error('Invalid type');
}

module.exports = {
  getMainGLs, createMainGL, updateMainGL, deleteMainGL,
  getSubGLs, createSubGL, updateSubGL, deleteSubGL,
  getMainAccounts, createMainAccount, updateMainAccount, deleteMainAccount,
  getSubAccounts, createSubAccount, updateSubAccount, deleteSubAccount,
  getPayeeHeads, createPayeeHead, updatePayeeHead, deletePayeeHead,
  getPayeeEntries, createPayeeEntry, deletePayeeEntry, getEmployeeList, getSupplierList,
  getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
  getChequeSerials, createChequeSerial, deleteChequeSerial, getNextChequeSerial,
  getIncomeCategories, createIncomeCategory, updateIncomeCategory, deleteIncomeCategory,
  getAllPayeeEntries, createVoucherExpense, getVoucherExpenses,
  getPayeeEntriesBySubAccount, getSupplierGRNs,
  createVoucherIncome, getVoucherIncomes,
  getNextVoucherNo,
  getVouchersForReprint,
};
