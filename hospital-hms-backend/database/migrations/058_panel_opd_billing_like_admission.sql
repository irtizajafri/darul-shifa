-- Panel OPD Billing made a replica of Admission Billing (owner, 2026-10-26):
-- one bill per patient per business day, opened from its primary slip.
--   entitledFor / billDate — same Covering Page fields Admission has.
--   closedAt / closedBy    — Save locks the bill (Admission: file closed).
--   seededVisitIds         — the day's slips already added to the bill's
--                            heads, so a slip made later is added exactly once.
--   overridesLiveId / excluded — edit / delete a live Lab-Radiology-
--                            Ultrasound-Medicine line, same as Admission.
-- Safe to re-run.
ALTER TABLE "ClinicPanelOpdBillingHeader" ADD COLUMN IF NOT EXISTS "entitledFor" TEXT;
ALTER TABLE "ClinicPanelOpdBillingHeader" ADD COLUMN IF NOT EXISTS "billDate" TEXT;
ALTER TABLE "ClinicPanelOpdBillingHeader" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "ClinicPanelOpdBillingHeader" ADD COLUMN IF NOT EXISTS "closedBy" TEXT;
ALTER TABLE "ClinicPanelOpdBillingHeader" ADD COLUMN IF NOT EXISTS "seededVisitIds" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "ClinicPanelOpdBillingItem" ADD COLUMN IF NOT EXISTS "overridesLiveId" TEXT;
ALTER TABLE "ClinicPanelOpdBillingItem" ADD COLUMN IF NOT EXISTS "excluded" BOOLEAN NOT NULL DEFAULT false;
