import { FileText, X } from 'lucide-react';
import { useTabStore } from '../../store/useTabStore';
import { useMinimizedReportsStore } from '../../store/useMinimizedReportsStore';
import './MinimizedReportsDock.scss';

// App-wide bar of minimized reports (see ReportWindowControls) — shown on
// every screen while at least one is parked. Clicking a chip reopens that
// report with its filters in the tab it came from (or a new tab if that one
// was closed) and the chip stays, highlighted while that report is on
// screen; it leaves only via its own ✕ or the report's Close button.
export default function MinimizedReportsDock() {
  const items = useMinimizedReportsStore((s) => s.items);
  const remove = useMinimizedReportsStore((s) => s.remove);
  const currentPath = useTabStore((s) => s.tabPaths[s.activeTabId]);
  if (!items.length) return null;

  const reopen = (item) => {
    const tabStore = useTabStore.getState();
    const nav = tabStore.navigateFns[item.tabId];
    if (tabStore.tabs.some((t) => t.id === item.tabId)) {
      // A hidden report tab may be asleep (no router mounted — see
      // TabsContainer): point it at the report first, then wake it.
      if (!nav) tabStore.updateTabPath(item.tabId, item.url);
      tabStore.activateTab(item.tabId);
      if (nav) nav(item.url);
    } else {
      // Remember the new tab so the next click lands there too.
      const tabId = tabStore.createNewTab(item.url);
      useMinimizedReportsStore.setState((s) => ({ items: s.items.map((i) => (i.id === item.id ? { ...i, tabId } : i)) }));
    }
  };

  return (
    <div className="min-dock" role="toolbar" aria-label="Minimized reports">
      {items.map((item) => (
        <div key={item.id} className={`min-dock-chip${currentPath === item.url ? ' min-dock-chip--active' : ''}`}>
          <button type="button" className="min-dock-open" onClick={() => reopen(item)} title={`Open ${item.title}`}>
            <FileText size={13} /> <span>{item.title}</span>
          </button>
          <button type="button" className="min-dock-close" onClick={() => remove(item.id)} title="Remove" aria-label={`Remove ${item.title}`}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
