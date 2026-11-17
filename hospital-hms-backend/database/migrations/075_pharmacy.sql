-- Al Shifa Hospital Pharmacy (7th module), owner 2026-11-17. Goods Demand
-- (GD) and Goods Issuance (GIN) like Inventory's, kept fully apart from
-- Inventory: no stock, no suppliers or categories, nothing shared with the
-- Inventory tables. Medicines are picked from Clinic's Medicine List
-- (ClinicMedicine); the department from Clinic's departments; Issued To from
-- HR employees; the patient is an Admission # or a Panel Slip # (optional).
-- Nothing goes to patient bills (owner: later). Ids of those lists are plain
-- numbers with a name copied in, so a later edit there never changes a saved
-- document. New tables only; safe to re-run.

CREATE TABLE IF NOT EXISTS "PharmacyGD" (
  "id"              SERIAL PRIMARY KEY,
  "code"            TEXT NOT NULL,            -- YYYYMMDD + 3-digit daily no. + "-gd"
  "requestDate"     DATE NOT NULL,
  "departmentId"    INTEGER NOT NULL,         -- ClinicDepartment.id
  "departmentName"  TEXT NOT NULL,
  "admissionNumber" TEXT,
  "opdSlipNo"       TEXT,
  "patientName"     TEXT,
  "comment"         TEXT,
  "status"          TEXT NOT NULL DEFAULT 'open',   -- open | partial | closed
  "createdByName"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyGD_code_key" ON "PharmacyGD"("code");
CREATE INDEX IF NOT EXISTS "PharmacyGD_requestDate_idx" ON "PharmacyGD"("requestDate");

CREATE TABLE IF NOT EXISTS "PharmacyGDItem" (
  "id"                SERIAL PRIMARY KEY,
  "gdId"              INTEGER NOT NULL REFERENCES "PharmacyGD"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "medicineId"        INTEGER,                -- ClinicMedicine.id
  "medicineCode"      TEXT,
  "medicineName"      TEXT NOT NULL,
  "packSize"          TEXT,
  "quantityRequested" DOUBLE PRECISION NOT NULL,
  "quantityIssued"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"            TEXT NOT NULL DEFAULT 'pending',  -- pending | partial | issued
  "sortOrder"         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "PharmacyGDItem_gdId_idx" ON "PharmacyGDItem"("gdId");

CREATE TABLE IF NOT EXISTS "PharmacyGIN" (
  "id"              SERIAL PRIMARY KEY,
  "code"            TEXT NOT NULL,            -- YYYYMMDD + 3-digit daily no. + "-gin"
  "gdId"            INTEGER NOT NULL REFERENCES "PharmacyGD"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "issueDate"       DATE NOT NULL,
  "issuedToId"      INTEGER,                  -- HR Employee.id
  "issuedToName"    TEXT,
  "departmentId"    INTEGER NOT NULL,
  "departmentName"  TEXT NOT NULL,
  "admissionNumber" TEXT,
  "opdSlipNo"       TEXT,
  "patientName"     TEXT,
  "totalAmount"     DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "createdByName"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyGIN_code_key" ON "PharmacyGIN"("code");
CREATE INDEX IF NOT EXISTS "PharmacyGIN_gdId_idx" ON "PharmacyGIN"("gdId");
CREATE INDEX IF NOT EXISTS "PharmacyGIN_issueDate_idx" ON "PharmacyGIN"("issueDate");

CREATE TABLE IF NOT EXISTS "PharmacyGINItem" (
  "id"           SERIAL PRIMARY KEY,
  "ginId"        INTEGER NOT NULL REFERENCES "PharmacyGIN"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "gdItemId"     INTEGER NOT NULL REFERENCES "PharmacyGDItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "medicineId"   INTEGER,
  "medicineCode" TEXT,
  "medicineName" TEXT NOT NULL,
  "packSize"     TEXT,
  "quantity"     DOUBLE PRECISION NOT NULL,
  "rate"         DECIMAL(12, 2) NOT NULL DEFAULT 0,   -- Medicine List retail price at issue
  "amount"       DECIMAL(14, 2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "PharmacyGINItem_ginId_idx" ON "PharmacyGINItem"("ginId");
CREATE INDEX IF NOT EXISTS "PharmacyGINItem_gdItemId_idx" ON "PharmacyGINItem"("gdItemId");
