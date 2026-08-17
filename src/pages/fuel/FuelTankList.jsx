import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Fuel, Pencil, ArrowRightLeft, Droplet, History, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useFuelStore } from '../../store/useFuelStore';
import FuelTransferModal from './FuelTransferModal';

const EMPTY_TANK = { name: '', capacity: '' };
const EMPTY_STOCK = { date: new Date().toISOString().slice(0, 10), quantity: '', rate: '', supplier: '', notes: '' };
const fmtNum = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FuelTankList({ onBack }) {
  const { tanks, fetchTanks, createTank, updateTank, generators, fetchGenerators, fuelStock, fetchFuelStock, createFuelStock, deleteFuelStock } = useFuelStore();

  const [showTankForm, setShowTankForm] = useState(false);
  const [editingTank, setEditingTank] = useState(null);
  const [tankForm, setTankForm] = useState(EMPTY_TANK);
  const [saving, setSaving] = useState(false);

  const [stockTankId, setStockTankId] = useState(null);
  const [stockForm, setStockForm] = useState(EMPTY_STOCK);
  const [savingStock, setSavingStock] = useState(false);

  const [transferTankId, setTransferTankId] = useState(undefined); // undefined = closed, null = open with no default
  const [historyTankId, setHistoryTankId] = useState(null);

  const load = () => {
    fetchTanks().catch((e) => toast.error(e.message));
    fetchGenerators().catch(() => {});
  };
  useEffect(load, []);

  const openAddTank = () => { setTankForm(EMPTY_TANK); setEditingTank(null); setShowTankForm(true); };
  const openEditTank = (t) => { setTankForm({ name: t.name, capacity: t.capacity != null ? String(t.capacity) : '' }); setEditingTank(t); setShowTankForm(true); };

  const handleTankSubmit = async (e) => {
    e.preventDefault();
    if (!tankForm.name.trim()) return toast.error('Tank name is required');
    setSaving(true);
    try {
      if (editingTank) {
        await updateTank(editingTank.id, tankForm);
        toast.success('Tank updated');
      } else {
        await createTank(tankForm);
        toast.success('Tank added');
      }
      setShowTankForm(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openAddStock = (tankId) => { setStockForm(EMPTY_STOCK); setStockTankId(tankId); };

  const toggleHistory = (tankId) => {
    if (historyTankId === tankId) { setHistoryTankId(null); return; }
    setHistoryTankId(tankId);
    fetchFuelStock(tankId).catch((e) => toast.error(e.message));
  };

  const handleDeleteStock = async (id, tankId) => {
    if (!confirm('Delete this stock entry?')) return;
    try {
      await deleteFuelStock(id);
      toast.success('Stock entry deleted');
      fetchFuelStock(tankId).catch(() => {});
      load();
    } catch (err) { toast.error(err.message); }
  };

  const handleStockSubmit = async (e) => {
    e.preventDefault();
    const qty = Number(stockForm.quantity);
    if (!qty || qty <= 0) return toast.error('Enter a valid quantity');
    setSavingStock(true);
    try {
      await createFuelStock({ ...stockForm, tankId: stockTankId });
      toast.success('Fuel stock added');
      if (historyTankId === stockTankId) fetchFuelStock(stockTankId).catch(() => {});
      setStockTankId(null);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSavingStock(false); }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">Fuel Tanks</h1>
          <p className="text-sm text-slate-500">Stock fuel into a tank, then transfer it to a generator</p>
        </div>
        <Button label="Transfer Fuel" icon={ArrowRightLeft} size="sm" variant="outline" onClick={() => setTransferTankId(null)} disabled={!tanks.length || !generators.length} />
        <Button label="Add Tank" icon={Plus} size="sm" onClick={openAddTank} />
      </div>

      {showTankForm && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">{editingTank ? 'Edit Tank' : 'Add New Tank'}</h3>
          <form onSubmit={handleTankSubmit} className="space-y-3">
            <div>
              <label className={labelCls}>Tank Name *</label>
              <input value={tankForm.name} onChange={(e) => setTankForm((p) => ({ ...p, name: e.target.value }))}
                className={inputCls} placeholder="e.g. Tank 1" required />
            </div>
            <div>
              <label className={labelCls}>Capacity (L)</label>
              <input type="number" step="0.01" min="0" value={tankForm.capacity} onChange={(e) => setTankForm((p) => ({ ...p, capacity: e.target.value }))}
                className={inputCls} placeholder="Optional — used for the fill bar" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" label={saving ? 'Saving...' : (editingTank ? 'Update' : 'Add')} disabled={saving} size="sm" />
              <Button type="button" label="Cancel" variant="secondary" size="sm" onClick={() => setShowTankForm(false)} />
            </div>
          </form>
        </div>
      )}

      {tanks.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Fuel className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tanks added yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tanks.map((t) => {
            const pct = t.capacity ? Math.min(100, Math.max(0, (t.balance / t.capacity) * 100)) : null;
            return (
              <div key={t.id} className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <Fuel className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{t.name}</p>
                      <p className="text-xs text-slate-500">
                        {fmtNum(t.balance)} L {t.capacity ? `/ ${fmtNum(t.capacity)} L` : 'available'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleHistory(t.id)} className={`p-1.5 rounded-md hover:bg-slate-100 ${historyTankId === t.id ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600'}`} title="Stock History">
                      <History className="w-4 h-4" />
                    </button>
                    <button onClick={() => openAddStock(t.id)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600" title="Add Stock">
                      <Droplet className="w-4 h-4" />
                    </button>
                    <button onClick={() => setTransferTankId(t.id)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-amber-600" title="Transfer to Generator" disabled={!generators.length}>
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEditTank(t)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {historyTankId === t.id && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    {fuelStock.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">Koi stock entry nahi hai</p>
                    ) : (
                      <div className="space-y-1.5">
                        {fuelStock.map((s) => (
                          <div key={s.id} className="flex items-center justify-between gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                            <span className="text-slate-500 shrink-0">{new Date(s.date).toLocaleDateString('en-PK', { dateStyle: 'medium' })}</span>
                            <span className="font-medium text-slate-700">{fmtNum(s.quantity)} L</span>
                            <span className="text-slate-400">{s.rate ? `@ ${fmtNum(s.rate)}` : ''}</span>
                            <span className="text-slate-600 flex-1 text-right">{s.amount ? `Rs ${fmtNum(s.amount)}` : ''}</span>
                            <span className="text-slate-400 truncate max-w-[100px]">{s.supplier || ''}</span>
                            <button onClick={() => handleDeleteStock(s.id, t.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {pct != null && (
                  <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}

                {stockTankId === t.id && (
                  <form onSubmit={handleStockSubmit} className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Date</label>
                        <input type="date" value={stockForm.date} onChange={(e) => setStockForm((p) => ({ ...p, date: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Quantity (L) *</label>
                        <input type="number" step="0.01" min="0" value={stockForm.quantity} onChange={(e) => setStockForm((p) => ({ ...p, quantity: e.target.value }))} className={inputCls} required />
                      </div>
                      <div>
                        <label className={labelCls}>Rate</label>
                        <input type="number" step="0.01" min="0" value={stockForm.rate} onChange={(e) => setStockForm((p) => ({ ...p, rate: e.target.value }))} className={inputCls} placeholder="Optional" />
                      </div>
                      <div>
                        <label className={labelCls}>Supplier</label>
                        <input value={stockForm.supplier} onChange={(e) => setStockForm((p) => ({ ...p, supplier: e.target.value }))} className={inputCls} placeholder="Optional" />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Notes</label>
                      <textarea rows={2} value={stockForm.notes} onChange={(e) => setStockForm((p) => ({ ...p, notes: e.target.value }))} className={`${inputCls} resize-none`} placeholder="Optional..." />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" label={savingStock ? 'Saving...' : 'Add Stock'} disabled={savingStock} size="sm" />
                      <Button type="button" label="Cancel" variant="secondary" size="sm" onClick={() => setStockTankId(null)} />
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      {transferTankId !== undefined && (
        <FuelTransferModal
          tanks={tanks}
          generators={generators}
          defaultTankId={transferTankId}
          onClose={() => setTransferTankId(undefined)}
          onDone={load}
        />
      )}
    </div>
  );
}
