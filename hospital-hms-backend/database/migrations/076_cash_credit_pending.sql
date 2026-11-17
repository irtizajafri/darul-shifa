-- Cash Pending and Credit Pending transactions (Clinic → Transactions),
-- owner 2026-11-17.
--   Cash Pending: a cash file can close on Discharge and Refund with its
--   balance left pending ("Goes to Cash Pending", for authorised users). The
--   amount pending at close is kept on the admission; each later receipt
--   (Cash Pending Transaction) is an ordinary admission payment, tagged, so it
--   counts on the day it's received like any other receipt.
--   Credit Pending: CC (credit card) OPD slips wait until the bank pays; the
--   bank's payment and its charges are recorded per slip here. Tracking only:
--   the slips' revenue is counted as before.
-- Columns and one new table; nothing existing changes. Safe to re-run.

ALTER TABLE "ClinicAdmission" ADD COLUMN IF NOT EXISTS "dischargeCashPending"   DOUBLE PRECISION;
ALTER TABLE "ClinicAdmission" ADD COLUMN IF NOT EXISTS "dischargeCashPendingBy" TEXT;
ALTER TABLE "ClinicAdmissionPayment" ADD COLUMN IF NOT EXISTS "againstCashPending" BOOLEAN NOT NULL DEFAULT false;
-- Marked "Goes to Cash Pending" on the Provisional Bill, before discharge: the
-- Discharge Certificate can then be made with a balance, and Discharge and
-- Refund opens with the box already ticked. The amount is fixed at close.
ALTER TABLE "ClinicAdmission" ADD COLUMN IF NOT EXISTS "cashPendingMarked"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClinicAdmission" ADD COLUMN IF NOT EXISTS "cashPendingMarkedBy" TEXT;
ALTER TABLE "ClinicAdmission" ADD COLUMN IF NOT EXISTS "cashPendingMarkedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ClinicCcSettlement" (
  "id"             SERIAL PRIMARY KEY,
  "visitId"        INTEGER NOT NULL REFERENCES "ClinicOpdVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "receivedDate"   DATE NOT NULL,
  "receivedAmount" DECIMAL(12, 2) NOT NULL,
  "bankCharges"    DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "remarks"        TEXT,
  "createdByName"  TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ClinicCcSettlement_visitId_idx" ON "ClinicCcSettlement"("visitId");
CREATE INDEX IF NOT EXISTS "ClinicCcSettlement_receivedDate_idx" ON "ClinicCcSettlement"("receivedDate");
