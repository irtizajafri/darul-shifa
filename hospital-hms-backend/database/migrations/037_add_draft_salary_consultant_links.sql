-- Save as Draft & Print only ever stored the GRN linkage (grnIds, via
-- AccVoucherExpenseDraftGrn) — an Employee salary entry or Doctor/IPD
-- Consultant fee entry saved as a draft silently dropped the data that
-- marks the underlying salary/visit/bill-item as paid, so once posted into
-- a real voucher at day-close, those entries never got flagged paid and
-- kept reappearing as still-due forever. Vendor already worked correctly
-- (see migration 034); this brings Employee/Doctor to the same behavior.
ALTER TABLE "AccVoucherExpenseDraft" ADD COLUMN IF NOT EXISTS "salaryEmpCode" TEXT;
ALTER TABLE "AccVoucherExpenseDraft" ADD COLUMN IF NOT EXISTS "salaryMonth" TEXT;
ALTER TABLE "AccVoucherExpenseDraft" ADD COLUMN IF NOT EXISTS "salaryYear" TEXT;
ALTER TABLE "AccVoucherExpenseDraft" ADD COLUMN IF NOT EXISTS "visitIds" JSONB;
ALTER TABLE "AccVoucherExpenseDraft" ADD COLUMN IF NOT EXISTS "consultantFeeItemIds" JSONB;
