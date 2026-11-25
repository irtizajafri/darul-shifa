-- 083: Auto Slip # and Admission # (owner, 2026-11-24).
-- The old software is stopped, so the HMS gives the numbers itself:
--   - ClinicNumberCounter: one row per series ('slip' = the shared Slip #
--     series of OPD / Emergency / Ambulance / Antenatal / admission advance /
--     admission receipts; 'admission' = Admission #). nextValue is the next
--     number to give. The row is locked (SELECT ... FOR UPDATE) while a number
--     is taken, so two PCs saving at the same moment never get the same one.
--   - Every shift, at its first slip / admission, some numbers among the
--     shift's first few are kept aside (reservePerShift among the next
--     reserveWindow: slip 4 of 12, admission 2 of 6). The counter skips them.
--     Only the Super Admin uses them, any time (back-dated slips). Kept-aside
--     numbers the counter never reached are given back when the next shift
--     starts.
--   - ClinicReservedNumber: the kept-aside numbers, and who used each one,
--     when, and for what.
-- New tables only; the starting numbers are inserted only if the row isn't
-- there yet. Safe to re-run.

-- Preview (run first — the starting numbers must be above every number used):
--   SELECT MAX("serialNo"::bigint) FROM "ClinicOpdVisit" WHERE "serialNo" ~ '^[0-9]{1,15}$';
--   SELECT MAX("serialNo") FROM "PatientVisit";
--   SELECT MAX("admissionNo"::bigint) FROM "ClinicAdmission" WHERE "admissionNo" ~ '^[0-9]{1,15}$';
--   SELECT MAX("admitNo") FROM "PatientVisit";

CREATE TABLE IF NOT EXISTS "ClinicNumberCounter" (
  "kind"            TEXT PRIMARY KEY,                     -- slip | admission
  "nextValue"       INTEGER NOT NULL,
  "reservePerShift" INTEGER NOT NULL DEFAULT 0,
  "reserveWindow"   INTEGER NOT NULL DEFAULT 0,
  "lastShiftKey"    TEXT,                                 -- "YYYY-MM-DD#shiftId" of the shift whose numbers were last kept aside
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByName"   TEXT
);

INSERT INTO "ClinicNumberCounter" ("kind", "nextValue", "reservePerShift", "reserveWindow")
VALUES ('slip', 2888578, 4, 12), ('admission', 180372, 2, 6)   -- starting numbers (owner, 2026-11-25)
ON CONFLICT ("kind") DO NOTHING;

CREATE TABLE IF NOT EXISTS "ClinicReservedNumber" (
  "id"         SERIAL PRIMARY KEY,
  "kind"       TEXT NOT NULL,                             -- slip | admission
  "number"     INTEGER NOT NULL,
  "shiftDate"  TEXT NOT NULL,                             -- YYYY-MM-DD the shift started on
  "shiftId"    INTEGER,
  "shiftName"  TEXT,
  "status"     TEXT NOT NULL DEFAULT 'free',              -- free | used
  "usedAt"     TIMESTAMP(3),
  "usedByName" TEXT,
  "usedFor"    TEXT,                                      -- e.g. "OPD slip — Ali Khan"
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClinicReservedNumber_kind_number_key" ON "ClinicReservedNumber"("kind", "number");
CREATE INDEX IF NOT EXISTS "ClinicReservedNumber_kind_status_idx" ON "ClinicReservedNumber"("kind", "status");

-- Receive Balance against Slip (owner, 2026-11-24): a balance received later
-- gets its own Slip # from the same series. Older balance receipts keep none.
ALTER TABLE "ClinicOpdBalancePayment" ADD COLUMN IF NOT EXISTS "serialNo" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ClinicOpdBalancePayment_serialNo_key" ON "ClinicOpdBalancePayment"("serialNo");
