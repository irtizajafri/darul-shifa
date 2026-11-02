-- Inventory GRN parent (owner, 2026-11-02): one delivery received in one GRN
-- save = one Parent GRN #, paid in one go from Voucher Expense. Every item
-- keeps its own GRN row and code (stock, amounts, paid flags and voucher
-- links are untouched) — only this column is added and filled.
--
-- Old GRNs are joined into deliveries: same PO, same supplier, same
-- Cash/Panel, saved within 2 minutes of each other. A delivery's parent is
-- its first GRN code — the number its printed GRN already shows. Only rows
-- still without a parent are filled. One transaction; safe to re-run.
--
-- Preview first (read-only, changes nothing) — one row per delivery:
--
--   WITH g AS (
--     SELECT g.id, g.code, g."supplierId", g."paymentMode", g."isPaid", g."totalAmount", g."createdAt",
--            regexp_replace(po.code, '-[0-9]{2}$', '') AS po_root
--     FROM "InventoryGRN" g JOIN "InventoryPurchaseOrder" po ON po.id = g."poId"
--   ), s AS (
--     SELECT *, CASE WHEN LAG("createdAt") OVER w IS NULL
--                      OR "createdAt" - LAG("createdAt") OVER w > INTERVAL '2 minutes' THEN 1 ELSE 0 END AS new_grp
--     FROM g WINDOW w AS (PARTITION BY po_root, "supplierId", "paymentMode" ORDER BY "createdAt", id)
--   ), t AS (
--     SELECT *, SUM(new_grp) OVER (PARTITION BY po_root, "supplierId", "paymentMode" ORDER BY "createdAt", id) AS grp FROM s
--   )
--   SELECT po_root, (array_agg(code ORDER BY "createdAt", id))[1] AS parent, COUNT(*) AS items,
--          SUM("totalAmount") AS total, COUNT(*) FILTER (WHERE "isPaid") AS paid_items, MIN("createdAt") AS received
--   FROM t GROUP BY po_root, "supplierId", "paymentMode", grp ORDER BY MIN("createdAt");

BEGIN;

ALTER TABLE "InventoryGRN" ADD COLUMN IF NOT EXISTS "parentCode" TEXT;
CREATE INDEX IF NOT EXISTS "InventoryGRN_parentCode_idx" ON "InventoryGRN"("parentCode");

WITH g AS (
  SELECT g.id, g.code, g."supplierId", g."paymentMode", g."createdAt",
         regexp_replace(po.code, '-[0-9]{2}$', '') AS po_root
  FROM "InventoryGRN" g JOIN "InventoryPurchaseOrder" po ON po.id = g."poId"
), s AS (
  SELECT *, CASE WHEN LAG("createdAt") OVER w IS NULL
                   OR "createdAt" - LAG("createdAt") OVER w > INTERVAL '2 minutes' THEN 1 ELSE 0 END AS new_grp
  FROM g WINDOW w AS (PARTITION BY po_root, "supplierId", "paymentMode" ORDER BY "createdAt", id)
), t AS (
  SELECT *, SUM(new_grp) OVER (PARTITION BY po_root, "supplierId", "paymentMode" ORDER BY "createdAt", id) AS grp FROM s
), p AS (
  SELECT id, FIRST_VALUE(code) OVER (PARTITION BY po_root, "supplierId", "paymentMode", grp ORDER BY "createdAt", id) AS parent FROM t
)
UPDATE "InventoryGRN" x SET "parentCode" = p.parent
FROM p
WHERE x.id = p.id AND x."parentCode" IS NULL;

COMMIT;
