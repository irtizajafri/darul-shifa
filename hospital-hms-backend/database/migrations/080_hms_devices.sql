-- Connected PCs (owner, 2026-11-20): every PC that uses the HMS, by IP — so
-- the Super Admin can see which PCs are connected and allow / block a PC's
-- access to the HMS. New tables only; safe to re-run.

CREATE TABLE IF NOT EXISTS "HmsDevice" (
  "id"            SERIAL PRIMARY KEY,
  "ip"            TEXT NOT NULL,
  "name"          TEXT,                                  -- e.g. "Reception 1", typed by the Super Admin
  "status"        TEXT NOT NULL DEFAULT 'allowed',       -- allowed | blocked | pending (waiting for approval)
  "protected"     BOOLEAN NOT NULL DEFAULT false,        -- can never be blocked (dev PC etc.)
  "macAddress"    TEXT,
  "lastUserName"  TEXT,
  "lastUserEmail" TEXT,
  "userAgent"     TEXT,
  "requestCount"  INTEGER NOT NULL DEFAULT 0,
  "firstSeenAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedByName" TEXT,
  "changedAt"     TIMESTAMP(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS "HmsDevice_ip_key" ON "HmsDevice"("ip");

-- Small key/value settings — "approvalMode" = 'on' lets only approved PCs in.
CREATE TABLE IF NOT EXISTS "HmsSetting" (
  "key"       TEXT PRIMARY KEY,
  "value"     TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
