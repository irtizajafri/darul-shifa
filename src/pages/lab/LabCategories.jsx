import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/shared/PageHeader';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { labApi } from './labApi';
import './Lab.scss';

const EMPTY = { name: '', sortOrder: '' };

export default function LabCategories() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await labApi('/categories'));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reset = () => { setForm(EMPTY); setEditingId(null); };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Enter a category name'); return; }
    setSaving(true);
    try {
      if (editingId) {
        await labApi(`/categories/${editingId}`, { method: 'PUT', body: form });
        toast.success('Category updated');
      } else {
        await labApi('/categories', { method: 'POST', body: form });
        toast.success('Category created');
      }
      reset();
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (c) => { setEditingId(c.id); setForm({ name: c.name, sortOrder: c.sortOrder || '' }); };

  const remove = async (c) => {
    const ok = await confirmDialog({ title: 'Delete category?', message: `"${c.name}" will be deleted.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await labApi(`/categories/${c.id}`, { method: 'DELETE' });
      toast.success('Category deleted');
      if (editingId === c.id) reset();
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="lab-page">
      <PageHeader
        breadcrumbs={[{ label: 'Laboratories', link: '/lab-module' }, { label: 'Categories' }]}
        title="Categories"
        subtitle="Groups such as Haematology and Biochemistry — each test belongs to one category"
      />

      <div className="lab-card">
        <h2 className="lab-card-title">{editingId ? 'Edit category' : 'New category'}</h2>
        <div className="lab-toolbar" style={{ marginBottom: 0 }}>
          <label className="lab-field" style={{ flex: '1 1 260px' }}>
            <span>Name</span>
            <input
              className="lab-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="e.g. Haematology"
              autoFocus
            />
          </label>
          <label className="lab-field" style={{ width: 110 }}>
            <span>Order</span>
            <input
              className="lab-input"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              placeholder="0"
            />
          </label>
          <button type="button" className="lab-btn lab-btn--primary" onClick={save} disabled={saving}>
            <Plus /> {editingId ? 'Update' : 'Save'}
          </button>
          {editingId && (
            <button type="button" className="lab-btn" onClick={reset}>
              <X /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="lab-card">
        <h2 className="lab-card-title">
          All categories <span className="lab-count">{rows.length} record{rows.length === 1 ? '' : 's'}</span>
        </h2>
        <div className="table-wrap">
          {loading ? (
            <p className="lab-empty">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="lab-empty">No categories yet. Create the first one above.</p>
          ) : (
            <table className="lab-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>#</th>
                  <th>Category</th>
                  <th className="r" style={{ width: 90 }}>Tests</th>
                  <th className="r" style={{ width: 90 }}>Order</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr key={c.id}>
                    <td className="muted">{i + 1}</td>
                    <td><b>{c.name}</b></td>
                    <td className="r">{c.testCount}</td>
                    <td className="r muted">{c.sortOrder}</td>
                    <td className="r nowrap">
                      <button type="button" className="lab-icon-btn" title="Edit" aria-label={`Edit ${c.name}`} onClick={() => edit(c)}><Pencil /></button>
                      <button type="button" className="lab-icon-btn is-danger" title="Delete" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}><Trash2 /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
