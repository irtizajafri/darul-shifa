-- Receive Balance against Slip takes a mode of payment (owner, 2026-11-20):
-- cash / cc / jazzcash, like Receiving against Admission. Older
-- rows stay NULL and keep going by their slip's payment type, as before.
-- (ClinicAdmissionPayment.paymentType is already TEXT — no change there.)
-- Safe to re-run.

ALTER TABLE "ClinicOpdBalancePayment" ADD COLUMN IF NOT EXISTS "paymentType" TEXT;
