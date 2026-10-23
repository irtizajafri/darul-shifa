// "Printed by" on the Discharge Certificate (owner, 2026-10-23): the
// logged-in user's HR Employee Code (set on the User form), not their name.
// Falls back to the name for a user with no employee linked yet, or a
// session that logged in before the code existed.
export function printedByCode(user) {
  return user?.employeeCode || user?.name || user?.username || user?.email || '';
}
