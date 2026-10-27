import { create } from 'zustand';

// Accounts reports open a preview screen first, with the same toolbar as
// the Clinic reports (owner, 2026-10-27): Back · Print / PDF · Export Excel ·
// Refresh · Minimize / Close. Each report already builds its own print page
// and writes it into the window from openPrintWindow(); openReportPreview()
// hands it a stand-in with the same shape, keeps the page it writes, and
// opens it at /accounts/:entityType/reports/:key/view?pid=… (AccountsReportView)
// — the report's own builder and filters stay untouched.
//
// `regenerate` re-runs the report with the same filters (toolbar Refresh);
// while it runs, the next openReportPreview() refills the same preview in
// place instead of opening a new one.

export const useReportPreviewStore = create((set) => ({
  previews: {}, // pid → { html, title, autoPrint, regenerate, at }
  put: (pid, data) => set((s) => ({ previews: { ...s.previews, [pid]: { ...s.previews[pid], ...data } } })),
}));

let refillPid = null;

export function refreshReportPreview(pid) {
  const p = useReportPreviewStore.getState().previews[pid];
  if (!p?.regenerate) return Promise.resolve();
  refillPid = pid;
  return Promise.resolve(p.regenerate()).finally(() => { refillPid = null; });
}

export function openReportPreview({ navigate, entityType, reportKey, title, regenerate }) {
  const refill = refillPid;
  const pid = refill || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let buffer = '';
  let html = null;
  let autoPrint = false;
  const handle = {
    closed: false,
    get filled() { return html != null; },
    document: {
      open() { buffer = ''; },
      write(s) { buffer += String(s); },
      close() {
        html = buffer;
        useReportPreviewStore.getState().put(pid, { html, title, autoPrint, regenerate, at: Date.now() });
        if (!refill) navigate(`/accounts/${entityType}/reports/${reportKey}/view?pid=${pid}`);
      },
    },
    focus() {},
    // The report asked to print — the preview's Print button does that now.
    print() { autoPrint = true; useReportPreviewStore.getState().put(pid, { autoPrint: true }); },
    close() { handle.closed = true; },
  };
  return handle;
}
