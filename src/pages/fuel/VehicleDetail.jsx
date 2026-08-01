import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useFuelStore } from '../../store/useFuelStore';
import FuelEntryForm from './FuelEntryForm';
import FuelBalanceCard from './FuelBalanceCard';

const TABS = ['Fuel', 'Oil'];

export default function VehicleDetail({ vehicle, onBack }) {
  const { vehicleEntries, fetchVehicleEntries, fetchLastVehicleEntry, createVehicleEntry, updateVehicleEntry, deleteVehicleEntry,
    fuelBalance, fetchFuelBalance } = useFuelStore();
  const [activeTab, setActiveTab] = useState('Fuel');
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [lastEntry, setLastEntry] = useState(null);

  const entryType = activeTab.toLowerCase();

  useEffect(() => {
    fetchVehicleEntries({ vehicleId: vehicle.id, entryType }).catch((e) => toast.error(e.message));
    fetchLastVehicleEntry({ vehicleId: vehicle.id, entryType }).then(setLastEntry).catch(() => setLastEntry(null));
  }, [vehicle.id, entryType]);

  useEffect(() => {
    fetchFuelBalance();
  }, []);

  const openAdd = () => { setEditingEntry(null); setShowForm(true); };
  const openEdit = (entry) => { setEditingEntry(entry); setShowForm(true); };

  const handleSubmit = async (payload) => {
    try {
      if (editingEntry) {
        await updateVehicleEntry(editingEntry.id, payload);
        toast.success('Entry updated');
      } else {
        await createVehicleEntry({ ...payload, vehicleId: vehicle.id });
        toast.success('Entry saved');
      }
      setShowForm(false);
      fetchVehicleEntries({ vehicleId: vehicle.id, entryType });
      fetchLastVehicleEntry({ vehicleId: vehicle.id, entryType }).then(setLastEntry).catch(() => {});
      fetchFuelBalance();
    } catch (err) { toast.error(err.message); throw err; }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await deleteVehicleEntry(id);
      toast.success('Deleted');
      fetchFuelBalance();
    } catch (err) { toast.error(err.message); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const fmtNum = (n) => (n != null && n !== '') ? Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{vehicle.name}</h1>
          <p className="text-sm text-slate-500 capitalize">{vehicle.type}{vehicle.plateNo ? ` • ${vehicle.plateNo}` : ''}</p>
        </div>
        {!showForm && <Button label={`Add ${activeTab}`} icon={Plus} size="sm" onClick={openAdd} />}
      </div>

      <FuelBalanceCard balance={fuelBalance} />

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-5 w-fit">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => { setActiveTab(tab); setShowForm(false); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {tab}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">{editingEntry ? `Edit ${activeTab} Entry` : `Add ${activeTab} Entry`}</h3>
          <FuelEntryForm
            mode="vehicle"
            entryType={entryType}
            lastEntry={editingEntry ? null : lastEntry}
            editing={editingEntry}
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Driver</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Qty (L)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Rate</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Last KM</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Current KM</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Net KM</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Avg</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vehicleEntries.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-slate-400 text-sm">No {activeTab.toLowerCase()} entries yet</td></tr>
              ) : vehicleEntries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 text-slate-600">{e.driverName || '-'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtNum(e.quantity)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtNum(e.rate)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{fmtNum(e.amount)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmtNum(e.lastKm)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{fmtNum(e.currentKm)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{fmtNum(e.netRunning)}</td>
                  <td className="px-4 py-3 text-right text-blue-700 font-medium">
                    {e.avgPerLiter != null ? `${fmtNum(e.avgPerLiter)} km/L` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(e)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(e.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
