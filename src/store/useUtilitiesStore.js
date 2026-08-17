import { create } from 'zustand';

const API_URL = 'http://localhost:5001/api/utilities';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.message || `Request failed (${res.status})`);
  return json?.data;
}

export const useUtilitiesStore = create((set) => ({
  meters: [],
  readings: [],
  rates: [],
  bills: [],
  report: null,

  // ── Meters ────────────────────────────────────────────────────────────────
  fetchMeters: async ({ type, utility, billingMeterId } = {}) => {
    const qs = new URLSearchParams();
    if (type) qs.set('type', type);
    if (utility) qs.set('utility', utility);
    if (billingMeterId) qs.set('billingMeterId', billingMeterId);
    const data = await request(`/meters?${qs}`);
    set({ meters: Array.isArray(data) ? data : [] });
    return data;
  },

  getMeter: async (id) => request(`/meters/${id}`),

  createMeter: async (payload) => {
    const data = await request('/meters', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ meters: [...s.meters, data] }));
    return data;
  },

  updateMeter: async (id, payload) => {
    const data = await request(`/meters/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    set((s) => ({ meters: s.meters.map((m) => (m.id === id ? data : m)) }));
    return data;
  },

  // ── Rate history ──────────────────────────────────────────────────────────
  fetchRates: async (meterId) => {
    const data = await request(`/meters/${meterId}/rates`);
    set({ rates: Array.isArray(data) ? data : [] });
    return data;
  },

  createRate: async (meterId, payload) => {
    const data = await request(`/meters/${meterId}/rates`, { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ rates: [data, ...s.rates] }));
    return data;
  },

  deleteRate: async (id) => {
    await request(`/rates/${id}`, { method: 'DELETE' });
    set((s) => ({ rates: s.rates.filter((r) => r.id !== id) }));
  },

  // ── Current running estimate ─────────────────────────────────────────────
  fetchCurrentEstimate: (meterId) => request(`/meters/${meterId}/current-estimate`),

  // ── Daily readings ───────────────────────────────────────────────────────
  fetchReadings: async ({ meterId, from, to } = {}) => {
    const qs = new URLSearchParams();
    if (meterId) qs.set('meterId', meterId);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const data = await request(`/readings?${qs}`);
    set({ readings: Array.isArray(data) ? data : [] });
    return data;
  },

  fetchLastReading: (meterId) => request(`/readings/last?meterId=${meterId}`),

  saveReading: async (payload) => {
    const data = await request('/readings', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => {
      const exists = s.readings.some((r) => r.id === data.id);
      return { readings: exists ? s.readings.map((r) => (r.id === data.id ? data : r)) : [data, ...s.readings] };
    });
    return data;
  },

  deleteReading: async (id) => {
    await request(`/readings/${id}`, { method: 'DELETE' });
    set((s) => ({ readings: s.readings.filter((r) => r.id !== id) }));
  },

  // ── Actual bills ──────────────────────────────────────────────────────────
  fetchBills: async (meterId) => {
    const data = await request(`/bills?meterId=${meterId}`);
    set({ bills: Array.isArray(data) ? data : [] });
    return data;
  },

  createBill: async (payload) => {
    const data = await request('/bills', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ bills: [data, ...s.bills] }));
    return data;
  },

  updateBill: async (id, payload) => {
    const data = await request(`/bills/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    set((s) => ({ bills: s.bills.map((b) => (b.id === id ? data : b)) }));
    return data;
  },

  deleteBill: async (id) => {
    await request(`/bills/${id}`, { method: 'DELETE' });
    set((s) => ({ bills: s.bills.filter((b) => b.id !== id) }));
  },

  // ── Report ────────────────────────────────────────────────────────────────
  fetchReport: async ({ meterId, from, to }) => {
    const qs = new URLSearchParams({ meterId });
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const data = await request(`/report?${qs}`);
    set({ report: data });
    return data;
  },
}));
