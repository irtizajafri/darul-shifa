import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config';
import { useAuthStore } from '../store/useAuthStore';

// Every call to the HMS API carries the login token (owner, 2026-11-20): the
// server now refuses /api calls without it. Done here once for every screen,
// instead of in each of the many fetch calls. A fresh token the server sends
// back ("x-new-token", after an hour) replaces the old one. When the server
// says the login is no longer valid, the user goes back to the login page.
const API_PREFIX = `${API_BASE_URL}/api/`;
const LOGIN_URL = `${API_BASE_URL}/api/auth/login`;
let sendingToLogin = false;

// A newer token for the SAME signed-in user, as another HMS tab saved it
// (raw = the saved 'hms-auth' text) — or null. A logout or another user's
// login in that tab isn't taken over here: those keep their own rules
// (useTabSessionGuard), so one tab can't silently become another user.
// When a token was issued (its "iat", seconds) — 0 if it can't be read.
function issuedAt(token) {
  try {
    const part = String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return Number(JSON.parse(atob(part)).iat) || 0;
  } catch { return 0; }
}

function newerSameUserToken(raw) {
  let saved;
  try { saved = JSON.parse(raw || '{}')?.state; } catch { return null; }
  const cur = useAuthStore.getState();
  if (!cur.isAuthenticated || !saved?.isAuthenticated || !saved.token || saved.token === cur.token) return null;
  if (String(saved.user?.id ?? '') !== String(cur.user?.id ?? '')) return null;
  // Never trade for an older token.
  return issuedAt(saved.token) >= issuedAt(cur.token) ? saved.token : null;
}

function urlOf(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input?.url || '';
}

export function installApiAuth() {
  if (window.__hmsApiAuth) return;
  window.__hmsApiAuth = true;
  const nativeFetch = window.fetch.bind(window);

  // Another tab got a fresh token (owner, 2026-11-23): take it here too, so
  // this tab doesn't carry on with an old token that later expires and logs
  // every tab out.
  window.addEventListener('storage', (e) => {
    if (e.key !== 'hms-auth') return;
    const newer = newerSameUserToken(e.newValue);
    if (newer) useAuthStore.setState({ token: newer });
  });

  window.fetch = async (input, init) => {
    const url = urlOf(input);
    if (!url.startsWith(API_PREFIX)) return nativeFetch(input, init);

    const { token } = useAuthStore.getState();
    let opts = init;
    let sent = ''; // the token this request actually carries
    if (token) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      sent = String(headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      opts = { ...(init || {}), headers };
    } else if (init?.headers) {
      sent = String(new Headers(init.headers).get('Authorization') || '').replace(/^Bearer\s+/i, '');
    }
    // The same request again with another token (replacing one set by the caller).
    const retryWith = (t) => {
      const headers = new Headers(init?.headers || undefined);
      headers.set('Authorization', `Bearer ${t}`);
      return window.fetch(input, { ...(init || {}), headers });
    };
    const res = await nativeFetch(input, opts);

    const fresh = res.headers.get('x-new-token');
    if (fresh && useAuthStore.getState().token) useAuthStore.setState({ token: fresh });

    if (res.status === 401 && url !== LOGIN_URL && typeof input === 'string') {
      // Sent before a fresh login (old token, or none while logged out) and
      // answered after it (owner, 2026-11-25: "dobara login ke baad bhi wohi
      // error"): not a reason to log out — send it again with today's token.
      const current = useAuthStore.getState().token;
      if (current && current !== sent) return retryWith(current);
      // Another tab has saved a newer token for this same user: take it and
      // try once more before calling the session over.
      if (sent) {
        let raw = null;
        try { raw = localStorage.getItem('hms-auth'); } catch { /* storage blocked */ }
        const newer = newerSameUserToken(raw);
        if (newer && newer !== sent) {
          useAuthStore.setState({ token: newer });
          return retryWith(newer);
        }
      }
    }

    if (res.status === 401 && url !== LOGIN_URL && !sendingToLogin && useAuthStore.getState().isAuthenticated) {
      sendingToLogin = true;
      useAuthStore.getState().logout();
      toast.error('Session khatam ho gaya — dobara login karein');
      setTimeout(() => { window.location.assign('/login'); }, 600);
    }
    // This PC was blocked on Connected PCs (or waits for approval).
    if (res.status === 403 && url !== LOGIN_URL && !sendingToLogin && useAuthStore.getState().isAuthenticated) {
      const body = await res.clone().json().catch(() => null);
      if (body?.code === 'DEVICE_BLOCKED') {
        sendingToLogin = true;
        useAuthStore.getState().logout();
        toast.error(body.message, { duration: 8000 });
        setTimeout(() => { window.location.assign('/login'); }, 1500);
      }
    }
    return res;
  };
}

// While the app is open, tell the server this PC is here once a minute, so
// Connected PCs shows it online even on a quiet screen.
export function startDeviceHeartbeat() {
  if (window.__hmsHeartbeat) return;
  window.__hmsHeartbeat = true;
  const beat = () => {
    if (useAuthStore.getState().isAuthenticated && document.visibilityState !== 'hidden') {
      fetch(`${API_BASE_URL}/api/devices/ping`).catch(() => {});
    }
  };
  beat();
  setInterval(beat, 60 * 1000);
}
