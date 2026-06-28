import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ArrowRight } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

const GLOBAL_ACTIONS = [
  { id: 'nav-po',       label: 'Purchase Orders (PO)',  hint: 'Navigate',  path: '/inventory/po' },
  { id: 'nav-grn',      label: 'Goods Receipt (GRN)',   hint: 'Navigate',  path: '/inventory/grn' },
  { id: 'nav-gin',      label: 'Goods Issue (GIN / GD)',hint: 'Navigate',  path: '/inventory/gin' },
  { id: 'nav-gdn',      label: 'Goods Discard (GDN)',   hint: 'Navigate',  path: '/inventory/gdn' },
  { id: 'nav-masters',  label: 'Master Setup',          hint: 'Navigate',  path: '/inventory/master-setup' },
  { id: 'nav-reports',  label: 'Inventory Reports',     hint: 'Navigate',  path: '/inventory/reports' },
  { id: 'nav-dashboard',label: 'Dashboard',             hint: 'Navigate',  path: '/dashboard' },
];

const PAGE_ACTIONS = {
  '/inventory/po': [
    { id: 'po-new',    label: 'New Purchase Order',      hint: 'Ctrl+N', path: '/inventory/po',  state: { openCreate: true } },
  ],
  '/inventory/grn': [
    { id: 'grn-new',   label: 'New GRN',                 hint: 'Ctrl+N', path: '/inventory/grn', state: { openCreate: true } },
  ],
  '/inventory/gin': [
    { id: 'gd-new',    label: 'New Goods Demand (GD)',   hint: 'Ctrl+N', path: '/inventory/gin', state: { openGD: true } },
    { id: 'gin-new',   label: 'New Goods Issue (GIN)',   hint: '',       path: '/inventory/gin', state: { openGIN: true } },
  ],
  '/inventory/gdn': [
    { id: 'gdn-new',   label: 'New Goods Discard (GDN)', hint: 'Ctrl+N', path: '/inventory/gdn', state: { openForm: true } },
  ],
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const overlayRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useFocusTrap(overlayRef, open);

  const actions = useMemo(() => {
    const pageActions = PAGE_ACTIONS[location.pathname] || [];
    return [...pageActions, ...GLOBAL_ACTIONS];
  }, [location.pathname]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) => a.label.toLowerCase().includes(q) || a.hint?.toLowerCase().includes(q)
    );
  }, [actions, query]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery('');
        setHighlighted(0);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const close = () => {
    setOpen(false);
    setQuery('');
    setHighlighted(0);
  };

  const run = (action) => {
    close();
    navigate(action.path, action.state ? { state: action.state } : undefined);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((p) => Math.min(p + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((p) => Math.max(p - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) run(filtered[highlighted]);
    }
  };

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9000] flex items-start justify-center pt-[15vh] bg-black/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        ref={overlayRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions or pages..."
            className="flex-1 text-sm outline-none text-slate-800 placeholder:text-slate-400"
            autoFocus
          />
          <kbd className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
        </div>

        <ul className="max-h-80 overflow-y-auto py-1" role="listbox">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-400">No actions found</li>
          ) : (
            filtered.map((action, idx) => (
              <li
                key={action.id}
                role="option"
                aria-selected={idx === highlighted}
                onMouseEnter={() => setHighlighted(idx)}
                onMouseDown={() => run(action)}
                className={`flex items-center justify-between px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                  idx === highlighted ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ArrowRight className={`w-3.5 h-3.5 ${idx === highlighted ? 'text-blue-500' : 'text-slate-300'}`} />
                  <span className="font-medium">{action.label}</span>
                </div>
                {action.hint && (
                  <kbd className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono shrink-0">
                    {action.hint}
                  </kbd>
                )}
              </li>
            ))
          )}
        </ul>

        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-400">
          <span><kbd className="bg-slate-100 px-1 py-0.5 rounded font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="bg-slate-100 px-1 py-0.5 rounded font-mono">Enter</kbd> select</span>
          <span><kbd className="bg-slate-100 px-1 py-0.5 rounded font-mono">Ctrl+K</kbd> toggle</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
