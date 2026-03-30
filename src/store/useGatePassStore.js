import { create } from 'zustand';

const API_URL = 'http://localhost:5001/api/gatepass';

export const useGatePassStore = create((set) => ({
  gatepasses: [],
  loading: false,
  error: null,

  fetchGatepasses: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(API_URL);
      const json = await res.json();
      const data = json.data || json || [];
      set({ gatepasses: Array.isArray(data) ? data : [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createGatepass: async (payload) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Failed to create gatepass');
      const record = json.data || json;
      set((state) => ({ gatepasses: [record, ...state.gatepasses], loading: false }));
      return record;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  closeGatepass: async (id, payload) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/${id}/return`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Failed to close gatepass');
      const record = json.data || json;
      set((state) => ({
        gatepasses: state.gatepasses.map((g) => (String(g.id) === String(record.id) ? record : g)),
        loading: false
      }));
      return record;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  }
}));
