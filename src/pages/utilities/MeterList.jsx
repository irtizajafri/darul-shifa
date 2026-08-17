import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Pencil, ChevronRight, PlugZap, Building2, Flame, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useUtilitiesStore } from '../../store/useUtilitiesStore';
import MeterDetail from './MeterDetail';
import CombinedReport from './CombinedReport';

const EMPTY = { meterNo: '', departmentName: '', location: '' };

export default function MeterList({ type, utility = 'electricity', onBack }) {
  const { fetchMeters, createMeter, updateMeter } = useUtilitiesStore();
  const isBilling = type === 'billing';
  const isGas = utility === 'gas';

  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showCombined, setShowCombined] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetchMeters({ type, utility }).then(setList).catch((e) => toast.error(e.message));
  };
  useEffect(load, [type, utility]);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setShowForm(true); };
  const openEdit = (m) => {
    setForm({
      meterNo: m.meterNo || '',
      departmentName: m.departmentName || '',
      location: m.location || '',
    });
    setEditing(m);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isBilling && !form.meterNo.trim()) return toast.error('Meter number is required');
    if (!isBilling && !form.departmentName.trim()) return toast.error('Department name is required');
    setSaving(true);
    try {
      if (editing) {
        await updateMeter(editing.id, form);
        toast.success('Meter updated');
      } else {
        await createMeter({ type, utility, ...form });
        toast.success('Meter added');
      }
      setShowForm(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (selected) {
    return <MeterDetail meter={selected} onBack={() => { setSelected(null); load(); }} />;
  }

  if (showCombined) {
    return <CombinedReport type={type} utility={utility} meters={list} onBack={() => setShowCombined(false)} />;
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';
  const Icon = isGas ? Flame : (isBilling ? PlugZap : Building2);
  const accent = isGas ? 'orange' : (isBilling ? 'amber' : 'blue');
  const title = isGas ? 'Sui Gas Meters' : (isBilling ? 'Billing Meters' : 'Department Wise Meters');

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{title}</h1>
          <p className="text-sm text-slate-500">{list.length} meter{list.length === 1 ? '' : 's'}</p>
        </div>
        <Button label="Combined Report" icon={BarChart3} size="sm" variant="outline" onClick={() => setShowCombined(true)} disabled={!list.length} />
        <Button label="Add Meter" icon={Plus} size="sm" onClick={openAdd} />
      </div>

      {showForm && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">{editing ? 'Edit Meter' : 'Add New Meter'}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            {isBilling ? (
              <div>
                <label className={labelCls}>Meter Number *</label>
                <input value={form.meterNo} onChange={(e) => setForm((p) => ({ ...p, meterNo: e.target.value }))} className={inputCls} placeholder="e.g. 803" required />
              </div>
            ) : (
              <div>
                <label className={labelCls}>Department Name *</label>
                <input value={form.departmentName} onChange={(e) => setForm((p) => ({ ...p, departmentName: e.target.value }))} className={inputCls} placeholder="e.g. ICU" required />
              </div>
            )}
            <div>
              <label className={labelCls}>Location</label>
              <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} className={inputCls} placeholder="Optional" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" label={saving ? 'Saving...' : (editing ? 'Update' : 'Add')} disabled={saving} size="sm" />
              <Button type="button" label="Cancel" variant="secondary" size="sm" onClick={() => setShowForm(false)} />
            </div>
          </form>
        </div>
      )}

      {list.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Icon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Koi meter add nahi hua abhi tak</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((m) => (
            <div
              key={m.id}
              onClick={() => setSelected(m)}
              className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm hover:border-blue-300 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-lg bg-${accent}-50 flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 text-${accent}-600`} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{isBilling ? m.meterNo : m.departmentName}</p>
                  <p className="text-xs text-slate-500 truncate">{m.location || 'No location set'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); openEdit(m); }} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Edit">
                  <Pencil className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
