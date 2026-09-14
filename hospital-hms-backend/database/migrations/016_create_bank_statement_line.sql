-- Upload Bank Statement — stores the bank's own statement rows (Date, Value
-- Date, Instrument No., Particulars, Debit, Credit, Balance) exactly as
-- exported from online banking, per Bank Account. Feeds Bank Reconciliation
-- Statement later; for now this migration only lays down storage for the
-- upload step itself.
BEGIN;

CREATE TABLE IF NOT EXISTS public."AccBankStatementLine" (
  id              SERIAL PRIMARY KEY,
  "bankAccountId" INTEGER NOT NULL REFERENCES public."AccBankAccount"(id),
  date            TIMESTAMP(3) NOT NULL,
  "valueDate"     TIMESTAMP(3),
  "instrumentNo"  TEXT,
  particulars     TEXT,
  debit           DECIMAL(15,2) NOT NULL DEFAULT 0,
  credit          DECIMAL(15,2) NOT NULL DEFAULT 0,
  balance         DECIMAL(15,2),
  "entityType"    TEXT NOT NULL DEFAULT 'non-corporate',
  "uploadBatchId" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AccBankStatementLine_bankAccountId_date_idx"
  ON public."AccBankStatementLine"("bankAccountId", date);
CREATE INDEX IF NOT EXISTS "AccBankStatementLine_uploadBatchId_idx"
  ON public."AccBankStatementLine"("uploadBatchId");

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'AccBankStatementLine';
  IF cnt <> 1 THEN RAISE EXCEPTION 'post-assertion failed: AccBankStatementLine table missing'; END IF;
END $$;

COMMIT;
