-- 085: Bank statement PDFs by month (owner, 2026-11-24). Each bank account's
-- (JazzCash too) monthly statement PDF, kept to look at later — any year,
-- any month. Only stored and shown; the Upload Bank Statement / matching
-- screens don't read it. The file itself is in the table, so the daily
-- database backup keeps it too. New table only; safe to re-run.

CREATE TABLE IF NOT EXISTS "AccBankStatementPdf" (
  "id"             SERIAL PRIMARY KEY,
  "bankAccountId"  INTEGER NOT NULL REFERENCES "AccBankAccount"("id") ON DELETE CASCADE,
  "year"           INTEGER NOT NULL,
  "month"          INTEGER NOT NULL,                     -- 1..12
  "fileName"       TEXT NOT NULL,
  "sizeBytes"      INTEGER NOT NULL,
  "data"           BYTEA NOT NULL,
  "uploadedByName" TEXT,
  "uploadedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AccBankStatementPdf_bank_year_month_key" ON "AccBankStatementPdf"("bankAccountId", "year", "month");

-- Password-locked statements (owner, 2026-11-24): the PDF's password, kept
-- with it so it can be copied into the viewer's password box (checked against
-- the PDF when saved), and whether the PDF is locked at all.
ALTER TABLE "AccBankStatementPdf" ADD COLUMN IF NOT EXISTS "password" TEXT;
ALTER TABLE "AccBankStatementPdf" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN;
