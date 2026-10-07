import { useRef, useEffect, useState } from 'react';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTabStore } from '../../store/useTabStore';
import { useModuleStore } from '../../store/useModuleStore';

export default function TabBar() {
  // `tabs` no longer carries each tab's live currentPath (that moved to its
  // own `tabPaths` map in the store — see useTabStore.js) specifically so
  // this list — label/icon only, rarely changes — doesn't re-render on
  // every navigation happening in every open tab. Actions selected
  // individually too; zustand keeps them referentially stable forever.
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const activateTab = useTabStore((s) => s.activateTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const createNewTab = useTabStore((s) => s.createNewTab);
  const clearModule = useModuleStore((s) => s.clearModule);
  const scrollRef = useRef(null);
  // Which side(s) have tabs hidden past the edge. The strip's scrollbar is
  // hidden (it would sit inside the pill), so these drive the ‹ › nudge
  // buttons that tell the user more tabs exist and let mouse users reach
  // them without Shift+wheel.
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector('[data-active="true"]');
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeTabId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setOverflow((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    };
    // ResizeObserver fires once on observe, which also gives the initial state.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [tabs.length]);

  // Each tab keeps its own live <MemoryRouter> mounted the whole time it's
  // open (see TabsContainer) — switching tabs is purely a visibility toggle,
  // no navigation call needed, so whatever that tab was showing is exactly
  // what reappears.
  const handleTabClick = (tab) => {
    if (tab.id === activeTabId) return;
    activateTab(tab.id);
  };

  const handleClose = (e, tabId) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  // Chrome-style: the "+" always lives at the end of the strip, not off in
  // the navbar somewhere — click it and the new tab's own pill appears right
  // where the button was, pushing "+" one slot further along. A brand-new
  // tab's own <MemoryRouter> always starts at '/dashboard' on its own (see
  // TabsContainer), so no explicit navigate is needed here either.
  const handleNewTab = () => {
    createNewTab();
    clearModule();
  };

  const nudge = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 160, behavior: 'smooth' });
  };

  // Vertical wheel over the strip scrolls it sideways (nothing above the
  // content frame scrolls vertically anyway).
  const handleWheel = (e) => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) el.scrollLeft += e.deltaY;
  };

  const nudgeBtnClass =
    'flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors';

  // No outer row of its own any more — this sits inline inside Navbar's own
  // header row, right next to the hamburger button, so it lives on the same
  // line instead of taking a second strip underneath.
  return (
    <div className="flex items-center bg-[#0F172A] rounded-full p-1 min-w-0 max-w-full">
      {overflow.left && (
        <button type="button" onClick={() => nudge(-1)} title="Scroll tabs left" aria-label="Scroll tabs left" className={nudgeBtnClass}>
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex items-center gap-1 min-w-0 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              data-active={isActive}
              onClick={() => handleTabClick(tab)}
              className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 min-w-0 max-w-[180px] shrink-0 ${
                isActive
                  ? 'bg-[#2563EB] text-white shadow-[0_1px_6px_rgba(37,99,235,0.5)]'
                  : 'text-[#94A3B8] hover:text-white hover:bg-white/10'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate max-w-[110px]">{tab.label}</span>
              <span
                onClick={(e) => handleClose(e, tab.id)}
                title="Close tab"
                className={`p-0.5 rounded-full transition-colors shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-blue-100 hover:bg-white/20 hover:text-white'
                    : 'text-[#64748B] opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <X className="w-3 h-3" />
              </span>
            </button>
          );
        })}

        <button
          onClick={handleNewTab}
          title="New tab"
          className="tabbar-new-tab group relative flex items-center justify-center w-7 h-7 rounded-full text-[#64748B] shrink-0 overflow-hidden transition-all duration-300 hover:text-white hover:scale-110 active:scale-95"
        >
          <span className="tabbar-new-tab__glow" />
          <Plus className="w-4 h-4 relative z-10 transition-transform duration-300 group-hover:rotate-90" />
        </button>
      </div>
      {overflow.right && (
        <button type="button" onClick={() => nudge(1)} title="Scroll tabs right" aria-label="Scroll tabs right" className={nudgeBtnClass}>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
