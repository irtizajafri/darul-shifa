import { createElement } from 'react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config';
import { useAuthStore } from '../store/useAuthStore';

// Print windows that can't freeze the app (owner's hang report, 2026-10-22).
//
// Why: a popup opened with window.open('') and written into (document.write)
// stays in the app's own JS thread. Its window.print() dialog blocks that
// thread — the whole app (every tab) froze while a print dialog was open,
// and looked hung whenever that dialog/popup slipped behind the app window
// ("switch to another Chrome window and it's fine again"). Measured: such a
// popup stalled a 100ms app timer to 1.5s; a noopener window ~35ms.
//
// How: open /print-relay.html (public/) with `noopener` — its own
// browsing-context group, so its print dialog only blocks itself — and hand
// it the print HTML over a BroadcastChannel. noopener means window.open()
// returns null, so "popup blocked" is detected by the relay never saying
// it's ready; then an error toast is shown.
//
// openPrintWindow() returns a small stand-in for the old popup window so
// existing code keeps its shape:
//   const w = openPrintWindow('width=900,height=700');   // on the click
//   w.document.write(html); w.document.close();          // later is fine
//   w.print();                                           // optional
// The HTML usually prints itself on load (window.onload → print), exactly
// as before; w.print() asks the relay to print once it's loaded.

const CHANNEL = 'hms-print-relay';
const READY_TIMEOUT_MS = 6000;
let channel = null;
const jobs = new Map(); // key → { ready, html, print, sent, timer }

function getChannel() {
  if (channel) return channel;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e) => {
    const m = e.data || {};
    const job = jobs.get(m.key);
    if (!job || m.type !== 'ready') return;
    job.ready = true;
    clearTimeout(job.timer);
    // close() was called (e.g. the save failed) before the window said ready.
    if (job.closing) { jobs.delete(m.key); channel.postMessage({ type: 'close', key: m.key }); return; }
    flush(m.key);
  };
  return channel;
}

function flush(key) {
  const job = jobs.get(key);
  if (!job || !job.ready || job.html == null || job.sent) return;
  job.sent = true;
  getChannel().postMessage({ type: 'html', key, html: job.html, print: job.print });
  // Keep the job a little so a late w.print()/close() can still reach it.
  setTimeout(() => jobs.delete(key), 60000);
}

const DEFAULT_FEATURES = 'width=1000,height=800';

// ─── Direct printing (owner, 2026-11-24) ─────────────────────────────────────
// "Thermal & Save" straight to the PC's thermal printer, "Save & Print"
// straight to its normal printer — no printer-choice dialog. A web page can't
// choose a printer, so the server prints (api/print, print.service.js) on the
// printers the Super Admin set for this PC in Connected PCs. A PC without
// them keeps the print dialog exactly as before.
// openPrintWindow(features, { targets: ['thermal' | 'normal', …] }) — every
// printer the click will need. Each parcha is decided on its own (owner,
// 2026-11-26): the ones whose printer is set go to the server, and a print
// dialog opens (on the click) only for the ones whose printer isn't. When
// any goes to the server the handle has isServerPrint and
// serverPrint(docs, {fallbackHtml}).
// The PC's printer setting loads when the app opens (startPrintConfig, from
// MainLayout) and every minute after, so a click never decides on an empty
// or old setting. PrintStatus (OPD screens) shows it and sends test prints.
const PRINT_API = `${API_BASE_URL}/api/print`;
const PRINT_CONFIG_MS = 60 * 1000;
let printConfig = null;      // { pc, thermal, normal } from the server
let printConfigAt = 0;
let printConfigError = '';   // the last load failed (shown by PrintStatus)
let printConfigLoading = null;
const printListeners = new Set();
const notifyPrint = () => printListeners.forEach((fn) => { try { fn(); } catch { /* a closed screen */ } });

export function refreshPrintConfig() {
  if (printConfigLoading) return printConfigLoading;
  if (!useAuthStore.getState().isAuthenticated) return Promise.resolve();
  printConfigLoading = fetch(`${PRINT_API}/config`)
    .then(async (r) => {
      const j = await r.json().catch(() => null);
      if (r.ok && j?.data) {
        printConfig = j.data;
        printConfigAt = Date.now();
        printConfigError = '';
      } else {
        printConfigError = j?.message || `Server ne setting nahi di (${r.status})`;
      }
    })
    .catch(() => { printConfigError = 'Server tak nahi pahuncha'; })
    .finally(() => { printConfigLoading = null; notifyPrint(); });
  return printConfigLoading;
}

export const getPrintConfig = () => ({ config: printConfig, at: printConfigAt, error: printConfigError, loading: !!printConfigLoading });
export function subscribePrintConfig(fn) {
  printListeners.add(fn);
  return () => printListeners.delete(fn);
}

let printConfigStarted = false;
export function startPrintConfig() {
  refreshPrintConfig();
  if (printConfigStarted) return;
  printConfigStarted = true;
  setInterval(() => { if (!document.hidden) refreshPrintConfig(); }, PRINT_CONFIG_MS);
  window.addEventListener('focus', () => { if (Date.now() - printConfigAt > 15000) refreshPrintConfig(); });
}

const printerSet = (target) => !!printConfig?.[target];

async function sendToServer(docs, fallbackHtml, features) {
  try {
    const res = await fetch(PRINT_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ docs }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Printer tak nahi pahuncha');
  } catch (e) {
    // The slip is saved; a click on the toast is a fresh click, so the print
    // dialog can still open from it.
    toast.error((t) => createElement('span', null,
      `Print nahi hua — ${e.message}. `,
      createElement('button', {
        type: 'button',
        onClick: () => { toast.dismiss(t.id); printHtml(fallbackHtml, features); },
        style: { marginLeft: 6, padding: '3px 8px', border: '1px solid #b91c1c', borderRadius: 4, background: '#fff', color: '#b91c1c', fontWeight: 700, cursor: 'pointer' },
      }, 'Dialog se print karein'),
    ), { duration: 20000 });
  }
}

// onServer: the targets whose printer is set; dialogPart: a print window
// opened on the click for the rest (or null when every printer is set).
function serverPrintHandle(target, features, onServer, dialogPart) {
  let buffer = '';
  let sent = false;
  const handle = {
    closed: false,
    isPrintRelay: true,
    isServerPrint: true,
    get filled() { return sent; },
    // docs: [{ html, target }] (null entries skipped); fallbackHtml: what the
    // print dialog shows if the server can't print them all.
    serverPrint(docs, { fallbackHtml } = {}) {
      if (sent) return;
      sent = true;
      const list = (docs || []).filter((d) => d && d.html);
      const toServer = list.filter((d) => onServer.has(d.target));
      const toDialog = list.filter((d) => !onServer.has(d.target));
      if (dialogPart) {
        if (toDialog.length) { dialogPart.document.write(toDialog[0].html); dialogPart.document.close(); }
        else dialogPart.close();
      }
      if (toServer.length) {
        const fb = toServer.length === list.length ? (fallbackHtml || toServer[0].html) : toServer[0].html;
        sendToServer(toServer, fb, features);
      }
    },
    document: {
      open() { buffer = ''; },
      write(s) { buffer += String(s); },
      writeln(s) { buffer += `${String(s)}\n`; },
      close() { handle.serverPrint([{ html: buffer, target }]); },
    },
    print() {},
    focus() {},
    close() { handle.closed = true; if (dialogPart && !sent) dialogPart.close(); },
    set onafterprint(_) {},
    set onload(_) {},
    addEventListener() {},
  };
  return handle;
}

export function openPrintWindow(features = DEFAULT_FEATURES, { targets = [] } = {}) {
  const need = [...new Set(targets.filter(Boolean))];
  if (need.length) {
    if (Date.now() - printConfigAt > PRINT_CONFIG_MS) refreshPrintConfig();
    const onServer = new Set(need.filter(printerSet));
    if (onServer.size) {
      // A dialog, opened now on the click, only for the parchas whose printer isn't set.
      const dialogPart = onServer.size < need.length ? relayWindow(features) : null;
      return serverPrintHandle(need[0], features, onServer, dialogPart);
    }
  }
  return relayWindow(features);
}

// The print dialog window (print-relay.html, see the top of this file).
function relayWindow(features = DEFAULT_FEATURES) {
  const key = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  getChannel();
  const job = { ready: false, html: null, print: false, sent: false, timer: null };
  jobs.set(key, job);
  const feat = /noopener/.test(features) ? features : `${features ? `${features},` : ''}noopener`;
  window.open(`${window.location.origin}/print-relay.html#${key}`, '_blank', feat);
  job.timer = setTimeout(() => {
    if (job.ready) return;
    jobs.delete(key);
    toast.error('Print window nahi khuli — browser mein is site ke liye popups allow karein, phir dobara Print karein.', { duration: 7000 });
  }, READY_TIMEOUT_MS);

  let buffer = '';
  const handle = {
    closed: false,
    isPrintRelay: true,
    // true once the print HTML has been handed over (document.close()) — an
    // error after that (e.g. a refetch after the save) must not close it.
    get filled() { return job.html != null; },
    document: {
      open() { buffer = ''; },
      write(s) { buffer += String(s); },
      writeln(s) { buffer += `${String(s)}\n`; },
      close() { job.html = buffer; flush(key); },
    },
    print() {
      if (job.sent) getChannel().postMessage({ type: 'print', key });
      else job.print = true;
    },
    focus() {},
    close() {
      handle.closed = true;
      if (job.sent || job.ready) getChannel().postMessage({ type: 'close', key });
      else {
        // Not ready yet (closed right after opening, e.g. the save failed):
        // close it as soon as it reports ready; give up after a while.
        clearTimeout(job.timer);
        job.closing = true;
        setTimeout(() => jobs.delete(key), READY_TIMEOUT_MS);
      }
    },
    // Old code sets these on the popup; the relay page's own HTML handles
    // afterprint/close, so they're accepted and ignored.
    set onafterprint(_) {},
    set onload(_) {},
    addEventListener() {},
  };
  return handle;
}

// One-shot: open a print window and give it this HTML. Pass `targetWindow`
// (an openPrintWindow() handle opened on the click, before any await) when
// the HTML is only ready after a save/fetch — a window opened after an await
// is blocked as an unrequested popup.
export function printHtml(html, features = DEFAULT_FEATURES, targetWindow = null) {
  const w = targetWindow && !targetWindow.closed ? targetWindow : openPrintWindow(features);
  w.document.write(html);
  w.document.close();
  return w;
}

// ─── Test print (PrintStatus, owner 2026-11-26) ──────────────────────────────
// A small parcha through the very same server route a slip takes — nothing is
// saved and no number is used.
function testPageHtml(target, pc) {
  const when = new Date().toLocaleString('en-GB');
  const thermal = target === 'thermal';
  const page = thermal ? '@page { size: 80mm auto; margin: 0; } body { width: 72mm; padding: 3mm; }'
    : '@page { size: auto; margin: 0; } body { width: 148mm; padding: 6mm; }';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Test print</title><style>
    ${page}
    body { margin: 0 auto; font-family: Arial, Helvetica, sans-serif; color: #000; text-align: center; }
    h1 { font-size: ${thermal ? 16 : 22}px; margin: 4px 0; letter-spacing: 1px; }
    .big { font-size: ${thermal ? 14 : 18}px; font-weight: 700; margin: 6px 0; padding: 4px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
    p { font-size: ${thermal ? 11 : 13}px; margin: 3px 0; }
  </style></head><body>
    <h1>DARUL SHIFA HMS</h1>
    <div class="big">TEST PRINT — ${thermal ? 'THERMAL' : 'NORMAL'}</div>
    <p>PC: ${String(pc || '').replace(/[<>&]/g, '')}</p>
    <p>${when}</p>
    <p>Yeh parcha sirf printer check karne ke liye hai.</p>
  </body></html>`;
}

export async function printTestPage(target) {
  const res = await fetch(PRINT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ docs: [{ html: testPageHtml(target, printConfig?.pc), target }] }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Printer tak nahi pahuncha');
  return j.data;
}
