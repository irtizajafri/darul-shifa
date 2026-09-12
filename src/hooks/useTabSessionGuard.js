import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';

export const HMS_BROADCAST = 'hms-auth';
const REFRESH_FLAG = '_hmsRefresh';

// Module-level flag — survives React StrictMode double-invoke but resets on real page reload
let _sessionChecked = false;

// Call this right after a successful login to kick out other tabs/accounts
export function broadcastLogin(userId) {
  if (typeof BroadcastChannel === 'undefined') return;
  const ch = new BroadcastChannel(HMS_BROADCAST);
  ch.postMessage({ type: 'LOGIN', userId: String(userId) });
  ch.close();
}

export function useTabSessionGuard() {
  const { user, logout } = useAuthStore();
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  // On first mount: if this is NOT a page refresh, clear any stale session.
  // sessionStorage is wiped when a tab/browser closes, so if the flag is gone
  // it means the previous session ended by closing — force logout.
  // _sessionChecked prevents React StrictMode's double-invoke from running this twice.
  useEffect(() => {
    if (_sessionChecked) return;
    _sessionChecked = true;

    const wasRefresh = sessionStorage.getItem(REFRESH_FLAG);
    if (wasRefresh) {
      sessionStorage.removeItem(REFRESH_FLAG);
    } else {
      // Super admin stays logged in across browser sessions
      const currentUser = useAuthStore.getState().user;
      if (!currentUser?.isSuperAdmin) {
        logoutRef.current();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Before the page unloads (refresh OR close), set the flag.
  // On close: tab dies → sessionStorage wiped → flag gone on next open.
  // On refresh: tab survives → sessionStorage preserved → flag present on reload.
  // Same handler also asks the browser to show its native "Leave site?"
  // confirmation — staff mid-entry on a bill/slip accidentally hitting the
  // tab's ✕ or closing Chrome shouldn't lose work silently. The browser
  // supplies its own generic wording (Chrome/Firefox/etc. all ignore any
  // custom returnValue text) — setting it non-empty is what triggers the
  // prompt at all. Only fires on a real browser-level unload (tab close,
  // window close, hard refresh, typed URL) — normal in-app navigation
  // between HMS pages is a React Router client-side transition, not a
  // beforeunload, so it never prompts.
  useEffect(() => {
    const mark = (e) => {
      sessionStorage.setItem(REFRESH_FLAG, '1');
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', mark);
    return () => window.removeEventListener('beforeunload', mark);
  }, []);

  // One account per browser: when another tab logs in with a different ID,
  // logout this tab and show the login screen.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(HMS_BROADCAST);
    ch.onmessage = ({ data }) => {
      if (data?.type === 'LOGIN') {
        const currentId = String(user?.id ?? user?.email ?? '');
        if (currentId && currentId !== data.userId) {
          logoutRef.current();
        }
      }
    };
    return () => ch.close();
  }, [user]);
}
