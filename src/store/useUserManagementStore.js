import { create } from 'zustand';

const BASE_URL = 'http://localhost:5001/api/users';

// Safely parse a fetch response as JSON.
// If the server returns HTML (e.g. 404/500 error page) this gives a clear message
// instead of "Unexpected token '<'" crash.
async function safeJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`Server error (${res.status}). Make sure the backend is running and restarted.`);
    }
    throw new Error('Server returned an unexpected response (not JSON).');
  }
}

export const useUserManagementStore = create((set, get) => ({
  users: [],
  loading: false,
  error: null,

  fetchUsers: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(BASE_URL);
      const json = await safeJson(res);
      if (!json.ok) throw new Error(json.message || 'Failed to fetch users');
      set({ users: json.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createUser: async (userData) => {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.message || 'Failed to create user');
    set((state) => ({ users: [json.data, ...state.users] }));
    return json.data;
  },

  updateUser: async (id, userData) => {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.message || 'Failed to update user');
    set((state) => ({
      users: state.users.map((u) => (u.id === id ? json.data : u)),
    }));
    return json.data;
  },

  deleteUser: async (id) => {
    const res = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.ok) throw new Error(json.message || 'Failed to delete user');
    set((state) => ({ users: state.users.filter((u) => u.id !== id) }));
  },

  toggleActive: async (id) => {
    const res = await fetch(`${BASE_URL}/${id}/toggle`, { method: 'PATCH' });
    const json = await res.json();
    if (!json.ok) throw new Error(json.message || 'Failed to toggle user status');
    set((state) => ({
      users: state.users.map((u) =>
        u.id === id ? { ...u, isActive: json.data.isActive } : u
      ),
    }));
    return json.data;
  },

  changePassword: async (id, password) => {
    const res = await fetch(`${BASE_URL}/${id}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.message || 'Failed to change password');
  },
}));
