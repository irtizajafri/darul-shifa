// ============================================================
//  PERMISSIONS MAP — Single source of truth for all modules,
//  sub-modules, and tab-level permissions in the HMS.
// ============================================================

export const PERMISSIONS_MAP = {
  employee: {
    label: 'Employee Management',
    dashboardRoute: '/employee-module',
    subModules: [
      { key: 'employee-database', label: 'Employee Database' },
      {
        key: 'attendance',
        label: 'Attendance',
        tabs: [
          { key: 'daily-view',       label: 'Daily View' },
          { key: 'all-records',      label: 'All Records' },
          { key: 'monthly-api-logs', label: 'Monthly API Logs' },
        ],
      },
      { key: 'gatepass',   label: 'Gate Pass' },
      { key: 'shortleave', label: 'Short Leave' },
      { key: 'advance',    label: 'Advance & Loan' },
      {
        key: 'reports',
        label: 'Reports',
        tabs: [
          { key: 'payslip',              label: 'Payslip' },
          { key: 'payroll-detailed',     label: 'Payroll — Detailed' },
          { key: 'payroll-consolidated', label: 'Payroll — Consolidated' },
          { key: 'payroll-register',     label: 'Payroll — Salary Register' },
          { key: 'test-attendance-raw',  label: 'Test Attendance Raw' },
          { key: 'missing-salary',       label: 'Missing Salary' },
          { key: 'employee-cr',          label: 'Employee CR' },
        ],
      },
    ],
  },
  inventory: {
    label: 'Inventory Management',
    dashboardRoute: '/inventory-module',
    subModules: [
      {
        key: 'master-setup',
        label: 'Master Setup',
        tabs: [
          { key: 'items',         label: 'Items' },
          { key: 'categories',    label: 'Categories' },
          { key: 'subcategories', label: 'Subcategories' },
          { key: 'suppliers',     label: 'Suppliers' },
          { key: 'storages',      label: 'Storages' },
          { key: 'departments',   label: 'Departments' },
        ],
      },
      { key: 'po',            label: 'Purchase Orders' },
      { key: 'grn',           label: 'Goods Receipt (GRN)' },
      { key: 'gin',           label: 'Goods Issuance (GIN)' },
      { key: 'sales-invoice', label: 'Sales Invoice' },
      { key: 'gdn',           label: 'Goods Discard (GDN)' },
      { key: 'maintenance',   label: 'Maintenance' },
      {
        key: 'inventory-reports',
        label: 'Inventory Reports',
        tabs: [
          { key: 'item-list',             label: 'Item List' },
          { key: 'stock-position',        label: 'Stock Position' },
          { key: 'item-ledger',           label: 'Item Ledger' },
          { key: 'reorder-report',        label: 'Reorder Report' },
          { key: 'receiving-report',      label: 'Receiving Report' },
          { key: 'issuance-report',       label: 'Issuance Report' },
          { key: 'discard-report',        label: 'Discard Report' },
          { key: 'repairing-report',      label: 'Repairing Report' },
          { key: 'short-expiry',          label: 'Short Expiry' },
          { key: 'expiry',                label: 'Expiry' },
          { key: 'daily-sales',           label: 'Daily Sales' },
          { key: 'supplier-ledger',       label: 'Supplier Ledger' },
          { key: 'purchase-order-report', label: 'Purchase Order Report' },
        ],
      },
    ],
  },
  clinic: {
    label: 'Clinic',
    dashboardRoute: '/clinic-module',
    subModules: [
      { key: 'general-opd',      label: 'General OPD' },
      { key: 'department',       label: 'Department' },
      { key: 'sub-department',   label: 'Sub Department' },
      { key: 'staff-category',   label: 'Staff Category' },
      { key: 'doctors',          label: 'Doctors / Consultant' },
      { key: 'room-category',    label: 'Room Category' },
      { key: 'bed',              label: 'Bed' },
      { key: 'bill-heads',       label: 'Bill Heads' },
      { key: 'panel-companies',  label: 'Panel Companies' },
    ],
  },
};

/**
 * Check if a user has access to a module, sub-module, and optionally a tab.
 *
 * Supports two permission formats:
 *  - Legacy (old): { employee: ['gatepass', 'attendance'] }  — arrays
 *  - New format:   { employee: { gatepass: true, attendance: ['daily-view'] } } — objects
 *
 * @param {object} user        - User from auth store
 * @param {string} module      - Module key e.g. 'employee'
 * @param {string} [subModule] - Sub-module key e.g. 'attendance'
 * @param {string} [tab]       - Tab key e.g. 'daily-view'
 * @returns {boolean}
 */
export function hasPermission(user, module, subModule = null, tab = null) {
  if (!user) return false;
  if (user.isSuperAdmin) return true;

  const permissions = user.permissions || {};
  const modulePerms = permissions[module];
  if (!modulePerms) return false;

  // ── Module-level check ────────────────────────────────────────────────────
  if (!subModule) {
    if (Array.isArray(modulePerms)) return modulePerms.length > 0; // legacy
    return typeof modulePerms === 'object' && Object.keys(modulePerms).length > 0;
  }

  // ── Sub-module check ──────────────────────────────────────────────────────
  if (Array.isArray(modulePerms)) {
    // Legacy format: no tab restrictions — if sub-module in list, full access
    if (!modulePerms.includes(subModule)) return false;
    return true;
  }

  const subPerm = modulePerms[subModule];
  if (subPerm === undefined || subPerm === null || subPerm === false) return false;

  if (!tab) {
    return subPerm === true || (Array.isArray(subPerm) && subPerm.length > 0);
  }

  // ── Tab-level check ───────────────────────────────────────────────────────
  if (subPerm === true) return true;            // full access → all tabs allowed
  if (Array.isArray(subPerm)) return subPerm.includes(tab);
  return false;
}

/**
 * Convert legacy array-format permissions to the new object format.
 * Safe to call on already-new-format permissions — returns a clean copy.
 *
 * Old: { employee: ['gatepass', 'attendance'] }
 * New: { employee: { gatepass: true, attendance: ['daily-view', 'all-records', ...] } }
 */
export function normalizePermissions(perms) {
  if (!perms || typeof perms !== 'object') return {};
  const result = {};

  for (const [modKey, modPerms] of Object.entries(perms)) {
    if (!PERMISSIONS_MAP[modKey]) continue;

    if (Array.isArray(modPerms)) {
      // Legacy → convert to new format with full tab access
      result[modKey] = {};
      for (const subKey of modPerms) {
        const subDef = PERMISSIONS_MAP[modKey].subModules.find((s) => s.key === subKey);
        if (!subDef) continue;
        result[modKey][subKey] = subDef.tabs ? subDef.tabs.map((t) => t.key) : true;
      }
    } else if (typeof modPerms === 'object' && modPerms !== null) {
      result[modKey] = { ...modPerms };
    }
  }

  return result;
}
