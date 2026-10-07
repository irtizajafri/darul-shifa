-- Superadmin "Full Slip Edit" (Clinic > Parameters) — one row per save,
-- with a before/after snapshot of the slip and the warnings that were shown
-- (doctor fee already paid, day closed, cash handed over, admission/panel
-- bill, cancelled). No FK on purpose (same convention as
-- ClinicAdmissionStatusLog): the log must survive even if the visit changes.

CREATE TABLE IF NOT EXISTS "ClinicOpdVisitEditLog" (
  "id"           SERIAL PRIMARY KEY,
  "visitId"      INTEGER NOT NULL,
  "serialNo"     TEXT,
  "patientName"  TEXT,
  "editedBy"     TEXT,
  "warnings"     JSONB,
  "before"       JSONB NOT NULL,
  "after"        JSONB NOT NULL,
  "editedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ClinicOpdVisitEditLog_visitId_idx" ON "ClinicOpdVisitEditLog" ("visitId");
