-- Clinic refunds via Pending Draft (2026-10-20): Cancel Slip, Slip Refund and
-- Admission Refund no longer post a voucher straight away — each saves a
-- Pending Draft tagged with what it refunds, and Day Close joins the day's
-- drafts of one kind into ONE voucher line:
--   'slip'      → "AMOUNT REFUND TO THE PATIENT AGAINST SLIP #a,b,c"
--   'admission' → "AMOUNT REFUND TO THE PATIENT AGAINST ADMISSION #x,y"
-- clinicRefundRef = that slip # / admission #. Safe to re-run.

ALTER TABLE "AccVoucherExpenseDraft" ADD COLUMN IF NOT EXISTS "clinicRefundKind" TEXT;
ALTER TABLE "AccVoucherExpenseDraft" ADD COLUMN IF NOT EXISTS "clinicRefundRef" TEXT;
