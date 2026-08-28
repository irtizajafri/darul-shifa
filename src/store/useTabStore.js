import { create } from 'zustand';
import { LayoutDashboard } from 'lucide-react';
import { useModuleStore } from './useModuleStore';

let tabCounter = 1;

const syncModule = (module) => {
  const ms = useModuleStore.getState();
  if (module) ms.setModule(module);
  else ms.clearModule();
};

export const useTabStore = create((set, get) => ({
  tabs: [
    {
      id: 'tab-0',
      path: '/dashboard',
      label: 'Dashboard',
      Icon: LayoutDashboard,
      module: null,
    },
  ],
  activeTabId: 'tab-0',

  // Per-tab "where am I right now", kept OUT of `tabs` on purpose. This
  // updates on every navigation inside every open tab (see TabRouteSync in
  // TabsContainer.jsx), while `tabs` itself (label/icon/module) only changes
  // on much rarer events — a new tab, a sidebar click renaming the active
  // tab. Keeping them in separate store fields means a component that only
  // cares about the tab list (TabBar) doesn't re-render every time the user
  // navigates somewhere in some other, currently-inactive tab.
  tabPaths: { 'tab-0': '/dashboard' },

  // Each open tab owns its own isolated <MemoryRouter> (see TabsContainer.jsx)
  // and registers its own navigate() function here on mount. Chrome-level UI
  // that lives OUTSIDE any tab's router — Sidebar nav items, Command
  // Palette, the GD notification popup — can't call react-router's own
  // useNavigate() to move around inside a tab (there's no single shared
  // router driving tab content any more), so they call navigateActiveTab()
  // instead, which forwards to whichever tab is currently active.
  navigateFns: {},

  createNewTab: () => {
    const id = `tab-${tabCounter++}`;
    const newTab = { id, path: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, module: null };
    syncModule(null);
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
      tabPaths: { ...state.tabPaths, [id]: '/dashboard' },
    }));
    return id;
  },

  updateTabPath: (tabId, path) => {
    set((state) => {
      if (state.tabPaths[tabId] === path) return state; // bail — no real change, no re-render
      return { tabPaths: { ...state.tabPaths, [tabId]: path } };
    });
  },

  updateTabModule: (tabId, module) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, module } : t)),
    }));
  },

  updateTabLabel: (tabId, label, Icon) => {
    set((state) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (tab && tab.label === label && tab.Icon === Icon) return state; // bail — no real change
      return { tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, label, Icon } : t)) };
    });
  },

  registerTabNavigate: (tabId, fn) => {
    set((state) => ({ navigateFns: { ...state.navigateFns, [tabId]: fn } }));
  },

  unregisterTabNavigate: (tabId) => {
    set((state) => {
      if (!(tabId in state.navigateFns)) return state;
      const next = { ...state.navigateFns };
      delete next[tabId];
      return { navigateFns: next };
    });
  },

  // Used by anything rendered outside a tab's own router (Sidebar, Command
  // Palette, GD notification popup) to navigate *inside whichever tab is
  // currently active* — exactly as if that tab's own page had called
  // useNavigate() itself.
  navigateActiveTab: (path, options) => {
    const { activeTabId, navigateFns } = get();
    const fn = navigateFns[activeTabId];
    if (fn) fn(path, options);
  },

  activateTab: (tabId) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return null;
    syncModule(tab.module);
    set({ activeTabId: tabId });
    return tab;
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId, navigateFns, tabPaths } = get();
    if (tabs.length === 1) return null;
    const idx = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);
    const nextNavigateFns = { ...navigateFns };
    delete nextNavigateFns[tabId];
    const nextTabPaths = { ...tabPaths };
    delete nextTabPaths[tabId];
    if (activeTabId === tabId) {
      const next = newTabs[Math.min(idx, newTabs.length - 1)];
      syncModule(next.module);
      set({ tabs: newTabs, activeTabId: next.id, navigateFns: nextNavigateFns, tabPaths: nextTabPaths });
      return next;
    }
    set({ tabs: newTabs, navigateFns: nextNavigateFns, tabPaths: nextTabPaths });
    return null;
  },
}));
