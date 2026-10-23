-- Users (2026-10-23): a login can be tied to its HR employee — picked from
-- the Employee list on the User form — so prints show the employee's code
-- as "Printed by" instead of the user's name (Discharge Certificate first).
-- Plain text copy of Employee.empCode, no FK. Safe to re-run.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "employeeCode" TEXT;
