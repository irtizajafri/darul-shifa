import { create } from 'zustand';

const API_URL = 'http://localhost:5001/api/employees';

export const useEmployeeStore = create((set, get) => ({
  employees: [],
  loading: false,
  error: null,

  fetchEmployees: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(API_URL);
      const { data } = await res.json();
      
      const formattedData = data.map(e => ({
        ...e,
        empCode: e.empCode || `EMP-${String(e.id).padStart(3, '0')}`,
        designation: e.role || e.designation,
        basicSalary: e.basicSalary ?? e.salaryMonthly ?? 0,
        joiningDate: e.createdAt,
      }));
      set({ employees: formattedData, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  getEmployeeById: (id) => get().employees.find((e) => String(e.id) === String(id)),

  getNextEmpCode: () => {
    const list = get().employees;
    const nums = list
      .map((e) => String(e.id || '')) // Let's use database ID for Emp Code as backup
      .map((code) => Number(code) || 0);
    const max = nums.length ? Math.max(...nums) : 0;
    return `EMP-${String(max + 1).padStart(3, '0')}`;
  },

  addEmployee: async (employee) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employee) // Sends all 4-tabs data exactly as collected by react-hook-form
      });
      
      if (!res.ok) throw new Error('Failed to add employee');
      await get().fetchEmployees(); // refetch after adding
      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  updateEmployee: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const payload = {
        firstName: updates.firstName,
        lastName: updates.lastName,
        email: updates.email,
        phone: updates.phone,
        salaryMonthly: updates.basicSalary,
        role: updates.designation,
        status: updates.status,
        allowances: updates.allowances
      };

      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to update employee');
      await get().fetchEmployees();
      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  deleteEmployee: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete employee');
      await get().fetchEmployees();
      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));

