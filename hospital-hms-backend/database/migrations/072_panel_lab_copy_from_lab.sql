-- Lab Billing (Panels): one-time copy of the Laboratories test setup into Lab
-- Billing's own tables (071), so the tests don't have to be typed again.
-- After this the two setups are separate: an edit in one never changes the
-- other. Copies only tests Lab Billing doesn't have yet, so re-running adds
-- nothing. Does nothing if the Laboratories tables (067) don't exist.
-- Run 072_panel_lab_copy_from_lab_preview.sql first.

DO $$
DECLARE
  t RECORD;
  new_id INTEGER;
BEGIN
  IF to_regclass('"LabTest"') IS NULL OR to_regclass('"LabParameter"') IS NULL THEN
    RAISE NOTICE 'Laboratories tables not found; nothing copied';
    RETURN;
  END IF;

  FOR t IN
    SELECT lt."id", lt."subDeptId", lt."sampleType"
    FROM "LabTest" lt
    WHERE NOT EXISTS (SELECT 1 FROM "PanelLabTest" pt WHERE pt."subDeptId" = lt."subDeptId")
    ORDER BY lt."id"
  LOOP
    INSERT INTO "PanelLabTest" ("subDeptId", "sampleType")
    VALUES (t."subDeptId", t."sampleType")
    RETURNING "id" INTO new_id;

    INSERT INTO "PanelLabParameter"
      ("testId", "kind", "name", "unit", "referenceRange", "noteText", "resultType", "options", "sortOrder", "isActive")
    SELECT new_id, lp."kind", lp."name", lp."unit", lp."referenceRange", lp."noteText", lp."resultType", lp."options",
           lp."sortOrder", lp."isActive"
    FROM "LabParameter" lp
    WHERE lp."labTestId" = t."id" AND lp."isActive"
    ORDER BY lp."sortOrder", lp."id";
  END LOOP;
END $$;
