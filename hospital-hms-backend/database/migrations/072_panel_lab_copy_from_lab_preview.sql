-- Read-only preview for 072_panel_lab_copy_from_lab.sql. Changes nothing.
-- Shows what the copy would add to Lab Billing's own setup: one row per
-- Laboratories test not yet set up in Lab Billing, with its line count.
-- Needs 071 run first. If the Laboratories tables don't exist, nothing to copy.

SELECT
  sd."id"                 AS "subDeptId",
  sd."name"               AS "test",
  lt."sampleType",
  COUNT(lp."id")          AS "lines",
  CASE WHEN EXISTS (SELECT 1 FROM "PanelLabTest" pt WHERE pt."subDeptId" = lt."subDeptId")
       THEN 'already in Lab Billing (skipped)' ELSE 'will copy' END AS "action"
FROM "LabTest" lt
JOIN "ClinicSubDepartment" sd ON sd."id" = lt."subDeptId"
LEFT JOIN "LabParameter" lp ON lp."labTestId" = lt."id" AND lp."isActive"
GROUP BY sd."id", sd."name", lt."sampleType", lt."subDeptId"
ORDER BY "action" DESC, sd."name";

SELECT
  COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "PanelLabTest" pt WHERE pt."subDeptId" = lt."subDeptId")) AS "tests to copy",
  COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "PanelLabTest" pt WHERE pt."subDeptId" = lt."subDeptId"))     AS "tests skipped",
  (SELECT COUNT(*) FROM "LabParameter" lp JOIN "LabTest" t ON t."id" = lp."labTestId"
    WHERE lp."isActive" AND NOT EXISTS (SELECT 1 FROM "PanelLabTest" pt WHERE pt."subDeptId" = t."subDeptId")) AS "lines to copy"
FROM "LabTest" lt;
