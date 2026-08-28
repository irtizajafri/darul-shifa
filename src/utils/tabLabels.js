import {
  LayoutDashboard, Users, Package, Stethoscope, Wallet, ShieldCheck, FileText,
} from 'lucide-react';
import { PERMISSIONS_MAP } from './permissions';

// Every open tab's title/icon (see TabsContainer.jsx's TabRouteSync) is
// derived from its path here — automatically, on every navigation,
// regardless of what triggered it (a Sidebar click, a card on the Main
// Dashboard, a Link inside some page, browser back/forward within a tab).
// Anything that only updated the label from one specific click handler
// (the old design) always misses navigation that happens any other way.

// PERMISSIONS_MAP already carries a curated, human label for pretty much
// every sub-module and tab across all four modules — and route paths
// mostly end in exactly one of those keys (".../reports/patients-list" ->
// tab key 'patients-list' -> "Patients List"), so it doubles as a label
// source here instead of hand-maintaining a second, parallel path->label
// table that would inevitably drift out of sync with the real route list.
const KEY_LABELS = {};
Object.values(PERMISSIONS_MAP).forEach((mod) => {
  mod.subModules.forEach((sm) => {
    if (!(sm.key in KEY_LABELS)) KEY_LABELS[sm.key] = sm.label;
    (sm.tabs || []).forEach((t) => {
      if (!(t.key in KEY_LABELS)) KEY_LABELS[t.key] = t.label;
    });
  });
});

// Paths that don't reduce to a PERMISSIONS_MAP key at all (dashboards,
// auth-adjacent pages, employee sub-pages reached by row-click rather than
// a sidebar item).
const PATH_OVERRIDES = {
  '/dashboard': 'Dashboard',
  '/employee-module': 'HR Dashboard',
  '/inventory-module': 'Inventory Dashboard',
  '/clinic-module': 'Clinic Dashboard',
  '/accounts-module': 'Accounts Dashboard',
  '/admin/users': 'User Management',
  '/employees': 'Employee Database',
  '/employees/add': 'Add Employee',
  '/coming-soon': 'Coming Soon',
};

// One icon per module, keyed off the path's own first segment — a tab
// showing some deep clinic report doesn't need its own bespoke icon, it
// just needs to visibly read as "a Clinic tab" at a glance, same idea as a
// browser tab's generic page icon.
const MODULE_ICONS = [
  { prefix: '/clinic',   Icon: Stethoscope },
  { prefix: '/inventory', Icon: Package },
  { prefix: '/accounts', Icon: Wallet },
  { prefix: '/employee', Icon: Users },
  { prefix: '/attendance', Icon: Users },
  { prefix: '/gatepass', Icon: Users },
  { prefix: '/shortleave', Icon: Users },
  { prefix: '/advance', Icon: Users },
  { prefix: '/leave-encashment', Icon: Users },
  { prefix: '/reports', Icon: Users },
  { prefix: '/admin', Icon: ShieldCheck },
];

function iconForPath(pathname) {
  if (pathname === '/dashboard') return LayoutDashboard;
  const hit = MODULE_ICONS.find((m) => pathname.startsWith(m.prefix));
  return hit ? hit.Icon : FileText;
}

function titleCase(segment) {
  return segment.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Segments that never carry a meaningful label on their own — the segment
// *before* one of these is the real page ('/employees/42/edit' -> 'employees').
const SKIP_SEGMENTS = new Set(['view', 'new', 'edit', 'form']);

export function resolveTabLabel(pathname) {
  const clean = (pathname || '/dashboard').split('?')[0].replace(/\/+$/, '') || '/dashboard';
  const Icon = iconForPath(clean);

  if (PATH_OVERRIDES[clean]) return { label: PATH_OVERRIDES[clean], Icon };

  const segments = clean.split('/').filter(Boolean);
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    if (SKIP_SEGMENTS.has(seg) || /^\d+$/.test(seg)) continue;
    return { label: KEY_LABELS[seg] || titleCase(seg), Icon };
  }
  return { label: 'Dashboard', Icon: LayoutDashboard };
}
