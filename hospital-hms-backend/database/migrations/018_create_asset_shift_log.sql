-- Asset Shifting History
-- Tracks every time a fixed-asset unit is moved from one location to another.

CREATE TABLE "AssetShiftLog" (
  "id"              SERIAL PRIMARY KEY,
  "assetInstanceId" INTEGER NOT NULL,
  "assetTag"        TEXT    NOT NULL,
  "itemName"        TEXT    NOT NULL,
  "fromLocation"    TEXT,
  "toLocation"      TEXT    NOT NULL,
  "reason"          TEXT,
  "shiftedBy"       TEXT,
  "shiftedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "AssetShiftLog_assetInstanceId_fkey"
    FOREIGN KEY ("assetInstanceId")
    REFERENCES "AssetInstance"("id")
    ON DELETE CASCADE
);

CREATE INDEX "AssetShiftLog_assetInstanceId_idx" ON "AssetShiftLog"("assetInstanceId");
CREATE INDEX "AssetShiftLog_shiftedAt_idx"       ON "AssetShiftLog"("shiftedAt");
