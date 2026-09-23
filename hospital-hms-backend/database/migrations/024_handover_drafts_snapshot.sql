-- Cashier Handover — persist the itemized Expense Details (Voucher Expense
-- drafts) list alongside draftPaymentsTotal, so History reprints can show
-- the same numbered payee/amount list the original submit-time print did,
-- not just the summed total.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ClinicHandover' AND column_name = 'draftsJson'
  ) THEN
    ALTER TABLE public."ClinicHandover" ADD COLUMN "draftsJson" JSONB;
  END IF;
END $$;

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ClinicHandover' AND column_name='draftsJson';
  IF cnt <> 1 THEN RAISE EXCEPTION 'post-assertion failed: ClinicHandover.draftsJson missing'; END IF;
END $$;

COMMIT;
