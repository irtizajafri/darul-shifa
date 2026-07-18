import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import './ClinicMenuBar.scss';

const menuItems = [
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
    ],
  },
  {
    label: 'Transactions',
    items: [
      { label: 'General OPD', path: '/clinic/general-opd' },
      { label: 'Emergency OPD', path: '/clinic/emergency-opd' },
      { label: 'Antenatal',   path: '/clinic/antenatal' },
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
        label: 'Reports',
        subItems: [
          { label: 'Bill Comparison Report', path: '/clinic/panels/bill-comparison' },
        ],
      },
    ],
  },
  { label: 'Inquiries', items: [] },
  {
    label: 'Report',
    items: [
      { label: 'Patients List',            path: '/clinic/reports/patients-list' },
      { label: 'Consultant Wise Patients', path: '/clinic/reports/consultant-wise' },
    ],
  },
  { label: 'Window',    items: [] },
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
