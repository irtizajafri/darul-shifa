-- Receive Balance Slip (clinic/transactions/receive-balance-slip) currently
-- just adds the collected amount straight into ClinicOpdVisit.receive, with
-- no record of WHEN that top-up actually happened — so the money retroactively
-- inflates the original slip's old date in every report, and never shows up
-- on the day it was really collected. This table gives it the same dated
-- transaction record ClinicAdmissionPayment already gives admission top-ups.
CREATE TABLE IF NOT EXISTS "ClinicOpdBalancePayment" (
  id SERIAL PRIMARY KEY,
  "visitId" INTEGER NOT NULL REFERENCES "ClinicOpdVisit"(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  "receivedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ClinicOpdBalancePayment_visitId_idx" ON "ClinicOpdBalancePayment"("visitId");
