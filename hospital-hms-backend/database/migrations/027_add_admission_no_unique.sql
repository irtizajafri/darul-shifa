-- Duplicate Admission bug: two ClinicAdmission rows could be created for the
-- same admissionNo (e.g. 177783) because there was no DB-level constraint —
-- only application-level checks (now added in clinic.service.js
-- createAdmission()). This is the last line of defense so it can never
-- happen again even from a code path that forgets the check.
--
-- Confirmed via a live spot-check before writing this migration: zero
-- existing duplicate admissionNo values and zero blank ('') ones in
-- ClinicAdmission, so a bare UNIQUE constraint is safe to add directly —
-- no cleanup/backfill step needed first.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClinicAdmission_admissionNo_key'
  ) THEN
    ALTER TABLE public."ClinicAdmission" ADD CONSTRAINT "ClinicAdmission_admissionNo_key" UNIQUE ("admissionNo");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClinicAdmission_admissionNo_key') THEN
    RAISE EXCEPTION 'ClinicAdmission admissionNo unique constraint missing after migration';
  END IF;
END $$;

COMMIT;
