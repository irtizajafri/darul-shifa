-- General Payment: a Surgery/Anesthesia line covering several admission
-- files now carries each file's own amount ({"175129": 5000, ...}). The
-- voucher still shows one line with the total; Discharge and Refund shows
-- each file only its own share (owner, 2026-10-27). Safe to re-run.
ALTER TABLE "AccVoucherExpenseEntry" ADD COLUMN IF NOT EXISTS "admissionAmounts" JSONB;
ALTER TABLE "AccVoucherExpenseDraft" ADD COLUMN IF NOT EXISTS "admissionAmounts" JSONB;
