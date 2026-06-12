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
      currentPath: '/dashboard',
      label: 'Dashboard',
      Icon: LayoutDashboard,
      module: null,
    },
  ],
  activeTabId: 'tab-0',

  createNewTab: () => {
    const id = `tab-${tabCounter++}`;
    const newTab = { id, path: '/dashboard', currentPath: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard, module: null };
    syncModule(null);
    set({ tabs: [...get().tabs, newTab], activeTabId: id });
    return id;
  },

  updateTabPath: (tabId, currentPath) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, currentPath } : t)),
    }));
  },

  updateTabModule: (tabId, module) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, module } : t)),
    }));
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
    const { tabs, activeTabId } = get();
    if (tabs.length === 1) return null;
    const idx = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);
    if (activeTabId === tabId) {
      const next = newTabs[Math.min(idx, newTabs.length - 1)];
      syncModule(next.module);
      set({ tabs: newTabs, activeTabId: next.id });
      return next;
    }
    set({ tabs: newTabs });
    return null;
  },
}));
