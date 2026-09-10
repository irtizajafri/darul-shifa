-- Canonical Bill Head sequence for the Panel Billing screen — matches the
-- legacy system's fixed 37-row Sno order exactly (user-provided screenshot).
-- Adds a dedicated "panelSortOrder" column (distinct from the existing
-- discountSeq, which drives discount computation order, not display order)
-- to both ClinicBillHead and ClinicPanelBillHead, backfills it for every
-- existing head that has a legacy counterpart, renames 3 heads to their
-- legacy label (Const Fee -> "a) Consultant Fee", Follow-up -> "b)
-- Follow-up", Anesthesia -> "Anesthesia Charges"), and inserts the ~23
-- heads that don't exist in the system yet. Values use gaps of 10 so
-- anything can be slotted in later without a renumber.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicBillHead' AND column_name='panelSortOrder'
  ) THEN
    ALTER TABLE public."ClinicBillHead" ADD COLUMN "panelSortOrder" INTEGER;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicPanelBillHead' AND column_name='panelSortOrder'
  ) THEN
    ALTER TABLE public."ClinicPanelBillHead" ADD COLUMN "panelSortOrder" INTEGER;
  END IF;
END $$;

-- Rename the 3 heads whose current description differs from the legacy
-- label — guarded so a re-run (already renamed) is a no-op, never a
-- duplicate rename or an error.
UPDATE public."ClinicBillHead" SET description = 'a) Consultant Fee' WHERE description = 'Const Fee';
UPDATE public."ClinicBillHead" SET description = 'b) Follow-up'      WHERE description = 'Follow-up';
UPDATE public."ClinicBillHead" SET description = 'Anesthesia Charges' WHERE description = 'Anesthesia';

-- Backfill panelSortOrder on every existing head that has a legacy slot.
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 10  WHERE description = 'Room Charges';
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 60  WHERE description = 'a) Consultant Fee';
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 70  WHERE description = 'b) Follow-up';
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 100 WHERE description = 'Surgeon Fee';
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 110 WHERE description = 'Anesthesia Charges';
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 170 WHERE description = 'Medicine';
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 180 WHERE description = 'Laboratory';
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 200 WHERE description = 'Cost of Blood';
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 230 WHERE description = 'Echocardiograph';
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 240 WHERE description = 'Ultrasound';
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 250 WHERE description = 'X-Ray';
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 280 WHERE description = 'Physiotherapy';
UPDATE public."ClinicBillHead" SET "panelSortOrder" = 300 WHERE description = 'C.T. Scan';

UPDATE public."ClinicPanelBillHead" SET "panelSortOrder" = 90 WHERE description = 'RMO CHARGES';

-- Insert the ~23 heads that don't exist anywhere in the system yet — each
-- find-or-create by description so re-running this migration is a no-op.
INSERT INTO public."ClinicBillHead" ("headCode", description, type, status, "panelSortOrder", "updatedAt")
SELECT v."headCode", v.description, 'both', 'active', v."panelSortOrder", CURRENT_TIMESTAMP
FROM (VALUES
  ('NICU',  'NICU/ICU/CCU',                20),
  ('MRI',   'M.R.I.',                      30),
  ('PT',    'Photo Therapy',               40),
  ('MON',   'Monitor',                     50),
  ('EV',    'c) Emergency Visit',          80),
  ('OT',    'Operation Theater Charges',   120),
  ('LR',    'Labor Room Charges',          130),
  ('DC',    'Delivery Charges',            140),
  ('BC',    'Baby Care Charges',           150),
  ('VC',    'Vaccination Charges',         160),
  ('BT',    'Blood Transfusion',           190),
  ('IVT',   'I/V Transfusion',             210),
  ('ECG',   'ECG',                         220),
  ('OXY',   'Oxygen',                      260),
  ('NEB',   'Nebulization/Stram',          270),
  ('MISC',  'Miscellaneous',               290),
  ('MESS',  'Mess',                        310),
  ('CF2',   'a) 2nd Consultant Fee',       320),
  ('F2',    'b) 2nd Cons. Follow-up',      330),
  ('EV2',   'c) 2nd Cons. Emergency Visit',340),
  ('NHK',   'Nursing and House Keeping',   350),
  ('RRC',   'Recovery Room Charges',       360),
  ('IC',    'Implant Charges',             370)
) AS v("headCode", description, "panelSortOrder")
WHERE NOT EXISTS (SELECT 1 FROM public."ClinicBillHead" b WHERE b.description = v.description);

DO $$
DECLARE
  v_missing_cols INTEGER;
  v_new_heads INTEGER;
  v_renamed INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_missing_cols FROM information_schema.columns
  WHERE table_schema='public' AND column_name='panelSortOrder'
    AND table_name IN ('ClinicBillHead', 'ClinicPanelBillHead');
  IF v_missing_cols <> 2 THEN
    RAISE EXCEPTION 'panelSortOrder column missing on one of the two tables';
  END IF;

  SELECT COUNT(*) INTO v_new_heads FROM public."ClinicBillHead" WHERE "panelSortOrder" IS NOT NULL;
  IF v_new_heads < 23 THEN
    RAISE EXCEPTION 'expected at least 23 ClinicBillHead rows with panelSortOrder set, found %', v_new_heads;
  END IF;

  SELECT COUNT(*) INTO v_renamed FROM public."ClinicBillHead"
  WHERE description IN ('a) Consultant Fee', 'b) Follow-up', 'Anesthesia Charges');
  IF v_renamed <> 3 THEN
    RAISE EXCEPTION 'expected 3 renamed heads, found %', v_renamed;
  END IF;

  IF (SELECT "panelSortOrder" FROM public."ClinicPanelBillHead" WHERE description = 'RMO CHARGES') IS DISTINCT FROM 90 THEN
    RAISE EXCEPTION 'RMO CHARGES panelSortOrder not set';
  END IF;
END $$;

COMMIT;
