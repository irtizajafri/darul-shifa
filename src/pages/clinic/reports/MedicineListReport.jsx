import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Upload, X, Plus, Pencil, Trash2 } from 'lucide-react';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import { useClinicStore } from '../../../store/useClinicStore';
import useModalKeys from '../../../hooks/useModalKeys';
import { printElementInPopup } from '../../../utils/printPopup';
import usePagedList from '../../../hooks/usePagedList';
import ShowMoreFooter from '../../../components/reports/ShowMoreFooter';
import './MedicineListReport.scss';
import { useShallow } from 'zustand/react/shallow';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_LABELS = { active: 'Active', inactive: 'Inactive', all: 'All' };

function localYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Plain price-list export — header row usually has 1-2 blank rows above it
// (Crystal Reports / Excel print-area quirk, same as the Panel Cheque file),
// so the header is located by CONTENT ("id" + "name" + "retail" all present
// in the same row) instead of assuming a fixed row index. Column order after
// that is read off the header text itself, so a reordered export still works.
function parseMedicineExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

        const norm = (v) => String(v || '').trim().toLowerCase();
        let headerIdx = -1;
        let col = {};
        for (let i = 0; i < raw.length; i++) {
          const cells = raw[i].map(norm);
          const idIdx = cells.findIndex((c) => c === 'id');
          const nameIdx = cells.findIndex((c) => c === 'name');
          const retailIdx = cells.findIndex((c) => c.includes('retail'));
          if (idIdx !== -1 && nameIdx !== -1 && retailIdx !== -1) {
            headerIdx = i;
            col = {
              id: idIdx,
              name: nameIdx,
              packSize: cells.findIndex((c) => c.includes('pack')),
              retail: retailIdx,
              tp: cells.findIndex((c) => c === 'tp' || c.includes('trade')),
            };
            break;
          }
        }
        if (headerIdx === -1) {
          reject(new Error('Header row nahi mili — id, Name, Retail columns check karein'));
          return;
        }

        const rows = [];
        for (let i = headerIdx + 1; i < raw.length; i++) {
          const r = raw[i];
          const code = String(r[col.id] ?? '').trim();
          const name = String(r[col.name] ?? '').trim();
          if (!code && !name) continue; // trailing blank row
          const packSize = col.packSize !== -1 ? String(r[col.packSize] ?? '').trim() : '';
          const retailPrice = Number(String(r[col.retail] ?? '').replace(/,/g, '')) || 0;
          const tradePrice = col.tp !== -1 ? (Number(String(r[col.tp] ?? '').replace(/,/g, '')) || 0) : 0;
          rows.push({ code, name, packSize, retailPrice, tradePrice });
        }
        resolve({ rows });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const emptyForm = { code: '', name: '', packSize: '', retailPrice: '', tradePrice: '' };

export default function MedicineListReport() {
  const { fetchMedicineList, createMedicine, updateMedicine, deleteMedicine } = useClinicStore(useShallow((s) => ({ fetchMedicineList: s.fetchMedicineList, createMedicine: s.createMedicine, updateMedicine: s.updateMedicine, deleteMedicine: s.deleteMedicine })));
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  // View page — filters come from MedicineListFilter via the URL (defaults
  // match the old in-page controls: status Active, empty search).
  const [params] = useSearchParams();
  const search = params.get('search') || '';
  const statusParam = params.get('status');
  const statusFilter = STATUS_LABELS[statusParam] ? statusParam : 'active';
  const reportRef = useRef(null);
  const [showImport, setShowImport] = useState(false);
  // The Add/Edit form's own field state lives in MedicineFormModal — typing
  // there must not re-render this component (and its 11k-row table): that
  // cost ~1.7s per keystroke.
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // medicine object | null (null = adding new)
  // Bumped on every (re)load so the on-screen paging goes back to page 1.
  const [loadSeq, setLoadSeq] = useState(0);

  const load = () => {
    setLoading(true);
    fetchMedicineList({ status: 'all' })
      .then((list) => { setMedicines(list); setLoadSeq((n) => n + 1); })
      .catch((err) => toast.error(err.message || 'Medicine list load nahi hui'))
      .finally(() => setLoading(false));
  };

  // Load once on mount (`loading` already starts true, so load()'s own
  // setLoading(true) is a no-op here).
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return medicines
      .filter((m) => (statusFilter === 'all' ? true : m.status === statusFilter))
      .filter((m) => !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));
  }, [medicines, search, statusFilter]);

  // Draw 300 rows at a time; count, print and Excel still use all `rows`.
  // Page 1 again when the filter changes or the list is reloaded (not on a
  // single row's edit/toggle/delete).
  const page = usePagedList(rows.length, `${loadSeq}|${statusFilter}|${search}`);
  const visibleRows = useMemo(() => (page.limit >= rows.length ? rows : rows.slice(0, page.limit)), [rows, page.limit]);

  const closeForm = useCallback(() => setShowForm(false), []);

  function openAdd() {
    setEditing(null);
    setShowForm(true);
  }

  // Stable callbacks (setters / store actions only) so the memoized table
  // never re-renders because of the form.
  const openEdit = useCallback((m) => {
    setEditing(m);
    setShowForm(true);
  }, []);

  const handleSaved = useCallback((saved, wasEdit) => {
    if (wasEdit) setMedicines((prev) => prev.map((m) => (m.id === saved.id ? saved : m)));
    else setMedicines((prev) => [saved, ...prev]);
    setShowForm(false);
  }, []);

  const handleToggleStatus = useCallback(async (m) => {
    const next = m.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await updateMedicine(m.id, { status: next });
      setMedicines((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch (err) {
      toast.error(err.message || 'Status update nahi hui');
    }
  }, [updateMedicine]);

  const handleDelete = useCallback(async (m) => {
    if (!(await confirmDialog({ title: 'Delete medicine', message: `"${m.name}" delete karni hai?`, confirmLabel: 'Delete', danger: true }))) return;
    try {
      await deleteMedicine(m.id);
      setMedicines((prev) => prev.filter((x) => x.id !== m.id));
      toast.success('Medicine delete ho gayi');
    } catch (err) {
      toast.error(err.message || 'Delete nahi hui');
    }
  }, [deleteMedicine]);

  const filterText = [
    `Status: ${STATUS_LABELS[statusFilter]}`,
    search ? `Search: "${search}"` : '',
  ].filter(Boolean).join(' — ');

  const countText = `${rows.length} medicine${rows.length !== 1 ? 's' : ''}`;

  // Print clones the on-screen table, so render every row for the clone.
  const handlePrint = () => {
    page.withAll(() => printElementInPopup(reportRef.current, {
      title: 'Medicine List',
      page: 'A4 portrait',
      margin: '10mm',
      // Belt-and-braces: .no-print is already hidden by the popup, but make
      // sure the row-action column never prints and the toggle badge prints
      // as plain text.
      extraCss: '.mlr-actions{display:none!important} .mlr-status-badge{background:none!important;padding:0!important;color:#000!important}',
    }));
  };

  const handleExportExcel = () => {
    if (!rows.length) { toast.error('No data to export'); return; }
    const aoa = [['Medicine List'], [filterText], []];
    aoa.push(['Code', 'Name', 'Pack Size', 'Retail', 'TP', 'Status']);
    rows.forEach((m) => aoa.push([
      m.code,
      m.name,
      m.packSize || '—',
      Number(m.retailPrice || 0),
      Number(m.tradePrice || 0),
      m.status,
    ]));
    aoa.push([]);
    aoa.push([countText]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Medicines');
    XLSX.writeFile(wb, `medicine_list_${localYmd(new Date())}.xlsx`);
  };

  return (
    <div className="mlr-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExportExcel} onRefresh={load} refreshing={loading}>
        <div className="rpt-tool-sep" />
        <button type="button" className="rpt-tool-btn" onClick={openAdd} title="Add Medicine">
          <Plus size={14} /> <span>Add Medicine</span>
        </button>
        <button type="button" className="rpt-tool-btn" onClick={() => setShowImport(true)} title="Upload Excel">
          <Upload size={14} /> <span>Upload Excel</span>
        </button>
      </ReportToolbar>

      <div className="mlr-printable rpt-arial9" ref={reportRef}>
        <div className="mlr-header">
          <div>
            <span className="mlr-title">Medicine List</span>
            <div className="mlr-filters">{filterText}</div>
          </div>
          <span className="mlr-count">{countText}</span>
        </div>

        <div className="mlr-report">
          {loading ? (
            <div className="mlr-empty">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="mlr-empty">Koi medicine nahi mili.</div>
          ) : (
            <>
              <MedicineTable rows={visibleRows} onToggle={handleToggleStatus} onEdit={openEdit} onDelete={handleDelete} />
              <ShowMoreFooter {...page} noun="medicines" />
            </>
          )}
        </div>
      </div>

      {showForm && (
        <MedicineFormModal
          editing={editing}
          onClose={closeForm}
          onSaved={handleSaved}
          createMedicine={createMedicine}
          updateMedicine={updateMedicine}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); load(); }}
        />
      )}
    </div>
  );
}

// Memoized: re-renders only when the visible rows or the (stable) row
// callbacks change — never while typing in the Add/Edit form.
const MedicineTable = memo(function MedicineTable({ rows, onToggle, onEdit, onDelete }) {
  return (
    <div className="mlr-table-wrap">
      <table className="mlr-table">
        <thead>
          <tr>
            <th className="mlr-l">Code</th>
            <th className="mlr-l">Name</th>
            <th className="mlr-l">Pack Size</th>
            <th className="mlr-r">Retail</th>
            <th className="mlr-r">TP</th>
            <th className="mlr-l">Status</th>
            <th className="mlr-l mlr-actions no-print"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id}>
              <td className="mlr-l">{m.code}</td>
              <td className="mlr-l">{m.name}</td>
              <td className="mlr-l">{m.packSize || '—'}</td>
              <td className="mlr-r">{fmt(m.retailPrice)}</td>
              <td className="mlr-r">{fmt(m.tradePrice)}</td>
              <td className="mlr-l">
                <button
                  className={`mlr-status-badge mlr-status-badge--${m.status}`}
                  onClick={() => onToggle(m)}
                  title="Click to toggle"
                >
                  {m.status}
                </button>
              </td>
              <td className="mlr-l mlr-actions no-print">
                <div className="mlr-row-actions">
                <button onClick={() => onEdit(m)} title="Edit"><Pencil size={13} /></button>
                <button onClick={() => onDelete(m)} title="Delete"><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

// Add / Edit Medicine form — owns its field state so a keystroke re-renders
// only this modal. `editing` = medicine being edited, or null to add new.
function MedicineFormModal({ editing, onClose, onSaved, createMedicine, updateMedicine }) {
  const [form, setForm] = useState(() => (editing
    ? { code: editing.code, name: editing.name, packSize: editing.packSize || '', retailPrice: editing.retailPrice, tradePrice: editing.tradePrice }
    : emptyForm));
  const [saving, setSaving] = useState(false);

  useModalKeys({ active: true, onEsc: onClose });

  async function handleSaveForm() {
    if (!form.code.trim()) return toast.error('Code zaroori hai');
    if (!form.name.trim()) return toast.error('Naam zaroori hai');
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        packSize: form.packSize.trim() || null,
        retailPrice: Number(form.retailPrice) || 0,
        tradePrice: Number(form.tradePrice) || 0,
      };
      if (editing) {
        const updated = await updateMedicine(editing.id, payload);
        toast.success('Medicine update ho gayi');
        onSaved(updated, true);
      } else {
        const created = await createMedicine(payload);
        toast.success('Medicine add ho gayi');
        onSaved(created, false);
      }
    } catch (err) {
      toast.error(err.message || 'Save nahi hui');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mlr-modal-overlay" onMouseDown={onClose}>
      <div className="mlr-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mlr-modal-head">
          <span>{editing ? 'Edit Medicine' : 'Add Medicine'}</span>
          <button onClick={onClose} aria-label="Close" title="Close"><X size={16} /></button>
        </div>
        <div className="mlr-modal-body">
          <div className="mlr-form-row">
            <label>Code</label>
            <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          </div>
          <div className="mlr-form-row">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="mlr-form-row">
            <label>Pack Size</label>
            <input value={form.packSize} onChange={(e) => setForm((f) => ({ ...f, packSize: e.target.value }))} />
          </div>
          <div className="mlr-form-row">
            <label>Retail</label>
            <input type="number" value={form.retailPrice} onChange={(e) => setForm((f) => ({ ...f, retailPrice: e.target.value }))} />
          </div>
          <div className="mlr-form-row">
            <label>TP</label>
            <input type="number" value={form.tradePrice} onChange={(e) => setForm((f) => ({ ...f, tradePrice: e.target.value }))} />
          </div>
        </div>
        <div className="mlr-modal-footer">
          <button className="mlr-btn mlr-btn--upload" onClick={handleSaveForm} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Update' : 'Add'}
          </button>
          <button className="mlr-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({ onClose, onImported }) {
  const { previewMedicineImport, confirmMedicineImport } = useClinicStore(useShallow((s) => ({ previewMedicineImport: s.previewMedicineImport, confirmMedicineImport: s.confirmMedicineImport })));
  const fileRef = useRef(null);

  const [step, setStep] = useState('pick'); // pick | preview | done
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  useModalKeys({ active: true, onEsc: onClose });

  async function handlePickFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    try {
      const { rows } = await parseMedicineExcel(file);
      if (!rows.length) { toast.error('Excel mein koi valid row nahi mili'); return; }
      const prev = await previewMedicineImport(rows);
      setParsedRows(rows);
      setPreview(prev);
      setStep('preview');
    } catch (err) {
      toast.error(err.message || 'File parse/preview nahi hui');
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  }

  async function handleConfirmImport() {
    setImporting(true);
    try {
      const res = await confirmMedicineImport(parsedRows);
      setResult(res);
      setStep('done');
      toast.success(`${res.created} medicines add hui, ${res.updated} update hui`);
    } catch (err) {
      toast.error(err.message || 'Import fail ho gaya');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mlr-modal-overlay" onMouseDown={onClose}>
      <div className="mlr-modal mlr-modal--wide" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mlr-modal-head">
          <span>Upload Excel — Medicine Price List</span>
          <button onClick={onClose} aria-label="Close" title="Close"><X size={16} /></button>
        </div>

        <div className="mlr-modal-body">
          {step === 'pick' && (
            <div className="mlr-import-pick">
              <p>id, Name, packsize, Retail, TP columns wali .xls/.xlsx file select karein — header row khud detect ho jayegi.</p>
              <input ref={fileRef} type="file" accept=".xls,.xlsx" style={{ display: 'none' }} onChange={handlePickFile} />
              <button className="mlr-btn mlr-btn--upload" onClick={() => fileRef.current?.click()} disabled={parsing}>
                <Upload size={14} /> {parsing ? 'Parsing…' : 'Select File'}
              </button>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="mlr-import-preview">
              <div className="mlr-import-file">File: <b>{fileName}</b></div>
              <div className="mlr-import-stats">
                <div><span>Total rows found</span><b>{preview.totalRows}</b></div>
                <div><span>Will add (new)</span><b>{preview.willCreate}</b></div>
                <div><span>Will update (existing)</span><b>{preview.willUpdate}</b></div>
                <div><span>Total Retail (new+update)</span><b>{fmt(preview.totalRetail)}</b></div>
                <div><span>Total TP (new+update)</span><b>{fmt(preview.totalTrade)}</b></div>
                <div><span>Blank rows (skipped)</span><b>{preview.blank}</b></div>
                <div><span>Duplicate in file (skipped)</span><b>{preview.duplicatesInFile.length}</b></div>
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div className="mlr-import-done">
              <p><b>{result.created}</b> new medicines added, <b>{result.updated}</b> existing ones updated.</p>
              {result.skipped > 0 && <p>{result.skipped} rows skipped (blank / duplicate in file).</p>}
            </div>
          )}
        </div>

        <div className="mlr-modal-footer">
          {step === 'preview' && (
            <button className="mlr-btn mlr-btn--upload" onClick={handleConfirmImport} disabled={importing}>
              {importing ? 'Importing…' : `Import ${preview.willCreate + preview.willUpdate} Medicines`}
            </button>
          )}
          {step === 'done' && (
            <button className="mlr-btn mlr-btn--upload" onClick={onImported}>Done</button>
          )}
          <button className="mlr-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
