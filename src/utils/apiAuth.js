import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config';
import { useAuthStore } from '../store/useAuthStore';

// Every call to the HMS API carries the login token (owner, 2026-11-20): the
// server now refuses /api calls without it. Done here once for every screen,
// instead of in each of the many fetch calls. A fresh token the server sends
// back ("x-new-token", after 12 hours) replaces the old one. When the server
// says the login is no longer valid, the user goes back to the login page.
const API_PREFIX = `${API_BASE_URL}/api/`;
const LOGIN_URL = `${API_BASE_URL}/api/auth/login`;
let sendingToLogin = false;

function urlOf(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input?.url || '';
}

export function installApiAuth() {
  if (window.__hmsApiAuth) return;
  window.__hmsApiAuth = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = urlOf(input);
    if (!url.startsWith(API_PREFIX)) return nativeFetch(input, init);

    const { token } = useAuthStore.getState();
    let opts = init;
    if (token) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      opts = { ...(init || {}), headers };
    }
    const res = await nativeFetch(input, opts);

    const fresh = res.headers.get('x-new-token');
    if (fresh && useAuthStore.getState().token) useAuthStore.setState({ token: fresh });

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
