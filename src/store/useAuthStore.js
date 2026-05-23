import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Static Super Admin ──────────────────────────────────────────────────────
// This is the master admin account. Credentials are hardcoded here intentionally.
// This account is never stored in the database and bypasses all permission checks.
export const SUPER_ADMIN_EMAIL    = 'ceo@hospital.com';
export const SUPER_ADMIN_PASSWORD = 'qwerty321';

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
