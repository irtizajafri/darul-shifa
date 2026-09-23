-- Cashier Handover: Asset Handover and Cash Handover can go to two
-- DIFFERENT employees, not necessarily the same one — split the single
-- toUserId/toUserName into assetToUserId/assetToUserName (renamed) plus new
-- cashToUserId/cashToUserName. Table is brand new and still empty in every
-- environment this has been applied to, so a straight rename is safe (no
-- data migration needed).
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ClinicHandover' AND column_name = 'toUserId'
  ) THEN
    ALTER TABLE public."ClinicHandover" RENAME COLUMN "toUserId" TO "assetToUserId";
    ALTER TABLE public."ClinicHandover" RENAME COLUMN "toUserName" TO "assetToUserName";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ClinicHandover' AND column_name = 'cashToUserId'
  ) THEN
    ALTER TABLE public."ClinicHandover" ADD COLUMN "cashToUserId" TEXT;
    ALTER TABLE public."ClinicHandover" ADD COLUMN "cashToUserName" TEXT;
  END IF;
END $$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicHandover'
      AND column_name IN ('assetToUserId','assetToUserName','cashToUserId','cashToUserName');
  IF cnt <> 4 THEN RAISE EXCEPTION 'post-assertion failed: ClinicHandover split-to-user columns missing'; END IF;
END $$;

COMMIT;
