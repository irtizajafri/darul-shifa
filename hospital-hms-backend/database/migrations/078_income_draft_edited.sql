-- Pending income voucher follows the Clinic (owner, 2026-11-18). The 8:00 AM
-- Day Close voucher waits in Pending Drafts; until someone edits it by hand
-- it is re-read from the Clinic figures (so a slip edited after 8 AM counts),
-- and on Post Now. Once edited by hand it is left alone — a "Refresh from
-- Clinic" button brings the Clinic figures back. These two columns say
-- whether (and by whom) it was edited by hand. Safe to re-run.

ALTER TABLE "AccVoucherIncome" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);
ALTER TABLE "AccVoucherIncome" ADD COLUMN IF NOT EXISTS "editedByName" TEXT;

-- A pending voucher already edited before this change: its lines were
-- re-created after the voucher (an edit replaces every line), so mark it
-- edited and it is never overwritten.
UPDATE "AccVoucherIncome" v
SET "editedAt" = e.last_line, "editedByName" = COALESCE(v."editedByName", '(edited before 078)')
FROM (
  SELECT "voucherId", MAX("createdAt") AS last_line
  FROM "AccVoucherIncomeEntry"
  GROUP BY "voucherId"
) e
WHERE e."voucherId" = v.id
  AND v.status = 'pending'
  AND v."editedAt" IS NULL
  AND e.last_line > v."createdAt" + INTERVAL '1 minute';
