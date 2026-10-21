import { create } from 'zustand';

// Reports minimized from their preview (owner's request, 2026-10-21): each
// shows as a chip in the app-wide dock at the bottom (MinimizedReportsDock)
// and stays there — reopening it keeps the chip — until the user closes the
// report (toolbar ✕) or dismisses the chip. `url` is the report's /view address with
// its filter params, `tabId` the tab it was minimized from — it reopens
// there if that tab is still open, otherwise in a new tab.
export const useMinimizedReportsStore = create((set) => ({
  items: [],
  minimize: (item) => set((s) => ({
    // Same report + same filters minimized again → one chip, moved to the end.
    items: [...s.items.filter((i) => i.url !== item.url), { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }],
  })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  removeByUrl: (url) => set((s) => ({ items: s.items.filter((i) => i.url !== url) })),
}));
