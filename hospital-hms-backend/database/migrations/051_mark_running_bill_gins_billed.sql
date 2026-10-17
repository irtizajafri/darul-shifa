-- Admission medicine billing (2026-10-17). Before GIN-linked billing, an
-- admission's medicine bill was ONE running bill: each update was saved as a
-- new Sales Invoice carrying the whole bill again, with lines NOT tied to
-- their GIN — so those GIN lines stayed "unbilled" (isBilled = false) even
-- though the running bill already charged them. Sales Invoice → Search by
-- Admission now bills unbilled GIN lines automatically, which would charge
-- them a second time.
--
-- Fix, once: every GIN / GIN line of an admission issued on or before that
-- admission's LATEST running-bill save is part of that bill → isBilled.
-- GINs issued after it stay unbilled (genuinely not on any bill yet).
-- Safe to re-run (only flips false → true).

WITH snap AS (
  SELECT "customerName" AS adm, max("invoiceDate") AS last_at
  FROM "InventorySalesInvoice"
  WHERE "customerType" = 'admission'
    AND "ginItemId" IS NULL AND "ginId" IS NULL AND "mrnItemId" IS NULL
    AND quantity > 0
  GROUP BY "customerName"
)
UPDATE "InventoryGINItem" gi
SET "isBilled" = true
FROM "InventoryGIN" g, snap
WHERE gi."ginId" = g.id
  AND g."admissionNumber" = snap.adm
  AND g."issueDate" <= snap.last_at
  AND gi."isBilled" = false;

WITH snap AS (
  SELECT "customerName" AS adm, max("invoiceDate") AS last_at
  FROM "InventorySalesInvoice"
  WHERE "customerType" = 'admission'
    AND "ginItemId" IS NULL AND "ginId" IS NULL AND "mrnItemId" IS NULL
    AND quantity > 0
  GROUP BY "customerName"
)
UPDATE "InventoryGIN" g
SET "isBilled" = true
FROM snap
WHERE g."admissionNumber" = snap.adm
  AND g."issueDate" <= snap.last_at
  AND g."isBilled" = false;
