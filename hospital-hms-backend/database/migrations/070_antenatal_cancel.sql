-- Antenatal registration slips can be cancelled from Clinic → Cancel Slip,
-- like OPD slips (owner, 2026-11-12). Same columns as ClinicOpdVisit's cancel.
-- Existing registrations stay 'active'. Safe to re-run.
ALTER TABLE "ClinicAntenatal" ADD COLUMN IF NOT EXISTS "status"       TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "ClinicAntenatal" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "ClinicAntenatal" ADD COLUMN IF NOT EXISTS "cancelNote"   TEXT;
ALTER TABLE "ClinicAntenatal" ADD COLUMN IF NOT EXISTS "cancelledAt"  TIMESTAMP(3);
ALTER TABLE "ClinicAntenatal" ADD COLUMN IF NOT EXISTS "cancelledBy"  TEXT;
