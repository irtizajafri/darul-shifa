import { useEffect, useRef } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import { useConfirmStore } from '../../utils/confirmDialog';

// App-wide replacement for window.confirm / window.prompt.
//
// Native dialogs block the whole tab, can't be styled, and on Windows open
// as OS-level boxes that look nothing like the app. Pages call
// `confirmDialog(...)` (see utils/confirmDialog.js for the API and examples)
// and this host, mounted once in MainLayout, renders the request.

// Re-exported so pages can import the API from the same place as the host.
// eslint-disable-next-line react-refresh/only-export-components
export { confirmDialog } from '../../utils/confirmDialog';

export function ConfirmDialogHost() {
  const request = useConfirmStore((s) => s.request);
  const clear = useConfirmStore((s) => s.clear);
  const boxRef = useRef(null);
  const open = Boolean(request);

  useFocusTrap(boxRef, open);

  const finish = (value) => {
    if (!request) return;
    request.resolve(value);
    clear();
  };
  const cancel = () => finish(request?.choices ? null : false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    };
    // capture so a page's own ESC handler (closing its modal) doesn't also fire
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!request) return null;

  const {
    title = request.choices ? 'Choose an option' : 'Please confirm',
    message,
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    danger = false,
    choices = null,
  } = request;

  const btnBase = 'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300';
  const btnPrimary = `${btnBase} bg-blue-600 text-white hover:bg-blue-700`;
  const btnDanger = `${btnBase} bg-red-600 text-white hover:bg-red-700 focus:ring-red-300`;
  const btnGhost = `${btnBase} bg-slate-100 text-slate-700 hover:bg-slate-200`;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-200"
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className={`mt-0.5 shrink-0 rounded-full p-2 ${danger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
            {danger ? <AlertTriangle size={20} /> : <HelpCircle size={20} />}
          </div>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">{title}</h2>
            {message && (
              <p className="mt-1 text-sm text-slate-600 whitespace-pre-line break-words">{message}</p>
            )}
          </div>
        </div>
        {/* flex-row-reverse: the confirm button is FIRST in the DOM (so the
            focus trap lands on it and Enter confirms) but shows on the right. */}
        <div className="flex flex-row-reverse flex-wrap gap-2 px-5 pb-5 pt-2">
          {choices ? (
            [...choices].reverse().map((c) => (
              <button
                key={String(c.value)}
                type="button"
                className={c.danger ? btnDanger : btnPrimary}
                onClick={() => finish(c.value)}
              >
                {c.label}
              </button>
            ))
          ) : (
            <button type="button" className={danger ? btnDanger : btnPrimary} onClick={() => finish(true)}>
              {confirmLabel}
            </button>
          )}
          <button type="button" className={btnGhost} onClick={cancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
