import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Car, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useFuelStore } from '../../store/useFuelStore';
import VehicleDetail from './VehicleDetail';

const EMPTY = { name: '', plateNo: '', type: 'van' };

export default function VehicleList({ onBack }) {
  const { vehicles, fetchVehicles, createVehicle, updateVehicle } = useFuelStore();
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchVehicles().catch((e) => toast.error(e.message)); }, [fetchVehicles]);

  const openAdd = () => { setForm(EMPTY); setEditingVehicle(null); setShowForm(true); };
  const openEdit = (v) => { setForm({ name: v.name, plateNo: v.plateNo || '', type: v.type }); setEditingVehicle(v); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Vehicle name is required');
    setSaving(true);
    try {
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, form);
        toast.success('Vehicle updated');
      } else {
        await createVehicle(form);
        toast.success('Vehicle added');
      }
      setShowForm(false);
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (selected) {
    return <VehicleDetail vehicle={selected} onBack={() => setSelected(null)} />;
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Vans / Vehicles</h1>
          <p className="text-sm text-slate-500">Select a vehicle to track fuel & oil</p>
        </div>
        <Button label="Add Vehicle" icon={Plus} size="sm" onClick={openAdd} />
      </div>

      {showForm && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={labelCls}>Vehicle Name *</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={inputCls} placeholder="e.g. Hospital Ambulance" required />
            </div>
            <div>
              <label className={labelCls}>Plate No</label>
              <input value={form.plateNo} onChange={(e) => setForm((p) => ({ ...p, plateNo: e.target.value }))}
                className={inputCls} placeholder="e.g. ABC-123" />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className={inputCls}>
                <option value="van">Van</option>
                <option value="ambulance">Ambulance</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" label={saving ? 'Saving...' : (editingVehicle ? 'Update' : 'Add')} disabled={saving} size="sm" />
              <Button type="button" label="Cancel" variant="secondary" size="sm" onClick={() => setShowForm(false)} />
            </div>
          </form>
        </div>
      )}

      {vehicles.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Car className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No vehicles added yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <div key={v.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm hover:border-blue-300 transition-colors">
              <button className="flex items-center gap-3 flex-1 text-left" onClick={() => setSelected(v)}>
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Car className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{v.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{v.type}{v.plateNo ? ` • ${v.plateNo}` : ''}</p>
                </div>
              </button>
              <button onClick={() => openEdit(v)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
