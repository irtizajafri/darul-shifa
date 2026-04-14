import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FlaskConical,
  Package,
  Stethoscope,
  Wallet,
  ArrowLeft,
  Clock,
  DoorOpen,
  Timer,
  CreditCard,
  BarChart3,
  Lock,
  Settings,
  ShoppingCart,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useModuleStore } from '../../store/useModuleStore';

const mainNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/employee-module', label: 'Employee Mgmt', icon: Users, module: 'employee' },
  { path: '/coming-soon', label: 'Laboratories', icon: FlaskConical, module: 'lab' },
  { path: '/inventory-module', label: 'Inventory Mgmt', icon: Package, module: 'inventory' },
  { path: '/coming-soon', label: 'Clinic', icon: Stethoscope, module: 'clinic' },
  { path: '/coming-soon', label: 'Accounts', icon: Wallet, module: 'accounts' },
];


const inventoryNavItems = [
  { path: '/dashboard', label: 'Main Dashboard', icon: ArrowLeft, clearModule: true },
  { path: '/inventory-module', label: 'Inventory Dashboard', icon: LayoutDashboard },
  { path: '/inventory/master-setup', label: 'Master Setup', icon: Settings },
  { path: '/inventory/po', label: 'Purchase Orders', icon: ShoppingCart },
  { path: '/inventory/grn', label: 'Receiving (GRN)', icon: Truck },
  { path: '/inventory/gin', label: 'Issuance (GIN)', icon: ArrowUpRight },
  { path: '/inventory/gdn', label: 'Discard (GDN)', icon: ArrowDownRight },
  { path: '/inventory/reports', label: 'Reports', icon: BarChart3 },
];

const employeeNavItems = [
  { path: '/dashboard', label: 'Main Dashboard', icon: ArrowLeft, clearModule: true },
  { path: '/employee-module', label: 'HR Dashboard', icon: LayoutDashboard },
  { path: '/employees', label: 'Employee Database', icon: Users },
  { path: '/attendance', label: 'Attendance', icon: Clock },
  { path: '/test-attendance', label: 'Test Attendance', icon: Clock },
  { path: '/gatepass', label: 'Gate Pass', icon: DoorOpen },
  { path: '/shortleave', label: 'Short Leave', icon: Timer },
  { path: '/advance', label: 'Advance & Loan', icon: CreditCard },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
];

export default function Sidebar({ isOpen, onClose, collapsed }) {
  const { activeModule, setModule, clearModule } = useModuleStore();
  const navigate = useNavigate();

  const handleMainNavClick = (item) => {
    if (item.module === 'employee') {
      setModule('employee');
      navigate('/employee-module');
    } else if (item.module === 'inventory') {
      setModule('inventory');
      navigate('/inventory-module');
    } else if (item.module) {
      clearModule();
      navigate(item.path);
    } else {
      clearModule();
    }
  };

  const handleEmployeeNavClick = (item) => {
    if (item.clearModule) {
      clearModule();
    }
  };

  const navItemClass = ({ isActive }) =>
    clsx(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
      isActive ? 'bg-[#2563EB] text-white' : 'text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#2563EB]'
    );

  const linkContent = (item) => (
    <>
      <item.icon className="w-5 h-5 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </>
  );

  if (activeModule === 'employee') {
    return (
      <aside
        className={clsx(
          'fixed lg:sticky top-0 left-0 z-40 h-screen bg-white border-r border-[#E2E8F0] flex flex-col transition-all duration-300',
          collapsed ? 'w-[70px]' : 'w-[260px]'
        )}
      >
        <div className="p-4 border-b border-[#E2E8F0]">
          {!collapsed && (
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              HR Module
            </p>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {employeeNavItems.map((item) =>
            item.clearModule ? (
              <NavLink
                key={item.path + item.label}
                to={item.path}
                className={navItemClass}
                onClick={handleEmployeeNavClick}
              >
                {linkContent(item)}
              </NavLink>
            ) : (
              <NavLink key={item.path + item.label} to={item.path} className={navItemClass}>
                {linkContent(item)}
              </NavLink>
            )
          )}
        </nav>
      </aside>
    );
  }


  if (activeModule === 'inventory') {
    return (
      <aside
        className={clsx(
          'fixed lg:sticky top-0 left-0 z-40 h-screen bg-white border-r border-[#E2E8F0] flex flex-col transition-all duration-300',
          collapsed ? 'w-[70px]' : 'w-[260px]'
        )}
      >
        <div className="p-4 border-b border-[#E2E8F0]">
          {!collapsed && (
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
              Inventory Module
            </p>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {inventoryNavItems.map((item) =>
            item.clearModule ? (
              <NavLink
                key={item.path + item.label}
                to={item.path}
                className={navItemClass}
                onClick={handleEmployeeNavClick}
              >
                {linkContent(item)}
              </NavLink>
            ) : (
              <NavLink key={item.path + item.label} to={item.path} className={navItemClass}>
                {linkContent(item)}
              </NavLink>
            )
          )}
        </nav>
      </aside>
    );
  }

  if (activeModule && activeModule !== 'employee' && activeModule !== 'inventory') {
    return (
      <aside
        className={clsx(
          'fixed lg:sticky top-0 left-0 z-40 h-screen bg-white border-r border-[#E2E8F0] flex flex-col transition-all duration-300',
          collapsed ? 'w-[70px]' : 'w-[260px]'
        )}
      >
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <NavLink to="/dashboard" onClick={clearModule} className={navItemClass}>
            {linkContent({ label: 'Main Dashboard', icon: ArrowLeft })}
          </NavLink>
          <div className={clsx('px-3 py-2', collapsed && 'hidden')}>
            <p className="text-xs text-[#64748B] opacity-60">Module Coming Soon</p>
          </div>
          <div className="opacity-50 cursor-not-allowed flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <Lock className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Module Coming Soon</span>}
          </div>
        </nav>
      </aside>
    );
  }

  return (
    <aside
      className={clsx(
        'fixed lg:sticky top-0 left-0 z-40 h-screen bg-white border-r border-[#E2E8F0] flex flex-col transition-all duration-300',
        collapsed ? 'w-[70px]' : 'w-[260px]',
        !isOpen && 'hidden lg:flex'
      )}
    >
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) =>
          item.module ? (
            <NavLink
              key={item.path + item.label}
              to={item.path}
              className={navItemClass}
              onClick={() => handleMainNavClick(item)}
            >
              {linkContent(item)}
            </NavLink>
          ) : (
            <NavLink key={item.path + item.label} to={item.path} className={navItemClass}>
              {linkContent(item)}
            </NavLink>
          )
        )}
      </nav>
    </aside>
  );
}
