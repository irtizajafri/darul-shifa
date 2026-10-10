-- Sales Invoice (admission) now lists the admission's GINs date-wise, one
-- block per GIN (2026-10-10). Save Invoice writes one invoice line per GIN
-- line and remembers which GIN line it billed, so a billed line's rate can be
-- edited right where that GIN is shown. Older invoice lines stay NULL (they
-- were merged across GINs) and are matched by item instead.

ALTER TABLE "InventorySalesInvoice" ADD COLUMN IF NOT EXISTS "ginItemId" INTEGER;
ALTER TABLE "InventorySalesInvoice" ADD COLUMN IF NOT EXISTS "ginId" INTEGER;
CREATE INDEX IF NOT EXISTS "InventorySalesInvoice_ginItemId_idx" ON "InventorySalesInvoice" ("ginItemId");
CREATE INDEX IF NOT EXISTS "InventorySalesInvoice_ginId_idx" ON "InventorySalesInvoice" ("ginId");
