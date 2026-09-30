-- Bed auto-release: a bed can be marked to automatically flip back to
-- "available" 6 hours after it becomes vacant (instead of instantly), so
-- housekeeping/turnover time is accounted for. autoReleaseEnabled is the
-- per-bed opt-in checkbox; vacatedAt records when the bed most recently
-- became vacant so a background job can compare it against now() and
-- flip status once 6 hours have elapsed. NULL vacatedAt = not currently
-- pending release (either never vacated, or already flipped/re-occupied).
BEGIN;

ALTER TABLE public."ClinicBed" ADD COLUMN IF NOT EXISTS "autoReleaseEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public."ClinicBed" ADD COLUMN IF NOT EXISTS "vacatedAt" TIMESTAMP;

COMMIT;
