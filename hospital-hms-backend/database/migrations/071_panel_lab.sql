-- Lab Billing (Panels), owner 2026-11-12. Lab reports for panel patients,
-- kept fully apart from the Laboratories module (067): its own test setup and
-- its own results. Nothing here reads or writes the Lab* tables, and the
-- Laboratories module never reads these.
--   PanelLabTest         a Clinic LABORATORY sub-department set up for Lab Billing
--   PanelLabParameter    that test's report rows (test line / heading / note)
--   PanelLabResult       one per report line: a Laboratory item on a Panels →
--                        Billing bill (Admission # or Slip #), or a test on a
--                        panel Laboratory slip
--   PanelLabResultValue  the report rows as saved, with the typed values
--   PanelLabResultLog    before/after of every edit to a saved result
-- No foreign keys to Clinic or Billing tables: a bill row or slip test can be
-- edited or removed there without touching a saved report.
-- New tables only; nothing existing changes. Safe to re-run.

CREATE TABLE IF NOT EXISTS "PanelLabTest" (
  "id"         SERIAL PRIMARY KEY,
  -- ClinicSubDepartment.id of a LABORATORY test (plain number, no FK)
  "subDeptId"  INTEGER NOT NULL,
  "sampleType" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PanelLabTest_subDeptId_key" ON "PanelLabTest"("subDeptId");

CREATE TABLE IF NOT EXISTS "PanelLabParameter" (
  "id"             SERIAL PRIMARY KEY,
  "testId"         INTEGER NOT NULL REFERENCES "PanelLabTest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  -- 'param' (result typed in Lab Billing) | 'heading' | 'note' (fixed text)
  "kind"           TEXT NOT NULL DEFAULT 'param',
  "name"           TEXT NOT NULL,
  "unit"           TEXT,
  "referenceRange" TEXT,
  "noteText"       TEXT,
  "resultType"     TEXT NOT NULL DEFAULT 'number',
  "options"        TEXT[] NOT NULL DEFAULT '{}',
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PanelLabParameter_testId_idx" ON "PanelLabParameter"("testId");

CREATE TABLE IF NOT EXISTS "PanelLabResult" (
  "id"              SERIAL PRIMARY KEY,
  -- 'adm-item:<ClinicPanelBillingItem.id>' | 'opd-item:<ClinicPanelOpdBillingItem.id>'
  -- | 'slip-line:<ClinicOpdVisitDoctor.id>'
  "lineKey"         TEXT NOT NULL,
  -- the report it belongs to: 'adm-<admissionId>-<YYYYMMDD>',
  -- 'opd-<opdVisitId>-<YYYYMMDD>' or 'slip-<ClinicOpdVisit.id>'
  "entryKey"        TEXT NOT NULL,
  "sourceType"      TEXT NOT NULL,
  "sourceId"        INTEGER NOT NULL,
  -- slip tests only: the slip, so a test re-made by Full Slip Edit finds its
  -- result again by (visitId, subDeptId)
  "visitId"         INTEGER,
  "subDeptId"       INTEGER,
  "testName"        TEXT NOT NULL,
  "sampleDate"      TIMESTAMP(3),
  "remarks"         TEXT,
  "status"          TEXT NOT NULL DEFAULT 'done',
  "enteredByUserId" TEXT,
  "enteredByName"   TEXT,
  "enteredAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByName"   TEXT,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "printCount"      INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "PanelLabResult_lineKey_key" ON "PanelLabResult"("lineKey");
CREATE INDEX IF NOT EXISTS "PanelLabResult_entryKey_idx" ON "PanelLabResult"("entryKey");
CREATE INDEX IF NOT EXISTS "PanelLabResult_visitId_idx" ON "PanelLabResult"("visitId");

CREATE TABLE IF NOT EXISTS "PanelLabResultValue" (
  "id"             SERIAL PRIMARY KEY,
  "resultId"       INTEGER NOT NULL REFERENCES "PanelLabResult"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "parameterId"    INTEGER REFERENCES "PanelLabParameter"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "kind"           TEXT NOT NULL DEFAULT 'param',
  "parameterName"  TEXT NOT NULL,
  "unit"           TEXT,
  "referenceRange" TEXT,
  "noteText"       TEXT,
  "value"          TEXT,
  "flag"           TEXT NOT NULL DEFAULT '',
  "sortOrder"      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "PanelLabResultValue_resultId_idx" ON "PanelLabResultValue"("resultId");

CREATE TABLE IF NOT EXISTS "PanelLabResultLog" (
  "id"            SERIAL PRIMARY KEY,
  "resultId"      INTEGER NOT NULL REFERENCES "PanelLabResult"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "changedByName" TEXT,
  "changedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "before"        JSONB,
  "after"         JSONB
);
CREATE INDEX IF NOT EXISTS "PanelLabResultLog_resultId_idx" ON "PanelLabResultLog"("resultId");
