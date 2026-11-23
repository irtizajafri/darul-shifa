-- 082: Accounts — Cash GL and Corporate get their own permissions
-- (owner, 2026-11-23). Until now one "accounts" permission opened both books.
-- Now "accounts" = Accounts — Cash GL, and the new "accounts-corporate" =
-- Accounts — Corporate. So that nobody loses access on the day of the update,
-- every user who has "accounts" gets the same tabs under "accounts-corporate"
-- too; the Super Admin then takes away whichever book a user shouldn't have
-- (User Management).
-- Additive: users who already have "accounts-corporate" are left as they are;
-- nothing else in the permissions changes. Safe to re-run.

-- Preview (run first):
--   SELECT name, permissions->'accounts' AS accounts
--   FROM "User" WHERE permissions ? 'accounts' AND NOT (permissions ? 'accounts-corporate');

UPDATE "User"
SET permissions = permissions || jsonb_build_object('accounts-corporate', permissions->'accounts')
WHERE jsonb_typeof(permissions) = 'object'
  AND permissions ? 'accounts'
  AND NOT (permissions ? 'accounts-corporate');
