import { useEffect, useLayoutEffect, useRef } from 'react';

// Keyboard shortcuts on Pharmacy GD / GIN — the same keys as Inventory's GD
// and GIN (owner, 2026-11-18):
//   Ctrl/Cmd + S  → Save
//   Ctrl/Cmd + P  → Save & Print
//   Ctrl/Cmd + N  → New (clear the form)
//   Esc           → Clear the form
// Esc is left to whatever is open first (a dropdown list, the patient
// picker, a confirm box) — those close themselves.
export default function usePharmacyKeys(handlers) {
  const ref = useRef(handlers);
  // Latest handlers (they read the page's current state).
  useLayoutEffect(() => { ref.current = handlers; });

  useEffect(() => {
    const onKey = (e) => {
      const h = ref.current;
      if (h.blocked?.()) return;
      if (document.querySelector('#confirm-dialog-title')) return; // a confirm box is open
      const ctrl = e.ctrlKey || e.metaKey;
      const k = String(e.key || '').toLowerCase();
      if (ctrl && k === 's') { e.preventDefault(); h.onSave?.(); return; }
      if (ctrl && k === 'p') { e.preventDefault(); h.onPrint?.(); return; }
      if (ctrl && k === 'n') { e.preventDefault(); h.onNew?.(); return; }
      if (e.key === 'Escape' && !e.defaultPrevented) {
        if (document.querySelector('[role="combobox"][aria-expanded="true"]')) return; // a select list is open
        h.onEsc?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
