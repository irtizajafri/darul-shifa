-- Panels > Billing (2026-10-21): the Billing Covering Page's "Date:" is
-- typed by hand on the Billing header (free text, exactly as it should
-- print — no calendar); blank keeps printing today's date. Safe to re-run.

ALTER TABLE "ClinicPanelBillingHeader" ADD COLUMN IF NOT EXISTS "billDate" TEXT;
