// Default dates for the report filters, from the local (PKT) clock —
// toISOString() is UTC and gave yesterday's date before 05:00 PKT.
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayStr = () => ymd(new Date());
export const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); };
export const firstOfMonthStr = () => { const d = new Date(); d.setDate(1); return ymd(d); };
export const monthStr = () => ymd(new Date()).slice(0, 7);

// Shift is purely a function of time-of-day, so it can be derived for EVERY
// row (old bulk data included) by matching visitTime against configured
// shifts — not just the rows that happen to have a stored shiftName (only
// visits created after the Shift feature existed have that).
export function resolveShiftName(visitTime, shifts) {
  if (!shifts?.length || !visitTime) return null;
  const t = visitTime.length >= 5 ? visitTime.slice(0, 5) : visitTime;
  const inRange = (from, to) => (from <= to ? (t >= from && t <= to) : (t >= from || t <= to));
  const match = shifts.find(s => inRange(s.fromTime, s.toTime));
  return match?.name || null;
}
