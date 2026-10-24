-- Panel Billing row sequence, set by Bill Head NAME (2026-10-24).
--
-- Why: the sequence is correct on the dev PC but wrong on the server PC.
-- Panel Billing orders its rows by each head's description, but migration
-- 030 renumbered the heads by headCode ('001', 'M', 'L', ...) — a server
-- whose heads carry different codes (or that never ran 011/030) kept the
-- old/empty numbers. This sets the exact dev-PC sequence by description,
-- adds any head that is missing, and clears stray numbers on other heads.
-- Safe to re-run.
BEGIN;

ALTER TABLE public."ClinicBillHead"      ADD COLUMN IF NOT EXISTS "panelSortOrder" INTEGER;
ALTER TABLE public."ClinicPanelBillHead" ADD COLUMN IF NOT EXISTS "panelSortOrder" INTEGER;

-- Legacy labels (as migration 011) — only when the new name isn't there yet,
-- so a PC that never ran 011 doesn't end up with a duplicate head.
UPDATE public."ClinicBillHead" SET description = 'a) Consultant Fee'
WHERE description = 'Const Fee' AND NOT EXISTS (SELECT 1 FROM public."ClinicBillHead" WHERE description = 'a) Consultant Fee');
UPDATE public."ClinicBillHead" SET description = 'b) Follow-up'
WHERE description = 'Follow-up' AND NOT EXISTS (SELECT 1 FROM public."ClinicBillHead" WHERE description = 'b) Follow-up');
UPDATE public."ClinicBillHead" SET description = 'Anesthesia Charges'
WHERE description = 'Anesthesia' AND NOT EXISTS (SELECT 1 FROM public."ClinicBillHead" WHERE description = 'Anesthesia Charges');

CREATE TEMP TABLE _panel_seq (sort INTEGER, head_code TEXT, description TEXT) ON COMMIT DROP;
INSERT INTO _panel_seq (sort, head_code, description) VALUES
  ( 1, '001'  , 'Room Charges'),
  ( 2, 'NICU' , 'NICU/ICU/CCU'),
  ( 3, 'MRI'  , 'M.R.I.'),
  ( 4, 'PT'   , 'Photo Therapy'),
  ( 5, 'MON'  , 'Monitor'),
  ( 6, 'CF'   , 'a) Consultant Fee'),
  ( 7, 'F'    , 'b) Follow-up'),
  ( 8, 'EV'   , 'c) Emergency Visit'),
  (10, 'SF'   , 'Surgeon Fee'),
  (11, 'A'    , 'Anesthesia Charges'),
  (12, 'OT'   , 'Operation Theater Charges'),
  (13, 'LR'   , 'Labor Room Charges'),
  (14, 'DC'   , 'Delivery Charges'),
  (15, 'BC'   , 'Baby Care Charges'),
  (16, 'VC'   , 'Vaccination Charges'),
  (17, 'M'    , 'Medicine'),
  (18, 'L'    , 'Laboratory'),
  (20, 'BT'   , 'Blood Transfusion'),
  (21, 'COB'  , 'Cost of Blood'),
  (22, 'IVT'  , 'I/V Transfusion'),
  (23, 'ECG'  , 'ECG'),
  (24, 'E'    , 'Echocardiograph'),
  (25, 'U'    , 'Ultrasound'),
  (26, 'X'    , 'X-Ray'),
  (27, 'OXY'  , 'Oxygen'),
  (28, 'NEB'  , 'Nebulization/Stram'),
  (29, 'P'    , 'Physiotherapy'),
  (30, 'MISC' , 'Miscellaneous'),
  (31, 'CS'   , 'C.T. Scan'),
  (32, 'MESS' , 'Mess'),
  (33, 'CF2'  , 'a) 2nd Consultant Fee'),
  (34, 'F2'   , 'b) 2nd Cons. Follow-up'),
  (35, 'EV2'  , 'c) 2nd Cons. Emergency Visit'),
  (36, 'NHK'  , 'Nursing and House Keeping'),
  (37, 'RRC'  , 'Recovery Room Charges'),
  (38, 'IC'   , 'Implant Charges');

-- Heads not in the sequence get no number (they show after it, in add order).
UPDATE public."ClinicBillHead" b SET "panelSortOrder" = NULL
WHERE b."panelSortOrder" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM _panel_seq s WHERE s.description = b.description);

UPDATE public."ClinicBillHead" b SET "panelSortOrder" = s.sort
FROM _panel_seq s WHERE s.description = b.description;

-- A head missing on this PC is created (its code only if still free).
INSERT INTO public."ClinicBillHead" ("headCode", description, type, status, "panelSortOrder", "updatedAt")
SELECT CASE WHEN EXISTS (SELECT 1 FROM public."ClinicBillHead" x WHERE x."headCode" = s.head_code)
            THEN 'PB' || s.sort ELSE s.head_code END,
       s.description, 'both', 'active', s.sort, CURRENT_TIMESTAMP
FROM _panel_seq s
WHERE NOT EXISTS (SELECT 1 FROM public."ClinicBillHead" b WHERE b.description = s.description);

-- 9 = RMO CHARGES (Panel Bill Head); 19 = Radiology / Ultra Sound, Echo &
-- Color Doppler are fixed in code (getPanelAdmissionBilling).
UPDATE public."ClinicPanelBillHead" SET "panelSortOrder" = 9 WHERE description = 'RMO CHARGES';

DO $$
DECLARE v_set INTEGER;
BEGIN
  SELECT COUNT(DISTINCT b.description) INTO v_set
  FROM public."ClinicBillHead" b JOIN _panel_seq s ON s.description = b.description AND b."panelSortOrder" = s.sort;
  IF v_set <> (SELECT COUNT(*) FROM _panel_seq) THEN
    RAISE EXCEPTION 'Panel sequence: only % of % heads set', v_set, (SELECT COUNT(*) FROM _panel_seq);
  END IF;
END $$;

COMMIT;
