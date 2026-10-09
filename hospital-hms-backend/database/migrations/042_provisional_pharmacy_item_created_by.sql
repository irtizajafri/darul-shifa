-- Clinic > Report > Medicine Issuance (Cash) shows a "Created" column — who
-- entered each Outside-Store medicine on the Provisional Bill's Pharmacy tab
-- (2026-10-09). Older rows stay NULL (shown blank in the report).

ALTER TABLE "ClinicProvisionalPharmacyItem" ADD COLUMN IF NOT EXISTS "createdByName" TEXT;
