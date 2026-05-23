// ============================================================
//  PERMISSIONS MAP — Single source of truth for all modules
//  and their sub-modules in the HMS.
// ============================================================

export const PERMISSIONS_MAP = {
  employee: {
    label: 'Employee Management',
    dashboardRoute: '/employee-module',
    subModules: [
      { key: 'employee-database', label: 'Employee Database' },
      { key: 'attendance',        label: 'Attendance' },
      { key: 'gatepass',          label: 'Gate Pass' },
      { key: 'shortleave',        label: 'Short Leave' },
      { key: 'advance',           label: 'Advance & Loan' },
      { key: 'reports',           label: 'Reports' },
    ],
  },
  inventory: {
    label: 'Inventory Management',
    dashboardRoute: '/inventory-module',
    subModules: [
      { key: 'master-setup',      label: 'Master Setup' },
      { key: 'po',                label: 'Purchase Orders' },
      { key: 'grn',               label: 'Goods Receipt (GRN)' },
      { key: 'gin',               label: 'Goods Issuance (GIN)' },
      { key: 'sales-invoice',     label: 'Sales Invoice' },
      { key: 'gdn',               label: 'Goods Discard (GDN)' },
      { key: 'maintenance',       label: 'Maintenance' },
      { key: 'inventory-reports', label: 'Inventory Reports' },
    ],
  },
};

/**
 * Check if a user has access to a module (and optionally a sub-module).
 *
 * @param {object} user       - User object from auth store
 * @param {string} module     - Module key e.g. 'employee'
 * @param {string} [subModule]- Sub-module key e.g. 'gatepass' (optional)
 * @returns {boolean}
 */
export function hasPermission(user, module, subModule = null) {
  if (!user) return false;

  // Super admin bypasses all checks
  if (user.isSuperAdmin) return true;

  const permissions = user.permissions || {};

  // Check module access
  const modulePerms = permissions[module];
  if (!modulePerms) return false;

  // If no sub-module requested, just check module exists and has at least one sub-module
  if (!subModule) {
    return Array.isArray(modulePerms) && modulePerms.length > 0;
  }

  // Check specific sub-module
  return Array.isArray(modulePerms) && modulePerms.includes(subModule);
}
