import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTabStore } from '../../store/useTabStore';

export default function TabBar() {
  const { tabs, activeTabId, activateTab, closeTab } = useTabStore();
  const navigate = useNavigate();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector('[data-active="true"]');
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId]);

  if (tabs.length <= 1) return null;

  const handleTabClick = (tab) => {
    if (tab.id === activeTabId) return;
    activateTab(tab.id);
    navigate(tab.currentPath || tab.path);
  };

  const handleClose = (e, tabId) => {
    e.stopPropagation();
    const nextTab = closeTab(tabId);
    if (nextTab) navigate(nextTab.currentPath || nextTab.path);
  };

  return (
    <div
      ref={scrollRef}
      className="flex items-end gap-0.5 px-2 pt-1.5 bg-[#F1F5F9] border-b border-[#E2E8F0] overflow-x-auto"
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
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-sm whitespace-nowrap transition-all min-w-0 max-w-[180px] border border-b-0 shrink-0 ${
              isActive
                ? 'bg-white text-[#0F172A] border-[#E2E8F0] relative -mb-px pb-[9px] z-10 shadow-sm'
                : 'bg-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A] border-transparent'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate max-w-[110px]">{tab.label}</span>
            <span
              onClick={(e) => handleClose(e, tab.id)}
              className={`ml-0.5 p-0.5 rounded hover:bg-red-100 hover:text-red-500 transition-colors shrink-0 cursor-pointer ${
                isActive ? 'text-[#94A3B8]' : 'text-[#94A3B8] opacity-0 group-hover:opacity-100'
              }`}
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
