-- Slip # hardening (2026-10-14): ClinicAntenatal.serialNo was the one slip
-- table without a DB-level unique rule, so two saves of the same number at
-- the same moment could both get through the app's check. Blank '' is
-- normalised to NULL first (NULLs never clash).
-- If this database already holds duplicate antenatal Slip #s the index is
-- NOT created (a NOTICE lists it) — fix those rows, then run this again.

UPDATE "ClinicAntenatal" SET "serialNo" = NULL WHERE "serialNo" = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ClinicAntenatal" WHERE "serialNo" IS NOT NULL
    GROUP BY "serialNo" HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'ClinicAntenatal has duplicate serialNo values — unique index skipped. Fix them and re-run 049.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "ClinicAntenatal_serialNo_key" ON "ClinicAntenatal" ("serialNo");
  END IF;
END $$;
