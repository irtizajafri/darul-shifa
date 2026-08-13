import { useNavigate, useLocation } from 'react-router-dom';
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
  FileText,
  Wrench,
  ShieldCheck,
  UserRound,
  Plus,
} from 'lucide-react';
import clsx from 'clsx';
import { useModuleStore } from '../../store/useModuleStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useTabStore } from '../../store/useTabStore';

const inventoryNavItems = [
  { path: '/dashboard', label: 'Main Dashboard', Icon: ArrowLeft, toDashboard: true },
  { path: '/inventory-module', label: 'Inventory Dashboard', Icon: LayoutDashboard },
  { path: '/inventory/master-setup', label: 'Master Setup', Icon: Settings },
  { path: '/inventory/po', label: 'Purchase Orders', Icon: ShoppingCart, state: { openCreate: true } },
  { path: '/inventory/grn', label: 'Receiving (GRN)', Icon: Truck, state: { openCreate: true } },
  { path: '/inventory/gin', label: 'Issuance (GIN)', Icon: ArrowUpRight },
  { path: '/inventory/sales-invoice', label: 'Sales Invoice', Icon: FileText },
  { path: '/inventory/gdn', label: 'Discard (GDN)', Icon: ArrowDownRight },
  { path: '/inventory/maintenance', label: 'Maintenance', Icon: Wrench },
  { path: '/inventory/reports', label: 'Reports', Icon: BarChart3 },
];

const accountsNavItems = [
  { path: '/dashboard', label: 'Main Dashboard', Icon: ArrowLeft, toDashboard: true },
  { path: '/accounts-module', label: 'Accounts Dashboard', Icon: LayoutDashboard },
  { path: '/accounts/corporate/parameters', label: 'Corporate — Parameters', Icon: Settings },
  { path: '/accounts/non-corporate/parameters', label: 'Non-Corporate — Parameters', Icon: Settings },
  { path: '/accounts/corporate/reports', label: 'Corporate — Reports', Icon: BarChart3 },
  { path: '/accounts/non-corporate/reports', label: 'Non-Corporate — Reports', Icon: BarChart3 },
];

const clinicNavItems = [
  { path: '/dashboard', label: 'Main Dashboard', Icon: ArrowLeft, toDashboard: true },
  { path: '/clinic-module', label: 'Clinic Dashboard', Icon: LayoutDashboard },
  { path: '/clinic/general-opd', label: 'General OPD', Icon: UserRound },
];

const employeeNavItems = [
  { path: '/dashboard', label: 'Main Dashboard', Icon: ArrowLeft, toDashboard: true },
  { path: '/employee-module', label: 'HR Dashboard', Icon: LayoutDashboard },
  { path: '/employees', label: 'Employee Database', Icon: Users },
  { path: '/attendance', label: 'Attendance', Icon: Clock },
  { path: '/test-attendance', label: 'Test Attendance', Icon: Clock },
  { path: '/gatepass', label: 'Gate Pass', Icon: DoorOpen },
  { path: '/shortleave', label: 'Short Leave', Icon: Timer },
  { path: '/advance', label: 'Advance & Loan', Icon: CreditCard },
  { path: '/reports', label: 'Reports', Icon: BarChart3 },
];

function NewTabButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="New Tab"
      className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
    >
      <Plus className="w-4 h-4" />
    </button>
  );
}

export default function Sidebar({ isOpen, onClose, collapsed }) {
  const { activeModule, setModule, clearModule } = useModuleStore();
  const { user } = useAuthStore();
  const { activeTabId, createNewTab, updateTabModule, updateTabLabel } = useTabStore();
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  const navClass = (path) =>
    clsx(
      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer',
      currentPath === path || (path !== '/dashboard' && currentPath.startsWith(path + '/'))
        ? 'bg-[#2563EB] text-white'
        : 'text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#2563EB]'
    );

  const navItem = (item) => (
    <>
      <item.Icon className="w-5 h-5 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </>
  );

  const go = (path, module, state, label, Icon) => {
    if (module !== undefined) {
      if (module) setModule(module);
      else clearModule();
      updateTabModule(activeTabId, module);
    }
    if (label) updateTabLabel(activeTabId, label, Icon);
    if (state) navigate(path, { state });
    else navigate(path);
    onClose();
  };

  const handleNewTab = () => {
    createNewTab();
    clearModule();
    navigate('/dashboard');
    onClose();
  };

  const sidebarClass = clsx(
    'fixed lg:sticky top-0 left-0 z-40 h-screen bg-white border-r border-[#E2E8F0] flex flex-col transition-all duration-300',
    collapsed ? 'w-[70px]' : 'w-[260px]',
    !isOpen && 'hidden'
  );

  if (activeModule === 'employee') {
    return (
      <aside className={sidebarClass}>
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          {!collapsed && <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">HR Module</p>}
          <NewTabButton onClick={handleNewTab} />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {employeeNavItems.map((item) => (
            <div
              key={item.path + item.label}
              className={navClass(item.path)}
              onClick={() => item.toDashboard ? go('/dashboard', null, undefined, item.label, item.Icon) : go(item.path, undefined, undefined, item.label, item.Icon)}
            >
              {navItem(item)}
            </div>
          ))}
        </nav>
      </aside>
    );
  }

  if (activeModule === 'accounts') {
    return (
      <aside className={sidebarClass}>
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          {!collapsed && <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Accounts Module</p>}
          <NewTabButton onClick={handleNewTab} />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {accountsNavItems.map((item) => (
            <div
              key={item.path + item.label}
              className={navClass(item.path)}
              onClick={() => item.toDashboard ? go('/dashboard', null, undefined, item.label, item.Icon) : go(item.path, undefined, undefined, item.label, item.Icon)}
            >
              {navItem(item)}
            </div>
          ))}
        </nav>
      </aside>
    );
  }

  if (activeModule === 'inventory') {
    return (
      <aside className={sidebarClass}>
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          {!collapsed && <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Inventory Module</p>}
          <NewTabButton onClick={handleNewTab} />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {inventoryNavItems.map((item) => (
            <div
              key={item.path + item.label}
              className={navClass(item.path)}
              onClick={() => item.toDashboard ? go('/dashboard', null, undefined, item.label, item.Icon) : go(item.path, undefined, item.state, item.label, item.Icon)}
            >
              {navItem(item)}
            </div>
          ))}
        </nav>
      </aside>
    );
  }

  if (activeModule === 'clinic') {
    return (
      <aside className={sidebarClass}>
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          {!collapsed && <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Clinic Module</p>}
          <NewTabButton onClick={handleNewTab} />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {clinicNavItems.map((item, i) => {
            if (item.section) {
              return !collapsed ? (
                <div key={i} className="px-3 pt-3 pb-1">
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">{item.section}</p>
                </div>
              ) : <div key={i} className="border-t border-[#E2E8F0] my-1" />;
            }
            return (
              <div
                key={item.path + item.label}
                className={navClass(item.path)}
                onClick={() => item.toDashboard ? go('/dashboard', null, undefined, item.label, item.Icon) : go(item.path, undefined, undefined, item.label, item.Icon)}
              >
                {navItem(item)}
              </div>
            );
          })}
        </nav>
      </aside>
    );
  }

  if (activeModule) {
    return (
      <aside className={sidebarClass}>
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          {!collapsed && <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Module</p>}
          <NewTabButton onClick={handleNewTab} />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className={navClass('/dashboard')} onClick={() => go('/dashboard', null, undefined, 'Dashboard', LayoutDashboard)}>
            <ArrowLeft className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Main Dashboard</span>}
          </div>
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

  // Main nav
  const mainItems = [
    { path: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, module: null },
    { path: '/employee-module', label: 'Employee Mgmt', Icon: Users, module: 'employee' },
    { path: '/coming-soon', label: 'Laboratories', Icon: FlaskConical, module: 'lab' },
    { path: '/inventory-module', label: 'Inventory Mgmt', Icon: Package, module: 'inventory' },
    { path: '/clinic-module', label: 'Clinic', Icon: Stethoscope, module: 'clinic' },
    { path: '/accounts-module', label: 'Accounts', Icon: Wallet, module: 'accounts' },
  ];

  return (
    <aside className={sidebarClass}>
      <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
        {!collapsed && <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Main Menu</p>}
        <NewTabButton onClick={handleNewTab} />
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {mainItems.map((item) => (
          <div
            key={item.path + item.label}
            className={navClass(item.path)}
            onClick={() => go(item.path, item.module ?? null, undefined, item.label, item.Icon)}
          >
            <item.Icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </div>
        ))}

        {user?.isSuperAdmin && (
          <div
            className={navClass('/admin/users')}
            onClick={() => go('/admin/users', null, undefined, 'User Management', ShieldCheck)}
          >
            <ShieldCheck className="w-5 h-5 shrink-0" />
            {!collapsed && <span>User Management</span>}
          </div>
        )}
      </nav>
    </aside>
  );
}
