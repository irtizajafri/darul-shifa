-- Migration 026: Add isIgnored flag to InventoryGDHeader
-- Allows a GD to be "ignored" so it is hidden from the GIN dropdown
-- but still visible in all reports and the Reprint section.

ALTER TABLE "InventoryGDHeader"
  ADD COLUMN IF NOT EXISTS "isIgnored" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "InventoryGDHeader_isIgnored_idx"
  ON "InventoryGDHeader" ("isIgnored");
