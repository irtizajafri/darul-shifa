-- Discharge and Refund (2026-10-19): a Panel file can be closed by sending
-- its remaining balance to "Other Income" — stored here (as a positive
-- amount, shown as minus on screen) so Balance comes to 0 and it's on record
-- which files were closed this way. No Accounts voucher is posted for it.
-- Safe to re-run.

ALTER TABLE "ClinicAdmission" ADD COLUMN IF NOT EXISTS "dischargeOtherIncome" DOUBLE PRECISION;
