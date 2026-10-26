-- Discharge & Refund shows every Laboratory / Radiology / Ultrasound /
-- Blood Bank slip of the file by itself (owner, 2026-10-26): one row per
-- test, synced from the slip while the file is open.
--   sourceOpdVisitId — the slip
--   sourceLineKey    — "<slip id>:<test row id>" ("<slip id>:0" = whole slip)
--   amountEdited     — staff changed the amount here; the slip no longer overwrites it
--   excluded         — staff deleted the row; kept (amount 0) so it doesn't come back
-- Safe to re-run.
ALTER TABLE "ClinicDischargeBillItem" ADD COLUMN IF NOT EXISTS "sourceOpdVisitId" INTEGER;
ALTER TABLE "ClinicDischargeBillItem" ADD COLUMN IF NOT EXISTS "sourceLineKey" TEXT;
ALTER TABLE "ClinicDischargeBillItem" ADD COLUMN IF NOT EXISTS "amountEdited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClinicDischargeBillItem" ADD COLUMN IF NOT EXISTS "excluded" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX IF EXISTS "ClinicDischargeBillItem_admissionId_sourceOpdVisitId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ClinicDischargeBillItem_admissionId_sourceLineKey_key"
  ON "ClinicDischargeBillItem" ("admissionId", "sourceLineKey");
