-- Un-Presented Cheque List — a cheque-mode Voucher Expense entry is
-- "Un-Presented" until its Bank Statement debit line has been matched to
-- it. matchedStatementLineId is that match (null = still un-presented).
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AccVoucherExpenseEntry' AND column_name = 'matchedStatementLineId'
  ) THEN
    ALTER TABLE public."AccVoucherExpenseEntry"
      ADD COLUMN "matchedStatementLineId" INTEGER REFERENCES public."AccBankStatementLine"(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "AccVoucherExpenseEntry_matchedStatementLineId_idx"
  ON public."AccVoucherExpenseEntry"("matchedStatementLineId");

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AccVoucherExpenseEntry' AND column_name = 'matchedStatementLineId';
  IF cnt <> 1 THEN RAISE EXCEPTION 'post-assertion failed: AccVoucherExpenseEntry.matchedStatementLineId missing'; END IF;
END $$;

COMMIT;
