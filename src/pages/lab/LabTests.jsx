import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, Plus, X, ListChecks, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/shared/PageHeader';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { confirmDialog } from '../../components/ui/ConfirmDialog';
import { labApi } from './labApi';
import './Lab.scss';

const EMPTY = { categoryId: '', subDeptId: '', sampleType: '' };
const SAMPLE_TYPES = ['Blood', 'Serum', 'Plasma', 'Urine', 'Stool', 'Sputum', 'Swab', 'Fluid', 'Semen', 'Tissue'];

// The "sub category": a test from Clinic's own Laboratory list (the list
// /clinic/laboratory shows) placed in one category. Tests are created in
// Clinic → Parameters → Sub Department, not here.
export default function LabTests() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [clinicTests, setClinicTests] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, ct, t] = await Promise.all([labApi('/categories'), labApi('/clinic-tests'), labApi('/tests')]);
      setCategories(c);
      setClinicTests(ct);
      setTests(t);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const freeTests = useMemo(() => clinicTests.filter((t) => !t.labTestId), [clinicTests]);

  const reset = () => { setForm(EMPTY); setEditing(null); };

  const save = async () => {
    if (!form.categoryId) { toast.error('Select a category'); return; }
    if (!editing && !form.subDeptId) { toast.error('Select a test'); return; }
    setSaving(true);
    try {
      if (editing) {
        await labApi(`/tests/${editing.id}`, { method: 'PUT', body: { categoryId: form.categoryId, sampleType: form.sampleType, sortOrder: editing.sortOrder } });
        toast.success('Test updated');
        reset();
      } else {
        await labApi('/tests', { method: 'POST', body: form });
        toast.success('Test added to the category');
        // Keep the category picked, so several tests go in one after another.
        setForm((f) => ({ ...EMPTY, categoryId: f.categoryId }));
      }
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const edit = (t) => {
    setEditing(t);
    setForm({ categoryId: t.categoryId, subDeptId: t.subDeptId, sampleType: t.sampleType || '' });
  };

  const remove = async (t) => {
    const ok = await confirmDialog({
      title: 'Remove test from its category?',
      message: `"${t.subDept.name}" and its ${t.parameterCount} report lines will be removed. Results already saved are not affected.`,
      confirmLabel: 'Remove', danger: true,
    });
    if (!ok) return;
    try {
      await labApi(`/tests/${t.id}`, { method: 'DELETE' });
      toast.success('Test hata diya');
      if (editing?.id === t.id) reset();
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tests.filter((t) => (!filterCat || String(t.categoryId) === String(filterCat))
      && (!term || t.subDept.name.toLowerCase().includes(term) || (t.subDept.code || '').toLowerCase().includes(term)));
  }, [tests, filterCat, q]);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const t of shown) {
      if (!m.has(t.category.id)) m.set(t.category.id, { name: t.category.name, rows: [] });
      m.get(t.category.id).rows.push(t);
    }
    return [...m.values()];
  }, [shown]);

  return (
    <div className="lab-page">
      <PageHeader
        breadcrumbs={[{ label: 'Laboratories', link: '/lab-module' }, { label: 'Sub Category (Tests)' }]}
        title="Sub Category (Tests)"
        subtitle="Pick a test from the Clinic → Laboratory list and place it in a category"
      />

      <div className="lab-card">
        <h2 className="lab-card-title">{editing ? `Edit: ${editing.subDept.name}` : 'Add a test to a category'}</h2>
        <div className="lab-toolbar" style={{ marginBottom: 6 }}>
          <label className="lab-field" style={{ flex: '1 1 220px' }}>
            <span>Category</span>
            <SearchableSelect
              options={categories}
              value={form.categoryId}
              onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
              getKey={(c) => c.id}
              getLabel={(c) => c.name}
              placeholder={categories.length ? 'Select a category' : 'Create a category in Categories first'}
              size="sm"
            />
          </label>
          <label className="lab-field" style={{ flex: '2 1 320px' }}>
            <span>Test (Clinic Laboratory list)</span>
            {editing ? (
              <input className="lab-input" value={`${editing.subDept.name} (${editing.subDept.code})`} disabled />
            ) : (
              <SearchableSelect
                options={freeTests}
                value={form.subDeptId}
                onChange={(v) => setForm((f) => ({ ...f, subDeptId: v }))}
                getKey={(t) => t.id}
                getLabel={(t) => (t.code ? `${t.name} (${t.code})` : t.name)}
                placeholder={`Select a test — ${freeTests.length} not placed yet`}
                size="sm"
                maxUnfiltered={400}
              />
            )}
          </label>
          <label className="lab-field" style={{ width: 150 }}>
            <span>Sample</span>
            <input
              className="lab-input"
              list="lab-sample-types"
              value={form.sampleType}
              onChange={(e) => setForm((f) => ({ ...f, sampleType: e.target.value }))}
              placeholder="e.g. Blood"
            />
            <datalist id="lab-sample-types">
              {SAMPLE_TYPES.map((s) => <option key={s} value={s} />)}
            </datalist>
          </label>
          <button type="button" className="lab-btn lab-btn--primary" onClick={save} disabled={saving}>
            <Plus /> {editing ? 'Update' : 'Save'}
          </button>
          {editing && (
            <button type="button" className="lab-btn" onClick={reset}><X /> Cancel</button>
          )}
        </div>
        <p className="lab-hint">
          Clinic has {clinicTests.length} lab tests; {clinicTests.length - freeTests.length} are in a category. New tests are created in Clinic → Parameters → Sub Department (LABORATORY).
        </p>
      </div>

      <div className="lab-card">
        <div className="lab-toolbar">
          <label className="lab-field" style={{ width: 240 }}>
            <span>Category</span>
            <SearchableSelect
              options={categories}
              value={filterCat}
              onChange={(v) => setFilterCat(v || '')}
              getKey={(c) => c.id}
              getLabel={(c) => c.name}
              placeholder="All categories"
              size="sm"
            />
          </label>
          <label className="lab-field" style={{ flex: '1 1 220px' }}>
            <span>Search</span>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 9, top: 9, width: 15, height: 15, color: '#94a3b8' }} />
              <input className="lab-input" style={{ paddingLeft: 30, width: '100%' }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Test name or code" />
            </div>
          </label>
          <span className="lab-count">{shown.length} test{shown.length === 1 ? '' : 's'}</span>
        </div>
        <div className="table-wrap">
          {loading ? (
            <p className="lab-empty">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="lab-empty">No tests. Pick a category and a test above, then Save.</p>
          ) : (
            <table className="lab-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Code</th>
                  <th>Test</th>
                  <th style={{ width: 110 }}>Sample</th>
                  <th className="r" style={{ width: 100 }}>Parameters</th>
                  <th style={{ width: 170 }} />
                </tr>
              </thead>
              <tbody>
                {grouped.map((g) => [
                  <tr key={`g-${g.name}`} className="lab-group-row"><td colSpan={5}>{g.name} ({g.rows.length})</td></tr>,
                  ...g.rows.map((t) => (
                    <tr key={t.id}>
                      <td className="muted">{t.subDept.code}</td>
                      <td>{t.subDept.name}</td>
                      <td className="muted">{t.sampleType || '—'}</td>
                      <td className="r">
                        {t.parameterCount ? t.parameterCount : <span className="lab-badge lab-badge--pending">Not set</span>}
                      </td>
                      <td className="r nowrap">
                        <button type="button" className="lab-btn lab-btn--sm" onClick={() => navigate(`/lab/parameters?test=${t.id}`)}>
                          <ListChecks /> Parameters
                        </button>
                        <button type="button" className="lab-icon-btn" title="Edit" aria-label={`Edit ${t.subDept.name}`} onClick={() => edit(t)}><Pencil /></button>
                        <button type="button" className="lab-icon-btn is-danger" title="Remove" aria-label={`Remove ${t.subDept.name}`} onClick={() => remove(t)}><Trash2 /></button>
                      </td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
