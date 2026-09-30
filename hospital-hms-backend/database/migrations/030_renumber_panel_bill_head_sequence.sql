-- Panel Billing row sequence: the legacy seed used multiples of 10 (10, 20,
-- 30, ...) to leave gaps for later insertions — staff found that confusing
-- ("why is it 10, 20 instead of 1, 2?"). Renumbers to plain 1, 2, 3, ...
-- in the SAME relative order that was already correct, using each row's
-- (unique) headCode so this is safe to re-run and matches exactly regardless
-- of id. "RMO CHARGES" lives in ClinicPanelBillHead (not ClinicBillHead) and
-- "Radiology" has no head row at all (hardcoded fallback in
-- getPanelAdmissionBilling, updated to match in the same change) — both are
-- included here so the full displayed sequence stays 1..38 with no gaps.
BEGIN;

UPDATE public."ClinicBillHead" SET "panelSortOrder" = CASE "headCode"
  WHEN '001'  THEN 1   -- Room Charges
  WHEN 'NICU' THEN 2   -- NICU/ICU/CCU
  WHEN 'MRI'  THEN 3   -- M.R.I.
  WHEN 'PT'   THEN 4   -- Photo Therapy
  WHEN 'MON'  THEN 5   -- Monitor
  WHEN 'CF'   THEN 6   -- a) Consultant Fee
  WHEN 'F'    THEN 7   -- b) Follow-up
  WHEN 'EV'   THEN 8   -- c) Emergency Visit
  -- 9 = RMO CHARGES (ClinicPanelBillHead, below)
  WHEN 'SF'   THEN 10  -- Surgeon Fee
  WHEN 'A'    THEN 11  -- Anesthesia Charges
  WHEN 'OT'   THEN 12  -- Operation Theater Charges
  WHEN 'LR'   THEN 13  -- Labor Room Charges
  WHEN 'DC'   THEN 14  -- Delivery Charges
  WHEN 'BC'   THEN 15  -- Baby Care Charges
  WHEN 'VC'   THEN 16  -- Vaccination Charges
  WHEN 'M'    THEN 17  -- Medicine
  WHEN 'L'    THEN 18  -- Laboratory
  -- 19 = Radiology (synthetic row, no ClinicBillHead)
  WHEN 'BT'   THEN 20  -- Blood Transfusion
  WHEN 'COB'  THEN 21  -- Cost of Blood
  WHEN 'IVT'  THEN 22  -- I/V Transfusion
  WHEN 'ECG'  THEN 23  -- ECG
  WHEN 'E'    THEN 24  -- Echocardiograph
  WHEN 'U'    THEN 25  -- Ultrasound
  WHEN 'X'    THEN 26  -- X-Ray
  WHEN 'OXY'  THEN 27  -- Oxygen
  WHEN 'NEB'  THEN 28  -- Nebulization/Stram
  WHEN 'P'    THEN 29  -- Physiotherapy
  WHEN 'MISC' THEN 30  -- Miscellaneous
  WHEN 'CS'   THEN 31  -- C.T. Scan
  WHEN 'MESS' THEN 32  -- Mess
  WHEN 'CF2'  THEN 33  -- a) 2nd Consultant Fee
  WHEN 'F2'   THEN 34  -- b) 2nd Cons. Follow-up
  WHEN 'EV2'  THEN 35  -- c) 2nd Cons. Emergency Visit
  WHEN 'NHK'  THEN 36  -- Nursing and House Keeping
  WHEN 'RRC'  THEN 37  -- Recovery Room Charges
  WHEN 'IC'   THEN 38  -- Implant Charges
  ELSE "panelSortOrder"
END
WHERE "headCode" IN (
  '001','NICU','MRI','PT','MON','CF','F','EV','SF','A','OT','LR','DC','BC','VC',
  'M','L','BT','COB','IVT','ECG','E','U','X','OXY','NEB','P','MISC','CS','MESS',
  'CF2','F2','EV2','NHK','RRC','IC'
);

UPDATE public."ClinicPanelBillHead" SET "panelSortOrder" = 9 WHERE description = 'RMO CHARGES';

COMMIT;
