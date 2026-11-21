-- 081: Income & Expense Summary — figures typed by hand per book per month
-- (owner, 2026-11-21). The report works out everything else from the books;
-- these have no source in the system:
--   openingBalance   the first month's opening (later months carry the
--                    previous month's closing unless one is typed here)
--   extraDeposit     Receipts › Other deposits
--   chequeWriteOff   Receipts › Other deposits (Cheq W/O)
--   outDatedCheques  Closing (taken off with Payments)
--   receivableBF     A/c Receivable B/F (Closing and Reconciliation)
--   pettyCash        Reconciliation
-- One row per (book, month, key). Additive only — nothing else changes.

CREATE TABLE IF NOT EXISTS "AccMonthSummaryInput" (
  "id"            SERIAL PRIMARY KEY,
  "entityType"    TEXT NOT NULL,
  "month"         TEXT NOT NULL,
  "key"           TEXT NOT NULL,
  "amount"        DECIMAL(15, 2) NOT NULL DEFAULT 0,
  "updatedByName" TEXT,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccMonthSummaryInput_entityType_month_key_key"
  ON "AccMonthSummaryInput" ("entityType", "month", "key");
