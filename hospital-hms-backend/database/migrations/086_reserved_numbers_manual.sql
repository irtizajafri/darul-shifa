-- 086: Reserved numbers kept aside by hand (owner, 2026-11-26).
-- The old (legacy) software still makes the slips first and skips its own
-- numbers one by one during a shift. Users with Clinic → Transactions
-- "Reserved Numbers — reserve" type such a number in the HMS and it is kept
-- aside at once; "— use" lets a user save a slip with it.
--   - source: 'shift' (picked by the HMS at a shift's start) | 'manual'
--   - reservedByName: who typed it (manual)
-- The HMS's own per-shift picks are switched off (the old software decides
-- which numbers to skip), and the HMS's own picks the counter hasn't reached
-- yet are given back so the counter doesn't skip numbers the old software
-- uses. Picks already passed stay for the Super Admin. Safe to re-run.

-- Preview (run first):
--   SELECT kind, "nextValue", "reservePerShift", "reserveWindow" FROM "ClinicNumberCounter";
--   SELECT r.kind, r.number, r."shiftName" FROM "ClinicReservedNumber" r
--     JOIN "ClinicNumberCounter" c ON c.kind = r.kind
--     WHERE r.status = 'free' AND r.number >= c."nextValue";

ALTER TABLE "ClinicReservedNumber" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'shift';
ALTER TABLE "ClinicReservedNumber" ADD COLUMN IF NOT EXISTS "reservedByName" TEXT;

UPDATE "ClinicNumberCounter" SET "reservePerShift" = 0, "updatedAt" = CURRENT_TIMESTAMP, "updatedByName" = 'Migration 086 — old software reserves'
WHERE "reservePerShift" <> 0;

DELETE FROM "ClinicReservedNumber" r
USING "ClinicNumberCounter" c
WHERE c.kind = r.kind AND r.status = 'free' AND r.source = 'shift' AND r.number >= c."nextValue";
