import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardList, Printer, Save, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/shared/PageHeader';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { useAuthStore } from '../../store/useAuthStore';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { canBackDate } from '../../utils/permissions';
import { openPrintWindow } from '../../utils/printRelay';
import PatientPickerModal from './PatientPickerModal';
import { pharmacyApi, getJson, DEPARTMENTS_API, activeDepartments, pktToday, daysBefore, fmtDate, fmtQty, patientRef, STATUS_LABEL } from './pharmacyApi';
import { printGD } from './pharmacyPrint';
import usePharmacyKeys from './usePharmacyKeys';
import './Pharmacy.scss';

// Al Shifa Hospital Pharmacy → Goods Demand (GD), like Inventory's GD:
// Department (Inventory's Master Setup list), Request Date, medicines from Clinic's Medicine List with the
// quantity, and optionally the patient (Admission # or Panel Slip #).
// No stock here — the pharmacy keeps none.
// Keyboard (same as Inventory's GD, owner 2026-11-18): Ctrl+S Save, Ctrl+P
// Save & Print, Ctrl+N New, Esc Clear; in Add Medicine ↑/↓ (or Tab) pick,
// Enter adds; Enter in a Qty goes back to Add Medicine.

const EMPTY = () => ({ requestDate: pktToday(), departmentId: '', patientKind: '', patientNo: '', patientName: '', comment: '' });

export default function PharmacyGD() {
  const { user } = useAuthStore();
  // Opened from the card on Inventory → GIN: the way back goes there.
  const [searchParams] = useSearchParams();
  const fromInventory = searchParams.get('from') === 'inventory';
  const userName = user?.name || user?.username || user?.email || '';
  const backDate = canBackDate(user);
  const [form, setForm] = useState(EMPTY);
  const [lines, setLines] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [medQuery, setMedQuery] = useState('');
  const [medResults, setMedResults] = useState([]);
  const [medOpen, setMedOpen] = useState(false);
  const [medHi, setMedHi] = useState(-1); // highlighted medicine in the list
  const [picker, setPicker] = useState(null); // 'admission' | 'slip'
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ from: daysBefore(pktToday(), 7), to: pktToday(), status: '', q: '' });
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [openRow, setOpenRow] = useState(null);
  const medTimer = useRef(null);
  const medBox = useRef(null);
  const medInput = useRef(null);
  const formCard = useRef(null);

  useEffect(() => {
    getJson(DEPARTMENTS_API).then((d) => setDepartments(activeDepartments(d))).catch((e) => toast.error(e.message));
  }, []);

  const loadList = useCallback(async (f) => {
    setListLoading(true);
    try {
      const p = new URLSearchParams();
      if (f.q.trim()) p.set('q', f.q.trim()); else { if (f.from) p.set('from', f.from); if (f.to) p.set('to', f.to); }
      if (f.status) p.set('status', f.status);
      setList(await pharmacyApi(`/gd?${p}`));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setListLoading(false);
    }
  }, []);
  useEffect(() => { loadList(filters); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const searchMed = (v) => {
    setMedQuery(v);
    setMedOpen(true);
    setMedHi(-1);
    clearTimeout(medTimer.current);
    medTimer.current = setTimeout(() => {
      pharmacyApi(`/medicines?q=${encodeURIComponent(v.trim())}`).then(setMedResults).catch(() => setMedResults([]));
    }, 250);
  };
  const addMedicine = (m) => {
    setLines((ls) => (ls.some((l) => l.medicineId === m.id) ? ls : [...ls, { medicineId: m.id, code: m.code, name: m.name, packSize: m.packSize, quantity: '1' }]));
    setMedQuery('');
    setMedResults([]);
    setMedOpen(false);
    setMedHi(-1);
    setTimeout(() => document.querySelector(`[data-qty="${m.id}"]`)?.select(), 50);
  };
  // Keep the highlighted medicine in view while arrowing through the list.
  useEffect(() => {
    if (medHi >= 0) medBox.current?.querySelector('.ph-dropdown li.is-hi')?.scrollIntoView({ block: 'nearest' });
  }, [medHi]);
  const medKeys = (e) => {
    const open = medOpen && medResults.length > 0;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setMedOpen(true); setMedHi(0); } else setMedHi((p) => Math.min(p + 1, medResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      if (open) { e.preventDefault(); setMedHi((p) => Math.max(p - 1, 0)); }
    } else if (e.key === 'Enter') {
      const m = medResults[medHi >= 0 ? medHi : 0];
      if (m) { e.preventDefault(); addMedicine(m); }
    } else if (e.key === 'Tab') {
      if (open && !e.shiftKey) { e.preventDefault(); setMedHi((p) => Math.min(p + 1, medResults.length - 1)); }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); setMedOpen(false); setMedHi(-1); }
    }
  };
  useEffect(() => {
    const close = (e) => { if (medBox.current && !medBox.current.contains(e.target)) setMedOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pickPatient = (r) => {
    setForm((f) => ({ ...f, patientNo: r.admissionNo, patientName: r.patientName || f.patientName }));
    setPicker(null);
  };
  const togglePatient = (kind) => setForm((f) => (f.patientKind === kind
    ? { ...f, patientKind: '', patientNo: '' }
    : { ...f, patientKind: kind, patientNo: '' }));

  const reset = () => { setForm(EMPTY()); setLines([]); };

  const save = async (andPrint) => {
    if (!form.departmentId) { toast.error('Select the Department'); return; }
    if (!lines.length) { toast.error('Add at least one medicine'); return; }
    if (form.patientKind && !form.patientNo) { toast.error(form.patientKind === 'slip' ? 'Select the Panel Slip' : 'Select the Admission'); return; }
    const win = andPrint ? openPrintWindow() : null;
    setSaving(true);
    try {
      const gd = await pharmacyApi('/gd', {
        method: 'POST',
        body: {
          requestDate: form.requestDate,
          departmentId: form.departmentId,
          admissionNumber: form.patientKind === 'admission' ? form.patientNo : null,
          opdSlipNo: form.patientKind === 'slip' ? form.patientNo : null,
          patientName: form.patientName,
          comment: form.comment,
          items: lines.map((l) => ({ medicineId: l.medicineId, quantity: Number(l.quantity) })),
          createdByName: userName,
        },
      });
      toast.success(`GD ${gd.code} saved`);
      if (win) printGD(gd, userName, win);
      reset();
      loadList(filters);
    } catch (e) {
      win?.close();
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const hasData = () => lines.length > 0 || !!form.departmentId || !!form.patientNo || !!form.comment.trim() || !!form.patientName.trim();
  const focusFirst = () => setTimeout(() => formCard.current?.querySelector('[role="combobox"]')?.focus(), 0);
  // New / Clear: asks first when something has been entered.
  const startNew = async () => {
    if (saving) return;
    if (hasData() && !(await confirmDialog({ title: 'Clear this GD?', message: 'The department, medicines and patient entered here will be cleared.', confirmLabel: 'Clear', danger: true }))) return;
    reset();
    focusFirst();
  };
  usePharmacyKeys({
    blocked: () => !!picker,
    onSave: () => { if (!saving) save(false); },
    onPrint: () => { if (!saving) save(true); },
    onNew: startNew,
    onEsc: () => { if (hasData()) startNew(); },
  });

  return (
    <div className="ph-page">
      <PageHeader
        breadcrumbs={fromInventory
          ? [{ label: 'Inventory', link: '/inventory-module' }, { label: 'Goods Issuance (GIN)', link: '/inventory/gin' }, { label: 'Pharmacy — Goods Demand (GD)' }]
          : [{ label: 'Al Shifa Hospital Pharmacy', link: '/pharmacy-module' }, { label: 'Goods Demand (GD)' }]}
        title="Goods Demand (GD)"
        subtitle="Demand medicines for a department or a patient — then issue them with a GIN"
      />

      <section className="ph-card" ref={formCard}>
        <h2 className="ph-card__title"><ClipboardList size={16} /> Create Goods Demand (GD)</h2>
        <div className="ph-grid ph-grid--3">
          <label className="ph-field">
            <span>Department *</span>
            <SearchableSelect options={departments} value={form.departmentId} onChange={(v) => set('departmentId', v || '')} getKey={(d) => d.id} getLabel={(d) => d.name} placeholder="Select department" size="sm" />
          </label>
          <label className="ph-field">
            <span>Request Date</span>
            <input type="date" className="ph-input" value={form.requestDate} max={pktToday()} disabled={!backDate} onChange={(e) => set('requestDate', e.target.value)} />
          </label>
          <div className="ph-field" ref={medBox}>
            <span>Add Medicine</span>
            <div className="ph-search">
              <Search size={14} />
              <input ref={medInput} value={medQuery} onChange={(e) => searchMed(e.target.value)} onFocus={() => { if (!medResults.length) searchMed(medQuery); }}
                onKeyDown={medKeys}
                placeholder="Medicine name or code" aria-label="Search medicine" />
            </div>
            {medOpen && medResults.length > 0 && (
              <ul className="ph-dropdown" role="listbox">
                {medResults.map((m, i) => (
                  <li key={m.id} role="option" aria-selected={i === medHi} className={i === medHi ? 'is-hi' : undefined}
                    onMouseEnter={() => setMedHi(i)} onMouseDown={(e) => { e.preventDefault(); addMedicine(m); }}>
                    <b>{m.name}</b><span>{m.code}{m.packSize ? ` · Pack ${m.packSize}` : ''} · Rs {Number(m.retailPrice || 0).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="table-wrap ph-lines">
          <table className="ph-table">
            <thead>
              <tr><th style={{ width: 40 }}>#</th><th style={{ width: 110 }}>Code</th><th>Medicine</th><th style={{ width: 90 }}>Pack</th><th style={{ width: 140 }}>Qty Requested</th><th style={{ width: 44 }} /></tr>
            </thead>
            <tbody>
              {!lines.length && <tr><td colSpan={6} className="ph-empty">Search a medicine above and press Enter to add it.</td></tr>}
              {lines.map((l, i) => (
                <tr key={l.medicineId}>
                  <td>{i + 1}</td>
                  <td className="muted">{l.code}</td>
                  <td>{l.name}</td>
                  <td className="muted">{l.packSize || ''}</td>
                  <td>
                    <input className="ph-input ph-input--qty" inputMode="decimal" data-qty={l.medicineId} value={l.quantity}
                      onChange={(e) => setLines((ls) => ls.map((x) => (x.medicineId === l.medicineId ? { ...x, quantity: e.target.value } : x)))} aria-label={`${l.name} quantity`}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); medInput.current?.focus(); } }} />
                  </td>
                  <td><button type="button" className="ph-icon-btn" onClick={() => setLines((ls) => ls.filter((x) => x.medicineId !== l.medicineId))} title="Remove" aria-label={`Remove ${l.name}`}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ph-grid ph-grid--2 ph-patient">
          <div className="ph-field">
            <span>Patient (optional)</span>
            <div className="ph-patient__row">
              <label className="ph-check"><input type="checkbox" checked={form.patientKind === 'admission'} onChange={() => togglePatient('admission')} /> Admission Number</label>
              <label className="ph-check"><input type="checkbox" checked={form.patientKind === 'slip'} onChange={() => togglePatient('slip')} /> Panel Slip</label>
              {form.patientKind && (
                <button type="button" className="ph-btn ph-btn--sm" onClick={() => setPicker(form.patientKind)}>
                  <Search size={13} /> {form.patientNo ? `${form.patientKind === 'slip' ? 'Slip' : 'Adm'} # ${form.patientNo}` : 'Select'}
                </button>
              )}
              {form.patientNo && <button type="button" className="ph-icon-btn" onClick={() => set('patientNo', '')} aria-label="Clear patient"><X size={14} /></button>}
            </div>
          </div>
          <label className="ph-field">
            <span>Patient Name</span>
            <input className="ph-input" value={form.patientName} onChange={(e) => set('patientName', e.target.value)} placeholder="Filled from the admission / slip" />
          </label>
          <label className="ph-field ph-span-2">
            <span>Comment</span>
            <input className="ph-input" value={form.comment} onChange={(e) => set('comment', e.target.value)} />
          </label>
        </div>

        <div className="ph-actions">
          <span className="ph-keys" aria-hidden="true"><kbd>Ctrl</kbd>+<kbd>S</kbd> Save · <kbd>Ctrl</kbd>+<kbd>P</kbd> Save &amp; Print · <kbd>Ctrl</kbd>+<kbd>N</kbd> New · <kbd>Esc</kbd> Clear</span>
          <button type="button" className="ph-btn" onClick={reset} disabled={saving} title="Clear (Esc)"><X size={14} /> Clear</button>
          <button type="button" className="ph-btn" onClick={() => save(false)} disabled={saving} title="Save (Ctrl+S)"><Save size={14} /> Save GD</button>
          <button type="button" className="ph-btn ph-btn--primary" onClick={() => save(true)} disabled={saving} title="Save & Print (Ctrl+P)"><Printer size={14} /> Save &amp; Print</button>
        </div>
      </section>

      <section className="ph-card">
        <div className="ph-toolbar">
          <h2 className="ph-card__title">Goods Demands</h2>
          <label className="ph-field ph-field--inline"><span>From</span><input type="date" className="ph-input" value={filters.from} disabled={!!filters.q.trim()} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} /></label>
          <label className="ph-field ph-field--inline"><span>To</span><input type="date" className="ph-input" value={filters.to} disabled={!!filters.q.trim()} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} /></label>
          <label className="ph-field ph-field--inline"><span>Status</span>
            <select className="ph-input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All</option><option value="pending">Not fully issued</option><option value="closed">Issued</option>
            </select>
          </label>
          <label className="ph-field ph-field--inline ph-grow"><span>Search (all dates)</span><input className="ph-input" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && loadList(filters)} placeholder="GD #, Adm #, Slip # or patient" /></label>
          <button type="button" className="ph-btn ph-btn--primary" onClick={() => loadList(filters)} disabled={listLoading}>Show</button>
        </div>
        <div className="table-wrap">
          <table className="ph-table ph-table--click">
            <thead><tr><th>GD #</th><th>Date</th><th>Department</th><th>Patient</th><th className="r">Items</th><th>Status</th><th>Created By</th><th /></tr></thead>
            <tbody>
              {listLoading && <tr><td colSpan={8} className="ph-empty">Loading…</td></tr>}
              {!listLoading && !list.length && <tr><td colSpan={8} className="ph-empty">No GD on these dates.</td></tr>}
              {!listLoading && list.map((g) => (
                <Fragment key={g.id}>
                  <tr onClick={() => setOpenRow(openRow === g.id ? null : g.id)}>
                    <td className="nowrap"><b>{g.code}</b></td>
                    <td className="nowrap">{fmtDate(g.requestDate)}</td>
                    <td>{g.departmentName}</td>
                    <td>{patientRef(g)}{g.patientName ? <span className="muted"> · {g.patientName}</span> : ''}</td>
                    <td className="r">{g.items.length}</td>
                    <td><span className={`ph-badge ph-badge--${g.status}`}>{STATUS_LABEL[g.status]}</span></td>
                    <td className="muted">{g.createdByName || ''}</td>
                    <td className="r"><button type="button" className="ph-icon-btn" title="Print GD" aria-label={`Print ${g.code}`} onClick={(e) => { e.stopPropagation(); printGD(g, userName); }}><Printer size={14} /></button></td>
                  </tr>
                  {openRow === g.id && (
                    <tr className="ph-sub"><td colSpan={8}>
                      <table className="ph-table ph-table--inner">
                        <thead><tr><th>Medicine</th><th>Pack</th><th className="r">Requested</th><th className="r">Issued</th><th>Status</th></tr></thead>
                        <tbody>{g.items.map((it) => (
                          <tr key={it.id}><td>{it.medicineName}</td><td className="muted">{it.packSize || ''}</td><td className="r">{fmtQty(it.quantityRequested)}</td><td className="r">{fmtQty(it.quantityIssued)}</td><td>{STATUS_LABEL[it.status]}</td></tr>
                        ))}</tbody>
                      </table>
                      {g.gins.length > 0 && <p className="muted ph-sub__note">GINs: {g.gins.map((x) => x.code).join(', ')}</p>}
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {picker && <PatientPickerModal mode={picker} onSelect={pickPatient} onClose={() => setPicker(null)} />}
    </div>
  );
}
