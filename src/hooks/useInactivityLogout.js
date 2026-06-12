import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';

const TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes
const PING_INTERVAL_MS = 60 * 1000; // ping server every 1 minute
const CHECK_INTERVAL_MS = 30 * 1000; // check inactivity every 30 seconds

export function useInactivityLogout() {
  const { user, logout } = useAuthStore();
  const lastActivityRef = useRef(Date.now());
  const lastPingRef = useRef(Date.now());

  useEffect(() => {
    if (!user || user.isSuperAdmin) return;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    document.addEventListener('mousemove', resetActivity, { passive: true });
    document.addEventListener('click', resetActivity, { passive: true });
    document.addEventListener('keydown', resetActivity, { passive: true });
    document.addEventListener('scroll', resetActivity, { passive: true });

    const interval = setInterval(() => {
      const now = Date.now();
      const inactive = now - lastActivityRef.current;

      if (inactive >= TIMEOUT_MS) {
        logout();
        return;
      }

      if (now - lastPingRef.current >= PING_INTERVAL_MS) {
        lastPingRef.current = now;
        fetch(`http://localhost:5001/api/users/${user.id}/activity`, { method: 'PATCH' }).catch(() => {});
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener('mousemove', resetActivity);
      document.removeEventListener('click', resetActivity);
      document.removeEventListener('keydown', resetActivity);
      document.removeEventListener('scroll', resetActivity);
      clearInterval(interval);
    };
  }, [user, logout]);
}
