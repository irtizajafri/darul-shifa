import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import { API_BASE_URL } from '../config';

// Idle logout for staff — the Super Admin is never logged out for being idle.
// 4 hours (owner, 2026-11-23): 30 minutes logged the counter out several
// times a day (talking to a patient, finding a file); 4 hours covers a shift
// and a PC left on overnight still logs itself out. A warning shows 2 minutes
// before; any key, click, mouse move, scroll or touch cancels it.
// The last activity is shared by every open HMS tab (localStorage), so work
// in one tab keeps the others logged in too.
const TIMEOUT_MS = 4 * 60 * 60 * 1000;
const WARN_BEFORE_MS = 2 * 60 * 1000;
const PING_INTERVAL_MS = 60 * 1000;   // tell the server "still here" every minute
const CHECK_INTERVAL_MS = 15 * 1000;  // look at the idle time every 15 seconds
const SHARE_EVERY_MS = 10 * 1000;     // write the shared time at most this often
const ACTIVITY_KEY = 'hms-last-activity';
const WARN_TOAST_ID = 'idle-logout-warning';
const EVENTS = ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'];

const readShared = () => {
  try { return Number(localStorage.getItem(ACTIVITY_KEY)) || 0; } catch { return 0; }
};
const writeShared = (t) => {
  try { localStorage.setItem(ACTIVITY_KEY, String(t)); } catch { /* storage blocked — this tab still counts */ }
};

export function useInactivityLogout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const userId = user?.id;
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const lastActivityRef = useRef(0);
  const lastSharedRef = useRef(0);
  const lastPingRef = useRef(0);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!userId || isSuperAdmin) return undefined;

    // A login / page load counts as activity.
    const start = Date.now();
    lastActivityRef.current = start;
    lastSharedRef.current = start;
    lastPingRef.current = start;
    writeShared(start);

    const hideWarning = () => {
      if (!warnedRef.current) return;
      warnedRef.current = false;
      toast.dismiss(WARN_TOAST_ID);
    };
    const resetActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastSharedRef.current >= SHARE_EVERY_MS) {
        lastSharedRef.current = now;
        writeShared(now);
      }
      hideWarning();
    };
    EVENTS.forEach((ev) => document.addEventListener(ev, resetActivity, { passive: true }));

    const interval = setInterval(() => {
      const now = Date.now();
      const idle = now - Math.max(lastActivityRef.current, readShared());

      if (idle >= TIMEOUT_MS) {
        hideWarning();
        logout();
        toast('Kaafi der se koi kaam nahi hua — hifazat ke liye logout ho gaya. Dobara login karein.', { icon: '🔒', duration: 10000 });
        return;
      }
      if (idle >= TIMEOUT_MS - WARN_BEFORE_MS) {
        if (!warnedRef.current) {
          warnedRef.current = true;
          toast('2 minute baad khud logout ho jayega — koi bhi key dabayein ya mouse hilayein', { id: WARN_TOAST_ID, icon: '⏳', duration: Infinity });
        }
      } else {
        hideWarning(); // work in another tab moved the time on
      }

      if (now - lastPingRef.current >= PING_INTERVAL_MS) {
        lastPingRef.current = now;
        fetch(`${API_BASE_URL}/api/users/${userId}/activity`, { method: 'PATCH' }).catch(() => {});
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      EVENTS.forEach((ev) => document.removeEventListener(ev, resetActivity));
      clearInterval(interval);
      toast.dismiss(WARN_TOAST_ID);
      warnedRef.current = false;
    };
  }, [userId, isSuperAdmin, logout]);
}
