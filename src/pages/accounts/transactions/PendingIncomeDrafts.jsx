import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Save, Trash2, X, Zap, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../../config';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import { useAuthStore } from '../../../store/useAuthStore';

// Pending Income vouchers (owner, 2026-11-13): the 8:00 AM Day Close makes
// the day's Clinic income voucher but no longer posts it. It waits here to be
// checked and edited, and is posted only with "Post Now". Until then it isn't
// counted in any report or the Inquiry dashboard (the day stays open).
// Owner, 2026-11-18: until someone edits it here it follows the Clinic
// figures (a slip edited after 8:00 AM comes in, also on Post Now). Once
// edited by hand it stays as edited; "Refresh from Clinic" brings the Clinic
// figures back when they've changed.

const API = `${API_BASE_URL}/api/accounts`;

const fmtAmt = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtDateTime = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.message || `Request failed (${res.status})`);
  return json.data;
}

let seq = 0;
const toRows = (v) => v.entries.map((e) => ({
  key: `e${e.id}`, incomeCategoryId: e.incomeCategoryId ? String(e.incomeCategoryId) : '', particulars: e.particulars || '', amount: String(Number(e.amount)),
}));

export default function PendingIncomeDrafts({ entityType }) {
  const { user } = useAuthStore();
  const userName = user?.name || user?.username || user?.email || '';
  const [vouchers, setVouchers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { id, rows }
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, c] = await Promise.all([
        call(`/income-drafts?entityType=${entityType}`),
        call(`/income-categories?entityType=${entityType}`),
      ]);
      setVouchers(Array.isArray(v) ? v : []);
      setCategories(Array.isArray(c) ? c : []);
    } catch (e) {
      toast.error(`Pending income vouchers: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (v) => setEditing({ id: v.id, rows: toRows(v) });
  const cancelEdit = async () => {
    const v = vouchers.find((x) => x.id === editing.id);
    const plain = (rows) => JSON.stringify(rows.map((r) => [r.incomeCategoryId, r.particulars, r.amount]));
    const changed = v && plain(toRows(v)) !== plain(editing.rows);
    if (changed && !(await confirmDialog({ title: 'Discard changes?', message: 'The changes to this voucher are not saved.', confirmLabel: 'Discard', danger: true }))) return;
    setEditing(null);
  };
  const setRow = (key, patch) => setEditing((ed) => ({ ...ed, rows: ed.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const addRow = () => setEditing((ed) => ({ ...ed, rows: [...ed.rows, { key: `n${++seq}`, incomeCategoryId: '', particulars: '', amount: '' }] }));
  const removeRow = (key) => setEditing((ed) => ({ ...ed, rows: ed.rows.filter((r) => r.key !== key) }));

  const save = async () => {
    setBusy(editing.id);
    try {
      const saved = await call(`/income-drafts/${editing.id}`, {
        method: 'PUT',
        body: { userName, entries: editing.rows.map((r) => ({ incomeCategoryId: r.incomeCategoryId, particulars: r.particulars, amount: r.amount })) },
      });
      setEditing(null);
      toast.success(`${saved.voucherNo} saved — it now stays as you edited it`);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const refresh = async (v) => {
    const ok = await confirmDialog({
      title: `Refresh ${v.voucherNo} from the Clinic?`,
      message: `The lines become the Clinic figures as they are now (PKR ${fmtAmt(v.clinicNow?.total)}). The changes made here by hand are replaced, and the voucher follows the Clinic again until it is edited.`,
      confirmLabel: 'Refresh from Clinic',
    });
    if (!ok) return;
    setBusy(v.id);
    try {
      const d = await call(`/income-drafts/${v.id}/refresh`, { method: 'POST' });
      toast.success(`${d.voucherNo} now PKR ${fmtAmt(d.totalAmount)} from the Clinic`);
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const post = async (v) => {
    const stale = v.editedAt && v.clinicNow?.changed;
    const ok = await confirmDialog({
      title: `Post ${v.voucherNo}?`,
      message: `Income voucher for ${fmtDate(v.voucherDate)} — PKR ${fmtAmt(v.totalAmount)}.${stale ? `\n\nThe Clinic figures have changed since this voucher was edited (Clinic now PKR ${fmtAmt(v.clinicNow.total)}). It will be posted as edited.` : ''} After posting it counts in reports and can't be edited here.`,
      confirmLabel: 'Post Now',
      danger: !!stale,
    });
    if (!ok) return;
    setBusy(v.id);
    try {
      const d = await call(`/income-drafts/${v.id}/post`, { method: 'POST', body: { userName } });
      setVouchers((vs) => vs.filter((x) => x.id !== v.id));
      toast.success(`${v.voucherNo} posted — PKR ${fmtAmt(d?.totalAmount ?? v.totalAmount)}`);
    } catch (e) {
      toast.error(e.message);
      load();
    } finally {
      setBusy(null);
    }
  };

  // Only Cash GL gets a Day Close income voucher; keep the Panel page clean.
  if (!loading && !vouchers.length && entityType === 'corporate') return null;

  const editTotal = editing ? editing.rows.reduce((s, r) => s + (Number(r.amount) || 0), 0) : 0;

  return (
    <div className="drafts__income">
      <div className="drafts__header">
        <div className="drafts__header-left">
          <h2 className="drafts__title"><TrendingUp size={18} /> Pending Income Vouchers</h2>
          <p className="drafts__sub">
            Made by the 8:00 AM Day Close from the day&apos;s Clinic income, and kept up to date with the Clinic until you edit it here. Not posted automatically: check or edit, then press &quot;Post Now&quot;. Until posted it isn&apos;t counted in reports.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="drafts__loading">Loading…</div>
      ) : !vouchers.length ? (
        <div className="drafts__income-empty">No pending income voucher.</div>
      ) : (
        <div className="drafts__groups">
          {vouchers.map((v) => {
            const isEditing = editing?.id === v.id;
            return (
              <div key={v.id} className="drafts__group">
                <div className="drafts__group-head">
                  <div className="drafts__group-title">
                    <span className="drafts__group-badge">IN</span>
                    {v.voucherNo}
                    <span className="drafts__group-backdated">📅 {fmtDate(v.voucherDate)}</span>
                  </div>
                  <div className="drafts__group-meta">
                    <span>{(isEditing ? editing.rows : v.entries).length} line{(isEditing ? editing.rows : v.entries).length === 1 ? '' : 's'}</span>
                    <span className="drafts__group-total">PKR {fmtAmt(isEditing ? editTotal : v.totalAmount)}</span>
                    {!isEditing && (
                      <>
                        <button type="button" className="drafts__move" onClick={() => startEdit(v)} disabled={!!editing || busy === v.id}>
                          <Pencil size={12} /> Edit
                        </button>
                        <button type="button" className="drafts__flash-btn" onClick={() => post(v)} disabled={!!editing || busy === v.id}>
                          <Zap size={14} /> {busy === v.id ? 'Posting…' : 'Post Now'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {!isEditing && v.source === 'auto' && (
                  v.editedAt ? (
                    <div className={`drafts__income-note${v.clinicNow?.changed ? ' drafts__income-note--warn' : ''}`}>
                      <span>
                        Edited by hand{v.editedByName ? ` by ${v.editedByName}` : ''} on {fmtDateTime(v.editedAt)} — kept as edited.
                        {v.clinicNow?.changed && <> The Clinic figures have changed since: <b>Clinic now PKR {fmtAmt(v.clinicNow.total)}</b>, voucher PKR {fmtAmt(v.totalAmount)}.</>}
                      </span>
                      <button type="button" className="drafts__move" onClick={() => refresh(v)} disabled={!!editing || busy === v.id}>
                        <RefreshCw size={12} /> Refresh from Clinic
                      </button>
                    </div>
                  ) : (
                    <div className="drafts__income-note">
                      <span>Follows the Clinic figures — a slip edited before posting is included (also when you press Post Now).</span>
                    </div>
                  )
                )}

                <div className="drafts__table-wrap">
                  <table className="drafts__table">
                    <thead>
                      <tr>
                        <th>Income Category</th>
                        <th>Particulars</th>
                        <th className="drafts__th-r">Amount</th>
                        {isEditing && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {isEditing ? editing.rows.map((r) => (
                        <tr key={r.key}>
                          <td>
                            <select className="drafts__input" value={r.incomeCategoryId} onChange={(e) => setRow(r.key, { incomeCategoryId: e.target.value })} aria-label="Income category">
                              <option value="">Select…</option>
                              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </td>
                          <td>
                            <input className="drafts__input" value={r.particulars} onChange={(e) => setRow(r.key, { particulars: e.target.value })} aria-label="Particulars" />
                          </td>
                          <td className="drafts__td-amt">
                            <input className="drafts__input drafts__input--amt" inputMode="decimal" value={r.amount} onChange={(e) => setRow(r.key, { amount: e.target.value })} aria-label="Amount" />
                          </td>
                          <td>
                            <button type="button" className="drafts__del" onClick={() => removeRow(r.key)} title="Remove line" aria-label="Remove line"><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      )) : v.entries.map((e) => (
                        <tr key={e.id}>
                          <td>{e.incomeCategoryName || '—'}</td>
                          <td className="drafts__td-particulars">{e.particulars || '—'}</td>
                          <td className="drafts__td-amt">PKR {fmtAmt(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} className="drafts__tfoot-label">Voucher Total</td>
                        <td className="drafts__tfoot-amt">PKR {fmtAmt(isEditing ? editTotal : v.totalAmount)}</td>
                        {isEditing && <td />}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {isEditing && (
                  <div className="drafts__income-actions">
                    <button type="button" className="drafts__move" onClick={addRow}><Plus size={12} /> Add line</button>
                    <span className="drafts__income-spacer" />
                    <button type="button" className="drafts__move" onClick={cancelEdit} disabled={busy === v.id}><X size={12} /> Cancel</button>
                    <button type="button" className="drafts__flash-btn" onClick={save} disabled={busy === v.id}>
                      <Save size={14} /> {busy === v.id ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
