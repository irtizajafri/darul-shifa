const express = require('express');
const multer = require('multer');
const prisma = require('../../config/db');
const { success, fail } = require('../../utils/response');
const { checkPdfPassword, isLockedPdf } = require('./pdfPassword');

// Bank statement PDFs by month (owner, 2026-11-24; migration 085).
// Each bank account's (JazzCash too) monthly statement PDF, uploaded once and
// opened later — any year, any month. Only kept and shown; the Upload Bank
// Statement / matching screens are separate and don't read these.
// The book is checked by accountsBookGuard: bankAccountId in the query (list
// and upload), the record's bank for /:id/file.
const router = express.Router();
const MAX_BYTES = 25 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });

const int = (v) => (/^\d+$/.test(String(v ?? '')) ? Number(v) : null);
const wrap = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { if (e.status) return fail(res, e.status, e.message); next(e); }
};
const err = (status, message) => Object.assign(new Error(message), { status });
const PUBLIC = { id: true, bankAccountId: true, year: true, month: true, fileName: true, sizeBytes: true, uploadedByName: true, uploadedAt: true, password: true, isLocked: true };

// One bank, one year: the months that have a PDF (no file bytes).
router.get('/', wrap(async (req, res) => {
  const bankAccountId = int(req.query.bankAccountId);
  const year = int(req.query.year);
  if (!bankAccountId || !year) throw err(400, 'Bank aur saal chunein');
  const rows = await prisma.accBankStatementPdf.findMany({ where: { bankAccountId, year }, select: PUBLIC, orderBy: { month: 'asc' } });
  // Uploaded before the lock was noted: look once.
  for (const r of rows.filter((x) => x.isLocked == null)) {
    const f = await prisma.accBankStatementPdf.findUnique({ where: { id: r.id }, select: { data: true } });
    r.isLocked = isLockedPdf(Buffer.from(f.data));
    await prisma.accBankStatementPdf.update({ where: { id: r.id }, data: { isLocked: r.isLocked } });
  }
  // Years that have any PDF for this bank, for the year picker.
  const years = (await prisma.accBankStatementPdf.findMany({ where: { bankAccountId }, select: { year: true }, distinct: ['year'], orderBy: { year: 'desc' } })).map((r) => r.year);
  success(res, { rows, years });
}));

// Upload (or replace) one month's PDF. bankAccountId in the query so the
// book guard sees it before the file is read.
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, (e) => {
    if (e) return fail(res, 400, e.code === 'LIMIT_FILE_SIZE' ? 'PDF 25 MB se bari nahi ho sakti' : 'File upload nahi hui');
    next();
  });
}, wrap(async (req, res) => {
  const bankAccountId = int(req.query.bankAccountId);
  const year = int(req.body?.year);
  const month = int(req.body?.month);
  const file = req.file;
  if (!bankAccountId) throw err(400, 'Bank chunein');
  if (!year || year < 2000 || year > 2100) throw err(400, 'Saal sahi nahi');
  if (!month || month < 1 || month > 12) throw err(400, 'Mahina sahi nahi');
  if (!file || !file.buffer?.length) throw err(400, 'PDF file chunein');
  const isPdf = file.buffer.subarray(0, 5).toString('latin1') === '%PDF-';
  if (!isPdf) throw err(400, 'Sirf PDF file upload ho sakti hai');
  const bank = await prisma.accBankAccount.findUnique({ where: { id: bankAccountId }, select: { id: true } });
  if (!bank) throw err(404, 'Bank account nahi mila');
  const data = {
    fileName: String(file.originalname || 'statement.pdf').slice(0, 200),
    sizeBytes: file.buffer.length,
    data: file.buffer,
    uploadedByName: req.user?.name || req.user?.email || null,
    uploadedAt: new Date(),
    isLocked: isLockedPdf(file.buffer),
    password: null, // a new file: its password is set again
  };
  const saved = await prisma.accBankStatementPdf.upsert({
    where: { bankAccountId_year_month: { bankAccountId, year, month } },
    create: { bankAccountId, year, month, ...data },
    update: data,
    select: PUBLIC,
  });
  success(res, saved, 'PDF save ho gayi');
}));

// The locked PDF's password — checked against the PDF first (Chrome's viewer
// just clears its box on a wrong one). Blank removes it.
router.put('/:id/password', wrap(async (req, res) => {
  const id = int(req.params.id);
  const row = id ? await prisma.accBankStatementPdf.findUnique({ where: { id }, select: { data: true } }) : null;
  if (!row) throw err(404, 'PDF nahi mili');
  const password = String(req.body?.password ?? '');
  if (!password) {
    await prisma.accBankStatementPdf.update({ where: { id }, data: { password: null } });
    return success(res, { verified: null }, 'Password hata diya');
  }
  if (password.length > 200) throw err(400, 'Password bahut lamba hai');
  const check = checkPdfPassword(Buffer.from(row.data), password);
  if (!check.locked) throw err(400, 'Is PDF pe password hai hi nahi');
  if (check.ok === false) throw err(400, 'Yeh password is PDF ko nahi kholta — dobara check karke likhein');
  await prisma.accBankStatementPdf.update({ where: { id }, data: { password, isLocked: true } });
  success(res, { verified: check.ok }, check.ok ? 'Password sahi hai — save ho gaya' : 'Password save ho gaya (is PDF ka lock check nahi ho saka)');
}));

// The PDF itself, to show in the browser.
router.get('/:id/file', wrap(async (req, res) => {
  const id = int(req.params.id);
  const row = id ? await prisma.accBankStatementPdf.findUnique({ where: { id }, select: { fileName: true, data: true } }) : null;
  if (!row) throw err(404, 'PDF nahi mili');
  const name = row.fileName.replace(/[^\w.\- ]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${name}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(Buffer.from(row.data));
}));

module.exports = router;
