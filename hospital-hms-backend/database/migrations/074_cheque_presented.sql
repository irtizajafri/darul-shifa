-- Presented / Unpresented Cheques (Accounts → Transactions), owner 2026-11-17.
-- A cheque (cheque-mode Voucher Expense line) is presented when it is ticked
-- on that screen with a Present Date, or when a Bank Statement line is
-- matched to it (matchedStatementLineId, unchanged). Columns only; nothing
-- existing changes. Safe to re-run.

ALTER TABLE "AccVoucherExpenseEntry" ADD COLUMN IF NOT EXISTS "presentedDate"   DATE;
ALTER TABLE "AccVoucherExpenseEntry" ADD COLUMN IF NOT EXISTS "presentedByName" TEXT;
ALTER TABLE "AccVoucherExpenseEntry" ADD COLUMN IF NOT EXISTS "presentedAt"     TIMESTAMP(3);
