import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Search, X, Plus } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import { useInventoryStore } from '../../../store/useInventoryStore';
import '../AdmissionAdjustment.scss'; // .aa-* lookup-modal classes
import './PanelBilling.scss';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Manual-add types — same lists already used elsewhere in Clinic (Sub
// Department parameters for Lab/Ultrasound/Radiology test names, Inventory
// items for Medicine), each scoped to the matching department.
const CUSTOM_TYPES = [
  { key: 'medicine',   label: 'Medicine',   source: 'inventory' },
  { key: 'lab',        label: 'Laboratory', source: 'subdept', deptName: 'LABORATORY' },
  { key: 'ultrasound', label: 'Ultrasound', source: 'subdept', deptName: 'Ultra Sound, Echo & Color Doppler' },
  { key: 'radiology',  label: 'Radiology',  source: 'subdept', deptName: 'RADIOLOGY' },
  // Panels > Parameter > Bill Head — 'simple' heads behave like any other
  // manual add; picking a 'package' head (e.g. "Surgery") instead opens the
  // medicine checklist (see PackagePickerModal) and skips this form entirely.
  { key: 'panelhead',  label: 'Panel Head', source: 'panelhead' },
];

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  return `${day}-${month}-${year}`;
}

function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${fmtDate(d)} ${time}`;
}

// `<input type="date">` needs a plain YYYY-MM-DD value, not the full ISO string.
function toInputDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// ── Panel Admission Lookup Modal — patientCategory 'panel' only ────────────────
function PanelAdmissionLookupModal({ onSelect, onClose, searchPanelAdmissions }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    searchPanelAdmissions('')
      .then((data) => setRows(data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [searchPanelAdmissions]);

  function handleQueryChange(val) {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      searchPanelAdmissions(val)
        .then((data) => setRows(data || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 300);
  }

  return (
    <div className="aa-overlay">
      <div className="aa-modal">
        <div className="aa-modal-hdr">
          <span>Select Panel Patient</span>
          <button className="aa-modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="aa-modal-search">
          <Search size={13} className="aa-modal-search-icon" />
          <input
            autoFocus
            className="aa-modal-search-input"
            placeholder="Search Admission # or Patient Name…"
            value={q}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
        </div>
        <div className="aa-modal-body">
          {loading ? (
            <div className="aa-modal-loading">Loading…</div>
          ) : (
            <table className="aa-modal-tbl">
              <thead>
                <tr><th>Admission #</th><th>Patient</th><th>Status</th><th>Admission Date</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => onSelect(r)}>
                    <td>{r.admissionNo}</td>
                    <td>{r.patientName}</td>
                    <td>{r.status}</td>
                    <td>{fmtDateTime(r.createdAt)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={4} className="aa-td-empty">Koi Panel patient nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Panels > Transaction > Billing — seeded once from the live Provisional Bill
// (Ward History, Provisional Bill items, Diagnostic tab, Pharmacy tab) the
// first time this admission's Billing is opened; every Rate/Qty/Remarks edit
// after that lives in its own snapshot (ClinicPanelBillingItem) — the
// original Provisional Bill is never touched.
export default function PanelBilling() {
  const {
    fetchPanelAdmissionBilling, searchPanelAdmissions, updatePanelBillingItem,
    updatePanelBillingHeader,
    addPanelBillingItem, deletePanelBillingItem, addPanelBillingItemsBulk,
    subDepartments, fetchSubDepartments, searchPanelBillHeads,
  } = useClinicStore();
  const { fetchItems: searchInventoryItems } = useInventoryStore();
  const [admitNo, setAdmitNo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState(null); // 'pharmacy' | 'diagnostic' | null
  const [showLookup, setShowLookup] = useState(false);
  const [editCell, setEditCell] = useState(null); // { itemId, field: 'rate'|'qty', value } | null
  const [savingCell, setSavingCell] = useState(false);

  // ── Manual add: Medicine / Laboratory / Ultrasound / Radiology ────────────
  const [customType, setCustomType] = useState('medicine');
  const [customQuery, setCustomQuery] = useState('');
  const [customOptions, setCustomOptions] = useState([]);
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  const [customQty, setCustomQty] = useState('1');
  const [customRate, setCustomRate] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const customSearchTimer = useRef(null);

  // Medicine Package checklist — set when a 'package' Panel Head is picked,
  // instead of filling the manual-add form.
  const [packagePicker, setPackagePicker] = useState(null); // { description, items: [{...packageItem, checked}] } | null
  const [confirmingPackage, setConfirmingPackage] = useState(false);

  useEffect(() => { fetchSubDepartments(); }, [fetchSubDepartments]);

  function handleCustomQueryChange(val) {
    setCustomQuery(val);
    setShowCustomOptions(true);
    const type = CUSTOM_TYPES.find((t) => t.key === customType);
    clearTimeout(customSearchTimer.current);
    if (type.source === 'subdept') {
      const q = val.trim().toLowerCase();
      setCustomOptions(
        subDepartments
          .filter((sd) => sd.department?.name === type.deptName && (!q || sd.name.toLowerCase().includes(q)))
          .slice(0, 30)
          .map((sd) => ({ id: sd.id, name: sd.name, code: sd.code }))
      );
      return;
    }
    if (type.source === 'panelhead') {
      customSearchTimer.current = setTimeout(() => {
        searchPanelBillHeads(val)
          .then((heads) => setCustomOptions(
            (heads || []).map((h) => ({ id: h.id, name: h.description, code: h.headCode, kind: h.kind, packageItems: h.packageItems }))
          ))
          .catch(() => setCustomOptions([]));
      }, 300);
      return;
    }
    // Medicine — Inventory item search, debounced.
    customSearchTimer.current = setTimeout(() => {
      searchInventoryItems({ search: val })
        .then((items) => setCustomOptions((items || []).map((it) => ({ id: it.id, name: it.name, code: it.code }))))
        .catch(() => setCustomOptions([]));
    }, 300);
  }

  function pickCustomOption(opt) {
    setShowCustomOptions(false);
    if (customType === 'panelhead' && opt.kind === 'package') {
      setCustomQuery('');
      setPackagePicker({
        description: opt.name,
        items: opt.packageItems.map((it) => ({ ...it, checked: true })),
      });
      return;
    }
    setCustomQuery(opt.name);
  }

  function togglePackageItem(itemId) {
    setPackagePicker((p) => ({
      ...p,
      items: p.items.map((it) => (it.id === itemId ? { ...it, checked: !it.checked } : it)),
    }));
  }

  async function handleConfirmPackage() {
    const checked = packagePicker.items.filter((it) => it.checked);
    if (!checked.length) return toast.error('Kam az kam ek medicine select karo');
    setConfirmingPackage(true);
    try {
      const rows = await addPanelBillingItemsBulk(
        data.admission.id,
        checked.map((it) => ({ description: it.medicine, qty: 1, rate: it.rate }))
      );
      setData((d) => ({
        ...d,
        rows: [...d.rows, ...rows],
        billingAmount: d.billingAmount + rows.reduce((s, r) => s + Number(r.amount || 0), 0),
      }));
      setPackagePicker(null);
      toast.success(`${rows.length} medicine bill me add ho gayin`);
    } catch (e) {
      toast.error(e.message || 'Add nahi hua');
    } finally {
      setConfirmingPackage(false);
    }
  }

  async function handleAddCustom() {
    if (!data) return;
    const description = customQuery.trim();
    if (!description) return toast.error('Item ka naam likho ya list se select karo');
    const qty = Number(customQty);
    const rate = Number(customRate);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error('Qty valid honi chahiye');
    if (!Number.isFinite(rate) || rate < 0) return toast.error('Rate valid honi chahiye');
    setAddingCustom(true);
    try {
      const row = await addPanelBillingItem(data.admission.id, { description, qty, rate });
      setData((d) => ({
        ...d,
        rows: [...d.rows, row],
        billingAmount: d.billingAmount + row.amount,
      }));
      setCustomQuery('');
      setCustomQty('1');
      setCustomRate('');
    } catch (e) {
      toast.error(e.message || 'Add nahi hua');
    } finally {
      setAddingCustom(false);
    }
  }

  async function handleDeleteCustom(row) {
    try {
      await deletePanelBillingItem(row.id);
      setData((d) => ({
        ...d,
        rows: d.rows.filter((r) => r.id !== row.id),
        billingAmount: d.billingAmount - row.amount,
      }));
    } catch (e) {
      toast.error(e.message || 'Delete nahi hua');
    }
  }

  async function loadByAdmitNo(no) {
    setLoading(true);
    try {
      const res = await fetchPanelAdmissionBilling(no);
      setData(res);
      setAdmitNo(res.admission.admissionNo);
    } catch (e) {
      setData(null);
      toast.error(e.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  function lookup() {
    const no = admitNo.trim();
    if (!no) return toast.error('Admission # daalo');
    loadByAdmitNo(no);
  }

  function handleSelectFromModal(row) {
    setShowLookup(false);
    loadByAdmitNo(row.admissionNo);
  }

  function handleCancel() {
    setAdmitNo('');
    setData(null);
    setPopup(null);
  }

  function rowDoubleClick(row) {
    if (row.kind === 'pharmacy') setPopup('pharmacy');
    else if (row.kind === 'diagnostic') setPopup('diagnostic');
  }

  function startEdit(row, field, e) {
    e.stopPropagation(); // don't also trigger the row's double-click detail popup
    const raw = field === 'date' ? toInputDate(row.date) : String(row[field] ?? 0);
    setEditCell({ itemId: row.id, field, value: raw });
  }

  async function handleSaveCell() {
    if (!editCell) return;
    if (editCell.field === 'date') {
      setSavingCell(true);
      try {
        const updated = await updatePanelBillingItem(editCell.itemId, { date: editCell.value || null });
        setData((d) => ({ ...d, rows: d.rows.map((r) => (r.id === updated.id ? { ...r, date: updated.date } : r)) }));
        setEditCell(null);
      } catch (e) {
        toast.error(e.message || 'Date save nahi hui');
      } finally {
        setSavingCell(false);
      }
      return;
    }
    const val = Number(editCell.value);
    if (!Number.isFinite(val) || val < 0) { toast.error('Valid number daalo'); return; }
    const row = data.rows.find((r) => r.id === editCell.itemId);
    const payload = editCell.field === 'rate' ? { qty: row.qty, rate: val } : { qty: val, rate: row.rate };
    setSavingCell(true);
    try {
      const updated = await updatePanelBillingItem(editCell.itemId, payload);
      setData((d) => ({
        ...d,
        rows: d.rows.map((r) => (r.id === updated.id ? { ...r, qty: updated.qty, rate: updated.rate, amount: updated.amount } : r)),
        billingAmount: d.rows.reduce((s, r) => s + Number((r.id === updated.id ? updated.amount : r.amount) || 0), 0),
      }));
      setEditCell(null);
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
    } finally {
      setSavingCell(false);
    }
  }

  async function handleHeaderDateChange(field, value) {
    try {
      const updated = await updatePanelBillingHeader(data.admission.id, { [field]: value || null });
      setData((d) => {
        const admitDate = field === 'admitDate' ? updated.admitDate : d.admission.admitDate;
        const dischargeDate = field === 'dischargeDate' ? updated.dischargeDate : d.admission.dischargeDate;
        const days = Math.max(1, Math.ceil(((dischargeDate ? new Date(dischargeDate) : new Date()) - new Date(admitDate)) / 86400000));
        return { ...d, admission: { ...d.admission, admitDate, dischargeDate, days } };
      });
    } catch (e) {
      toast.error(e.message || 'Date save nahi hui');
    }
  }

  return (
    <div className="pnb-page">
      <ClinicMenuBar />

      {showLookup && (
        <PanelAdmissionLookupModal
          onSelect={handleSelectFromModal}
          onClose={() => setShowLookup(false)}
          searchPanelAdmissions={searchPanelAdmissions}
        />
      )}

      <div className="pnb-body">
        <div className="pnb-window">
          <div className="pnb-titlebar">
            <span>Transaction — Panel Billing</span>
            <span className="pnb-title-right">Panel Admission Billing</span>
          </div>

          {/* ── Header ── */}
          <div className="pnb-header">
            <div className="pnb-hg">
              <label>Admission #</label>
              <div className="pnb-lookup">
                <input
                  value={admitNo}
                  onChange={(e) => setAdmitNo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookup()}
                  placeholder="e.g. 174628"
                />
                <button onClick={() => setShowLookup(true)} disabled={loading}><Search size={14} /></button>
              </div>
            </div>
            <div className="pnb-hg"><label>Sno</label><div className="pnb-val">{data?.admission.serialNo || '—'}</div></div>
            <div className="pnb-hg">
              <label>Admit Date</label>
              {data ? (
                <input type="date" className="pnb-date-input" value={toInputDate(data.admission.admitDate)}
                  onChange={(e) => handleHeaderDateChange('admitDate', e.target.value)} />
              ) : <div className="pnb-val">—</div>}
            </div>
            <div className="pnb-hg">
              <label>Discharge Date</label>
              {data ? (
                <input type="date" className="pnb-date-input" value={toInputDate(data.admission.dischargeDate)}
                  onChange={(e) => handleHeaderDateChange('dischargeDate', e.target.value)} />
              ) : <div className="pnb-val">—</div>}
            </div>
            <div className="pnb-hg"><label>Days</label><div className="pnb-val">{data?.admission.days ?? '—'}</div></div>

            <div className="pnb-hg"><label>Company</label><div className="pnb-val pnb-val--blue">{data?.company ? `${data.company.code} — ${data.company.name}` : '—'}</div></div>
            <div className="pnb-hg"><label>Employee</label><div className="pnb-val">{data?.employee ? `${data.employee.empCode} — ${data.employee.name}` : '—'}</div></div>
            <div className="pnb-hg"><label>Patient Name</label><div className="pnb-val">{data?.admission.patientName || '—'}</div></div>
            <div className="pnb-hg"><label>Consultant</label><div className="pnb-val">{data?.consultant?.name || '—'}</div></div>
            <div className="pnb-hg pnb-hg--wide"><label>Diagnosis</label><div className="pnb-val">{data?.admission.diagnosis || '—'}</div></div>
          </div>

          {/* ── Manual add: Medicine / Laboratory / Ultrasound / Radiology ── */}
          {data && (
            <div className="pnb-add-row">
              <div className="pnb-fg pnb-fg--sm">
                <label>Type</label>
                <select
                  value={customType}
                  onChange={(e) => { setCustomType(e.target.value); setCustomQuery(''); setCustomOptions([]); }}
                >
                  {CUSTOM_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="pnb-fg pnb-fg--search">
                <label>Item</label>
                <div className="pnb-combo">
                  <input
                    value={customQuery}
                    onChange={(e) => handleCustomQueryChange(e.target.value)}
                    onFocus={() => handleCustomQueryChange(customQuery)}
                    onBlur={() => setTimeout(() => setShowCustomOptions(false), 150)}
                    placeholder="Naam type karo ya list se select karo…"
                  />
                  {showCustomOptions && customOptions.length > 0 && (
                    <div className="pnb-combo-list">
                      {customOptions.map((opt) => (
                        <div key={opt.id} className="pnb-combo-opt" onMouseDown={() => pickCustomOption(opt)}>
                          {opt.name}{opt.code ? <span className="pnb-combo-code"> ({opt.code})</span> : null}
                          {opt.kind === 'package' && <span className="pnb-combo-package"> — Medicine Package ({opt.packageItems.length})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="pnb-fg pnb-fg--sm">
                <label>Qty</label>
                <input value={customQty} onChange={(e) => setCustomQty(e.target.value)} />
              </div>
              <div className="pnb-fg pnb-fg--sm">
                <label>Rate</label>
                <input value={customRate} onChange={(e) => setCustomRate(e.target.value)} placeholder="apni rate" />
              </div>
              <button className="pnb-add-btn" onClick={handleAddCustom} disabled={addingCustom}>
                <Plus size={14} /> Add
              </button>
            </div>
          )}

          {/* ── Grid ── */}
          <div className="pnb-tab-body">
            <table className="pnb-table">
              <thead>
                <tr><th>Description</th><th>Date</th><th className="r">Rate</th><th className="r">Qty</th><th className="r">Amount</th><th>Remarks</th><th></th></tr>
              </thead>
              <tbody>
                {!data ? (
                  <tr><td colSpan={7} className="pnb-empty">Admission # lookup karo — Panel patient ka Provisional Bill data yahan aayega.</td></tr>
                ) : data.rows.map((r) => {
                  const clickable = r.kind === 'pharmacy' || r.kind === 'diagnostic';
                  return (
                    <tr key={r.id} className={clickable ? 'pnb-clickable' : ''} onDoubleClick={() => rowDoubleClick(r)}>
                      <td>{r.description}{clickable && <span className="pnb-hint"> (double-click for detail)</span>}</td>
                      <EditableCell row={r} field="date" type="date" editCell={editCell} savingCell={savingCell}
                        onStart={startEdit} onChange={(v) => setEditCell((s) => ({ ...s, value: v }))}
                        onSave={handleSaveCell} onCancel={() => setEditCell(null)} display={fmtDate(r.date)} />
                      <EditableCell row={r} field="rate" editCell={editCell} savingCell={savingCell}
                        onStart={startEdit} onChange={(v) => setEditCell((s) => ({ ...s, value: v }))}
                        onSave={handleSaveCell} onCancel={() => setEditCell(null)} display={fmt(r.rate)} />
                      <EditableCell row={r} field="qty" editCell={editCell} savingCell={savingCell}
                        onStart={startEdit} onChange={(v) => setEditCell((s) => ({ ...s, value: v }))}
                        onSave={handleSaveCell} onCancel={() => setEditCell(null)} display={r.qty || 0} />
                      <td className="r">{fmt(r.amount)}</td>
                      <td>{r.remarks || ''}</td>
                      <td>{r.kind === 'custom' && <button className="pnb-del" onClick={() => handleDeleteCustom(r)} title="Delete">✕</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Footer ── */}
          <div className="pnb-footer">
            <button className="pnb-btn" onClick={handleCancel}>Cancel</button>
            <div className="pnb-total">Billing Amt <span>{fmt(data?.billingAmount)}</span></div>
          </div>
        </div>
      </div>

      {popup === 'pharmacy' && data && (
        <DetailPopup
          title="Pharmacy Bill"
          onClose={() => setPopup(null)}
          columns={['Date', 'Medicine', 'Dosage', 'Qty', 'Rate', 'Amount']}
          rows={data.pharmacyRows.map((r) => [fmtDate(r.date), r.medicine, r.dosage || '', r.qty, fmt(r.rate), fmt(r.amount)])}
          total={data.pharmacyRows.reduce((s, r) => s + Number(r.amount || 0), 0)}
        />
      )}
      {popup === 'diagnostic' && data && (
        <DetailPopup
          title="Diagnostic Bill"
          onClose={() => setPopup(null)}
          columns={['Date', 'ConCode', 'Department', 'Particulars', 'Amount']}
          rows={data.diagnosticRows.map((r) => [fmtDate(r.date), r.conCode || '—', r.department, r.particulars || '', fmt(r.amount)])}
          total={data.diagnosticRows.reduce((s, r) => s + Number(r.amount || 0), 0)}
        />
      )}

      {packagePicker && (
        <PackagePickerModal
          picker={packagePicker}
          onToggle={togglePackageItem}
          onConfirm={handleConfirmPackage}
          onClose={() => setPackagePicker(null)}
          confirming={confirmingPackage}
        />
      )}
    </div>
  );
}

// Medicine Package checklist — pick which of the package's medicines actually
// applied for this patient; each checked one becomes its own bill row.
function PackagePickerModal({ picker, onToggle, onConfirm, onClose, confirming }) {
  const checkedCount = picker.items.filter((it) => it.checked).length;
  const checkedTotal = picker.items.filter((it) => it.checked).reduce((s, it) => s + Number(it.rate || 0), 0);
  return (
    <div className="pnb-modal-overlay" onMouseDown={onClose}>
      <div className="pnb-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pnb-modal-head">
          <span>{picker.description} — Medicine Package</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pnb-modal-body">
          <div className="pnb-pkg-list">
            {picker.items.map((it) => (
              <label key={it.id} className="pnb-pkg-row">
                <input type="checkbox" checked={it.checked} onChange={() => onToggle(it.id)} />
                <span className="pnb-pkg-name">{it.medicine}</span>
                <span className="pnb-pkg-rate">Rs. {fmt(it.rate)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="pnb-pkg-footer">
          <button className="pnb-btn" onClick={onClose}>Cancel</button>
          <div className="pnb-pkg-footer-total">{checkedCount} selected <span>{fmt(checkedTotal)}</span></div>
          <button className="pnb-add-btn" onClick={onConfirm} disabled={confirming}>Add Selected</button>
        </div>
      </div>
    </div>
  );
}

// Click-to-edit Rate/Qty cell — same interaction as Discharge Bill's inline
// Amount edit (click → input, blur/Enter saves, Escape cancels).
function EditableCell({ row, field, editCell, savingCell, onStart, onChange, onSave, onCancel, display, type = 'number' }) {
  const isEditing = editCell?.itemId === row.id && editCell?.field === field;
  return (
    <td className={type === 'date' ? 'pnb-edit-cell' : 'r pnb-edit-cell'}>
      {isEditing ? (
        <input
          autoFocus
          type={type}
          {...(type === 'number' ? { min: '0', step: '0.01' } : {})}
          className="pnb-edit-input"
          value={editCell.value}
          disabled={savingCell}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onSave(); }
            if (e.key === 'Escape') onCancel();
          }}
        />
      ) : (
        <span className="pnb-edit-display" title="Click to edit" onClick={(e) => onStart(row, field, e)}>
          {display}
        </span>
      )}
    </td>
  );
}

function DetailPopup({ title, columns, rows, total, onClose }) {
  return (
    <div className="pnb-modal-overlay" onMouseDown={onClose}>
      <div className="pnb-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pnb-modal-head">
          <span>{title}</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pnb-modal-body">
          <table className="pnb-table">
            <thead><tr>{columns.map((c) => <th key={c} className={c === 'Amount' ? 'r' : ''}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="pnb-empty">Koi record nahi mila</td></tr>
              ) : rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={j === r.length - 1 ? 'r' : ''}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pnb-modal-footer">Bill <span>{fmt(total)}</span></div>
      </div>
    </div>
  );
}
