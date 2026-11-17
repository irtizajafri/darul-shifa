import { API_BASE_URL } from '../../config';

// Al Shifa Hospital Pharmacy — its own API (/api/pharmacy), apart from Inventory.
export const PHARMACY_NAME = 'AL SHIFA HOSPITAL PHARMACY';
const API = `${API_BASE_URL}/api/pharmacy`;
export const CLINIC_API = `${API_BASE_URL}/api/clinic`;
export const EMPLOYEES_API = `${API_BASE_URL}/api/employees`;
// GD departments = Inventory → Master Setup → Departments (owner, 2026-11-17).
export const DEPARTMENTS_API = `${API_BASE_URL}/api/inventory/departments`;
export const activeDepartments = (list) => (list || []).filter((d) => String(d.status || 'active') === 'active').sort((a, b) => a.name.localeCompare(b.name));

export async function pharmacyApi(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.message || `Request failed (${res.status})`);
  return json.data;
}

export async function getJson(url) {
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.message || `Request failed (${res.status})`);
  return json.data;
}

const PKT_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' });
export const pktToday = () => PKT_DAY.format(new Date());
export const daysBefore = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Document dates are calendar dates stored at midnight UTC.
export const fmtDate = (d) => {
  if (!d) return '';
  const t = new Date(d);
  return `${String(t.getUTCDate()).padStart(2, '0')}-${MONTHS[t.getUTCMonth()]}-${t.getUTCFullYear()}`;
};
export const fmtQty = (n) => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
export const fmtAmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const employeeName = (e) => [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ');
export const patientRef = (r) => (r.admissionNumber ? `Adm # ${r.admissionNumber}` : r.opdSlipNo ? `Slip # ${r.opdSlipNo}` : '');
export const STATUS_LABEL = { open: 'Open', partial: 'Partial', closed: 'Issued', pending: 'Pending', issued: 'Issued' };
