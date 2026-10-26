-- General Payment (clinic) picks admission file(s) for a payment line — the
-- file #(s) now ride on the Pending Draft too (comma-joined, same as
-- AccVoucherExpenseEntry.admissionNo), so Day Close / Post Now carries them
-- onto the real voucher line and Discharge and Refund shows the payment on
-- each file (owner, 2026-10-26). Safe to re-run.
ALTER TABLE "AccVoucherExpenseDraft" ADD COLUMN IF NOT EXISTS "admissionNo" TEXT;
