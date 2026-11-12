import { API_BASE_URL } from '../../../../config';

// Lab Billing (Panels) — its own API (/api/panel-lab), separate from the
// Laboratories module's /api/lab. Only the pure text helpers (row kinds,
// result types, the H/L rule, date formats) are shared with Laboratories.
export { ROW_KINDS, RESULT_TYPES, pktToday, fmtDateTime, flagFor } from '../../../lab/labApi';

const API = `${API_BASE_URL}/api/panel-lab`;

export async function panelLabApi(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.message || `Request failed (${res.status})`);
  return json.data;
}

export const SOURCE_LABEL = {
  admission: 'Billing · Admission #',
  'opd-bill': 'Billing · Slip #',
  slip: 'Panel lab slip',
};
