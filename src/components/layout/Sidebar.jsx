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
} from 'lucide-react';
import clsx from 'clsx';
import { useModuleStore } from '../../store/useModuleStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useTabStore } from '../../store/useTabStore';
import { hasPermission } from '../../utils/permissions';

const inventoryNavItems = [
  { path: '/dashboard',              label: 'Main Dashboard',     Icon: ArrowLeft,      toDashboard: true },
  { path: '/inventory-module',       label: 'Inventory Dashboard', Icon: LayoutDashboard },
  { path: '/inventory/master-setup', label: 'Master Setup',       Icon: Settings,       subModule: 'master-setup' },
  { path: '/inventory/po',           label: 'Purchase Orders',    Icon: ShoppingCart,   subModule: 'po',               state: { openCreate: true } },
  { path: '/inventory/grn',          label: 'Receiving (GRN)',    Icon: Truck,          subModule: 'grn',              state: { openCreate: true } },
  { path: '/inventory/gin',          label: 'Issuance (GIN)',     Icon: ArrowUpRight,   subModule: 'gin',  altSubModule: 'gd' },
  { path: '/inventory/sales-invoice', label: 'Sales Invoice',     Icon: FileText,       subModule: 'sales-invoice' },
  { path: '/inventory/gdn',          label: 'Discard (GDN)',      Icon: ArrowDownRight, subModule: 'gdn' },
  { path: '/inventory/mrn',          label: 'Material Return (MRN)', Icon: ArrowUpRight, subModule: 'mrn' },
  { path: '/inventory/maintenance',  label: 'Maintenance',        Icon: Wrench,         subModule: 'maintenance' },
  { path: '/inventory/fuel',         label: 'Fuel Management',    Icon: BarChart3,      subModule: 'fuel' },
  { path: '/inventory/utilities-bill', label: 'Utilities Bill',   Icon: BarChart3,      subModule: 'utilities-bill' },
  { path: '/inventory/reports',      label: 'Reports',            Icon: BarChart3,      subModule: 'inventory-reports' },
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
  { path: '/dashboard',        label: 'Main Dashboard',    Icon: ArrowLeft,      toDashboard: true },
  { path: '/employee-module',  label: 'HR Dashboard',      Icon: LayoutDashboard },
  { path: '/employees',        label: 'Employee Database', Icon: Users,          subModule: 'employee-database' },
  { path: '/attendance',       label: 'Attendance',        Icon: Clock,          subModule: 'attendance' },
  { path: '/gatepass',         label: 'Gate Pass',         Icon: DoorOpen,       subModule: 'gatepass' },
  { path: '/shortleave',       label: 'Short Leave',       Icon: Timer,          subModule: 'shortleave' },
  { path: '/advance',          label: 'Advance & Loan',    Icon: CreditCard,     subModule: 'advance' },
  { path: '/reports',          label: 'Reports',           Icon: BarChart3,      subModule: 'reports' },
  { path: '/leave-encashment', label: 'Leave Encashment',  Icon: CreditCard,     subModule: 'leave-encashment' },
];

export default function Sidebar({ isOpen, onClose, collapsed }) {
  const { activeModule, setModule, clearModule } = useModuleStore();
  const { user } = useAuthStore();
  // Individual selectors, not a whole-store destructure: every keystroke
  // navigation in ANY open tab touches the store's `tabPaths` map, so
  // subscribing to the whole store would re-render Sidebar on every
  // navigation in every tab, not just the active one. Selecting a derived
  // primitive (a string) for currentPath, and the action functions
  // individually (zustand keeps those referentially stable forever), means
  // Sidebar only re-renders when something it actually displays changes.
  // (New-tab creation moved to Navbar, next to the hamburger button.)
  const activeTabId = useTabStore((s) => s.activeTabId);
  const updateTabModule = useTabStore((s) => s.updateTabModule);
  const navigateActiveTab = useTabStore((s) => s.navigateActiveTab);
  // Sidebar lives outside every tab's own <MemoryRouter> (it's shared chrome,
  // not per-tab content), so it can't read "the current page" via
  // useLocation() any more — that hook would resolve to the outer,
  // effectively-static shell router instead. The active tab's own
  // remembered path (kept in sync by TabRouteSync) is the real answer.
  const currentPath = useTabStore((s) => (s.tabPaths[s.activeTabId] || '/dashboard').split('?')[0]);

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

  // Tab label/icon are no longer set from here — TabRouteSync (see
  // TabsContainer.jsx) derives them straight from wherever the tab actually
  // lands, so they stay correct even for navigation that never goes through
  // Sidebar at all (a card on the Main Dashboard, a Link inside a page).
  const go = (path, module, state) => {
    if (module !== undefined) {
      if (module) setModule(module);
      else clearModule();
      updateTabModule(activeTabId, module);
    }
    navigateActiveTab(path, state ? { state } : undefined);
    onClose();
  };

  const sidebarClass = clsx(
    'fixed lg:sticky top-0 left-0 z-40 h-screen bg-white border-r border-[#E2E8F0] flex flex-col transition-all duration-300',
    collapsed ? 'w-[70px]' : 'w-[260px]',
    !isOpen && 'hidden'
  );

  if (activeModule === 'employee') {
    const visibleEmpItems = employeeNavItems.filter(
      (item) => item.toDashboard || !item.subModule || user?.isSuperAdmin || hasPermission(user, 'employee', item.subModule)
    );
    return (
      <aside className={sidebarClass}>
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          {!collapsed && <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">HR Module</p>}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleEmpItems.map((item) => (
            <div
              key={item.path + item.label}
              className={navClass(item.path)}
              onClick={() => item.toDashboard ? go('/dashboard', null) : go(item.path)}
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
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {accountsNavItems.map((item) => (
            <div
              key={item.path + item.label}
              className={navClass(item.path)}
              onClick={() => item.toDashboard ? go('/dashboard', null) : go(item.path)}
            >
              {navItem(item)}
            </div>
          ))}
        </nav>
      </aside>
    );
  }

  if (activeModule === 'inventory') {
    const visibleInvItems = inventoryNavItems.filter(
      (item) =>
        item.toDashboard ||
        !item.subModule ||
        user?.isSuperAdmin ||
        hasPermission(user, 'inventory', item.subModule) ||
        (item.altSubModule && hasPermission(user, 'inventory', item.altSubModule))
    );
    return (
      <aside className={sidebarClass}>
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          {!collapsed && <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Inventory Module</p>}
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleInvItems.map((item) => (
            <div
              key={item.path + item.label}
              className={navClass(item.path)}
              onClick={() => item.toDashboard ? go('/dashboard', null) : go(item.path, undefined, item.state)}
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
                onClick={() => item.toDashboard ? go('/dashboard', null) : go(item.path)}
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
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className={navClass('/dashboard')} onClick={() => go('/dashboard', null)}>
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
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {mainItems
          .filter((item) => !item.module || user?.isSuperAdmin || hasPermission(user, item.module))
          .map((item) => (
          <div
            key={item.path + item.label}
            className={navClass(item.path)}
            onClick={() => go(item.path, item.module ?? null)}
          >
            <item.Icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </div>
        ))}

        {user?.isSuperAdmin && (
          <div
            className={navClass('/admin/users')}
            onClick={() => go('/admin/users', null)}
          >
            <ShieldCheck className="w-5 h-5 shrink-0" />
            {!collapsed && <span>User Management</span>}
          </div>
        )}
      </nav>
    </aside>
  );
}
