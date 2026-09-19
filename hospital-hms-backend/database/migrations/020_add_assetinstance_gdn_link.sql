-- Goods Discard (GDN) currently has no way to link the specific Fixed Asset
-- unit(s) being discarded — createGDN only ever recorded a plain quantity.
-- gdnId gives AssetInstance the same kind of link it already has to GIN
-- (ginItemId) and Maintenance (maintenanceId), so a discarded fixed-asset
-- unit's tag stays traceable to the GDN that discarded it.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AssetInstance' AND column_name = 'gdnId'
  ) THEN
    ALTER TABLE public."AssetInstance"
      ADD COLUMN "gdnId" INTEGER REFERENCES public."InventoryGDN"(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AssetInstance_gdnId_idx"
  ON public."AssetInstance"("gdnId");

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AssetInstance' AND column_name = 'gdnId';
  IF cnt <> 1 THEN RAISE EXCEPTION 'post-assertion failed: AssetInstance.gdnId missing'; END IF;
END $$;

COMMIT;
