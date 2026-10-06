-- Global salary-month lock (per user's explicit design 2026-10-06):
-- Voucher Expense's Employee payee list normally only ever checks "last
-- calendar month" (getPrevMonthYear), with no concept of a backlog — an
-- employee whose August salary was never paid would still show as "due"
-- only for whatever today's last-calendar-month happens to be, silently
-- skipping the unpaid August entirely. This table holds a single ON/OFF
-- switch a superadmin can flip to temporarily bypass the lock (see
-- getSalaryCeilingMonth in accounts.service.js) — singleton row, id always 1.
CREATE TABLE IF NOT EXISTS "AccSalaryLockSetting" (
  id SERIAL PRIMARY KEY,
  "isOverrideActive" BOOLEAN NOT NULL DEFAULT false,
  "updatedByUserId" TEXT,
  "updatedByName" TEXT,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
INSERT INTO "AccSalaryLockSetting" (id, "isOverrideActive")
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;
