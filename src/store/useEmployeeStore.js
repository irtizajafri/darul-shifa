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
      const json = await res.json().catch(() => ({}));
      const data = Array.isArray(json.data) ? json.data : [];
      if (!res.ok || json.ok === false) {
        throw new Error(json.message || `Failed to load employees (${res.status})`);
      }
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
      
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message || 'Failed to add employee');
      }
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
        empCode: updates.empCode,
        firstName: updates.firstName,
        middleName: updates.middleName,
        lastName: updates.lastName,
        fatherName: updates.fatherName,
        dob: updates.dob,
        gender: updates.gender,
        maritalStatus: updates.maritalStatus,
        spouseName: updates.spouseName,
        nic: updates.nic,
        birthPlace: updates.birthPlace,
        beneficiaryName: updates.beneficiaryName,
        beneficiaryRelation: updates.beneficiaryRelation,
        address: updates.address,
        city: updates.city,
        email: updates.email,
        phone: updates.phone,
        reference1: updates.reference1,
        reference2: updates.reference2,
        department: updates.department,
        salaryMonthly: updates.basicSalary,
        basicSalary: updates.basicSalary,
        role: updates.designation,
        designation: updates.designation,
        status: updates.status,
        appointmentDate: updates.appointmentDate,
        weeklyHoliday: updates.weeklyHoliday,
        workingDays: updates.workingDays,
        disbursement: updates.disbursement,
        allowances: updates.allowances
        ,
        dutyType: updates.dutyType,
        dutyRoster: updates.dutyRoster,
  isNightShift: updates.isNightShift,
        photo: updates.photo,
        emergencyContact: updates.emergencyContact,
        emergencyPhone: updates.emergencyPhone,
        emergencyRelation: updates.emergencyRelation,
        notes: updates.notes
      };

      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message || 'Failed to update employee');
      }
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
      // First, get the employee to find their empCode
      const empToDelete = get().employees.find(e => e.id === id);
      
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete employee');
      
      // Clean up attendance overrides from localStorage for this employee
      if (empToDelete?.empCode) {
        try {
          const overrides = JSON.parse(localStorage.getItem('attendanceOverrides') || '[]');
          const filtered = overrides.filter(o => String(o.empCode) !== String(empToDelete.empCode));
          localStorage.setItem('attendanceOverrides', JSON.stringify(filtered));
        } catch (e) {
          console.warn('Failed to clean up attendance overrides:', e);
        }
      }
      
      await get().fetchEmployees();
      set({ loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));

