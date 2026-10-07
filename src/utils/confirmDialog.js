import { create } from 'zustand';

// State + imperative API behind <ConfirmDialogHost /> (components/ui/
// ConfirmDialog.jsx). Lives in its own module so the component file only
// exports a component (keeps React Fast Refresh working). Pages normally
// import `confirmDialog` from components/ui/ConfirmDialog, which re-exports it.

export const useConfirmStore = create((set) => ({
  request: null,
  show: (request) => set({ request }),
  clear: () => set({ request: null }),
}));

let seq = 0;

/**
 * App-wide replacement for window.confirm / window.prompt.
 *
 *   if (!(await confirmDialog('Delete this entry?'))) return;
 *
 *   const ok = await confirmDialog({
 *     title: 'Delete Main GL',
 *     message: 'All child Sub GLs and accounts will also be removed.',
 *     confirmLabel: 'Delete', danger: true,
 *   });
 *
 *   // Several choices (replaces window.prompt "type R or M"):
 *   const mode = await confirmDialog({
 *     title: 'Import', message: 'Existing data found for this date.',
 *     choices: [{ label: 'Replace', value: 'R', danger: true }, { label: 'Merge', value: 'M' }],
 *   }); // → 'R' | 'M' | null (cancelled)
 *
 * @param {string|object} options  message string, or
 *   { title, message, confirmLabel, cancelLabel, danger, choices }
 * @returns {Promise<boolean|any>} true/false for a plain confirm; the chosen
 *   choice's `value` (or null when cancelled) when `choices` is given.
 */
export function confirmDialog(options) {
  const opts = typeof options === 'string' ? { message: options } : (options || {});
  return new Promise((resolve) => {
    // If something is already open, cancel it rather than stacking.
    const current = useConfirmStore.getState().request;
    if (current) current.resolve(current.choices ? null : false);
    useConfirmStore.getState().show({ id: ++seq, ...opts, resolve });
  });
}
