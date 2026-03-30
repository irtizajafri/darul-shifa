import { create } from 'zustand';

const API_URL = 'http://localhost:5001/api/advance';

export const useAdvanceLoanStore = create((set) => ({
  records: [],
  loading: false,
  error: null,

  fetchAdvanceLoans: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(API_URL);
      const json = await res.json();
      const data = json.data || json || [];
      set({ records: Array.isArray(data) ? data : [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createAdvanceLoan: async (payload) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Failed to save record');
      const record = json.data || json;
      set((state) => ({ records: [record, ...state.records], loading: false }));
      return record;
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  }
}));