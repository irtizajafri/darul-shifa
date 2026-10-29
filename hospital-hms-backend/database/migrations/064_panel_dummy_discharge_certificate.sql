-- Panels > Billing > Discharge Certificate (owner, 2026-10-29): a separate,
-- print-only certificate in the panel format — its own details, saved for
-- reprint, never linked to the real Discharge Certificate. One per file.
-- Safe to re-run.
CREATE TABLE IF NOT EXISTS "ClinicPanelDummyDischargeCert" (
  "id" SERIAL PRIMARY KEY,
  "admissionId" INTEGER NOT NULL,
  "admissionNo" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdByName" TEXT,
  "updatedByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClinicPanelDummyDischargeCert_admissionId_key" ON "ClinicPanelDummyDischargeCert"("admissionId");
