import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useAuthStore, SUPER_ADMIN_EMAIL } from '../../store/useAuthStore';

// Super Admin back-dating on the OPD slip and Admission forms (owner,
// 2026-10-27). The chosen date-time is kept here and attached to the save by
// useClinicStore (createOpdVisit / createAdmission) as `backDate`, so the
// pages only render the field. Empty = now, as before. It clears when the
// form is left, so the next visit never back-dates by accident.
export const useBackDateStore = create((set) => ({
  value: '',
  setValue: (value) => set({ value }),
}));

export function isSuperAdminUser(user) {
  return Boolean(user?.isSuperAdmin) || user?.email === SUPER_ADMIN_EMAIL;
}

// The ISO back date to send with a save, or undefined.
export function getBackDate() {
  if (!isSuperAdminUser(useAuthStore.getState().user)) return undefined;
  const v = useBackDateStore.getState().value;
  return v ? new Date(v).toISOString() : undefined;
}

const pad = (n) => String(n).padStart(2, '0');
const localNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function BackDateField({ style }) {
  const user = useAuthStore((s) => s.user);
  const { value, setValue } = useBackDateStore();
  const [max, setMax] = useState(localNow);

  useEffect(() => () => useBackDateStore.getState().setValue(''), []);

  if (!isSuperAdminUser(user)) return null;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...style }} title="Sirf Super Admin — khali chhorein to abhi ka waqt">
      <span style={{ fontSize: 12, fontWeight: 600, color: value ? '#b42318' : '#555', whiteSpace: 'nowrap' }}>Back Date</span>
      <input
        type="datetime-local"
        value={value}
        max={max}
        onFocus={() => setMax(localNow())}
        onChange={(e) => setValue(e.target.value)}
        style={{
          fontSize: 12, padding: '2px 4px', height: 26,
          border: `1px solid ${value ? '#b42318' : '#c5c5c5'}`,
          background: value ? '#fff4f2' : '#fff', borderRadius: 3,
        }}
      />
      {value && (
        <button type="button" onClick={() => setValue('')} title="Back Date hatayein" style={{ border: 0, background: 'none', color: '#b42318', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>×</button>
      )}
    </span>
  );
}
