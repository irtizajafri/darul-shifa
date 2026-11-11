// Same machine the app was opened from, so other PCs reach the server.
const API = `${window.location.protocol}//${window.location.hostname}:5001/api/lab`;

export async function labApi(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.message || `Request failed (${res.status})`);
  return json.data;
}

export const ROW_KINDS = [
  { key: 'param', label: 'Test line' },
  { key: 'heading', label: 'Heading' },
  { key: 'note', label: 'Note' },
];

export const RESULT_TYPES = [
  { key: 'number', label: 'Number' },
  { key: 'text', label: 'Text' },
  { key: 'select', label: 'Dropdown' },
];

export const pktToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

// Same rule as the backend's flag (laboratory.service.js parseReference): a
// plain range in the reference text — "13.0-17.0", "< 200", "Up to 41",
// "> 40" — one per line, optionally labelled Male: / Female: / Children:.
const LABEL_GROUPS = [
  [/^(male|males|men|man|m)$/i, 'male'],
  [/^(female|females|women|woman|f)$/i, 'female'],
  [/^(child|children|kids?|infants?|newborns?|paediatric|pediatric)$/i, 'child'],
  [/^(adults?|all)$/i, 'all'],
];
const N = '(-?\\d+(?:\\.\\d+)?)';
const RE_BETWEEN = new RegExp(`^${N}\\s*(?:-|–|to)\\s*${N}`, 'i');
const RE_UPTO = new RegExp(`^(?:<=?|≤|up\\s*to|upto|less\\s+than|below)\\s*${N}`, 'i');
const RE_FROM = new RegExp(`^(?:>=?|≥|more\\s+than|greater\\s+than|above)\\s*${N}`, 'i');

function parseReference(ref) {
  if (!ref) return [];
  return String(ref)
    .replace(/(\d),(?=\d{3})/g, '$1')
    .split(/\r?\n|;|\s\/\s/)
    .map((line) => {
      let body = line.trim();
      let group = 'all';
      const colon = body.indexOf(':');
      if (colon > 0) {
        const label = body.slice(0, colon).trim();
        const hit = LABEL_GROUPS.find(([re]) => re.test(label));
        group = hit ? hit[1] : null;
        body = body.slice(colon + 1).trim();
      }
      if (!group) return null;
      let m = RE_BETWEEN.exec(body);
      if (m) return { group, low: Number(m[1]), high: Number(m[2]) };
      m = RE_UPTO.exec(body);
      if (m) return { group, low: null, high: Number(m[1]) };
      m = RE_FROM.exec(body);
      if (m) return { group, low: Number(m[1]), high: null };
      return null;
    })
    .filter(Boolean);
}

export function flagFor(value, referenceRange, group) {
  if (value === '' || value === null || value === undefined) return '';
  const v = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(v)) return '';
  const ranges = parseReference(referenceRange);
  const r = ranges.find((x) => x.group === group) || ranges.find((x) => x.group === 'all');
  if (!r) return '';
  if (r.low !== null && v < r.low) return 'L';
  if (r.high !== null && v > r.high) return 'H';
  return '';
}
