import { useEffect, useRef } from 'react';

/**
 * Keyboard shortcuts for modals and forms.
 *
 * @param {object}   opts
 * @param {boolean}  [opts.active=true]   – bind only when true (e.g. modal is open)
 * @param {Function} [opts.onEsc]         – Escape          → close / cancel
 * @param {Function} [opts.onCtrlS]       – Ctrl/Cmd + S    → save
 * @param {Function} [opts.onCtrlP]       – Ctrl/Cmd + P    → print (blocks browser dialog)
 * @param {Function} [opts.onCtrlEnter]   – Ctrl/Cmd + Enter→ safe-save for large forms
 */
export default function useModalKeys({
  active = true,
  onEsc,
  onCtrlS,
  onCtrlP,
  onCtrlEnter,
} = {}) {
  // Keep latest callbacks in a ref so the listener never goes stale
  // without needing to re-register on every render.
  const cb = useRef({});
  cb.current = { onEsc, onCtrlS, onCtrlP, onCtrlEnter };

  useEffect(() => {
    if (!active) return;

    const handler = (e) => {
      const { onEsc, onCtrlS, onCtrlP, onCtrlEnter } = cb.current;
      const isCtrl = e.ctrlKey || e.metaKey;

      if (e.key === 'Escape' && onEsc) {
        e.preventDefault();
        onEsc();
        return;
      }
      if (isCtrl && e.key === 'p' && onCtrlP) {
        e.preventDefault();
        onCtrlP();
        return;
      }
      if (isCtrl && e.key === 's' && onCtrlS) {
        e.preventDefault();
        onCtrlS();
        return;
      }
      if (isCtrl && e.key === 'Enter' && onCtrlEnter) {
        e.preventDefault();
        onCtrlEnter();
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active]); // re-register only when active flips
}
