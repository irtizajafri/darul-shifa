-- Panels > Transaction > Distribution OPD (owner, 2026-10-27): the OPD Bill's
-- Discharge and Refund — a closed OPD Bill's rows copied in once, editable,
-- with its own Discount / Goes to Other Income / Close File. Safe to re-run.
ALTER TABLE "ClinicPanelOpdBill" ADD COLUMN IF NOT EXISTS "distImported" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClinicPanelOpdBill" ADD COLUMN IF NOT EXISTS "distDiscount" DOUBLE PRECISION;
ALTER TABLE "ClinicPanelOpdBill" ADD COLUMN IF NOT EXISTS "distOtherIncome" DOUBLE PRECISION;
ALTER TABLE "ClinicPanelOpdBill" ADD COLUMN IF NOT EXISTS "distClosedAt" TIMESTAMP(3);
ALTER TABLE "ClinicPanelOpdBill" ADD COLUMN IF NOT EXISTS "distClosedBy" TEXT;

CREATE TABLE IF NOT EXISTS "ClinicPanelOpdDistItem" (
  "id" SERIAL PRIMARY KEY,
  "opdBillId" INTEGER NOT NULL,
  "billHeadId" INTEGER,
  "doctorId" INTEGER,
  "subDeptId" INTEGER,
  "doctorFee" DOUBLE PRECISION,
  "hospitalShare" DOUBLE PRECISION,
  "description" TEXT,
  "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "sourceOpdVisitId" INTEGER,
  "sourceLineKey" TEXT,
  "amountEdited" BOOLEAN NOT NULL DEFAULT false,
  "excluded" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ClinicPanelOpdDistItem_opdBillId_idx" ON "ClinicPanelOpdDistItem"("opdBillId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClinicPanelOpdDistItem_opdBillId_sourceLineKey_key" ON "ClinicPanelOpdDistItem"("opdBillId", "sourceLineKey");
