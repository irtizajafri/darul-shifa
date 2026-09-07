-- Adds `patientName` to InventoryGDHeader and InventoryGIN, snapshotted the same
-- way `admissionNumber` already is (captured once at GD creation, copied onto
-- the GIN at issuance) — so GIN's "who is this for" is visible in the UI, not
-- just admission number. Safe to run multiple times.

DO $$
BEGIN
  IF to_regclass('public."InventoryGDHeader"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'InventoryGDHeader' AND column_name = 'patientName'
    ) THEN
      ALTER TABLE public."InventoryGDHeader" ADD COLUMN "patientName" TEXT;
    END IF;
  END IF;

  IF to_regclass('public."InventoryGIN"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'InventoryGIN' AND column_name = 'patientName'
    ) THEN
      ALTER TABLE public."InventoryGIN" ADD COLUMN "patientName" TEXT;
    END IF;
  END IF;
END $$;
