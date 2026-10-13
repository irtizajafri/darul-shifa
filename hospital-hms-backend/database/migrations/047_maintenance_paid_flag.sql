-- Inventory Maintenance → Accounts (2026-10-13): a maintenance job back from
-- repair with an Actual Cost is payable to its supplier from Non-Corporate
-- Voucher Expense (Vendors / Suppliers popup, next to the GRNs). Once a
-- voucher line pays it, it's flagged paid so it can't be paid twice; deleting
-- that line / voucher flags it unpaid again.

ALTER TABLE "InventoryMaintenance" ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventoryMaintenance" ADD COLUMN IF NOT EXISTS "paidVoucherEntryId" INTEGER;
