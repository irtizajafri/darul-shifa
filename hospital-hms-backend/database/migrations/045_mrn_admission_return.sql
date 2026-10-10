-- MRN by Admission # (2026-10-10): medicine an admitted patient didn't use
-- comes back to stock, priced at the rate it was billed at, and the
-- patient's bill gets a matching minus "Return" line.
--
-- InventoryMRN: an admission return can span several GINs (and departments),
-- so ginId / departmentId become optional and the admission is recorded.
-- InventoryMRNItem: the exact GIN it came back from, and the billed rate.
-- InventorySalesInvoice.mrnItemId: marks a minus "Return" bill line and the
-- MRN line it belongs to.

ALTER TABLE "InventoryMRN" ALTER COLUMN "ginId" DROP NOT NULL;
ALTER TABLE "InventoryMRN" ALTER COLUMN "departmentId" DROP NOT NULL;
ALTER TABLE "InventoryMRN" ADD COLUMN IF NOT EXISTS "admissionNumber" TEXT;
ALTER TABLE "InventoryMRN" ADD COLUMN IF NOT EXISTS "patientName" TEXT;
ALTER TABLE "InventoryMRN" ADD COLUMN IF NOT EXISTS "createdByName" TEXT;
CREATE INDEX IF NOT EXISTS "InventoryMRN_admissionNumber_idx" ON "InventoryMRN" ("admissionNumber");

ALTER TABLE "InventoryMRNItem" ADD COLUMN IF NOT EXISTS "ginId" INTEGER;
ALTER TABLE "InventoryMRNItem" ADD COLUMN IF NOT EXISTS "rate" DOUBLE PRECISION;
ALTER TABLE "InventoryMRNItem" ADD COLUMN IF NOT EXISTS "amount" DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "InventoryMRNItem_ginItemId_idx" ON "InventoryMRNItem" ("ginItemId");
CREATE INDEX IF NOT EXISTS "InventoryMRNItem_ginId_idx" ON "InventoryMRNItem" ("ginId");

ALTER TABLE "InventorySalesInvoice" ADD COLUMN IF NOT EXISTS "mrnItemId" INTEGER;
CREATE INDEX IF NOT EXISTS "InventorySalesInvoice_mrnItemId_idx" ON "InventorySalesInvoice" ("mrnItemId");
