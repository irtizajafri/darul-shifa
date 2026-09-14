-- Voucher Expense's Supplier/GRN payment picker already flips
-- InventoryGRN.isPaid=true when a GRN is picked into a payment, but never
-- recorded which voucher did it — so a "Paid" GRN could never show its
-- Voucher Number again (Supplier Payment History report needs this).
-- Mirrors the existing AccVoucherExpenseEntryConsultantFee /
-- AccVoucherExpenseEntryOpdDoctorFee link-table pattern exactly, this time
-- against InventoryGRN. Only covers payments made from here on — GRNs
-- already marked isPaid before this migration have no recoverable link.
BEGIN;

CREATE TABLE IF NOT EXISTS public."AccVoucherExpenseEntryGrn" (
  id                      SERIAL PRIMARY KEY,
  "voucherExpenseEntryId" INTEGER NOT NULL REFERENCES public."AccVoucherExpenseEntry"(id) ON DELETE CASCADE,
  "grnId"                 INTEGER NOT NULL REFERENCES public."InventoryGRN"(id),
  amount                  DOUBLE PRECISION NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AccVoucherExpenseEntryGrn_voucherExpenseEntryId_idx"
  ON public."AccVoucherExpenseEntryGrn"("voucherExpenseEntryId");
CREATE INDEX IF NOT EXISTS "AccVoucherExpenseEntryGrn_grnId_idx"
  ON public."AccVoucherExpenseEntryGrn"("grnId");

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AccVoucherExpenseEntryGrn';
  IF cnt <> 1 THEN RAISE EXCEPTION 'post-assertion failed: AccVoucherExpenseEntryGrn table missing'; END IF;
END $$;

COMMIT;
