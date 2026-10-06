-- Two fixes for the GIN rate-lock gap (see migration 036):
--
-- 1. Migration 036 added unitRate but never backfilled it — every GIN/
--    GINItem created before that migration still has unitRate = NULL, so
--    Sales Invoice's admission-search screen kept falling back to the
--    item's LIVE current rate for them, making already-issued medicine look
--    repriced whenever a new GRN changed that rate. Backfill each one with
--    the rate from the most recent GRN received on/before its issue date —
--    the closest historically-accurate value available. Where no GRN exists
--    before the issue date, fall back to the item's own lastGrnRate/
--    purchasePrice (best remaining guess, same fallback the app already used).
--
-- 2. isBilled flags, so a GIN/GINItem already picked into a Sales Invoice
--    doesn't keep reappearing in the admission-search picker and get billed
--    a second time.

ALTER TABLE "InventoryGIN" ADD COLUMN IF NOT EXISTS "isBilled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventoryGINItem" ADD COLUMN IF NOT EXISTS "isBilled" BOOLEAN NOT NULL DEFAULT false;

UPDATE "InventoryGIN" g
SET "unitRate" = sub.rate
FROM (
  SELECT DISTINCT ON (g2.id) g2.id AS gin_id, grn."receivedRate" AS rate
  FROM "InventoryGIN" g2
  JOIN "InventoryGRN" grn ON grn."itemId" = g2."itemId" AND grn."receivedDate" <= g2."issueDate"
  WHERE g2."unitRate" IS NULL AND g2."itemId" IS NOT NULL
  ORDER BY g2.id, grn."receivedDate" DESC
) sub
WHERE g.id = sub.gin_id;

UPDATE "InventoryGIN" g
SET "unitRate" = COALESCE(i."lastGrnRate", i."purchasePrice", 0)
FROM "InventoryItem" i
WHERE g."unitRate" IS NULL AND g."itemId" = i.id;

UPDATE "InventoryGINItem" gi
SET "unitRate" = sub.rate
FROM (
  SELECT DISTINCT ON (gi2.id) gi2.id AS gin_item_id, grn."receivedRate" AS rate
  FROM "InventoryGINItem" gi2
  JOIN "InventoryGIN" g3 ON g3.id = gi2."ginId"
  JOIN "InventoryGRN" grn ON grn."itemId" = gi2."itemId" AND grn."receivedDate" <= g3."issueDate"
  WHERE gi2."unitRate" IS NULL
  ORDER BY gi2.id, grn."receivedDate" DESC
) sub
WHERE gi.id = sub.gin_item_id;

UPDATE "InventoryGINItem" gi
SET "unitRate" = COALESCE(i."lastGrnRate", i."purchasePrice", 0)
FROM "InventoryItem" i
WHERE gi."unitRate" IS NULL AND gi."itemId" = i.id;
