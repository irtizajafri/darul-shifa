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
};

async function getPayeeHeads(entityType) {
  await ensureSystemHeads(entityType);
  return prisma.accPayeeHead.findMany({
    where: { entityType },
    orderBy: { id: 'asc' },
    include: LINKED_ACCOUNTS_INCLUDE,
  });
}

async function createPayeeHead({ name, sourceType = 'manual', entityType }) {
  return prisma.accPayeeHead.create({
    data: { name: name.trim(), sourceType, entityType },
    include: LINKED_ACCOUNTS_INCLUDE,
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

async function getPayeeEntriesBySubAccount(subAccountId, entityType) {
  const link = await prisma.accPayeeHeadAccount.findFirst({
    where: { subAccountId: Number(subAccountId), payeeHead: { entityType } },
    include: { payeeHead: true },
  });
  const head = link?.payeeHead;
  if (!head) return { type: null, headName: null, headId: null, entries: [], checkedNames: [] };

  if (head.sourceType === 'employee') {
    const rows = await prisma.employee.findMany({
      select: { id: true, firstName: true, lastName: true, empCode: true },
      orderBy: { firstName: 'asc' },
    });
    return { type: 'employee', headName: head.name, headId: head.id, entries: rows.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, code: e.empCode })), checkedNames: [] };
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
    const filteredEntries = checkedNames.length > 0
      ? allSuppliers.filter((s) => checkedNames.includes(s.name))
      : allSuppliers;
    return { type: 'vendor', headName: head.name, headId: head.id, entries: filteredEntries, allSuppliers, checkedNames };
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

module.exports = {
  getMainGLs, createMainGL, updateMainGL, deleteMainGL,
  getSubGLs, createSubGL, updateSubGL, deleteSubGL,
  getMainAccounts, createMainAccount, updateMainAccount, deleteMainAccount,
  getSubAccounts, createSubAccount, updateSubAccount, deleteSubAccount,
  getPayeeHeads, createPayeeHead, updatePayeeHead, deletePayeeHead, addHeadAccount, removeHeadAccount,
  getPayeeEntries, createPayeeEntry, deletePayeeEntry, bulkSavePayeeEntries, getEmployeeList, getSupplierList,
  getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
  getChequeSerials, createChequeSerial, deleteChequeSerial, getNextChequeSerial,
  getIncomeCategories, createIncomeCategory, updateIncomeCategory, deleteIncomeCategory,
  getAllPayeeEntries, createVoucherExpense, getVoucherExpenses,
  getPayeeEntriesBySubAccount, getSupplierGRNs,
  createVoucherIncome, getVoucherIncomes,
  getNextVoucherNo,
  getVouchersForReprint, getVoucherSummaryMatrix,
  createBankDeposit, getBankDeposits,
  createBankDepositAdj, getBankDepositAdjs,
  getVoucherSummary,
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
