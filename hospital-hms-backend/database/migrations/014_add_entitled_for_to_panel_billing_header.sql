-- Panel Billing header's "Entitled For" field — staff picks a Room Category
-- (Clinic > Parameters > Room Category) manually; shows on the Billing
-- Covering Page print (replacing the old unlinked, always-blank "Entitled
-- For" row).
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicPanelBillingHeader' AND column_name='entitledFor'
  ) THEN
    ALTER TABLE public."ClinicPanelBillingHeader" ADD COLUMN "entitledFor" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicPanelBillingHeader' AND column_name='entitledFor'
  ) THEN
    RAISE EXCEPTION 'entitledFor column missing after migration';
  END IF;
END $$;

COMMIT;
