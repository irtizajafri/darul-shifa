-- Full Slip Edit also edits Excel Patients List rows, admission receipts and
-- Antenatal (owner, 2026-11-04). Their edit history goes in the same log, so
-- each entry now says which table its record id belongs to. Existing entries
-- are all OPD slips. Safe to re-run.
ALTER TABLE "ClinicOpdVisitEditLog" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'opd';
CREATE INDEX IF NOT EXISTS "ClinicOpdVisitEditLog_source_visitId_idx" ON "ClinicOpdVisitEditLog"("source", "visitId");
