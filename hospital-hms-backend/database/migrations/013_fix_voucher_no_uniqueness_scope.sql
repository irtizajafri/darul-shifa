-- Found while testing the new Slip/Admission Refund auto-voucher feature:
-- generateVoucherNo() (accounts.service.js) computes the next sequence
-- number SCOPED per entityType ("VE-20260911-001" can legitimately exist
-- once for 'corporate' AND once for 'non-corporate' on the same day) — but
-- AccVoucherExpense.voucherNo / AccVoucherIncome.voucherNo were a bare
-- GLOBAL unique column, so the second book to reach the same sequence
-- number on the same day would fail with a unique-constraint error. Swap
-- the bare unique for a composite one on (voucherNo, entityType), matching
-- what the generation logic already assumes. No code does a bare
-- findUnique/findFirst on voucherNo alone (checked), so this is safe.
BEGIN;

-- The old bare-unique enforcement turned out to be a plain UNIQUE INDEX
-- (not wrapped in a named CONSTRAINT) on this DB, not a constraint — so
-- DROP CONSTRAINT alone (tried first below) silently has nothing to drop.
-- Cover both possible shapes: drop it as a constraint if it exists as one,
-- then drop the index directly either way (DROP INDEX on a constraint's
-- backing index is a no-op once the constraint's already gone).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccVoucherExpense_voucherNo_key'
  ) THEN
    ALTER TABLE public."AccVoucherExpense" DROP CONSTRAINT "AccVoucherExpense_voucherNo_key";
  END IF;
END $$;
DROP INDEX IF EXISTS "AccVoucherExpense_voucherNo_key";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccVoucherExpense_voucherNo_entityType_key'
  ) THEN
    ALTER TABLE public."AccVoucherExpense" ADD CONSTRAINT "AccVoucherExpense_voucherNo_entityType_key" UNIQUE ("voucherNo", "entityType");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccVoucherIncome_voucherNo_key'
  ) THEN
    ALTER TABLE public."AccVoucherIncome" DROP CONSTRAINT "AccVoucherIncome_voucherNo_key";
  END IF;
END $$;
DROP INDEX IF EXISTS "AccVoucherIncome_voucherNo_key";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccVoucherIncome_voucherNo_entityType_key'
  ) THEN
    ALTER TABLE public."AccVoucherIncome" ADD CONSTRAINT "AccVoucherIncome_voucherNo_entityType_key" UNIQUE ("voucherNo", "entityType");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccVoucherExpense_voucherNo_entityType_key') THEN
    RAISE EXCEPTION 'AccVoucherExpense composite unique missing after migration';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccVoucherExpense_voucherNo_key') THEN
    RAISE EXCEPTION 'AccVoucherExpense old bare unique still present after migration';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccVoucherIncome_voucherNo_entityType_key') THEN
    RAISE EXCEPTION 'AccVoucherIncome composite unique missing after migration';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AccVoucherIncome_voucherNo_key') THEN
    RAISE EXCEPTION 'AccVoucherIncome old bare unique still present after migration';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'AccVoucherExpense_voucherNo_key') THEN
    RAISE EXCEPTION 'AccVoucherExpense old bare unique index still present after migration';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'AccVoucherIncome_voucherNo_key') THEN
    RAISE EXCEPTION 'AccVoucherIncome old bare unique index still present after migration';
  END IF;
END $$;

COMMIT;
