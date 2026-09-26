-- Doctor Parameter's new "Antenatal" quick-rate button: a flat, doctor-level
-- Antenatal registration fee, editable straight from the doctor list instead
-- of going through the full Sub Department tab (which requires picking a
-- department/sub-department, consultant days, from/to time etc. — a lot of
-- unrelated fields for what is conceptually just one number).
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicDoctor' AND column_name='antenatalRate'
  ) THEN
    ALTER TABLE public."ClinicDoctor" ADD COLUMN "antenatalRate" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicDoctor' AND column_name='antenatalRate'
  ) THEN
    RAISE EXCEPTION 'antenatalRate column missing after migration';
  END IF;
END $$;

COMMIT;
