-- Bank Reconciliation (Accounts), owner 2026-11-18.
--   AccBankAccount: opening balance + its date, active flag (Bank Book).
--   AccBankReconLink: a statement line matched to book items that put money
--     INTO the bank (deposit / bank income voucher / panel cheque / CC
--     settlement). Money OUT (cheque / online expense entries) keeps using
--     AccVoucherExpenseEntry.matchedStatementLineId, as the cheque reports do.
--   AccBankReconSignoff: "reconciled as of date by X" — matching on or before
--     that date is locked until reopened.
--   ClinicPanelChequeReceipt.bankAccountId / depositDate and
--   ClinicCcSettlement.bankAccountId: which bank the money went into.
-- Columns and new tables only; nothing existing changes. Safe to re-run.

ALTER TABLE "AccBankAccount" ADD COLUMN IF NOT EXISTS "openingBalance" DECIMAL(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE "AccBankAccount" ADD COLUMN IF NOT EXISTS "openingDate"    DATE;
ALTER TABLE "AccBankAccount" ADD COLUMN IF NOT EXISTS "isActive"       BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "AccBankReconLink" (
  "id"              SERIAL PRIMARY KEY,
  "bankAccountId"   INTEGER NOT NULL REFERENCES "AccBankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "statementLineId" INTEGER NOT NULL REFERENCES "AccBankStatementLine"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "bookType"        TEXT NOT NULL,   -- deposit | income | panel-cheque | cc
  "bookId"          INTEGER NOT NULL,
  "amount"          DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "method"          TEXT NOT NULL DEFAULT 'manual',   -- auto | manual
  "matchedByName"   TEXT,
  "matchedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "AccBankReconLink_book_key" ON "AccBankReconLink"("bookType", "bookId");
CREATE INDEX IF NOT EXISTS "AccBankReconLink_statementLineId_idx" ON "AccBankReconLink"("statementLineId");

CREATE TABLE IF NOT EXISTS "AccBankReconSignoff" (
  "id"               SERIAL PRIMARY KEY,
  "bankAccountId"    INTEGER NOT NULL REFERENCES "AccBankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "asOfDate"         DATE NOT NULL,
  "statementBalance" DECIMAL(15, 2) NOT NULL,
  "bookBalance"      DECIMAL(15, 2) NOT NULL,
  "difference"       DECIMAL(15, 2) NOT NULL,
  "signedByName"     TEXT,
  "signedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reopenedByName"   TEXT,
  "reopenedAt"       TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "AccBankReconSignoff_bank_idx" ON "AccBankReconSignoff"("bankAccountId", "asOfDate");

ALTER TABLE "ClinicPanelChequeReceipt" ADD COLUMN IF NOT EXISTS "bankAccountId" INTEGER;
ALTER TABLE "ClinicPanelChequeReceipt" ADD COLUMN IF NOT EXISTS "depositDate"   DATE;
ALTER TABLE "ClinicCcSettlement"       ADD COLUMN IF NOT EXISTS "bankAccountId" INTEGER;
