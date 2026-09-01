import { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload, X, Plus, Pencil, Trash2, Search } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import './MedicineListReport.scss';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const { fetchMedicineList, createMedicine, updateMedicine, deleteMedicine } = useClinicStore();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showImport, setShowImport] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // medicine object | null (null = adding new)
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetchMedicineList({ status: 'all' })
      .then(setMedicines)
      .catch((err) => toast.error(err.message || 'Medicine list load nahi hui'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return medicines
      .filter((m) => (statusFilter === 'all' ? true : m.status === statusFilter))
      .filter((m) => !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q));
  }, [medicines, search, statusFilter]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(m) {
    setEditing(m);
    setForm({ code: m.code, name: m.name, packSize: m.packSize || '', retailPrice: m.retailPrice, tradePrice: m.tradePrice });
    setShowForm(true);
  }

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
        setMedicines((prev) => prev.map((m) => (m.id === editing.id ? updated : m)));
        toast.success('Medicine update ho gayi');
      } else {
        const created = await createMedicine(payload);
        setMedicines((prev) => [created, ...prev]);
        toast.success('Medicine add ho gayi');
      }
      setShowForm(false);
    } catch (err) {
      toast.error(err.message || 'Save nahi hui');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(m) {
    const next = m.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await updateMedicine(m.id, { status: next });
      setMedicines((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
    } catch (err) {
      toast.error(err.message || 'Status update nahi hui');
    }
  }

  async function handleDelete(m) {
    if (!window.confirm(`"${m.name}" delete karni hai?`)) return;
    try {
      await deleteMedicine(m.id);
      setMedicines((prev) => prev.filter((x) => x.id !== m.id));
      toast.success('Medicine delete ho gayi');
    } catch (err) {
      toast.error(err.message || 'Delete nahi hui');
    }
  }

  return (
    <div className="mlr-page">
      <ClinicMenuBar />
      <div className="mlr-body">
        <div className="mlr-toolbar">
          <div className="mlr-titlebar">Medicine List</div>
          <div className="mlr-toolbar-actions">
            <div className="mlr-search">
              <Search size={14} />
              <input placeholder="Search code or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="mlr-status-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
            <button className="mlr-btn" onClick={openAdd}><Plus size={14} /> Add Medicine</button>
            <button className="mlr-btn mlr-btn--upload" onClick={() => setShowImport(true)}><Upload size={14} /> Upload Excel</button>
          </div>
        </div>

        <div className="mlr-report">
          {loading ? (
            <div className="mlr-empty">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="mlr-empty">Koi medicine nahi mili.</div>
          ) : (
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
                    <th className="mlr-l"></th>
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
                          onClick={() => handleToggleStatus(m)}
                          title="Click to toggle"
                        >
                          {m.status}
                        </button>
                      </td>
                      <td className="mlr-l mlr-row-actions">
                        <button onClick={() => openEdit(m)} title="Edit"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(m)} title="Delete"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="mlr-modal-overlay" onMouseDown={() => setShowForm(false)}>
          <div className="mlr-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mlr-modal-head">
              <span>{editing ? 'Edit Medicine' : 'Add Medicine'}</span>
              <button onClick={() => setShowForm(false)}><X size={16} /></button>
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
              <button className="mlr-btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
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

function ImportModal({ onClose, onImported }) {
  const { previewMedicineImport, confirmMedicineImport } = useClinicStore();
  const fileRef = useRef(null);

  const [step, setStep] = useState('pick'); // pick | preview | done
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

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
      <div className="mlr-modal mlr-modal--wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mlr-modal-head">
          <span>Upload Excel — Medicine Price List</span>
          <button onClick={onClose}><X size={16} /></button>
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
