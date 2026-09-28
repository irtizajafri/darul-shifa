-- Provisional Bill: Pharmacy and Diagnostic amounts auto-fold into the Bill
-- Amount total, but staff sometimes need to leave one out (e.g. a panel
-- company that bills its own pharmacy separately). These two per-admission
-- flags let each be toggled out of the total independently, without
-- deleting the underlying sales invoices / OPD visits they're computed from.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicAdmission' AND column_name='pharmacyBillExcluded'
  ) THEN
    ALTER TABLE public."ClinicAdmission" ADD COLUMN "pharmacyBillExcluded" BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicAdmission' AND column_name='diagnosticBillExcluded'
  ) THEN
    ALTER TABLE public."ClinicAdmission" ADD COLUMN "diagnosticBillExcluded" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicAdmission' AND column_name='pharmacyBillExcluded'
  ) THEN
    RAISE EXCEPTION 'pharmacyBillExcluded column missing after migration';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicAdmission' AND column_name='diagnosticBillExcluded'
  ) THEN
    RAISE EXCEPTION 'diagnosticBillExcluded column missing after migration';
  END IF;
END $$;

COMMIT;
