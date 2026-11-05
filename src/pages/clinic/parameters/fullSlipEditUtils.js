// Same machine the app was opened from, so other PCs reach the server.
const API = `${window.location.protocol}//${window.location.hostname}:5001/api/clinic`;

export const fmt = (n) => Number(n || 0).toLocaleString('en', { maximumFractionDigits: 2 });
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

export async function api(path, opts) {
  const res = await fetch(`${API}${path}`, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.message || `Request failed (${res.status})`);
  return json.data;
}
