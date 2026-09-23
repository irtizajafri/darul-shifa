-- Cashier Handover — persist the first/last cash slip serial# + time this
-- cashier processed in the window, so History reprints show the same
-- "worked from slip # X to slip # Y" range the original submit-time print
-- did (matching the paper sheet's two scan-reference lines at the top).
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ClinicHandover' AND column_name = 'firstSlipSerial'
  ) THEN
    ALTER TABLE public."ClinicHandover" ADD COLUMN "firstSlipSerial" TEXT;
    ALTER TABLE public."ClinicHandover" ADD COLUMN "firstSlipTime" TIMESTAMP;
    ALTER TABLE public."ClinicHandover" ADD COLUMN "lastSlipSerial" TEXT;
    ALTER TABLE public."ClinicHandover" ADD COLUMN "lastSlipTime" TIMESTAMP;
  END IF;
END $$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicHandover'
      AND column_name IN ('firstSlipSerial','firstSlipTime','lastSlipSerial','lastSlipTime');
  IF cnt <> 4 THEN RAISE EXCEPTION 'post-assertion failed: ClinicHandover slip-range columns missing'; END IF;
END $$;

COMMIT;
