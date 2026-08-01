import { create } from 'zustand';

const API_URL = 'http://localhost:5001/api/fuel';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.message || `Request failed (${res.status})`);
  return json?.data;
}

export const useFuelStore = create((set) => ({
  vehicles: [],
  generators: [],
  vehicleEntries: [],
  generatorEntries: [],
  dailySheets: [],
  fuelStock: [],
  fuelBalance: null,
  loading: false,
  error: null,

  // ── Generators ────────────────────────────────────────────────────────────
  fetchGenerators: async () => {
    try {
      const data = await request('/generators');
      set({ generators: Array.isArray(data) ? data : [] });
    } catch (err) { throw err; }
  },

  createGenerator: async (payload) => {
    const data = await request('/generators', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ generators: [...s.generators, data] }));
    return data;
  },

  updateGenerator: async (id, payload) => {
    const data = await request(`/generators/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    set((s) => ({ generators: s.generators.map((g) => (g.id === id ? data : g)) }));
    return data;
  },

  // ── Vehicles ──────────────────────────────────────────────────────────────
  fetchVehicles: async () => {
    set({ loading: true, error: null });
    try {
      const data = await request('/vehicles');
      set({ vehicles: Array.isArray(data) ? data : [], loading: false });
    } catch (err) { set({ error: err.message, loading: false }); throw err; }
  },

  createVehicle: async (payload) => {
    const data = await request('/vehicles', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ vehicles: [...s.vehicles, data] }));
    return data;
  },

  updateVehicle: async (id, payload) => {
    const data = await request(`/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    set((s) => ({ vehicles: s.vehicles.map((v) => (v.id === id ? data : v)) }));
    return data;
  },

  // ── Vehicle Entries ────────────────────────────────────────────────────────
  fetchVehicleEntries: async ({ vehicleId, entryType } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (vehicleId) qs.set('vehicleId', vehicleId);
      if (entryType) qs.set('entryType', entryType);
      const data = await request(`/vehicle-entries?${qs}`);
      set({ vehicleEntries: Array.isArray(data) ? data : [], loading: false });
    } catch (err) { set({ error: err.message, loading: false }); throw err; }
  },

  fetchLastVehicleEntry: async ({ vehicleId, entryType }) => {
    const qs = new URLSearchParams({ vehicleId, entryType });
    return request(`/vehicle-entries/last?${qs}`);
  },

  createVehicleEntry: async (payload) => {
    const data = await request('/vehicle-entries', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ vehicleEntries: [data, ...s.vehicleEntries] }));
    return data;
  },

  updateVehicleEntry: async (id, payload) => {
    const data = await request(`/vehicle-entries/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    set((s) => ({ vehicleEntries: s.vehicleEntries.map((e) => (e.id === id ? data : e)) }));
    return data;
  },

  deleteVehicleEntry: async (id) => {
    await request(`/vehicle-entries/${id}`, { method: 'DELETE' });
    set((s) => ({ vehicleEntries: s.vehicleEntries.filter((e) => e.id !== id) }));
  },

  // ── Generator Entries ──────────────────────────────────────────────────────
  fetchGeneratorEntries: async ({ generatorId, entryType } = {}) => {
    set({ loading: true, error: null });
    try {
      const qs = new URLSearchParams();
      if (generatorId) qs.set('generatorId', generatorId);
      if (entryType) qs.set('entryType', entryType);
      const data = await request(`/generator-entries?${qs}`);
      set({ generatorEntries: Array.isArray(data) ? data : [], loading: false });
    } catch (err) { set({ error: err.message, loading: false }); throw err; }
  },

  fetchLastGeneratorEntry: async ({ generatorId, entryType }) => {
    const qs = new URLSearchParams();
    if (generatorId) qs.set('generatorId', generatorId);
    if (entryType) qs.set('entryType', entryType);
    return request(`/generator-entries/last?${qs}`);
  },

  createGeneratorEntry: async (payload) => {
    const data = await request('/generator-entries', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ generatorEntries: [data, ...s.generatorEntries] }));
    return data;
  },

  updateGeneratorEntry: async (id, payload) => {
    const data = await request(`/generator-entries/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    set((s) => ({ generatorEntries: s.generatorEntries.map((e) => (e.id === id ? data : e)) }));
    return data;
  },

  deleteGeneratorEntry: async (id) => {
    await request(`/generator-entries/${id}`, { method: 'DELETE' });
    set((s) => ({ generatorEntries: s.generatorEntries.filter((e) => e.id !== id) }));
  },

  // ── Fuel Stock ────────────────────────────────────────────────────────────
  fetchFuelBalance: async () => {
    try {
      const data = await request('/balance');
      set({ fuelBalance: data });
      return data;
    } catch (err) { return null; }
  },

  fetchFuelStock: async () => {
    try {
      const data = await request('/stock');
      set({ fuelStock: Array.isArray(data) ? data : [] });
    } catch (err) { throw err; }
  },

  createFuelStock: async (payload) => {
    const data = await request('/stock', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ fuelStock: [data, ...s.fuelStock] }));
    return data;
  },

  deleteFuelStock: async (id) => {
    await request(`/stock/${id}`, { method: 'DELETE' });
    set((s) => ({ fuelStock: s.fuelStock.filter((e) => e.id !== id) }));
  },

  // ── Daily Sheets ───────────────────────────────────────────────────────────
  fetchDailySheets: async (generatorId) => {
    set({ loading: true, error: null });
    try {
      const qs = generatorId ? `?generatorId=${generatorId}` : '';
      const data = await request(`/daily-sheets${qs}`);
      set({ dailySheets: Array.isArray(data) ? data : [], loading: false });
    } catch (err) { set({ error: err.message, loading: false }); throw err; }
  },

  fetchLastDailySheet: async (generatorId) => {
    const qs = generatorId ? `?generatorId=${generatorId}` : '';
    return request(`/daily-sheets/last${qs}`);
  },

  createDailySheet: async (payload) => {
    const data = await request('/daily-sheets', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ dailySheets: [data, ...s.dailySheets] }));
    return data;
  },

  updateDailySheet: async (id, payload) => {
    const data = await request(`/daily-sheets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    set((s) => ({ dailySheets: s.dailySheets.map((d) => (d.id === id ? data : d)) }));
    return data;
  },

  deleteDailySheet: async (id) => {
    await request(`/daily-sheets/${id}`, { method: 'DELETE' });
    set((s) => ({ dailySheets: s.dailySheets.filter((d) => d.id !== id) }));
  },
}));
