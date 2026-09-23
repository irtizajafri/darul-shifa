-- Cashier Handover print (matches the hospital's existing paper handover
-- sheet — denomination-wise cash count, Amount/Exp/Other Exp/Total summary,
-- numbered Expense Details, Takeover By signature lines):
--   denominationsJson — [{ denomination, qty, amount }] note-count entered
--     by the cashier at handover time (not derived — physical count).
--   otherExpense — manual amount for anything not already tracked as a
--     Voucher Expense draft (the existing "Exp"/Expense Details section).
--   slipCount — snapshot of how many cash slips fed totalCash, so History/
--     reprints show the same "No of Slips" the cashier saw when submitting,
--     even after later same-day slips change the live count.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ClinicHandover' AND column_name = 'otherExpense'
  ) THEN
    ALTER TABLE public."ClinicHandover" ADD COLUMN "otherExpense" DECIMAL(12,2);
    ALTER TABLE public."ClinicHandover" ADD COLUMN "denominationsJson" JSONB;
    ALTER TABLE public."ClinicHandover" ADD COLUMN "slipCount" INTEGER;
  END IF;
END $$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicHandover'
      AND column_name IN ('otherExpense','denominationsJson','slipCount');
  IF cnt <> 3 THEN RAISE EXCEPTION 'post-assertion failed: ClinicHandover print columns missing'; END IF;
END $$;

COMMIT;
