-- Lets Voucher Expense's IPD Consultant Fee list also pick up doctor fees
-- from Laboratory/Radiology/Ultrasound OPD visits linked to an admission
-- (ClinicOpdVisitDoctor) — not just Discharge Bill rows (ClinicDischargeBillItem)
-- like today. ClinicOpdVisitDoctor had no paid/unpaid tracking at all, so
-- without this a fee picked into a voucher would keep showing as pending
-- forever, or could be paid twice. Mirrors the existing ClinicDischargeBillItem
-- isPaid + AccVoucherExpenseEntryConsultantFee pattern exactly.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public."ClinicOpdVisitDoctor"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ClinicOpdVisitDoctor' AND column_name = 'isPaid'
    ) THEN
      ALTER TABLE public."ClinicOpdVisitDoctor" ADD COLUMN "isPaid" BOOLEAN NOT NULL DEFAULT false;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public."AccVoucherExpenseEntryOpdDoctorFee" (
  id                      SERIAL PRIMARY KEY,
  "voucherExpenseEntryId" INTEGER NOT NULL REFERENCES public."AccVoucherExpenseEntry"(id) ON DELETE CASCADE,
  "opdVisitDoctorId"      INTEGER NOT NULL REFERENCES public."ClinicOpdVisitDoctor"(id),
  amount                  DOUBLE PRECISION NOT NULL,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AccVoucherExpenseEntryOpdDoctorFee_voucherExpenseEntryId_idx"
  ON public."AccVoucherExpenseEntryOpdDoctorFee"("voucherExpenseEntryId");
CREATE INDEX IF NOT EXISTS "AccVoucherExpenseEntryOpdDoctorFee_opdVisitDoctorId_idx"
  ON public."AccVoucherExpenseEntryOpdDoctorFee"("opdVisitDoctorId");

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ClinicOpdVisitDoctor' AND column_name = 'isPaid';
  IF cnt <> 1 THEN RAISE EXCEPTION 'post-assertion failed: ClinicOpdVisitDoctor.isPaid missing'; END IF;

  SELECT count(*) INTO cnt FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AccVoucherExpenseEntryOpdDoctorFee';
  IF cnt <> 1 THEN RAISE EXCEPTION 'post-assertion failed: AccVoucherExpenseEntryOpdDoctorFee table missing'; END IF;
END $$;

COMMIT;
