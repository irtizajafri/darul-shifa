import { useCallback, useEffect, useRef, useState } from 'react';
import { focusKeyField } from '../../utils/keyboardNav';

// OPD slips' keyboard path (owner, 2026-11-27) — the steps are in
// utils/keyboardNav.js (KEY_FLOW). Shared by General OPD (and the screens
// built on it), Consultant OPD and Emergency OPD.

// boxRef goes on the slip's outer box (the one with handleSlipKeys); the
// cursor starts in Phone #, and again when `screen` changes (Dental, Lab …
// are one component, so moving between them doesn't open it afresh).
// focus(step, delay) puts the cursor in a step's field.
export function useOpdKeyboard(screen) {
  const boxRef = useRef(null);
  const focus = useCallback((step, delay = 0) => {
    setTimeout(() => focusKeyField(boxRef.current, step), delay);
  }, []);
  useEffect(() => { focus('phone', 50); }, [focus, screen]);
  return { boxRef, focus };
}

// When a pop-up closes, the cursor goes on to `step` (e.g. after the phone
// number's patient pop-up → MAST/MRS).
export function useFocusAfterClose(open, focus, step) {
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !open) focus(step);
    was.current = open;
  }, [open, focus, step]);
}

// The Search box over the left list: the first row is highlighted while the
// box has the cursor, ↑ / ↓ move the highlight, Enter sends that row to the
// right side (onPick). Mouse use of the list is unchanged.
export function useListKeys(rows, onPick) {
  const [hi, setHi] = useState(0);
  const [active, setActive] = useState(false);
  const bodyRef = useRef(null);
  const idx = rows.length ? Math.min(hi, rows.length - 1) : -1;

  useEffect(() => {
    if (active) bodyRef.current?.querySelector('.gopd-tr--hi')?.scrollIntoView({ block: 'nearest' });
  }, [idx, active]);

  const onKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (!rows.length) return;
      const down = e.key === 'ArrowDown';
      setHi((h) => {
        const cur = Math.min(h, rows.length - 1);
        return down ? Math.min(cur + 1, rows.length - 1) : Math.max(cur - 1, 0);
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (idx >= 0) onPick(rows[idx]);
    }
  };

  return {
    bodyRef,
    rowClass: (i) => (active && i === idx ? ' gopd-tr--hi' : ''),
    reset: () => setHi(0),
    inputProps: {
      'data-kf': 'search',
      onKeyDown,
      onFocus: () => setActive(true),
      onBlur: () => setActive(false),
    },
  };
}
