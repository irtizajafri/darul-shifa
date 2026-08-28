import { memo, useEffect, useRef } from 'react';
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
  // Whether this tab's real browser-history entry has been claimed yet —
  // its very first location (mount, or a brand-new tab's '/dashboard')
  // replaces the current entry instead of pushing a new one, same reason
  // switching tabs doesn't push either: it's not a step the user took
  // *inside* a page, it's just this tab's history catching up to what's
  // already showing.
  const hasSyncedHistoryRef = useRef(false);

  useEffect(() => {
    registerTabNavigate(tabId, navigate);
    return () => unregisterTabNavigate(tabId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, navigate]);

  useEffect(() => {
    const path = location.pathname + location.search;
    updateTabPath(tabId, path);
    const { label, Icon } = resolveTabLabel(location.pathname);
    updateTabLabel(tabId, label, Icon);

    // Every open tab has its own isolated <MemoryRouter> — necessary so
    // tabs stay independent of each other, but it means none of this ever
    // touches the real browser address bar/history on its own. Mirror it
    // here, but only for whichever tab is actually visible right now (a
    // background tab navigating shouldn't hijack the address bar), and
    // never for a location change that's just this tab catching up to a
    // browser back/forward the popstate listener below already handled
    // (tagged __fromPopstate) — that step already exists in real history,
    // re-pushing it would duplicate it.
    if (useTabStore.getState().activeTabId === tabId && !location.state?.__fromPopstate) {
      if (!hasSyncedHistoryRef.current) {
        window.history.replaceState({ tabId }, '', path);
      } else {
        window.history.pushState({ tabId }, '', path);
      }
    }
    hasSyncedHistoryRef.current = true;
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

// Reacts to the browser's actual back/forward buttons — see TabRouteSync's
// pushState/replaceState calls above for the other half. Reads store state
// live via getState() rather than hook selectors: this listener is
// registered once and must always see whatever's current at the moment the
// user presses back, not whatever it was when this effect first ran.
function usePopStateSync() {
  useEffect(() => {
    const onPopState = (e) => {
      const { tabs: liveTabs, activeTabId: liveActiveId, activateTab, navigateFns } = useTabStore.getState();
      // The entry we're landing on was tagged with whichever tab it
      // belonged to when it was pushed (see TabRouteSync) — fall back to
      // the currently active tab if that tab's since been closed, or this
      // is a same-document entry from before our own history-sync started
      // (e.g. right after login).
      const targetTabId = e.state?.tabId && liveTabs.some((t) => t.id === e.state.tabId)
        ? e.state.tabId
        : liveActiveId;
      if (targetTabId !== liveActiveId) activateTab(targetTabId);
      const path = window.location.pathname + window.location.search;
      // replace:true — the browser already moved; this just tells that
      // tab's own <MemoryRouter> to catch up, not asking it to push a
      // second, duplicate step into its own internal history. __fromPopstate
      // tells TabRouteSync not to mirror this particular change back onto
      // window.history — it's already there.
      navigateFns[targetTabId]?.(path, { replace: true, state: { __fromPopstate: true } });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
}

export default function TabsContainer() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  usePopStateSync();

  return (
    <main className="flex-1 p-4 lg:p-6 overflow-auto">
      {tabs.map((tab) => (
        <TabInstance key={tab.id} tabId={tab.id} initialPath={tab.path} isActive={tab.id === activeTabId} />
      ))}
    </main>
  );
}
