import { create } from 'zustand';

export const useAttendanceStore = create((set) => ({
  attendanceRecords: [],
  loading: false,

  fetchAttendance: async () => {
    set({ loading: true });
    try {
      const res = await fetch('http://localhost:5001/api/attendance');
      const data = await res.json();
      const records = data?.data || data?.records || [];
      if (data?.ok === false) {
        console.error('Attendance fetch failed:', data?.message);
        return;
      }
      if (Array.isArray(records)) {
        set({ attendanceRecords: records });
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      set({ loading: false });
    }
  }
}));
