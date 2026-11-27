-- 088: Al Shifa Hospital Pharmacy — Medicine Return (MRN) (owner, 2026-11-27).
-- Medicine issued on a GIN that comes back (e.g. one box of Panadol from an
-- admission): requested from the ward / department side ("MRN — request"),
-- then verified on the pharmacy side by a user with "MRN — verify", who gets
-- a pop-up and accepts or rejects it. Only an accepted return counts in the
-- pharmacy reports (Issued − Returned = Net). No stock, no patient bill yet.
-- New tables only; safe to re-run.

CREATE TABLE IF NOT EXISTS "PharmacyMRN" (
  "id"              SERIAL PRIMARY KEY,
  "code"            TEXT NOT NULL,                       -- YYYYMMDDnnn-mrn
  "returnDate"      DATE NOT NULL,
  "admissionNumber" TEXT,
  "opdSlipNo"       TEXT,
  "patientName"     TEXT,
  "departmentId"    INTEGER,
  "departmentName"  TEXT,
  "reason"          TEXT,
  "status"          TEXT NOT NULL DEFAULT 'pending',     -- pending | accepted | rejected
  "totalAmount"     DECIMAL(14,2) NOT NULL DEFAULT 0,
  "requestedByName" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedByName"  TEXT,
  "verifiedAt"      TIMESTAMP(3),
  "verifyNote"      TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyMRN_code_key" ON "PharmacyMRN"("code");
CREATE INDEX IF NOT EXISTS "PharmacyMRN_status_idx" ON "PharmacyMRN"("status");
CREATE INDEX IF NOT EXISTS "PharmacyMRN_returnDate_idx" ON "PharmacyMRN"("returnDate");

CREATE TABLE IF NOT EXISTS "PharmacyMRNItem" (
  "id"           SERIAL PRIMARY KEY,
  "mrnId"        INTEGER NOT NULL REFERENCES "PharmacyMRN"("id") ON DELETE CASCADE,
  "ginId"        INTEGER NOT NULL REFERENCES "PharmacyGIN"("id") ON DELETE RESTRICT,
  "ginItemId"    INTEGER NOT NULL REFERENCES "PharmacyGINItem"("id") ON DELETE RESTRICT,
  "medicineId"   INTEGER,
  "medicineCode" TEXT,
  "medicineName" TEXT NOT NULL,
  "packSize"     TEXT,
  "quantity"     DOUBLE PRECISION NOT NULL,
  "rate"         DECIMAL(12,2) NOT NULL DEFAULT 0,
  "amount"       DECIMAL(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "PharmacyMRNItem_mrnId_idx" ON "PharmacyMRNItem"("mrnId");
CREATE INDEX IF NOT EXISTS "PharmacyMRNItem_ginItemId_idx" ON "PharmacyMRNItem"("ginItemId");
