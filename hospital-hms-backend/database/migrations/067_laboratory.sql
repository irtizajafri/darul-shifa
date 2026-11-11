-- Laboratories module (owner, 2026-11-11).
--   LabCategory        Haematology, Biochemistry, …
--   LabTest            a Clinic LABORATORY sub-department placed in a category
--                      (the "sub category"; the test list stays Clinic's own)
--   LabParameter       a test's report rows, in order: a test line (result
--                      typed in Result Entry, with unit and a free-text
--                      reference range), a heading, or a fixed note
--   LabResult          one per test line on a Clinic lab slip
--   LabResultValue     the report rows as they were when saved — the setup's
--                      text copied in with the typed values, so later setup
--                      edits don't change an old report
--   LabResultLog       before/after of every edit to a saved result
-- New tables only; nothing existing changes. Safe to re-run.

CREATE TABLE IF NOT EXISTS "LabCategory" (
  "id"        SERIAL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LabCategory_name_key" ON "LabCategory"("name");

CREATE TABLE IF NOT EXISTS "LabTest" (
  "id"         SERIAL PRIMARY KEY,
  "subDeptId"  INTEGER NOT NULL REFERENCES "ClinicSubDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "categoryId" INTEGER NOT NULL REFERENCES "LabCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "sampleType" TEXT,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LabTest_subDeptId_key" ON "LabTest"("subDeptId");
CREATE INDEX IF NOT EXISTS "LabTest_categoryId_idx" ON "LabTest"("categoryId");

CREATE TABLE IF NOT EXISTS "LabParameter" (
  "id"         SERIAL PRIMARY KEY,
  "labTestId"  INTEGER NOT NULL REFERENCES "LabTest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  -- 'param' (result from Result Entry) | 'heading' | 'note' (fixed text)
  "kind"           TEXT NOT NULL DEFAULT 'param',
  "name"           TEXT NOT NULL,
  "unit"           TEXT,
  -- Printed as typed, e.g. "13.0-17.0" or "Male: 13-17" / "Female: 12-15"
  -- on separate lines; a plain range like these also drives the H/L flag.
  "referenceRange" TEXT,
  "noteText"       TEXT,
  "resultType"     TEXT NOT NULL DEFAULT 'number',
  "options"        TEXT[] NOT NULL DEFAULT '{}',
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "LabParameter_labTestId_idx" ON "LabParameter"("labTestId");

CREATE TABLE IF NOT EXISTS "LabResult" (
  "id"              SERIAL PRIMARY KEY,
  "visitId"         INTEGER NOT NULL REFERENCES "ClinicOpdVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  -- ClinicOpdVisitDoctor.id, no FK: Full Slip Edit can delete that row and
  -- the result must survive it.
  "visitDoctorId"   INTEGER NOT NULL,
  "subDeptId"       INTEGER,
  "testName"        TEXT NOT NULL,
  "remarks"         TEXT,
  "status"          TEXT NOT NULL DEFAULT 'done',
  "enteredByUserId" TEXT,
  "enteredByName"   TEXT,
  "enteredAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByName"   TEXT,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "printCount"      INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "LabResult_visitDoctorId_key" ON "LabResult"("visitDoctorId");
CREATE INDEX IF NOT EXISTS "LabResult_visitId_idx" ON "LabResult"("visitId");

CREATE TABLE IF NOT EXISTS "LabResultValue" (
  "id"            SERIAL PRIMARY KEY,
  "resultId"      INTEGER NOT NULL REFERENCES "LabResult"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "parameterId"    INTEGER REFERENCES "LabParameter"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "kind"           TEXT NOT NULL DEFAULT 'param',
  "parameterName"  TEXT NOT NULL,
  "unit"           TEXT,
  "referenceRange" TEXT,
  "noteText"       TEXT,
  "value"          TEXT,
  "flag"          TEXT NOT NULL DEFAULT '',
  "sortOrder"     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "LabResultValue_resultId_idx" ON "LabResultValue"("resultId");

CREATE TABLE IF NOT EXISTS "LabResultLog" (
  "id"            SERIAL PRIMARY KEY,
  "resultId"      INTEGER NOT NULL REFERENCES "LabResult"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "changedByName" TEXT,
  "changedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "before"        JSONB,
  "after"         JSONB
);
CREATE INDEX IF NOT EXISTS "LabResultLog_resultId_idx" ON "LabResultLog"("resultId");
