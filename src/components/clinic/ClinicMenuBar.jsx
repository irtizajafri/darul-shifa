import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import './ClinicMenuBar.scss';

const menuItems = [
  {
    label: 'Report',
    items: [
      { label: 'Reprint',                  path: '/clinic/reports/reprint' },
      { label: 'Departmental Performance', path: '/clinic/reports/department-performance' },
      { label: 'Doctor Departmental Performance', path: '/clinic/reports/doctor-departmental-performance' },
      { label: 'Admission Report', path: '/clinic/reports/admission-wise' },
      { label: 'OT Register', path: '/clinic/reports/ot-register' },
      { label: 'Birth Certificate', path: '/clinic/reports/birth-certificate' },
      { label: 'Appointment Register', path: '/clinic/reports/appointment' },
      { label: 'Department wise Patients', path: '/clinic/reports/department-patients' },
      { label: 'User by Date Summary', path: '/clinic/reports/user-date-summary' },
      { label: 'Patients List',            path: '/clinic/reports/patients-list' },
      { label: 'Consultant Wise Patients', path: '/clinic/reports/consultant-wise' },
      { label: 'Death Certificate Report', path: '/clinic/reports/death-certificate' },
      { label: 'Admission Status Change Report', path: '/clinic/reports/admission-status-change' },
    ],
  },
  { label: 'File', items: [] },
  {
    label: 'Parameters',
    items: [
      { label: 'Department',           path: '/clinic/parameters/department' },
      { label: 'Sub Department',       path: '/clinic/parameters/sub-department' },
      { label: 'Staff Category',       path: '/clinic/parameters/staff-category' },
      { label: 'Doctors / Consultant', path: '/clinic/parameters/doctors' },
      { label: 'Room Category',        path: '/clinic/parameters/room-category' },
      { label: 'Bed',                  path: '/clinic/parameters/bed' },
      { label: 'Bill Heads',           path: '/clinic/parameters/bill-heads' },
      { label: 'Surgery Type',         path: '/clinic/parameters/surgery-types' },
      { label: 'Symptoms',             path: '/clinic/parameters/symptoms' },
      { label: 'Diseases',             path: '/clinic/parameters/diseases' },
      { label: 'Upload Document Type', path: '/clinic/parameters/document-types' },
      { label: 'Discharge Type',       path: '/clinic/parameters/discharge-types' },
      { label: 'Shift',                path: '/clinic/parameters/shift' },
      { label: 'Credit Card %',        path: '/clinic/parameters/credit-card' },
      { label: 'Death Certificate',    path: '/clinic/parameters/death-certificate' },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { label: 'General OPD',     path: '/clinic/general-opd' },
      { label: 'Emergency OPD',   path: '/clinic/emergency-opd' },
      { label: 'Slip - Ambulance', path: '/clinic/ambulance' },
      { label: 'Antenatal',       path: '/clinic/antenatal' },
      { label: 'General Payment', path: '/accounts/non-corporate/transactions/voucher-expense/form' },
      { label: 'Mark Attendance', path: '/attendance' },
      { label: 'Short Leave',     path: '/shortleave' },
      { label: 'Gate Pass',                path: '/gatepass' },
      { label: 'Receive Balance against Slip', path: '/clinic/transactions/receive-balance-slip' },
      { label: 'Cancel Slip',                  path: '/clinic/transactions/cancel-slip' },
      { label: 'Slip Refund',                  path: '/clinic/transactions/slip-refund' },
      { label: 'Slip Adjustment',              path: '/clinic/transactions/slip-adjustment' },
      { label: 'Slip Transfer',                path: '/clinic/transactions/slip-transfer' },
      { label: 'Receiving against Admission',  path: '/clinic/transactions/receiving-against-admission' },
      { label: 'Discount & Refund Against Admission', path: '/clinic/transactions/discount-refund-admission' },
      { label: 'Appointment',                  path: '/clinic/transactions/appointment' },
      { label: 'OT Register',                  path: '/clinic/transactions/ot-register' },
      { label: 'Birth Certificate',             path: '/clinic/transactions/birth-certificate' },
      { label: 'Admission Adjustment',          path: '/clinic/transactions/admission-adjustment' },
      { label: 'Admission Status Change',       path: '/clinic/transactions/admission-status-change' },
      { label: 'Bed Shifting',                  path: '/clinic/transactions/bed-shifting' },
      { label: 'Bed Status',                    path: '/clinic/transactions/bed-status' },
      { label: 'Upload Patient Document',       path: '/clinic/transactions/upload-patient-document' },
    ],
  },
  {
    label: 'Panels',
    items: [
      {
        label: 'Parameter',
        subItems: [
          { label: 'Panel Companies',  path: '/clinic/panels/companies' },
          { label: 'Panel Employees',  path: '/clinic/panels/employees' },
        ],
      },
      {
        label: 'Transaction',
        subItems: [
          { label: 'Provisional Bill', path: '/clinic/panels/provisional-bill' },
        ],
      },
      {
        label: 'Reports',
        subItems: [
          { label: 'Bill Comparison Report', path: '/clinic/panels/bill-comparison' },
          { label: 'Billing Detail Report',  path: '/clinic/panels/billing-detail' },
        ],
      },
    ],
  },
  {
    label: 'Inquiries',
    items: [
      { label: 'Revenue Dashboard', path: '/clinic/inquiries/revenue-dashboard' },
      { label: 'Patient Documents', path: '/clinic/inquiries/patient-documents' },
    ],
  },
  {
    label: 'Billing',
    items: [
      { label: 'Provisional Bill', path: '/clinic/billing/provisional-bill' },
      { label: 'Discharge and Refund', path: '/clinic/discharge-refund' },
    ],
  },
];

export default function ClinicMenuBar() {
  const [openMenu, setOpenMenu] = useState(null);
  const [openSub, setOpenSub] = useState(null);
  const barRef = useRef(null);
  const navigate = useNavigate();

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

  function handleItemClick(item) {
    if (item.path) {
      navigate(item.path);
      setOpenMenu(null);
      setOpenSub(null);
    }
  }

  function handleSubItemClick(subItem) {
    if (subItem.path) {
      navigate(subItem.path);
      setOpenMenu(null);
      setOpenSub(null);
    }
  }

  return (
    <nav className="clinic-menu-bar" ref={barRef}>
      {menuItems.map((menu) => (
        <div key={menu.label} className="menu-item-wrapper">
          <button
            className={`menu-label ${openMenu === menu.label ? 'menu-label--active' : ''}`}
            onClick={() => handleMenuClick(menu.label)}
          >
            {menu.label}
          </button>

          {openMenu === menu.label && (
            <div className="menu-dropdown">
              {menu.items.length === 0 ? (
                <p className="menu-dropdown-empty">Coming Soon</p>
              ) : (
                menu.items.map((item) => {
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
                                onClick={(e) => { e.stopPropagation(); handleSubItemClick(sub); }}
                              >
                                {sub.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return item.path ? (
                    <button key={item.label} className="menu-dropdown-item" onClick={() => handleItemClick(item)}>
                      {item.label}
                    </button>
                  ) : (
                    <div key={item.label} className="menu-dropdown-item menu-dropdown-item--soon">
                      {item.label}
                      <span className="menu-soon-tag">Soon</span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
