-- Department spelling aliases (owner, 2026-11-12).
--
-- A slip's department reaches us two ways. In the new system it comes from a
-- dropdown, so ClinicOpdVisit holds 11 clean values. The Patients List Excel
-- import writes the cell's raw text with nothing but .trim(), so PatientVisit
-- holds 207 — "CONSULTANT OPD", "consultant opd", "CONSULATNT OPD",
-- "COUNSULTANT OPD" and "CONSULTANT OPO" are all the same department, and any
-- code that matched the department by name saw them as five different ones.
--
-- Two layers fix that for good:
--   1. a normalised key (case, punctuation and spacing dropped, "and" read as
--      "&") handles 44 of those spellings on its own — no row needed here;
--   2. this table carries the rest, the real typos, which no rule can derive.
--
-- Seeded below are the 21 spellings already in the data, each one letter off a
-- real department. Add a row here whenever a new misspelling shows up; nothing
-- else has to change. The sub-department and test names that the old system
-- sometimes dropped into its department column are NOT aliases and are left
-- alone.
--
-- New table only. No existing row is deleted or changed. Safe to re-run.

CREATE TABLE IF NOT EXISTS "ClinicDepartmentAlias" (
  "id"           SERIAL PRIMARY KEY,
  -- the misspelling as it appears in the data, stored verbatim
  "alias"        TEXT NOT NULL,
  "departmentId" INTEGER NOT NULL REFERENCES "ClinicDepartment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "note"         TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One alias maps to one department, matched case-insensitively so the same
-- typo in another casing can't be added twice.
CREATE UNIQUE INDEX IF NOT EXISTS "ClinicDepartmentAlias_alias_key"
  ON "ClinicDepartmentAlias"(UPPER("alias"));
CREATE INDEX IF NOT EXISTS "ClinicDepartmentAlias_departmentId_idx"
  ON "ClinicDepartmentAlias"("departmentId");

-- Seed. The department is looked up by name, so a renamed department makes its
-- row a no-op rather than pointing somewhere wrong. Re-running inserts nothing.
INSERT INTO "ClinicDepartmentAlias" ("alias", "departmentId", "note")
SELECT v.alias, d.id, 'seeded from PatientVisit, migration 069'
FROM (VALUES
  -- CONSULTANT OPD
  ('CONSULTANAT OPD',                      'CONSULTANT OPD'),
  ('CONSULATNT OPD',                       'CONSULTANT OPD'),
  ('COUNSULTANT OPD',                      'CONSULTANT OPD'),
  ('counsultant opd',                      'CONSULTANT OPD'),
  ('COSULTANT OPD',                        'CONSULTANT OPD'),
  ('CONSULTANT OPO',                       'CONSULTANT OPD'),
  -- MISCELLANEOUS
  ('MISCELLANOUS',                         'MISCELLANEOUS'),
  -- LABORATORY
  ('LABORATOTY',                           'LABORATORY'),
  -- ADMISSION
  ('ADIMISSION',                           'ADMISSION'),
  -- THERAPY
  ('THEROPY',                              'THERAPY'),
  ('THERPAY',                              'THERAPY'),
  -- ANTENATAL
  ('ANTINATAL',                            'ANTENATAL'),
  ('antinatal',                            'ANTENATAL'),
  -- EMERGENCY & CHEST PAIN CLINIC
  ('EMERGENCY & CHEASH PAIN CLINIC',       'EMERGENCY & CHEST PAIN CLINIC'),
  ('EMERGENCY & CHEAST PAIN CLINIC',       'EMERGENCY & CHEST PAIN CLINIC'),
  ('EMERGENCY & CHEST PAIN CLINC',         'EMERGENCY & CHEST PAIN CLINIC'),
  -- Ultra Sound, Echo & Color Doppler — the original row (id 14), not the
  -- near-identical one the import later created
  ('ULTRA SOUND, ECO & COLOR DOPPLER',     'Ultra Sound, Echo & Color Doppler'),
  ('ULTRA SOUND , EHO & COLOR DOPPLER',    'Ultra Sound, Echo & Color Doppler'),
  ('ULTRA SOUBD , ECHO & COLOR DOPPLER',   'Ultra Sound, Echo & Color Doppler'),
  ('ULTRA SOUND , ECHO AND COLOR DUPPLER', 'Ultra Sound, Echo & Color Doppler'),
  ('ULTRASOUND , ECHO AND colour Doppler', 'Ultra Sound, Echo & Color Doppler')
) AS v(alias, dept_name)
JOIN "ClinicDepartment" d ON d.name = v.dept_name
ON CONFLICT DO NOTHING;
