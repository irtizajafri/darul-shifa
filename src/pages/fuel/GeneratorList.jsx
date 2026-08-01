import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Zap, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useFuelStore } from '../../store/useFuelStore';
import GeneratorManagement from './GeneratorManagement';

const EMPTY = { name: '', modelNo: '', serialNo: '', location: '' };

export default function GeneratorList({ onBack }) {
  const { generators, fetchGenerators, createGenerator, updateGenerator } = useFuelStore();
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingGenerator, setEditingGenerator] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchGenerators().catch((e) => toast.error(e.message)); }, [fetchGenerators]);

  const openAdd = () => { setForm(EMPTY); setEditingGenerator(null); setShowForm(true); };
  const openEdit = (g) => {
    setForm({ name: g.name, modelNo: g.modelNo || '', serialNo: g.serialNo || '', location: g.location || '' });
    setEditingGenerator(g);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Generator name is required');
    setSaving(true);
    try {
      if (editingGenerator) {
        await updateGenerator(editingGenerator.id, form);
        toast.success('Generator updated');
      } else {
        await createGenerator(form);
        toast.success('Generator added');
      }
      setShowForm(false);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (selected) {
    return <GeneratorManagement generator={selected} onBack={() => setSelected(null)} />;
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-amber-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Generators</h1>
          <p className="text-sm text-slate-500">Select a generator to track fuel, oil & daily sheets</p>
        </div>
        <Button label="Add Generator" icon={Plus} size="sm" onClick={openAdd} />
      </div>

      {showForm && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">{editingGenerator ? 'Edit Generator' : 'Add New Generator'}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={labelCls}>Generator Name *</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={inputCls} placeholder="e.g. Main Generator, Backup Generator" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Model No</label>
                <input value={form.modelNo} onChange={(e) => setForm((p) => ({ ...p, modelNo: e.target.value }))}
                  className={inputCls} placeholder="e.g. Perkins 20kVA" />
              </div>
              <div>
                <label className={labelCls}>Serial No</label>
                <input value={form.serialNo} onChange={(e) => setForm((p) => ({ ...p, serialNo: e.target.value }))}
                  className={inputCls} placeholder="e.g. SN-12345" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                className={inputCls} placeholder="e.g. Basement, Generator Room" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" label={saving ? 'Saving...' : (editingGenerator ? 'Update' : 'Add')} disabled={saving} size="sm" />
              <Button type="button" label="Cancel" variant="secondary" size="sm" onClick={() => setShowForm(false)} />
            </div>
          </form>
        </div>
      )}

      {generators.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No generators added yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {generators.map((g) => (
            <div key={g.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm hover:border-amber-300 transition-colors">
              <button className="flex items-center gap-3 flex-1 text-left" onClick={() => setSelected(g)}>
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{g.name}</p>
                  <p className="text-xs text-slate-500">
                    {[g.modelNo, g.serialNo, g.location].filter(Boolean).join(' • ') || 'No details'}
                  </p>
                </div>
              </button>
              <button onClick={() => openEdit(g)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
