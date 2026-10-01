-- Voucher Expense's "Save" button only ever creates a Draft (posted into a
-- real voucher later, usually at 8AM day-close) — but the draft row never
-- recorded which InventoryGRN(s) it was paying off, so InventoryGRN.isPaid
-- never flipped and the same GRN kept reappearing in the pending-GRN popup
-- forever, no matter how many times it was "paid" through this screen. This
-- table is the draft-side equivalent of AccVoucherExpenseEntryGrn (which
-- already works correctly for the separate, unused-by-this-screen direct
-- voucher-creation path).
CREATE TABLE IF NOT EXISTS "AccVoucherExpenseDraftGrn" (
  id SERIAL PRIMARY KEY,
  "draftId" INTEGER NOT NULL REFERENCES "AccVoucherExpenseDraft"(id) ON DELETE CASCADE,
  "grnId" INTEGER NOT NULL REFERENCES "InventoryGRN"(id),
  amount DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "AccVoucherExpenseDraftGrn_draftId_idx" ON "AccVoucherExpenseDraftGrn"("draftId");
CREATE INDEX IF NOT EXISTS "AccVoucherExpenseDraftGrn_grnId_idx" ON "AccVoucherExpenseDraftGrn"("grnId");
