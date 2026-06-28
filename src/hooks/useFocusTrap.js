import { useEffect } from 'react';

const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Focus trap for true overlay modals (not inline forms).
 * When active:
 *  - Moves focus to the first focusable element inside the container
 *  - Cycles Tab/Shift+Tab within the container
 *  - Returns focus to triggerRef.current when deactivated
 *
 * @param {React.RefObject} containerRef – ref attached to the modal root element
 * @param {boolean}         active       – true when the modal is open
 * @param {React.RefObject} [triggerRef] – element that should receive focus when modal closes
 */
export default function useFocusTrap(containerRef, active, triggerRef = null) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const getFocusable = () => Array.from(container.querySelectorAll(FOCUSABLE));

    const firstEl = getFocusable()[0];
    if (firstEl) firstEl.focus();

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;
      const els = getFocusable();
      if (els.length === 0) { e.preventDefault(); return; }
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      if (triggerRef?.current) triggerRef.current.focus();
    };
  }, [active]);
}
