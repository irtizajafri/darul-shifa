-- Doctor Parameter's new "Administrative Expenses" toggle + flat Rate.
-- Step 1 of a bigger feature (auto-add this to the OPD slip when the doctor
-- is picked) — this migration only adds the parameter fields; the slip-side
-- wiring comes later once the user describes it.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicDoctor' AND column_name='administrativeExpenseEnabled'
  ) THEN
    ALTER TABLE public."ClinicDoctor" ADD COLUMN "administrativeExpenseEnabled" BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicDoctor' AND column_name='administrativeExpenseRate'
  ) THEN
    ALTER TABLE public."ClinicDoctor" ADD COLUMN "administrativeExpenseRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicDoctor' AND column_name='administrativeExpenseEnabled'
  ) THEN
    RAISE EXCEPTION 'administrativeExpenseEnabled column missing after migration';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicDoctor' AND column_name='administrativeExpenseRate'
  ) THEN
    RAISE EXCEPTION 'administrativeExpenseRate column missing after migration';
  END IF;
END $$;

COMMIT;
