import { useEffect, useRef } from 'react';

/**
 * Keyboard shortcuts for modals, forms, and page-level actions.
 *
 * @param {object}   opts
 * @param {boolean}  [opts.active=true]   – bind only when true
 * @param {Function} [opts.onEsc]         – Escape              → close / cancel
 * @param {Function} [opts.onCtrlS]       – Ctrl/Cmd + S        → save
 * @param {Function} [opts.onCtrlP]       – Ctrl/Cmd + P        → print
 * @param {Function} [opts.onCtrlEnter]   – Ctrl/Cmd + Enter    → safe-save
 * @param {Function} [opts.onCtrlN]       – Ctrl/Cmd + N        → new item
 * @param {Function} [opts.onSlash]       – /  (not in input)   → focus search
 */
export default function useModalKeys({
  active = true,
  onEsc,
  onCtrlS,
  onCtrlP,
  onCtrlEnter,
  onCtrlN,
  onSlash,
} = {}) {
  const cb = useRef({});
  cb.current = { onEsc, onCtrlS, onCtrlP, onCtrlEnter, onCtrlN, onSlash };

  useEffect(() => {
    if (!active) return;

    const handler = (e) => {
      const { onEsc, onCtrlS, onCtrlP, onCtrlEnter, onCtrlN, onSlash } = cb.current;
      const isCtrl = e.ctrlKey || e.metaKey;
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

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
      if (isCtrl && e.key === 'n' && onCtrlN) {
        e.preventDefault();
        onCtrlN();
        return;
      }
      if (e.key === '/' && !inInput && onSlash) {
        e.preventDefault();
        onSlash();
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active]);
}
