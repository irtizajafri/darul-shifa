-- 087: Printer setup by script (owner, 2026-11-26). Setting a counter PC's
-- printers up by hand (share, add on the server, firewall) was too long, so
-- two scripts do it (public/it/counter-printers.ps1.txt on the counter,
-- server-printers.ps1.txt on the server). The counter script shares the PC's
-- thermal / normal printer, makes a small local user the server prints as,
-- and tells the HMS; the server script connects them and prints a test page.
-- Kept per PC (Connected PCs, by IP):
--   printSetup: counter-done (shared, waiting for the server) | ready | failed
--   printNote:  what the last script said
--   printShareUser / printSharePassword: the counter's print-only user
-- Additive; safe to re-run.

ALTER TABLE "HmsDevice" ADD COLUMN IF NOT EXISTS "printSetup" TEXT;
ALTER TABLE "HmsDevice" ADD COLUMN IF NOT EXISTS "printNote" TEXT;
ALTER TABLE "HmsDevice" ADD COLUMN IF NOT EXISTS "printShareUser" TEXT;
ALTER TABLE "HmsDevice" ADD COLUMN IF NOT EXISTS "printSharePassword" TEXT;
ALTER TABLE "HmsDevice" ADD COLUMN IF NOT EXISTS "printSetupAt" TIMESTAMP(3);
