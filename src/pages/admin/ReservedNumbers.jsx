import { useEffect, useMemo, useState } from 'react';
import { Hash, Lock, RefreshCw, Save, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../config';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { ReserveBox } from '../../components/clinic/AutoNumberField';
import './ReservedNumbers.scss';

// Reserved Numbers (owner, 2026-11-24; migrations 083, 086). The auto Slip # /
// Admission # counters (Super Admin), and the numbers kept aside: typed in as
// the old software skips them (User Management → Clinic → Transactions
// "Reserved Numbers — reserve a number"), or the HMS's own per-shift picks
// when those are on — free ones, and who used which, when, for what.
// Opened from Super Admin → Reserved Numbers or Clinic → Transactions.
const API = `${API_BASE_URL}/api/clinic/numbers`;
const KIND_LABEL = { slip: 'Slip #', admission: 'Admission #' };

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const fmtDate = (s) => { const [y, m, d] = String(s || '').split('-'); return y ? `${d}-${m}-${y}` : ''; };
const fmtDT = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

async function api(path, opts) {
  const res = await fetch(`${API}${path}`, opts);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Server se jawab nahi mila');
  return j.data;
}

function CounterCard({ counter, onSaved }) {
  const [form, setForm] = useState({ nextValue: '', reservePerShift: String(counter.reservePerShift), reserveWindow: String(counter.reserveWindow) });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v.replace(/\D/g, '') }));
  const dirty = form.nextValue !== '' || form.reservePerShift !== String(counter.reservePerShift) || form.reserveWindow !== String(counter.reserveWindow);

  async function save() {
    setSaving(true);
    try {
      await api(`/counters/${counter.kind}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      toast.success(`${KIND_LABEL[counter.kind]} settings saved`);
      setForm((f) => ({ ...f, nextValue: '' }));
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rsn-card">
      <div className="rsn-card__top">
        <span className="rsn-card__kind">{KIND_LABEL[counter.kind]}</span>
        <span className="rsn-card__next" title="Agli save pe yahi number lagega">
          <small>Next</small>{counter.next}
        </span>
      </div>
      <div className="rsn-card__fields">
        <label>
          <span>Start from (new next number)</span>
          <input inputMode="numeric" value={form.nextValue} placeholder={String(counter.next)} onChange={(e) => set('nextValue', e.target.value)} />
        </label>
        <label>
          <span>Reserve each shift</span>
          <input inputMode="numeric" value={form.reservePerShift} onChange={(e) => set('reservePerShift', e.target.value)} />
        </label>
        <label>
          <span>Among the shift's first</span>
          <input inputMode="numeric" value={form.reserveWindow} onChange={(e) => set('reserveWindow', e.target.value)} />
        </label>
      </div>
      <div className="rsn-card__foot">
        <span>
          {counter.updatedByName ? `Last changed by ${counter.updatedByName}, ${fmtDT(counter.updatedAt)}` : 'Used numbers are always skipped.'}
        </span>
        <button type="button" className="rsn-btn rsn-btn--primary" onClick={save} disabled={!dirty || saving}>
          <Save size={14} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </section>
  );
}

export default function ReservedNumbers() {
  const user = useAuthStore((s) => s.user);
  const superAdmin = Boolean(user?.isSuperAdmin);
  // Super Admin, or User Management → Clinic → Transactions "Reserved Numbers — reserve a number".
  const canReserve = superAdmin || hasPermission(user, 'clinic', 'transactions', 'reserved-numbers');
  const [reserving, setReserving] = useState(null); // 'slip' | 'admission'
  const [counters, setCounters] = useState([]);
  const [rows, setRows] = useState(null);
  const [filters, setFilters] = useState({ kind: '', status: 'all', from: daysAgo(30), to: ymd(new Date()) });
  const [tick, setTick] = useState(0); // Refresh / after a save
  const reload = () => setTick((t) => t + 1);

  useEffect(() => {
    let live = true;
    api('/counters').then((d) => { if (live) setCounters(d); }).catch((e) => toast.error(e.message));
    return () => { live = false; };
  }, [tick]);

  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams({ status: filters.status });
    if (filters.kind) qs.set('kind', filters.kind);
    if (filters.from) qs.set('from', filters.from);
    if (filters.to) qs.set('to', filters.to);
    api(`/reserved?${qs}`)
      .then((d) => { if (live) setRows(d.rows || []); })
      .catch((e) => { if (live) { toast.error(e.message); setRows([]); } });
    return () => { live = false; };
  }, [filters, tick]);

  const stats = useMemo(() => {
    const list = rows || [];
    const count = (kind, status) => list.filter((r) => r.kind === kind && r.status === status).length;
    return [
      { label: 'Free Slip #', value: count('slip', 'free'), tone: 'free' },
      { label: 'Used Slip #', value: count('slip', 'used'), tone: 'used' },
      { label: 'Free Admission #', value: count('admission', 'free'), tone: 'free' },
      { label: 'Used Admission #', value: count('admission', 'used'), tone: 'used' },
    ];
  }, [rows]);

  const setF = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const release = async (r) => {
    const ok = await confirmDialog({
      title: `${KIND_LABEL[r.kind]} ${r.number} wapas karein?`,
      message: 'Reserved se hat kar yeh number phir aam ho jayega, aur counter usay agli slip ko de sakta hai.',
      confirmLabel: 'Wapas karein',
    });
    if (!ok) return;
    try {
      await api(`/reserved/${r.id}`, { method: 'DELETE' });
      toast.success(`${KIND_LABEL[r.kind]} ${r.number} wapas ho gaya`);
      reload();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="rsn">
      <header className="rsn__head">
        <div>
          <h1><Hash size={20} /> Reserved Numbers</h1>
          <p>
            Slip # and Admission # are given automatically when a record is saved. When the old software skips a
            number, reserve it here (or with the lock button next to the Serial # field) — the HMS keeps it aside at
            once. Users allowed in User Management can then make the back-dated slip with it from the list on the slip
            screens.
          </p>
        </div>
        <div className="rsn__head-actions">
          {canReserve && (
            <>
              <button type="button" className="rsn-btn rsn-btn--primary" onClick={() => setReserving('slip')}><Lock size={14} /> Reserve Slip #</button>
              <button type="button" className="rsn-btn rsn-btn--primary" onClick={() => setReserving('admission')}><Lock size={14} /> Reserve Admission #</button>
            </>
          )}
          <button type="button" className="rsn-btn" onClick={reload}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>
      {reserving && <ReserveBox kind={reserving} onClose={() => setReserving(null)} onDone={reload} />}

      {superAdmin ? (
        <div className="rsn__counters">
          {counters.map((c) => <CounterCard key={`${c.kind}-${c.updatedAt}`} counter={c} onSaved={reload} />)}
        </div>
      ) : (
        <p className="rsn__next">
          {counters.map((c) => <span key={c.kind}>Next {KIND_LABEL[c.kind]} <b>{c.next}</b></span>)}
        </p>
      )}

      <div className="rsn__stats">
        {stats.map((s) => (
          <div key={s.label} className={`rsn-stat rsn-stat--${s.tone}`}>
            <span>{s.label}</span>
            <strong>{s.value}</strong>
          </div>
        ))}
      </div>

      <div className="rsn__filters">
        <label><span>Number</span>
          <select value={filters.kind} onChange={(e) => setF('kind', e.target.value)}>
            <option value="">Both</option>
            <option value="slip">Slip #</option>
            <option value="admission">Admission #</option>
          </select>
        </label>
        <label><span>Status</span>
          <select value={filters.status} onChange={(e) => setF('status', e.target.value)}>
            <option value="all">All</option>
            <option value="free">Free</option>
            <option value="used">Used</option>
          </select>
        </label>
        <label><span>Shift date from</span><input type="date" value={filters.from} onChange={(e) => setF('from', e.target.value)} /></label>
        <label><span>To</span><input type="date" value={filters.to} onChange={(e) => setF('to', e.target.value)} /></label>
      </div>

      <div className="rsn__table-wrap">
        <table className="rsn-table">
          <thead>
            <tr>
              <th>Number</th><th>Type</th><th>Date</th><th>Shift</th><th>Kept aside by</th><th>Status</th>
              <th>Used by</th><th>Used at</th><th>Used for</th>{canReserve && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr><td colSpan={10} className="rsn-table__empty">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="rsn-table__empty">No reserved numbers in these dates.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td className="rsn-num">{r.number}</td>
                <td>{KIND_LABEL[r.kind] || r.kind}</td>
                <td>{fmtDate(r.shiftDate)}</td>
                <td>{r.shiftName || '—'}</td>
                <td>{r.source === 'manual' ? `${r.reservedByName || 'By hand'} · ${fmtDT(r.createdAt)}` : 'HMS (shift)'}</td>
                <td><span className={`rsn-pill rsn-pill--${r.status}`}>{r.status === 'used' ? 'Used' : 'Free'}</span></td>
                <td>{r.usedByName || ''}</td>
                <td>{fmtDT(r.usedAt)}</td>
                <td>{r.usedFor || ''}</td>
                {canReserve && (
                  <td>
                    {r.status === 'free' && (
                      <button type="button" className="rsn-btn rsn-btn--sm" onClick={() => release(r)} title="Ghalti se reserve hua — wapas aam number banayein">
                        <Undo2 size={13} /> Wapas
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
