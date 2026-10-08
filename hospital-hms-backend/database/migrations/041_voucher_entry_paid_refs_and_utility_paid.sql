-- Voucher Expense "Confirm creates the voucher" flow (2026-10-08).
--
-- 1. AccVoucherExpenseEntry."paidRefs" — what THIS voucher line marked as
--    paid that has no link table of its own: legacy PatientVisit ids,
--    OPD doctor rows, the salary month, utility bills. Lets a confirmed line
--    be removed (or a voucher deleted) and put exactly those items back to
--    unpaid. GRN / consultant-fee links already have their own tables.
--    Shape: { "visitIds": [..], "opdDoctorIds": [..],
--             "salary": { "empCode": "..", "month": "..", "year": ".." },
--             "utilityBillIds": [..] }
--
-- 2. UtilityActualBill."isPaid" / "paidVoucherEntryId" — a utility bill paid
--    through Voucher Expense stops being offered again (it had no paid flag).

ALTER TABLE "AccVoucherExpenseEntry" ADD COLUMN IF NOT EXISTS "paidRefs" JSONB;

ALTER TABLE "UtilityActualBill" ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UtilityActualBill" ADD COLUMN IF NOT EXISTS "paidVoucherEntryId" INTEGER;
