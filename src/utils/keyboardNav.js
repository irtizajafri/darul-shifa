// Fast keyboard-driven data entry — mimics legacy DOS-style accounting/
// hospital software: Enter or ArrowDown moves to the next field, ArrowUp
// moves back to the previous one, and hitting either on the last field
// fires the form's primary Save/Submit action. Mouse users are completely
// unaffected: clicking/tabbing still works exactly as before.
//
// Usage: put onKeyDown={handleEnterAsTab} (or handleSlipKeys, see below) on
// the form's outer container, and mark the primary Save/Submit button with
// data-enter-submit so hitting the end of the field list triggers it.
const FOCUSABLE_SELECTOR =
  'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), ' +
  'textarea:not([disabled]):not([readonly]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isVisible(el) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

// Jumps focus by `delta` (+1/-1) within the container's focusable fields.
function stepFocus(e, delta) {
  const container = e.currentTarget;
  const focusables = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);
  const idx = focusables.indexOf(e.target);
  if (idx === -1) return;

  e.preventDefault();

  const next = focusables[idx + delta];
  if (next) {
    next.focus();
    if (typeof next.select === 'function' && (next.tagName === 'INPUT' || next.tagName === 'TEXTAREA')) {
      next.select();
    }
    return;
  }

  if (delta > 0) {
    // Nothing left to jump to going forward — fire the primary submit button, if any.
    const submitBtn = container.querySelector('[data-enter-submit]');
    if (submitBtn && !submitBtn.disabled) submitBtn.click();
  }
}

export function handleEnterAsTab(e) {
  const key = e.key;
  const isEnter = key === 'Enter';
  const isArrow = key === 'ArrowDown' || key === 'ArrowUp';
  if (!isEnter && !isArrow) return;

  const target = e.target;
  const tag = target.tagName;

  if (isEnter) {
    // Textareas keep native Enter = newline. Buttons/links fire their own click.
    if (tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A') return;
  } else {
    // Arrow field-hopping never overrides a control's own native Up/Down
    // meaning: <select> and radio buttons cycle their value, <textarea>
    // moves the text cursor between lines.
    if (tag === 'TEXTAREA' || tag === 'SELECT' || target.type === 'radio') return;
  }
  // Don't hijack while composing (IME) or with modifier keys held.
  if (e.nativeEvent?.isComposing || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

  stepFocus(e, isArrow && key === 'ArrowUp' ? -1 : 1);
}

// OPD slips' keyboard path (owner, 2026-11-27): Phone # → MAST/MRS →
// Patient Name → Age → (Doctor, where one is picked first) → Search. Fields
// carry data-kf="<step>" (on the control itself or a wrapper around it);
// Enter or Tab moves to the next step that's on screen and usable,
// Shift+Tab back. Search handles its own Enter (sends the highlighted row to
// the right side) and Tab leaves it as usual. Forms without data-kf fields
// are untouched.
const KEY_FLOW = ['phone', 'ptype', 'name', 'age', 'doctor', 'search'];

function keyFlowField(container, step) {
  const box = container?.querySelector(`[data-kf="${step}"]`);
  if (!box || !isVisible(box)) return null;
  const el = box.matches(FOCUSABLE_SELECTOR) ? box : box.querySelector(FOCUSABLE_SELECTOR);
  return el && isVisible(el) ? el : null;
}

// Puts the cursor in a step's field (e.g. Phone # when the slip opens).
export function focusKeyField(container, step) {
  const el = keyFlowField(container, step);
  if (!el) return false;
  el.focus();
  if (el.tagName === 'INPUT' && typeof el.select === 'function') el.select();
  return true;
}

// true when the key was the path's (handled or deliberately left alone).
function handleKeyFlow(e) {
  const isEnter = e.key === 'Enter';
  const isTab = e.key === 'Tab';
  if (!isEnter && !isTab) return false;
  if (e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent?.isComposing || (isEnter && e.shiftKey)) return false;
  const box = e.target.closest?.('[data-kf]');
  if (!box || !e.currentTarget.contains(box)) return false;
  const i = KEY_FLOW.indexOf(box.dataset.kf);
  if (i === -1) return false;
  // The field already used this key itself (e.g. a dropdown opening).
  if (e.defaultPrevented) return true;
  const back = isTab && e.shiftKey;
  if (box.dataset.kf === 'search' && !back) return false;
  const steps = back ? KEY_FLOW.slice(0, i).reverse() : KEY_FLOW.slice(i + 1);
  for (const step of steps) {
    const el = keyFlowField(e.currentTarget, step);
    if (el) {
      e.preventDefault();
      el.focus();
      if (el.tagName === 'INPUT' && typeof el.select === 'function') el.select();
      return true;
    }
  }
  return false;
}

// Advanced slip-entry hotkeys, layered on top of handleEnterAsTab — the
// pattern power users of legacy DOS-style hospital/accounting software
// expect: Ctrl/Cmd+Enter saves immediately from *any* field (no need to tab
// all the way to the end first), and Escape backs out of whatever lookup/
// confirm popup is open. Mouse behaviour is untouched either way.
//
// Usage: onKeyDown={(e) => handleSlipKeys(e, { onEscape: closeAllPopups })}
// on the form's outer container (same container that holds [data-enter-submit]).
export function handleSlipKeys(e, { onEscape } = {}) {
  if (e.key === 'Escape') {
    if (!onEscape) return;
    e.preventDefault();
    onEscape();
    return;
  }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    const submitBtn = e.currentTarget.querySelector('[data-enter-submit]');
    if (submitBtn && !submitBtn.disabled) submitBtn.click();
    return;
  }
  if (handleKeyFlow(e)) return;
  handleEnterAsTab(e);
}
