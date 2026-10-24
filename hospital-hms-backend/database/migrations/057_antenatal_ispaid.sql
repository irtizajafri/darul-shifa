-- Antenatal registrations can be paid to their doctor from Voucher Expense
-- (Consultant visits popup, "ant-<id>" rows) — like ClinicOpdVisitDoctor,
-- a paid registration is flagged so it is never offered/paid twice; deleting
-- the voucher puts it back to unpaid. Safe to re-run.
ALTER TABLE "ClinicAntenatal" ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT false;
