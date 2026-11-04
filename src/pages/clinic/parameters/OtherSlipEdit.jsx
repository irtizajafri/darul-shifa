import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, History } from 'lucide-react';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import { api, fmtDate, fmtDateTime } from './fullSlipEditUtils';

// Full Slip Edit for everything that isn't an OPD slip (owner, 2026-11-04):
// Excel Patients List rows, admission receipts and Antenatal. These have no
// test lines, so it's one small form per type. Same rule as OPD slips — risky
// situations are warnings, never blocks, and every save is logged.

const SLIP = { key: 'serialNo', label: 'Slip #' };
const NAME = { key: 'patientName', label: 'Patient Name', span: true };

const FIELDS = {
  pv: [
    SLIP, NAME,
    { key: 'doctor', label: 'Doctor', kind: 'doctor' },
    { key: 'subDepartment', label: 'Sub Department' },
    { key: 'paymentType', label: 'Payment Type', kind: 'select', options: ['Cash', 'Panel', 'C Card', 'CANCELED'] },
    { key: 'received', label: 'Received', kind: 'amount' },
    { key: 'balance', label: 'Balance', kind: 'amount' },
    { key: 'discount', label: 'Discount', kind: 'amount' },
  ],
  admission: [SLIP, NAME, { key: 'amount', label: 'Advance Amount', kind: 'amount' }],
  'admission-payment': [
    SLIP,
    { key: 'amount', label: 'Amount', kind: 'amount' },
    { key: 'paymentType', label: 'Payment Type', kind: 'select', options: ['cash', 'cc'], labels: { cash: 'Cash', cc: 'Credit Card' } },
  ],
  antenatal: [
    SLIP,
    { key: 'mrNo', label: 'MR #' },
    NAME,
    { key: 'age', label: 'Age (Years)', kind: 'number' },
    { key: 'phoneNo', label: 'Phone' },
    { key: 'amount', label: 'Amount', kind: 'amount' },
  ],
};

export default function OtherSlipEdit({ source, id, editedBy }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    let alive = true;
    api(`/slip-edit/${source}/${id}`)
      .then((d) => { if (alive) { setData(d); setForm(d.fields); } })
      .catch((err) => toast.error(err.message));
    if (source === 'pv') {
      api('/doctors?minimal=true').then((d) => { if (alive) setDoctors(Array.isArray(d) ? d.map((x) => x.name) : []); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [source, id]);

  if (!data || !form) return <p className="fse-empty">Loading…</p>;

  const fields = FIELDS[source];
  const { meta, warnings, logs } = data;
  const label = (key) => fields.find((f) => f.key === key)?.label || key;
  const set = (key) => (e) => { const v = e?.target ? e.target.value : e; setForm((f) => ({ ...f, [key]: v })); };
  // What this save changes, or what an earlier one changed.
  const changes = (before, after) => Object.keys(after)
    .filter((k) => String(before?.[k] ?? '') !== String(after[k] ?? ''))
    .map((k) => `${label(k)}: ${before?.[k] === '' || before?.[k] == null ? '-' : before[k]} → ${after[k] === '' || after[k] == null ? '-' : after[k]}`);

  async function handleSave() {
    const changed = changes(data.fields, form);
    if (!changed.length) { toast('Koi tabdeeli nahi hui'); return; }
    const ok = await confirmDialog({
      title: warnings.length ? 'Warnings ke saath save karein?' : 'Slip save karein?',
      message: [...warnings.map((w) => `• ${w.message}`), '', ...changed].join('\n').trim(),
      confirmLabel: 'Save',
      danger: warnings.length > 0,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const d = await api(`/slip-edit/${source}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, editedBy }),
      });
      setData(d);
      setForm(d.fields);
      toast.success('Slip update ho gayi');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const renderField = (f) => {
    const value = form[f.key] ?? '';
    if (f.kind === 'doctor') {
      return (
        <label key={f.key}>{f.label}
          <SearchableSelect options={[...new Set([value, ...doctors].filter(Boolean))]} value={value} onChange={set(f.key)} placeholder="Doctor chunein…" emptyText="Koi doctor nahi mila" />
        </label>
      );
    }
    if (f.kind === 'select') {
      return (
        <label key={f.key}>{f.label}
          <select value={value} onChange={set(f.key)}>
            {[...new Set([value, ...f.options])].map((o) => <option key={o} value={o}>{f.labels?.[o] || o || '—'}</option>)}
          </select>
        </label>
      );
    }
    const isNumber = f.kind === 'amount' || f.kind === 'number';
    return (
      <label key={f.key} className={f.span ? 'fse-span2' : undefined}>{f.label}
        <input type={isNumber ? 'number' : 'text'} min={isNumber ? '0' : undefined} step={f.kind === 'amount' ? '0.01' : undefined} value={value} onChange={set(f.key)} />
      </label>
    );
  };

  return (
    <>
      <div className="fse-card fse-meta">
        <span><b>{meta.type}</b> · Slip {data.fields.serialNo || '—'}</span>
        <span>
          {source === 'pv' ? `${fmtDate(meta.date)}${meta.time ? ` ${meta.time}` : ''}` : fmtDateTime(meta.date)}
          {meta.department ? ` · ${meta.department}` : ''}
          {meta.admissionNo ? ` · Admission # ${meta.admissionNo}` : ''}
          {meta.patientName ? ` · ${meta.patientName}` : ''}
          {meta.paymentType ? ` · ${meta.paymentType}` : ''}
        </span>
        {meta.adjustedAt && <span className="fse-chip">Pehle bhi adjust hui: {fmtDateTime(meta.adjustedAt)}</span>}
      </div>

      {warnings.length > 0 && (
        <div className="fse-warn" role="alert">
          <div className="fse-warn__title"><AlertTriangle size={16} /> Dhyan dein — save ho sakti hai, lekin:</div>
          <ul>{warnings.map((w) => <li key={w.code}>{w.message}</li>)}</ul>
        </div>
      )}

      <div className="fse-card">
        <h2 className="fse-h2">Slip</h2>
        <div className="fse-grid">{fields.map(renderField)}</div>
        <p className="fse-note">Tareekh, department, Admission # aur Panel/Staff link yahan se nahi badalte.</p>
      </div>

      <div className="fse-actions">
        <button type="button" className="fse-btn fse-btn--ghost" onClick={() => setShowLogs((s) => !s)}>
          <History size={15} /> History ({logs.length})
        </button>
        <button type="button" className="fse-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Slip'}
        </button>
      </div>

      {showLogs && (
        <div className="fse-card">
          <h2 className="fse-h2">Edit History</h2>
          {logs.length === 0 ? <p className="fse-empty">Is slip ki koi edit history nahi.</p> : (
            <div className="table-wrap">
              <table className="fse-table">
                <thead><tr><th>Kab</th><th>Kis ne</th><th>Kya badla</th></tr></thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td>{fmtDateTime(l.editedAt)}</td>
                      <td>{l.editedBy || '-'}</td>
                      <td>{changes(l.before, l.after).join(' · ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}

