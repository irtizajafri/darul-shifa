-- Panels > Transaction > OPD Bill (owner, 2026-10-27): the Provisional Bill
-- for a panel OPD patient. Opened from a General / Consultant OPD panel
-- slip; every panel slip of that patient until the bill is closed belongs
-- to it. Its heads and outside-store medicine flow into Panel Billing (OPD).
-- Safe to re-run.
CREATE TABLE IF NOT EXISTS "ClinicPanelOpdBill" (
  "id" SERIAL PRIMARY KEY,
  "opdVisitId" INTEGER NOT NULL,
  "serialNo" TEXT NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "panelCompanyId" INTEGER,
  "panelEmployeeId" INTEGER,
  "panelDependentId" INTEGER,
  "patientName" TEXT NOT NULL DEFAULT '',
  "pharmacyBillExcluded" BOOLEAN NOT NULL DEFAULT false,
  "diagnosticBillExcluded" BOOLEAN NOT NULL DEFAULT false,
  "closedAt" TIMESTAMP(3),
  "closedBy" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClinicPanelOpdBill_opdVisitId_key" ON "ClinicPanelOpdBill"("opdVisitId");
CREATE INDEX IF NOT EXISTS "ClinicPanelOpdBill_panelEmployeeId_idx" ON "ClinicPanelOpdBill"("panelEmployeeId");
CREATE INDEX IF NOT EXISTS "ClinicPanelOpdBill_panelCompanyId_idx" ON "ClinicPanelOpdBill"("panelCompanyId");

CREATE TABLE IF NOT EXISTS "ClinicPanelOpdBillItem" (
  "id" SERIAL PRIMARY KEY,
  "opdBillId" INTEGER NOT NULL,
  "roomCategoryId" INTEGER,
  "billHeadId" INTEGER,
  "qty" INTEGER NOT NULL DEFAULT 1,
  "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "remarks" TEXT,
  "patientType" TEXT,
  "sourceOpdVisitId" INTEGER,
  "serialNo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ClinicPanelOpdBillItem_opdBillId_idx" ON "ClinicPanelOpdBillItem"("opdBillId");

CREATE TABLE IF NOT EXISTS "ClinicPanelOpdBillPharmacyItem" (
  "id" SERIAL PRIMARY KEY,
  "opdBillId" INTEGER NOT NULL,
  "storeId" INTEGER,
  "medicine" TEXT NOT NULL,
  "dosage" TEXT,
  "qty" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unit" TEXT,
  "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "medDate" TIMESTAMP(3) NOT NULL,
  "remarks" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ClinicPanelOpdBillPharmacyItem_opdBillId_idx" ON "ClinicPanelOpdBillPharmacyItem"("opdBillId");

ALTER TABLE "ClinicPanelOpdBillingHeader" ADD COLUMN IF NOT EXISTS "seededOpdBillItemIds" INTEGER[] NOT NULL DEFAULT '{}';
