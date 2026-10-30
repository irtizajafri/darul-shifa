import { useEffect, useState } from 'react';
import './UpdateNotice.scss';

// "System Updated" alert (owner, 2026-10-30). After a new deploy every open
// PC used to need Ctrl+Shift+R. Now each one checks the server's
// version.json once a minute (and whenever the window comes back into
// focus); a different build than the one running brings up this alert. It
// doesn't block the screen — staff finish what they're doing and press
// Refresh. Production builds only (the dev server has no version.json).
const CHECK_EVERY_MS = 60 * 1000;
const LATER_MS = 5 * 60 * 1000;
const RUNNING_BUILD = import.meta.env.VITE_BUILD_ID;

// Refresh = what Ctrl+Shift+R does (owner, 2026-10-30). A page can't press
// those keys itself, so it does the same job: fetches the page and the
// version file again straight from the server (cache: 'reload' also
// replaces the browser's cached copies), empties any Cache Storage / service
// worker, then reloads — the new build's files have new names, so nothing
// old can be picked up.
async function hardRefresh() {
  try {
    await Promise.all([
      fetch(window.location.href, { cache: 'reload' }),
      fetch('/', { cache: 'reload' }),
      fetch('/index.html', { cache: 'reload' }),
    ]);
  } catch { /* still reload below */ }
  try {
    if (window.caches) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((k) => window.caches.delete(k)));
    }
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* nothing cached that way */ }
  window.location.reload();
}

export default function UpdateNotice() {
  // On the dev server (localhost:5173) there are no deploys, so it never
  // shows by itself there — open http://localhost:5173/?update-test to see it.
  const [newBuild, setNewBuild] = useState(() => import.meta.env.DEV && new URLSearchParams(window.location.search).has('update-test'));
  const [snoozed, setSnoozed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !RUNNING_BUILD) return undefined;
    let stopped = false;
    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const { buildId } = await res.json();
        if (!stopped && buildId && buildId !== RUNNING_BUILD) setNewBuild(true);
      } catch { /* server restarting / offline — try again next time */ }
    };
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onFocus = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    // A screen asking for a file the new build no longer has also means
    // this PC is on an old build.
    const onPreloadError = () => setNewBuild(true);
    window.addEventListener('vite:preloadError', onPreloadError);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('vite:preloadError', onPreloadError);
    };
  }, []);

  // "Later" hides it for 5 minutes, then it comes back.
  useEffect(() => {
    if (!snoozed) return undefined;
    const t = setTimeout(() => setSnoozed(false), LATER_MS);
    return () => clearTimeout(t);
  }, [snoozed]);

  if (!newBuild || snoozed) return null;

  return (
    <div className="update-notice" role="alertdialog" aria-live="assertive" aria-labelledby="update-notice-title">
      <div className="update-notice__title" id="update-notice-title">System Updated</div>
      <p className="update-notice__text">
        A new version of the system has been deployed.
        <br />
        Please finish and save your current work, then press <strong>Refresh</strong>.
      </p>
      <div className="update-notice__actions">
        <button type="button" className="update-notice__refresh" onClick={() => { setRefreshing(true); hardRefresh(); }} disabled={refreshing} autoFocus>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        <button type="button" className="update-notice__later" onClick={() => setSnoozed(true)}>
          Remind me in 5 minutes
        </button>
      </div>
    </div>
  );
}
