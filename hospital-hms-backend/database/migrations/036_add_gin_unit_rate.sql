-- Sales Invoice read the ITEM's current rate (lastGrnRate/purchasePrice) live
-- every time, instead of the rate that was actually in effect when the GIN
-- was issued — so changing an item's rate later silently changed the amount
-- on every past invoice built from that item's GINs too. Lock the rate onto
-- the GIN itself at creation time instead.
ALTER TABLE "InventoryGIN"     ADD COLUMN IF NOT EXISTS "unitRate" DECIMAL(12,4);
ALTER TABLE "InventoryGINItem" ADD COLUMN IF NOT EXISTS "unitRate" DECIMAL(12,4);
