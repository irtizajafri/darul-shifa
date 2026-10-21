import { useLocation, useNavigate } from 'react-router-dom';
import { Minus, X } from 'lucide-react';
import { useTabStore } from '../../store/useTabStore';
import { useMinimizedReportsStore } from '../../store/useMinimizedReportsStore';

const DATE_KEYS = [['fromDate', 'toDate'], ['from', 'to'], ['dateFrom', 'dateTo']];
const shortDate = (v) => {
  const m = String(v || '').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!m) return v;
  return m[3] ? `${m[3]}-${m[2]}` : `${m[2]}-${m[1]}`;
};

// Window-style Minimize / Close for a report preview (owner's request,
// 2026-10-21), at the right end of its toolbar like Windows. Both leave for
// the screen the report was opened from; Minimize also parks the report as a
// chip in the bottom dock (MinimizedReportsDock) to reopen with the same
// filters.
export default function ReportWindowControls({ title }) {
  const navigate = useNavigate();
  const location = useLocation();
  const minimize = useMinimizedReportsStore((s) => s.minimize);
  const removeByUrl = useMinimizedReportsStore((s) => s.removeByUrl);

  const leave = () => {
    // The first entry of a tab's router (e.g. a report reopened in a new tab)
    // has nothing to go back to — fall back to the report's filter screen.
    if (location.key === 'default') navigate(location.pathname.replace(/\/view$/, '') || '/dashboard');
    else navigate(-1);
  };

  const handleMinimize = () => {
    const { activeTabId, tabs } = useTabStore.getState();
    const params = new URLSearchParams(location.search);
    const pair = DATE_KEYS.find(([a]) => params.get(a));
    const range = pair ? ` ${shortDate(params.get(pair[0]))}${params.get(pair[1]) ? ` → ${shortDate(params.get(pair[1]))}` : ''}` : '';
    const name = title || tabs.find((t) => t.id === activeTabId)?.label || 'Report';
    minimize({ title: `${name}${range}`, url: `${location.pathname}${location.search}`, tabId: activeTabId });
    leave();
  };

  // Closing the report is what takes its chip off the dock (reopening from
  // the dock keeps it there).
  const handleClose = () => {
    removeByUrl(`${location.pathname}${location.search}`);
    leave();
  };

  return (
    <div className="rpt-winctl">
      <button type="button" className="rpt-winctl-btn" onClick={handleMinimize} title="Minimize" aria-label="Minimize report">
        <Minus size={14} />
      </button>
      <button type="button" className="rpt-winctl-btn rpt-winctl-btn--close" onClick={handleClose} title="Close" aria-label="Close report">
        <X size={14} />
      </button>
    </div>
  );
}
