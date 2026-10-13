-- Admission Form (2026-10-13): the form shows who generated the admission,
-- not whoever happens to print/reprint it. Stamped once in createAdmission
-- from the logged-in user. Admissions saved before this have no name.

ALTER TABLE "ClinicAdmission" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "ClinicAdmission" ADD COLUMN IF NOT EXISTS "createdByName" TEXT;
