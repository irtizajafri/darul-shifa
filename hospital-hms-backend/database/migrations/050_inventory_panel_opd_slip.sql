-- GD "Panel Slip" (2026-10-14): besides an Admission #, a GD can now be for
-- a panel OPD slip (ClinicOpdVisit.serialNo, paymentType panel). Same flow as
-- an admission: the GIN carries it, bills itself through a Sales Invoice
-- (customerType 'panel_opd', customerName = Slip #) that the slip's Panel
-- Billing Medicine reads, and an MRN against it credits the bill back.

ALTER TABLE "InventoryGDHeader" ADD COLUMN IF NOT EXISTS "opdSlipNo" TEXT;
ALTER TABLE "InventoryGIN"      ADD COLUMN IF NOT EXISTS "opdSlipNo" TEXT;
ALTER TABLE "InventoryMRN"      ADD COLUMN IF NOT EXISTS "opdSlipNo" TEXT;

CREATE INDEX IF NOT EXISTS "InventoryGIN_opdSlipNo_idx" ON "InventoryGIN" ("opdSlipNo");
CREATE INDEX IF NOT EXISTS "InventoryMRN_opdSlipNo_idx" ON "InventoryMRN" ("opdSlipNo");
