-- Slip Adjustment (personal info / amount / doctor edits) didn't leave any
-- trace on the slip itself — Patient List had no way to show that a slip was
-- touched by this screen. Display-only marker: stamped whenever Slip
-- Adjustment saves a change, read back by Patient List's Type column
-- ("Cash/Adj" instead of "Cash") — never used for filtering/money logic.
ALTER TABLE "ClinicOpdVisit" ADD COLUMN IF NOT EXISTS "adjustedAt" TIMESTAMP;
ALTER TABLE "PatientVisit"   ADD COLUMN IF NOT EXISTS "adjustedAt" TIMESTAMP;
