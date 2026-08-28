import { memo, useEffect } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useTabStore } from '../../store/useTabStore';
import ProtectedRoutes from '../../routes/ProtectedRoutes';
import { resolveTabLabel } from '../../utils/tabLabels';

// Registers this tab's own navigate() into the tab store (see useTabStore's
// navigateActiveTab), keeps the tab's remembered `currentPath` in sync for
// TabBar/Sidebar/Command-Palette bookkeeping, and re-derives the tab's
// label/icon from wherever it actually is now (see resolveTabLabel).
//
// Deriving the label here — from the real location, on every navigation —
// instead of only from one specific click handler (Sidebar's old `go()`)
// is what makes it correct regardless of *how* the tab got here: a Sidebar
// click, a card on the Main Dashboard, a Link inside some page, or the
// user hitting back/forward inside this tab's own history. Any one-off
// "update the label here" call is guaranteed to miss some other path.
//
// Switching tabs itself never calls this navigate — each tab's
// <MemoryRouter> already remembers its own last location on its own, it
// just needs to become visible again.
function TabRouteSync({ tabId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const registerTabNavigate = useTabStore((s) => s.registerTabNavigate);
  const unregisterTabNavigate = useTabStore((s) => s.unregisterTabNavigate);
  const updateTabPath = useTabStore((s) => s.updateTabPath);
  const updateTabLabel = useTabStore((s) => s.updateTabLabel);

  useEffect(() => {
    registerTabNavigate(tabId, navigate);
    return () => unregisterTabNavigate(tabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, navigate]);

  useEffect(() => {
    updateTabPath(tabId, location.pathname + location.search);
    const { label, Icon } = resolveTabLabel(location.pathname);
    updateTabLabel(tabId, label, Icon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, location.pathname, location.search]);

  return null;
}

// Each open tab gets its own isolated <MemoryRouter> + the full route tree,
// mounted once and kept alive for as long as the tab stays open. Switching
// tabs only toggles which one is visible (opacity/display for the rest) — it
// never unmounts a tab's page, which is what actually preserves in-progress
// work (a loaded patient, a half-filled form) when the user hops to another
// tab and back. The old design shared one <Outlet/> across every tab, so
// switching tabs re-mounted the target page from scratch every time.
//
// A fully isolated router per tab (not just a cached element under one
// shared location) also matters for correctness, not just state: several
// pages drive a one-shot action off their own ?xxx=&autoprint=1 query string
// (Provisional Bill, Final Bill, Antenatal, Discount/Refund reprint, ...).
// With one shared location, a hidden background tab would see the active
// tab's search params change and could silently re-fire its own autoprint
// effect. A <MemoryRouter> per tab means each tab's location/searchParams
// are genuinely its own, so that can't happen.
//
// Wrapped in memo() and given only primitive props (tabId/initialPath/
// isActive, never the whole `tab` object) so that typing/navigating in one
// tab — which updates that tab's `currentPath` in the store on every
// keystroke-triggered route change — doesn't cascade a re-render into every
// *other* open tab's already-mounted page. Without this, a heavy page
// sitting in a background tab (a big grid, a report) would silently
// re-render every time you did anything in the tab you're actually using.
const TabInstance = memo(function TabInstance({ tabId, initialPath, isActive }) {
  return (
    <div
      className={isActive ? 'tabs-container__pane tabs-container__pane--active' : 'tabs-container__pane'}
      style={{ display: isActive ? 'block' : 'none' }}
    >
      <MemoryRouter initialEntries={[initialPath]}>
        <TabRouteSync tabId={tabId} />
        <ProtectedRoutes />
      </MemoryRouter>
    </div>
  );
});

export default function TabsContainer() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);

  return (
    <main className="flex-1 p-4 lg:p-6 overflow-auto">
      {tabs.map((tab) => (
        <TabInstance key={tab.id} tabId={tab.id} initialPath={tab.path} isActive={tab.id === activeTabId} />
      ))}
    </main>
  );
}
