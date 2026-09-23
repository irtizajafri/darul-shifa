-- Cashier Handover feature:
--   1. AccVoucherExpenseDraft gets createdByUserId/createdByName — drafts
--      currently have zero user attribution, so a cashier's own pending
--      drafts can't be filtered out for their Cash Handover total.
--   2. ClinicReceptionAsset — an independent Reception items master list
--      (Clinic module, deliberately unrelated to Inventory's AssetInstance
--      tracking — just Item Name / Quantity / Condition / Notes).
--   3. ClinicHandover — one row per handover event (asset section and/or
--      cash section), snapshotting the Reception asset list + petty cash
--      handed over, and the computed Total Cash / Draft Payments / Net Cash
--      for that cashier's business day.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AccVoucherExpenseDraft' AND column_name = 'createdByUserId'
  ) THEN
    ALTER TABLE public."AccVoucherExpenseDraft" ADD COLUMN "createdByUserId" TEXT;
    ALTER TABLE public."AccVoucherExpenseDraft" ADD COLUMN "createdByName" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AccVoucherExpenseDraft_createdByUserId_idx"
  ON public."AccVoucherExpenseDraft"("createdByUserId");

CREATE TABLE IF NOT EXISTS public."ClinicReceptionAsset" (
  "id"        SERIAL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "quantity"  INTEGER NOT NULL DEFAULT 0,
  "condition" TEXT NOT NULL DEFAULT 'working',
  "notes"     TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public."ClinicHandover" (
  "id"                 SERIAL PRIMARY KEY,
  "businessDate"       TEXT NOT NULL,
  "fromUserId"         TEXT NOT NULL,
  "fromUserName"       TEXT NOT NULL,
  "toUserId"           TEXT NOT NULL,
  "toUserName"         TEXT NOT NULL,
  "pettyCash"          DECIMAL(12,2),
  "assetsJson"         JSONB,
  "totalCash"          DECIMAL(12,2),
  "draftPaymentsTotal" DECIMAL(12,2),
  "netCash"            DECIMAL(12,2),
  "notes"              TEXT,
  "createdAt"          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ClinicHandover_fromUserId_businessDate_idx"
  ON public."ClinicHandover"("fromUserId", "businessDate");

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AccVoucherExpenseDraft' AND column_name IN ('createdByUserId', 'createdByName');
  IF cnt <> 2 THEN RAISE EXCEPTION 'post-assertion failed: AccVoucherExpenseDraft user columns missing'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ClinicReceptionAsset') THEN
    RAISE EXCEPTION 'post-assertion failed: ClinicReceptionAsset missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ClinicHandover') THEN
    RAISE EXCEPTION 'post-assertion failed: ClinicHandover missing';
  END IF;
END $$;

COMMIT;
