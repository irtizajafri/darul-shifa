// Mode of payment for money received against an admission or a slip's
// balance (owner, 2026-11-20): Cash, Credit Card and JazzCash only — no
// Online. Values are what the backend stores (receivingMode in
// clinic.service.js).
export const RECEIVING_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'cc', label: 'Credit Card' },
  { value: 'jazzcash', label: 'JazzCash' },
];

const LABELS = { cash: 'Cash', private: 'Cash', jazzcash: 'JazzCash', online: 'Online', cc: 'Credit Card', 'c card': 'Credit Card', 'credit card': 'Credit Card' };
export const receivingModeLabel = (v) => LABELS[String(v || 'cash').toLowerCase()] || String(v);
