-- 084: Direct printing (owner, 2026-11-24). "Thermal & Save" must go straight
-- to the PC's thermal printer and "Save & Print" straight to its normal
-- printer, with no printer-choice dialog. A web page can't choose a printer,
-- so the server prints: each PC (Connected PCs, by IP) gets the names of its
-- two printers as the server sees them (e.g. \\RECEPTION1\THERMAL — the PC's
-- USB printer shared in Windows and added on the server). A PC with no
-- printer set keeps printing through the browser's print dialog, as before.
-- Additive; safe to re-run.

ALTER TABLE "HmsDevice" ADD COLUMN IF NOT EXISTS "thermalPrinter" TEXT;
ALTER TABLE "HmsDevice" ADD COLUMN IF NOT EXISTS "normalPrinter" TEXT;
