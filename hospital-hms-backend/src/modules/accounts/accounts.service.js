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

async function getPayeeHeads(entityType) {
  return prisma.accPayeeHead.findMany({ where: { entityType }, orderBy: { id: 'asc' } });
}

async function createPayeeHead({ name, sourceType = 'manual', entityType }) {
  return prisma.accPayeeHead.create({ data: { name: name.trim(), sourceType, entityType } });
}

async function updatePayeeHead(id, { name }) {
  return prisma.accPayeeHead.update({ where: { id: Number(id) }, data: { name: name.trim() } });
}

async function deletePayeeHead(id) {
  return prisma.accPayeeHead.delete({ where: { id: Number(id) } });
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

// ── Income Categories ─────────────────────────────────────────────────────────

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

module.exports = {
  getMainGLs, createMainGL, updateMainGL, deleteMainGL,
  getSubGLs, createSubGL, updateSubGL, deleteSubGL,
  getMainAccounts, createMainAccount, updateMainAccount, deleteMainAccount,
  getSubAccounts, createSubAccount, updateSubAccount, deleteSubAccount,
  getPayeeHeads, createPayeeHead, updatePayeeHead, deletePayeeHead,
  getPayeeEntries, createPayeeEntry, deletePayeeEntry, getEmployeeList, getSupplierList,
  getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
  getChequeSerials, createChequeSerial, deleteChequeSerial,
  getIncomeCategories, createIncomeCategory, updateIncomeCategory, deleteIncomeCategory,
};
