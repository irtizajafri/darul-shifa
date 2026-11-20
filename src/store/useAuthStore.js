import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Static Super Admin ──────────────────────────────────────────────────────
// The master admin account — never stored in the database, bypasses all
// permission checks. Its password is checked on the server now (owner,
// 2026-11-20: it used to sit here, readable by anyone in the browser); the
// server's login returns this account with a token like any other user.
export const SUPER_ADMIN_EMAIL    = 'ceo@darulshifa.com';

export const SUPER_ADMIN_USER = {
  id: 'super-admin',
  name: 'Dr. Nadeem Abbas',
  email: SUPER_ADMIN_EMAIL,
  role: 'CEO',
  avatar: null,
  isSuperAdmin: true,
  permissions: { all: true },
};
// ─────────────────────────────────────────────────────────────────────────────

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // Call this after successful login (super admin or sub-user)
      login: (user, token = null) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        }),
    }),
    { name: 'hms-auth' }
  )
);
