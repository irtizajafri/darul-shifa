-- WhatsApp Punch Notifier — marks each PunchLog row once an alert has been
-- sent for it, so the notifier job (polling every ~2 min) never double-sends
-- for the same punch.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='PunchLog' AND column_name='whatsappNotifiedAt'
  ) THEN
    ALTER TABLE public."PunchLog" ADD COLUMN "whatsappNotifiedAt" TIMESTAMP;
    -- Backfill existing rows as already-notified in the same step the column
    -- is created — a fresh nullable column defaults every existing row to
    -- NULL, which the notifier job reads as "pending". Without this, first
    -- boot after this migration would try to WhatsApp-alert the *entire*
    -- punch history instead of only punches going forward.
    UPDATE public."PunchLog" SET "whatsappNotifiedAt" = NOW() WHERE "whatsappNotifiedAt" IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='PunchLog' AND column_name='whatsappNotifiedAt'
  ) THEN
    RAISE EXCEPTION 'whatsappNotifiedAt column missing after migration';
  END IF;
END $$;

COMMIT;
