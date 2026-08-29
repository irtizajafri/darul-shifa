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
      { key: 'leave-encashment', label: 'Leave Encashment' },
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
      {
        key: 'grn',
        label: 'Goods Receipt (GRN)',
        tabs: [
          { key: 'view', label: 'View' },
          { key: 'edit', label: 'Edit GRN' },
        ],
      },
      { key: 'gd',            label: 'Goods Demand (GD)' },
      {
        key: 'gin',
        label: 'Goods Issuance (GIN)',
        tabs: [
          { key: 'view', label: 'View' },
          { key: 'edit', label: 'Edit GIN' },
        ],
      },
      { key: 'sales-invoice', label: 'Sales Invoice' },
      { key: 'gdn',           label: 'Goods Discard (GDN)' },
      { key: 'mrn',           label: 'Goods Return (MRN)' },
      { key: 'maintenance',   label: 'Maintenance' },
      { key: 'fuel',          label: 'Fuel Management' },
      { key: 'utilities-bill', label: 'Utilities Bill' },
      { key: 'low-stock-alerts',       label: 'Low Stock Alerts (Inventory)' },
      { key: 'fixed-asset-alerts',     label: 'Low Stock Alerts (Fixed Assets)' },
      { key: 'gd-notifications',       label: 'GD Request Notifications' },
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
      // ── OPD ─────────────────────────────────────────────────────────────────
      { key: 'general-opd', label: 'General OPD (All Departments)' },
      { key: 'antenatal',   label: 'Antenatal' },
      { key: 'admission',   label: 'Admission' },

      // ── Transactions ─────────────────────────────────────────────────────────
      {
        key: 'transactions',
        label: 'Transactions',
        tabs: [
          { key: 'receive-balance-slip',        label: 'Receive Balance against Slip' },
          { key: 'cancel-slip',                 label: 'Cancel Slip' },
          { key: 'slip-refund',                 label: 'Slip Refund' },
          { key: 'slip-adjustment',             label: 'Slip Adjustment' },
          { key: 'slip-transfer',               label: 'Slip Transfer' },
          { key: 'receiving-against-admission', label: 'Receiving against Admission' },
          { key: 'discount-refund-admission',   label: 'Discount & Refund Against Admission' },
          { key: 'appointment',                 label: 'Appointment' },
          { key: 'ot-register',                 label: 'OT Register' },
          { key: 'birth-certificate',           label: 'Birth Certificate' },
          { key: 'admission-adjustment',        label: 'Admission Adjustment' },
          { key: 'admission-status-change',     label: 'Admission Status Change' },
          { key: 'bed-shifting',                label: 'Bed Shifting' },
          { key: 'bed-status',                  label: 'Bed Status' },
          { key: 'upload-patient-document',     label: 'Upload Patient Document' },
          { key: 'surgery-information',         label: 'Surgery / Procedure Information' },
        ],
      },

      // ── Billing ──────────────────────────────────────────────────────────────
      {
        key: 'billing',
        label: 'Billing',
        tabs: [
          { key: 'provisional-bill', label: 'Provisional Bill' },
          { key: 'discharge-refund', label: 'Discharge & Refund' },
        ],
      },

      // ── Panels ───────────────────────────────────────────────────────────────
      {
        key: 'panels',
        label: 'Panels',
        tabs: [
          { key: 'companies',        label: 'Panel Companies' },
          { key: 'employees',        label: 'Panel Employees' },
          { key: 'bill-heads',       label: 'Bill Head' },
          { key: 'provisional-bill', label: 'Panel Provisional Bill' },
          { key: 'billing',          label: 'Billing' },
          { key: 'cheque-received',  label: 'Panel Cheque Transaction' },
          { key: 'bill-comparison',  label: 'Bill Comparison Report' },
          { key: 'billing-detail',   label: 'Billing Detail Report' },
          { key: 'cheques-report',   label: 'Panel Cheques Report' },
        ],
      },

      // ── Inquiries ────────────────────────────────────────────────────────────
      {
        key: 'inquiries',
        label: 'Inquiries',
        tabs: [
          { key: 'revenue-dashboard', label: 'Revenue Dashboard' },
          { key: 'patient-documents', label: 'Patient Documents' },
        ],
      },

      // ── Reports ──────────────────────────────────────────────────────────────
      {
        key: 'reports',
        label: 'Reports',
        tabs: [
          { key: 'reprint',                         label: 'Reprint' },
          { key: 'departmental-performance',        label: 'Departmental Performance' },
          { key: 'doctor-departmental-performance', label: 'Doctor Departmental Performance' },
          { key: 'admission-wise',                  label: 'Admission Report' },
          { key: 'ot-register',                     label: 'OT Register Report' },
          { key: 'birth-certificate',               label: 'Birth Certificate Report' },
          { key: 'appointment',                     label: 'Appointment Register' },
          { key: 'department-patients',             label: 'Department wise Patients' },
          { key: 'user-date-summary',               label: 'User by Date Summary' },
          { key: 'patients-list',                   label: 'Patients List' },
          { key: 'consultant-wise',                 label: 'Consultant Wise Patients' },
          { key: 'death-certificate',               label: 'Death Certificate Report' },
          { key: 'discharge-certificate',           label: 'Discharge Certificate Report' },
          { key: 'antenatal',                       label: 'Antenatal Report' },
          { key: 'admission-status-change',         label: 'Admission Status Change Report' },
          { key: 'status-change-history',           label: 'Status Change History Report' },
          { key: 'consultant-statement',            label: 'Consultant Statement' },
          { key: 'consultant-rates',                label: 'Consultant Rates' },
        ],
      },

      // ── Parameters ───────────────────────────────────────────────────────────
      { key: 'department',      label: 'Department' },
      { key: 'sub-department',  label: 'Sub Department' },
      { key: 'staff-category',  label: 'Staff Category' },
      { key: 'doctors',         label: 'Doctors / Consultant' },
      { key: 'room-category',   label: 'Room Category' },
      { key: 'bed',             label: 'Bed' },
      { key: 'bill-heads',      label: 'Bill Heads' },
      { key: 'surgery-types',   label: 'Surgery Types' },
      { key: 'symptoms',        label: 'Symptoms' },
      { key: 'diseases',        label: 'Diseases' },
      { key: 'document-types',  label: 'Document Types' },
      { key: 'discharge-types', label: 'Discharge Types' },
      { key: 'shift',           label: 'Shift' },
      { key: 'credit-card',     label: 'Credit Card %' },
      { key: 'death-certificate', label: 'Death Certificate (Parameter)' },
      { key: 'pharmacy-stores', label: 'Pharmacy Stores' },
    ],
  },
  accounts: {
    label: 'Accounts',
    dashboardRoute: '/accounts-module',
    subModules: [
      {
        key: 'parameters',
        label: 'Parameters',
        tabs: [
          { key: 'main-gl',          label: 'Main GL' },
          { key: 'sub-gl',           label: 'Sub GL' },
          { key: 'main-account',     label: 'Main Account' },
          { key: 'sub-account',      label: 'Sub Account' },
          { key: 'list-attachments', label: 'List Attachments' },
          { key: 'bank-accounts',    label: 'Bank Accounts' },
          { key: 'cheque-serial',    label: 'Cheque Serial' },
          { key: 'income-category',  label: 'Account Category for Income' },
        ],
      },
      {
        key: 'transactions',
        label: 'Transactions',
        tabs: [
          { key: 'voucher-income',     label: 'Voucher Entry — Income' },
          { key: 'voucher-expense',    label: 'Voucher Entry — Expense' },
          { key: 'cheque-printing',    label: 'Cheque Printing' },
          { key: 'bank-deposit',       label: 'Bank Deposit' },
          { key: 'bank-statement',     label: 'Upload Bank Statement' },
          { key: 'deposit-adjustment', label: 'Bank Deposit Adjustment' },
        ],
      },
      { key: 'inquiry', label: 'Inquiry' },
      { key: 'reports', label: 'Reports' },
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

/**
 * Returns true if the user is allowed to enter back-dated transactions.
 * SuperAdmin always can. Others need allowBackDating flag in their permissions.
 */
export function canBackDate(user) {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return user.permissions?.allowBackDating === true;
}
