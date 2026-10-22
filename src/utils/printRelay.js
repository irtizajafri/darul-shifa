import toast from 'react-hot-toast';

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

export function openPrintWindow(features = DEFAULT_FEATURES) {
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
