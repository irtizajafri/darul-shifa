-- Inventory > Sales Invoice now records who saved each line (2026-10-09), so
-- Hospital Store medicine shows a "Created" name in Clinic > Report >
-- Medicine Issuance / Panels > Reports > Medicine Report. Older rows stay
-- NULL (shown blank).

ALTER TABLE "InventorySalesInvoice" ADD COLUMN IF NOT EXISTS "createdByName" TEXT;
