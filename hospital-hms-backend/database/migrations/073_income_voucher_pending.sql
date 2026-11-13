-- Income Voucher: Pending → Posted (owner, 2026-11-13). The 8:00 AM Day
-- Close no longer posts the day's Clinic income voucher: it is made as
-- 'pending' and shows in Accounts → Pending Drafts, where it can be edited and
-- is posted only with the "Post Now" button. A pending voucher is not counted
-- anywhere (reports, Inquiry dashboard, day closed checks) until posted.
-- Every voucher already saved stays 'posted'. Columns only; safe to re-run.

ALTER TABLE "AccVoucherIncome" ADD COLUMN IF NOT EXISTS "status"       TEXT NOT NULL DEFAULT 'posted';
ALTER TABLE "AccVoucherIncome" ADD COLUMN IF NOT EXISTS "postedAt"     TIMESTAMP(3);
ALTER TABLE "AccVoucherIncome" ADD COLUMN IF NOT EXISTS "postedByName" TEXT;
CREATE INDEX IF NOT EXISTS "AccVoucherIncome_status_idx" ON "AccVoucherIncome"("status");
