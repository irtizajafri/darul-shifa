const API = 'http://localhost:5001/api/accounts';

// Every Expense voucher of a book (Cash / Corporate), newest first, with its
// lines' Main GL, line count and total — not the lines themselves.
export async function listExpenseVouchers(entityType) {
  const j = await fetch(`${API}/voucher-expense/numbers?entityType=${entityType}`).then((r) => r.json());
  return Array.isArray(j?.data) ? j.data : [];
}

// One voucher in full — its lines with account names, as Voucher Reprint
// loads it (and as the voucher form's edit mode expects). null if gone.
export async function fetchExpenseVoucher(entityType, row) {
  const q = new URLSearchParams({ type: 'expense', entityType, voucherFrom: row.voucherNo });
  const j = await fetch(`${API}/voucher-reprint?${q}`).then((r) => r.json());
  return (Array.isArray(j?.data) ? j.data : []).find((v) => v.id === row.id) || null;
}
