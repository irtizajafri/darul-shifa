-- Correction to migration 031: bed auto-release was placed on ClinicBed,
-- but the user wants it set once per Room Category (e.g. all "General Ward"
-- beds behave the same way), not toggled per individual bed. Move the flag
-- up to ClinicRoomCategory; vacatedAt stays on ClinicBed since each bed
-- vacates at its own time regardless of category setting.
BEGIN;

ALTER TABLE public."ClinicRoomCategory" ADD COLUMN IF NOT EXISTS "autoReleaseEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public."ClinicBed" DROP COLUMN IF EXISTS "autoReleaseEnabled";

COMMIT;
