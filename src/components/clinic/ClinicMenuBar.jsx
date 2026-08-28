import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';
import './ClinicMenuBar.scss';

// perm: { sub, tab } — sub = subModule key, tab = optional tab key
// Items with no perm are always visible (e.g. cross-module links)
const menuItems = [
  {
    label: 'Report',
    items: [
      { label: 'Reprint',                          path: '/clinic/reports/reprint',                          perm: { sub: 'reports', tab: 'reprint' } },
      { label: 'Departmental Performance',          path: '/clinic/reports/department-performance',           perm: { sub: 'reports', tab: 'departmental-performance' } },
      { label: 'Doctor Departmental Performance',   path: '/clinic/reports/doctor-departmental-performance',  perm: { sub: 'reports', tab: 'doctor-departmental-performance' } },
      { label: 'Admission Report',                  path: '/clinic/reports/admission-wise',                   perm: { sub: 'reports', tab: 'admission-wise' } },
      { label: 'OT Register',                       path: '/clinic/reports/ot-register',                     perm: { sub: 'reports', tab: 'ot-register' } },
      { label: 'Birth Certificate',                 path: '/clinic/reports/birth-certificate',               perm: { sub: 'reports', tab: 'birth-certificate' } },
      { label: 'Appointment Register',              path: '/clinic/reports/appointment',                     perm: { sub: 'reports', tab: 'appointment' } },
      { label: 'Department wise Patients',          path: '/clinic/reports/department-patients',             perm: { sub: 'reports', tab: 'department-patients' } },
      { label: 'User by Date Summary',              path: '/clinic/reports/user-date-summary',               perm: { sub: 'reports', tab: 'user-date-summary' } },
      { label: 'Patients List',                     path: '/clinic/reports/patients-list',                   perm: { sub: 'reports', tab: 'patients-list' } },
      { label: 'Consultant Wise Patients',          path: '/clinic/reports/consultant-wise',                 perm: { sub: 'reports', tab: 'consultant-wise' } },
      { label: 'Death Certificate Report',          path: '/clinic/reports/death-certificate',               perm: { sub: 'reports', tab: 'death-certificate' } },
      { label: 'Discharge Certificate Report',      path: '/clinic/reports/discharge-certificate',           perm: { sub: 'reports', tab: 'discharge-certificate' } },
      { label: 'Antenatal Report',                  path: '/clinic/reports/antenatal',                      perm: { sub: 'reports', tab: 'antenatal' } },
      { label: 'Admission Status Change Report',    path: '/clinic/reports/admission-status-change',         perm: { sub: 'reports', tab: 'admission-status-change' } },
      { label: 'Status Change History Report',      path: '/clinic/reports/status-change-history',           perm: { sub: 'reports', tab: 'status-change-history' } },
    ],
  },
  { label: 'File', items: [] },
  {
    label: 'Parameters',
    items: [
      { label: 'Department',           path: '/clinic/parameters/department',       perm: { sub: 'department' } },
      { label: 'Sub Department',       path: '/clinic/parameters/sub-department',   perm: { sub: 'sub-department' } },
      { label: 'Staff Category',       path: '/clinic/parameters/staff-category',   perm: { sub: 'staff-category' } },
      { label: 'Doctors / Consultant', path: '/clinic/parameters/doctors',          perm: { sub: 'doctors' } },
      { label: 'Room Category',        path: '/clinic/parameters/room-category',    perm: { sub: 'room-category' } },
      { label: 'Bed',                  path: '/clinic/parameters/bed',              perm: { sub: 'bed' } },
      { label: 'Bill Heads',           path: '/clinic/parameters/bill-heads',       perm: { sub: 'bill-heads' } },
      { label: 'Surgery Type',         path: '/clinic/parameters/surgery-types',    perm: { sub: 'surgery-types' } },
      { label: 'Symptoms',             path: '/clinic/parameters/symptoms',         perm: { sub: 'symptoms' } },
      { label: 'Diseases',             path: '/clinic/parameters/diseases',         perm: { sub: 'diseases' } },
      { label: 'Upload Document Type', path: '/clinic/parameters/document-types',   perm: { sub: 'document-types' } },
      { label: 'Discharge Type',       path: '/clinic/parameters/discharge-types',  perm: { sub: 'discharge-types' } },
      { label: 'Shift',                path: '/clinic/parameters/shift',            perm: { sub: 'shift' } },
      { label: 'Credit Card %',        path: '/clinic/parameters/credit-card',      perm: { sub: 'credit-card' } },
      { label: 'Death Certificate',    path: '/clinic/parameters/death-certificate', perm: { sub: 'death-certificate' } },
      { label: 'Pharmacy Stores',      path: '/clinic/parameters/pharmacy-stores',  perm: { sub: 'pharmacy-stores' } },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { label: 'General OPD',      path: '/clinic/general-opd',   perm: { sub: 'general-opd' } },
      { label: 'Emergency OPD',    path: '/clinic/emergency-opd', perm: { sub: 'general-opd' } },
      { label: 'Slip - Ambulance', path: '/clinic/ambulance',     perm: { sub: 'general-opd' } },
      { label: 'Antenatal',        path: '/clinic/antenatal',     perm: { sub: 'antenatal' } },
      // Cross-module links — always visible if user has clinic access
      { label: 'General Payment',  path: '/accounts/non-corporate/transactions/voucher-expense/form' },
      { label: 'Mark Attendance',  path: '/attendance' },
      { label: 'Short Leave',      path: '/shortleave' },
      { label: 'Gate Pass',        path: '/gatepass' },
      { label: 'Receive Balance against Slip',          path: '/clinic/transactions/receive-balance-slip',     perm: { sub: 'transactions', tab: 'receive-balance-slip' } },
      { label: 'Cancel Slip',                           path: '/clinic/transactions/cancel-slip',              perm: { sub: 'transactions', tab: 'cancel-slip' } },
      { label: 'Slip Refund',                           path: '/clinic/transactions/slip-refund',              perm: { sub: 'transactions', tab: 'slip-refund' } },
      { label: 'Slip Adjustment',                       path: '/clinic/transactions/slip-adjustment',          perm: { sub: 'transactions', tab: 'slip-adjustment' } },
      { label: 'Slip Transfer',                         path: '/clinic/transactions/slip-transfer',            perm: { sub: 'transactions', tab: 'slip-transfer' } },
      { label: 'Receiving against Admission',           path: '/clinic/transactions/receiving-against-admission', perm: { sub: 'transactions', tab: 'receiving-against-admission' } },
      { label: 'Discount & Refund Against Admission',   path: '/clinic/transactions/discount-refund-admission', perm: { sub: 'transactions', tab: 'discount-refund-admission' } },
      { label: 'Appointment',                           path: '/clinic/transactions/appointment',              perm: { sub: 'transactions', tab: 'appointment' } },
      { label: 'OT Register',                           path: '/clinic/transactions/ot-register',              perm: { sub: 'transactions', tab: 'ot-register' } },
      { label: 'Birth Certificate',                     path: '/clinic/transactions/birth-certificate',        perm: { sub: 'transactions', tab: 'birth-certificate' } },
      { label: 'Admission Adjustment',                  path: '/clinic/transactions/admission-adjustment',     perm: { sub: 'transactions', tab: 'admission-adjustment' } },
      { label: 'Admission Status Change',               path: '/clinic/transactions/admission-status-change',  perm: { sub: 'transactions', tab: 'admission-status-change' } },
      { label: 'Bed Shifting',                          path: '/clinic/transactions/bed-shifting',             perm: { sub: 'transactions', tab: 'bed-shifting' } },
      { label: 'Bed Status',                            path: '/clinic/transactions/bed-status',               perm: { sub: 'transactions', tab: 'bed-status' } },
      { label: 'Upload Patient Document',               path: '/clinic/transactions/upload-patient-document',  perm: { sub: 'transactions', tab: 'upload-patient-document' } },
    ],
  },
  {
    label: 'Panels',
    items: [
      {
        label: 'Parameter',
        subItems: [
          { label: 'Panel Companies', path: '/clinic/panels/companies', perm: { sub: 'panels', tab: 'companies' } },
          { label: 'Panel Employees', path: '/clinic/panels/employees', perm: { sub: 'panels', tab: 'employees' } },
          { label: 'Bill Head',       path: '/clinic/panels/bill-heads', perm: { sub: 'panels', tab: 'bill-heads' } },
        ],
      },
      {
        label: 'Transaction',
        subItems: [
          { label: 'Provisional Bill', path: '/clinic/panels/provisional-bill', perm: { sub: 'panels', tab: 'provisional-bill' } },
          { label: 'Billing',          path: '/clinic/panels/billing',          perm: { sub: 'panels', tab: 'billing' } },
        ],
      },
      {
        label: 'Reports',
        subItems: [
          { label: 'Bill Comparison Report', path: '/clinic/panels/bill-comparison', perm: { sub: 'panels', tab: 'bill-comparison' } },
          { label: 'Billing Detail Report',  path: '/clinic/panels/billing-detail',  perm: { sub: 'panels', tab: 'billing-detail' } },
        ],
      },
    ],
  },
  {
    label: 'Inquiries',
    items: [
      { label: 'Revenue Dashboard', path: '/clinic/inquiries/revenue-dashboard', perm: { sub: 'inquiries', tab: 'revenue-dashboard' } },
      { label: 'Patient Documents', path: '/clinic/inquiries/patient-documents', perm: { sub: 'inquiries', tab: 'patient-documents' } },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Provisional Bill',     path: '/clinic/billing/provisional-bill', perm: { sub: 'billing', tab: 'provisional-bill' } },
      { label: 'Discharge and Refund', path: '/clinic/discharge-refund',         perm: { sub: 'billing', tab: 'discharge-refund' } },
    ],
  },
];

// ─── Permission helpers (pure functions — safe to call outside component) ──────
function buildCanSee(user) {
  return function canSee(perm) {
    if (!perm) return true;
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return hasPermission(user, 'clinic', perm.sub, perm.tab || null);
  };
}

function getVisibleItems(items, canSee) {
  const result = [];
  for (const item of items) {
    if (item.subItems) {
      const visibleSubs = item.subItems.filter((s) => canSee(s.perm));
      if (visibleSubs.length > 0) result.push({ ...item, subItems: visibleSubs });
    } else if (canSee(item.perm)) {
      result.push(item);
    }
  }
  return result;
}

function menuHasAccess(menu, canSee) {
  if (menu.items.length === 0) return true; // "File" — always show (Coming Soon)
  return menu.items.some((item) => {
    if (item.subItems) return item.subItems.some((s) => canSee(s.perm));
    return canSee(item.perm);
  });
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function ClinicMenuBar() {
  const { user } = useAuthStore();
  const [openMenu, setOpenMenu] = useState(null);
  const [openSub, setOpenSub] = useState(null);
  const barRef = useRef(null);
  const navigate = useNavigate();

  const canSee = buildCanSee(user);
  const visibleMenus = menuItems.filter((m) => menuHasAccess(m, canSee));

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setOpenMenu(null);
        setOpenSub(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleMenuClick(label) {
    setOpenMenu(openMenu === label ? null : label);
    setOpenSub(null);
  }

  function handleItemClick(path) {
    navigate(path);
    setOpenMenu(null);
    setOpenSub(null);
  }

  function renderItem(item) {
    if (item.subItems) {
      return (
        <div
          key={item.label}
          className={`menu-dropdown-item menu-dropdown-item--parent ${openSub === item.label ? 'menu-dropdown-item--parent-open' : ''}`}
          onClick={(e) => { e.stopPropagation(); setOpenSub(openSub === item.label ? null : item.label); }}
        >
          <span>{item.label}</span>
          <ChevronRight size={13} className="menu-chevron" />
          {openSub === item.label && (
            <div className="menu-submenu">
              {item.subItems.map((sub) => (
                <button
                  key={sub.label}
                  className="menu-dropdown-item"
                  onClick={(e) => { e.stopPropagation(); handleItemClick(sub.path); }}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (item.path) {
      return (
        <button key={item.label} className="menu-dropdown-item" onClick={() => handleItemClick(item.path)}>
          {item.label}
        </button>
      );
    }

    return (
      <div key={item.label} className="menu-dropdown-item menu-dropdown-item--soon">
        {item.label}
        <span className="menu-soon-tag">Soon</span>
      </div>
    );
  }

  return (
    <nav className="clinic-menu-bar" ref={barRef}>
      {visibleMenus.map((menu) => {
        const visibleItems = getVisibleItems(menu.items, canSee);
        return (
          <div key={menu.label} className="menu-item-wrapper">
            <button
              className={`menu-label ${openMenu === menu.label ? 'menu-label--active' : ''}`}
              onClick={() => handleMenuClick(menu.label)}
            >
              {menu.label}
            </button>

            {openMenu === menu.label && (
              <div className="menu-dropdown">
                {menu.items.length === 0
                  ? <p className="menu-dropdown-empty">Coming Soon</p>
                  : visibleItems.length === 0
                    ? <p className="menu-dropdown-empty">Access Restricted</p>
                    : visibleItems.map(renderItem)
                }
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
