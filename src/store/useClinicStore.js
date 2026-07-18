import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';

const API_URL = 'http://localhost:5001/api/clinic';

function getToken() {
  return useAuthStore.getState().token;
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Request failed (${res.status})`);
  return json?.data;
}

export const useClinicStore = create((set) => ({
  loading: false,
  error: null,

  departments: [],
  subDepartments: [],
  doctors: [],

  // ── Department ──────────────────────────────────────────────────────────────
  fetchDepartments: async () => {
    set({ loading: true, error: null });
    try {
      const departments = await request('/departments');
      set({ departments, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createDepartment: async (payload) => {
    const data = await request('/departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    set((s) => ({ departments: [...s.departments, data].sort((a, b) => a.name.localeCompare(b.name)) }));
    return data;
  },

  updateDepartment: async (id, payload) => {
    const data = await request(`/departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    set((s) => ({
      departments: s.departments.map((d) => (d.id === id ? data : d)),
    }));
    return data;
  },

  deleteDepartment: async (id) => {
    await request(`/departments/${id}`, { method: 'DELETE' });
    set((s) => ({ departments: s.departments.filter((d) => d.id !== id) }));
  },

  // ── Surgery Type ────────────────────────────────────────────────────────────
  surgeryTypes: [],

  fetchSurgeryTypes: async () => {
    set({ loading: true, error: null });
    try {
      const surgeryTypes = await request('/surgery-types');
      set({ surgeryTypes, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createSurgeryType: async (payload) => {
    const data = await request('/surgery-types', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    set((s) => ({ surgeryTypes: [...s.surgeryTypes, data].sort((a, b) => a.name.localeCompare(b.name)) }));
    return data;
  },

  updateSurgeryType: async (id, payload) => {
    const data = await request(`/surgery-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    set((s) => ({ surgeryTypes: s.surgeryTypes.map((c) => (c.id === id ? data : c)) }));
    return data;
  },

  deleteSurgeryType: async (id) => {
    await request(`/surgery-types/${id}`, { method: 'DELETE' });
    set((s) => ({ surgeryTypes: s.surgeryTypes.filter((c) => c.id !== id) }));
  },

  // ── Staff Category ──────────────────────────────────────────────────────────
  staffCategories: [],

  fetchStaffCategories: async () => {
    set({ loading: true, error: null });
    try {
      const staffCategories = await request('/staff-categories');
      set({ staffCategories, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createStaffCategory: async (payload) => {
    const data = await request('/staff-categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    set((s) => ({ staffCategories: [...s.staffCategories, data].sort((a, b) => a.name.localeCompare(b.name)) }));
    return data;
  },

  updateStaffCategory: async (id, payload) => {
    const data = await request(`/staff-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    set((s) => ({ staffCategories: s.staffCategories.map((c) => (c.id === id ? data : c)) }));
    return data;
  },

  deleteStaffCategory: async (id) => {
    await request(`/staff-categories/${id}`, { method: 'DELETE' });
    set((s) => ({ staffCategories: s.staffCategories.filter((c) => c.id !== id) }));
  },

  // ── Sub Department ──────────────────────────────────────────────────────────
  fetchSubDepartments: async () => {
    set({ loading: true, error: null });
    try {
      const subDepartments = await request('/sub-departments');
      set({ subDepartments, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createSubDepartment: async (payload) => {
    const data = await request('/sub-departments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    set((s) => ({ subDepartments: [...s.subDepartments, data] }));
    return data;
  },

  updateSubDepartment: async (id, payload) => {
    const data = await request(`/sub-departments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    set((s) => ({
      subDepartments: s.subDepartments.map((d) => (d.id === id ? data : d)),
    }));
    return data;
  },

  deleteSubDepartment: async (id) => {
    await request(`/sub-departments/${id}`, { method: 'DELETE' });
    set((s) => ({ subDepartments: s.subDepartments.filter((d) => d.id !== id) }));
  },

  // ── OPD ─────────────────────────────────────────────────────────────────────
  fetchAvailableDoctors: async ({ day, time, onCall, departmentName }) => {
    const params = new URLSearchParams({ day, time, onCall: String(onCall) });
    if (departmentName) params.set('departmentName', departmentName);
    return request(`/opd/available-doctors?${params}`);
  },

  fetchNextSerialNo: async () => {
    const data = await request('/opd/next-serial');
    return data?.serialNo || '1';
  },

  fetchNextMrNo: async () => {
    const data = await request('/opd/next-mr');
    return data?.mrNo || 1;
  },

  searchEmployees: async (q) => {
    const params = new URLSearchParams({ q });
    return request(`/opd/employee-search?${params}`);
  },

  createOpdVisit: async (payload) => {
    return request('/opd', { method: 'POST', body: JSON.stringify(payload) });
  },

  printOpdVisit: async (id) => {
    return request(`/opd/${id}/print`, { method: 'POST' });
  },

  // ── Room Category ────────────────────────────────────────────────────────────
  roomCategories: [],

  fetchRoomCategories: async () => {
    set({ loading: true, error: null });
    try {
      const roomCategories = await request('/room-categories');
      set({ roomCategories, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createRoomCategory: async (payload) => {
    const data = await request('/room-categories', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ roomCategories: [...s.roomCategories, data].sort((a, b) => a.name.localeCompare(b.name)) }));
    return data;
  },

  updateRoomCategory: async (id, payload) => {
    const data = await request(`/room-categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    set((s) => ({ roomCategories: s.roomCategories.map((r) => (r.id === id ? data : r)) }));
    return data;
  },

  deleteRoomCategory: async (id) => {
    await request(`/room-categories/${id}`, { method: 'DELETE' });
    set((s) => ({ roomCategories: s.roomCategories.filter((r) => r.id !== id) }));
  },

  // ── Bed ──────────────────────────────────────────────────────────────────────
  beds: [],

  fetchBeds: async () => {
    set({ loading: true, error: null });
    try {
      const beds = await request('/beds');
      set({ beds, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createBed: async (payload) => {
    const data = await request('/beds', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    set((s) => ({ beds: [...s.beds, data] }));
    return data;
  },

  updateBed: async (id, payload) => {
    const data = await request(`/beds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    set((s) => ({ beds: s.beds.map((b) => (b.id === id ? data : b)) }));
    return data;
  },

  deleteBed: async (id) => {
    await request(`/beds/${id}`, { method: 'DELETE' });
    set((s) => ({ beds: s.beds.filter((b) => b.id !== id) }));
  },

  // ── Bill Head ────────────────────────────────────────────────────────────────
  billHeads: [],

  fetchBillHeads: async () => {
    set({ loading: true, error: null });
    try {
      const billHeads = await request('/bill-heads');
      set({ billHeads, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchBillHeadById: async (id) => {
    return request(`/bill-heads/${id}`);
  },

  createBillHead: async (payload) => {
    const data = await request('/bill-heads', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ billHeads: [...s.billHeads, data].sort((a, b) => a.headCode.localeCompare(b.headCode)) }));
    return data;
  },

  updateBillHead: async (id, payload) => {
    const data = await request(`/bill-heads/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    set((s) => ({ billHeads: s.billHeads.map((b) => (b.id === id ? data : b)) }));
    return data;
  },

  deleteBillHead: async (id) => {
    await request(`/bill-heads/${id}`, { method: 'DELETE' });
    set((s) => ({ billHeads: s.billHeads.filter((b) => b.id !== id) }));
  },

  // ── Doctor ──────────────────────────────────────────────────────────────────
  fetchDoctors: async () => {
    set({ loading: true, error: null });
    try {
      const doctors = await request('/doctors');
      set({ doctors, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createDoctor: async (payload) => {
    const data = await request('/doctors', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    set((s) => ({ doctors: [...s.doctors, data].sort((a, b) => a.name.localeCompare(b.name)) }));
    return data;
  },

  updateDoctor: async (id, payload) => {
    const data = await request(`/doctors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    set((s) => ({ doctors: s.doctors.map((d) => (d.id === id ? data : d)) }));
    return data;
  },

  deleteDoctor: async (id) => {
    await request(`/doctors/${id}`, { method: 'DELETE' });
    set((s) => ({ doctors: s.doctors.filter((d) => d.id !== id) }));
  },

  // ── Panel Company ────────────────────────────────────────────────────────────
  panelCompanies: [],

  fetchPanelCompanies: async () => {
    set({ loading: true, error: null });
    try {
      const panelCompanies = await request('/panel-companies');
      set({ panelCompanies, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchPanelCompanyById: async (id) => request(`/panel-companies/${id}`),

  createPanelCompany: async (payload) => {
    const data = await request('/panel-companies', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ panelCompanies: [...s.panelCompanies, data].sort((a, b) => a.code.localeCompare(b.code)) }));
    return data;
  },

  updatePanelCompany: async (id, payload) => {
    const data = await request(`/panel-companies/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    set((s) => ({ panelCompanies: s.panelCompanies.map((p) => (p.id === id ? data : p)) }));
    return data;
  },

  deletePanelCompany: async (id) => {
    await request(`/panel-companies/${id}`, { method: 'DELETE' });
    set((s) => ({ panelCompanies: s.panelCompanies.filter((p) => p.id !== id) }));
  },

  // ── Panel Employees ──────────────────────────────────────────────────────────
  panelEmployees: [],

  fetchPanelEmployees: async () => {
    set({ loading: true, error: null });
    try {
      const panelEmployees = await request('/panel-employees');
      set({ panelEmployees, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchPanelEmployeeById: async (id) => request(`/panel-employees/${id}`),

  createPanelEmployee: async (payload) => {
    const data = await request('/panel-employees', { method: 'POST', body: JSON.stringify(payload) });
    set((s) => ({ panelEmployees: [...s.panelEmployees, data] }));
    return data;
  },

  updatePanelEmployee: async (id, payload) => {
    const data = await request(`/panel-employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    set((s) => ({ panelEmployees: s.panelEmployees.map((e) => (e.id === id ? data : e)) }));
    return data;
  },

  deletePanelEmployee: async (id) => {
    await request(`/panel-employees/${id}`, { method: 'DELETE' });
    set((s) => ({ panelEmployees: s.panelEmployees.filter((e) => e.id !== id) }));
  },

  // ── Antenatal ────────────────────────────────────────────────────────────────
  createAntenatal: async (payload) => {
    return request('/antenatal', { method: 'POST', body: JSON.stringify(payload) });
  },

  fetchAntenatalList: async () => {
    return request('/antenatal');
  },

  fetchAntenatalByNo: async (no) => {
    return request(`/antenatal/by-no/${encodeURIComponent(no)}`);
  },

  fetchOpdPatientByMrNo: async (mrNo) => {
    return request(`/opd/by-mr/${encodeURIComponent(mrNo)}`);
  },

  fetchOpdPatientsByPhone: async (phone) => {
    return request(`/opd/by-phone/${encodeURIComponent(phone)}`);
  },

  fetchOpdVisitBySerial: async (serialNo) => {
    return request(`/opd/by-serial/${encodeURIComponent(serialNo)}`);
  },

  fetchAvailableBeds: async (roomCategoryId) => {
    return request(`/admission/available-beds?roomCategoryId=${roomCategoryId}`);
  },

  createAdmission: async (payload) => {
    return request('/admission', { method: 'POST', body: JSON.stringify(payload) });
  },
}));
