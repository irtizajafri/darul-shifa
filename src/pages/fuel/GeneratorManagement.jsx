import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useFuelStore } from '../../store/useFuelStore';
import FuelEntryForm from './FuelEntryForm';
import FuelBalanceCard from './FuelBalanceCard';
import FuelTransferModal from './FuelTransferModal';

const TABS = ['Fuel', 'Oil', 'Daily Sheets'];

const nowDatetime = () => new Date().toISOString().slice(0, 16);
const nowDate = () => new Date().toISOString().slice(0, 10);

const EMPTY_SHEET = {
  date: nowDate(),
  timeStart: '',
  timeClose: '',
  fuelGaugeOn: '',
  fuelConsumed: '',
  fuelGaugeOff: '',
  hourlyFuelAssumption: '',
  lastReading: '',
  currentReading: '',
  notes: '',
};

export default function GeneratorManagement({ generator, onBack }) {
  const {
    generatorEntries, fetchGeneratorEntries, fetchLastGeneratorEntry, createGeneratorEntry, updateGeneratorEntry, deleteGeneratorEntry,
    dailySheets, fetchDailySheets, fetchLastDailySheet, createDailySheet, updateDailySheet, deleteDailySheet,
    fuelBalance, fetchFuelBalance,
    tanks, fetchTanks, deleteTransfer,
  } = useFuelStore();
  const gid = generator?.id;

  const [activeTab, setActiveTab] = useState('Fuel');
  const [showForm, setShowForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [lastEntry, setLastEntry] = useState(null);
  const [sheetForm, setSheetForm] = useState(EMPTY_SHEET);
  const [editingSheet, setEditingSheet] = useState(null);
  const [saving, setSaving] = useState(false);

  const entryType = activeTab.toLowerCase();

  useEffect(() => {
    fetchFuelBalance();
    fetchTanks().catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === 'Daily Sheets') {
      fetchDailySheets(gid).catch((e) => toast.error(e.message));
    } else {
      fetchGeneratorEntries({ generatorId: gid, entryType }).catch((e) => toast.error(e.message));
      fetchLastGeneratorEntry({ generatorId: gid, entryType }).then(setLastEntry).catch(() => setLastEntry(null));
    }
    setShowForm(false);
    setEditingEntry(null);
    setEditingSheet(null);
  }, [activeTab, gid]);

  const handleEntrySubmit = async (payload) => {
    try {
      if (editingEntry) {
        await updateGeneratorEntry(editingEntry.id, payload);
        toast.success('Entry updated');
      } else {
        await createGeneratorEntry({ ...payload, generatorId: gid });
        toast.success('Entry saved');
      }
      setShowForm(false);
      fetchGeneratorEntries({ generatorId: gid, entryType });
      fetchLastGeneratorEntry({ generatorId: gid, entryType }).then(setLastEntry).catch(() => {});
      fetchFuelBalance();
    } catch (err) { toast.error(err.message); throw err; }
  };

  const handleDeleteEntry = async (id) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await deleteGeneratorEntry(id);
      toast.success('Deleted');
      fetchGeneratorEntries({ generatorId: gid, entryType });
      fetchFuelBalance();
    } catch (err) { toast.error(err.message); }
  };

  // Fuel-tab entries are created via Transfer — deleting one undoes the whole
  // transfer (frees the fuel back into the tank) rather than just the entry.
  const handleDeleteTransfer = async (transferId) => {
    if (!confirm('Delete this transfer? Fuel will be returned to the tank.')) return;
    try {
      await deleteTransfer(transferId);
      toast.success('Transfer deleted');
      fetchGeneratorEntries({ generatorId: gid, entryType });
      fetchFuelBalance();
      fetchTanks().catch(() => {});
    } catch (err) { toast.error(err.message); }
  };

  // Daily sheet submit
  const handleSheetSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { fuelConsumed, ...payload } = sheetForm;
    try {
      if (editingSheet) {
        await updateDailySheet(editingSheet.id, payload);
        toast.success('Sheet updated');
      } else {
        await createDailySheet({ ...payload, generatorId: gid });
        toast.success('Sheet saved');
      }
      setShowForm(false);
      setEditingSheet(null);
      fetchDailySheets(gid);
      fetchFuelBalance();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const openAddSheet = async () => {
    const last = await fetchLastDailySheet(gid).catch(() => null);
    // Prefer last sheet's remaining fuel; if unavailable, use total generator fuel balance
    const gaugeOn = last?.fuelGaugeOff != null
      ? String(last.fuelGaugeOff)
      : fuelBalance?.totalGenerator != null ? String(fuelBalance.totalGenerator) : '';
    setSheetForm({
      ...EMPTY_SHEET,
      date: nowDate(),
      lastReading: last?.currentReading ?? '',
      fuelGaugeOn: gaugeOn,
    });
    setEditingSheet(null);
    setShowForm(true);
  };

  const openEditSheet = (s) => {
    const on = s.fuelGaugeOn != null ? String(s.fuelGaugeOn) : '';
    const off = s.fuelGaugeOff != null ? String(s.fuelGaugeOff) : '';
    const consumed = (on !== '' && off !== '')
      ? String(Math.max(0, parseFloat(on) - parseFloat(off)))
      : '';
    setSheetForm({
      date: s.date ? new Date(s.date).toISOString().slice(0, 10) : nowDate(),
      timeStart: s.timeStart || '', timeClose: s.timeClose || '',
      fuelGaugeOn: on, fuelConsumed: consumed, fuelGaugeOff: off,
      hourlyFuelAssumption: s.hourlyFuelAssumption != null ? String(s.hourlyFuelAssumption) : '',
      lastReading: s.lastReading != null ? String(s.lastReading) : '',
      currentReading: s.currentReading != null ? String(s.currentReading) : '',
      notes: s.notes || '',
    });
    setEditingSheet(s);
    setShowForm(true);
  };

  const handleDeleteSheet = async (id) => {
    if (!confirm('Delete this sheet?')) return;
    try {
      await deleteDailySheet(id);
      toast.success('Deleted');
      fetchDailySheets(gid);
      fetchFuelBalance();
    } catch (err) { toast.error(err.message); }
  };

  const sf = (k, v) => setSheetForm((p) => {
    const next = { ...p, [k]: v };
    if (k === 'fuelConsumed' || k === 'fuelGaugeOn') {
      const on = parseFloat(k === 'fuelGaugeOn' ? v : next.fuelGaugeOn);
      const consumed = parseFloat(k === 'fuelConsumed' ? v : next.fuelConsumed);
      if (!isNaN(on) && !isNaN(consumed)) {
        next.fuelGaugeOff = String(Math.max(0, on - consumed));
      } else {
        next.fuelGaugeOff = '';
      }
    }
    return next;
  });

  const sheetNetRunning = (() => {
    const l = parseFloat(sheetForm.lastReading); const c = parseFloat(sheetForm.currentReading);
    return (!isNaN(l) && !isNaN(c)) ? (c - l).toFixed(2) : null;
  })();

  const fmtDate = (d) => d ? new Date(d).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const fmtDateOnly = (d) => d ? new Date(d).toLocaleDateString('en-PK', { dateStyle: 'medium' }) : '-';
  const fmtNum = (n) => (n != null && n !== '') ? Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800">{generator?.name ?? 'Generator'}</h1>
          <p className="text-sm text-slate-500">
            {[generator?.modelNo, generator?.serialNo, generator?.location].filter(Boolean).join(' • ') || 'Fuel, oil and daily operation sheets'}
          </p>
        </div>
        {!showForm && (
          <Button
            label={activeTab === 'Daily Sheets' ? 'Add Sheet' : activeTab === 'Fuel' ? 'Transfer Fuel' : `Add ${activeTab}`}
            icon={Plus} size="sm"
            disabled={activeTab === 'Fuel' && !tanks.length}
            onClick={() => {
              if (activeTab === 'Daily Sheets') { openAddSheet(); }
              else if (activeTab === 'Fuel') { setShowTransfer(true); }
              else { setEditingEntry(null); setShowForm(true); }
            }}
          />
        )}
      </div>

      <FuelBalanceCard balance={fuelBalance} />

      {activeTab === 'Fuel' && !tanks.length && (
        <p className="text-xs text-amber-600 -mt-3 mb-4">Koi Fuel Tank nahi mila — pehle "Fuel Tanks" section mein ek tank banayein.</p>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-5 w-fit">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Fuel / Oil form */}
      {showForm && activeTab !== 'Daily Sheets' && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">{editingEntry ? `Edit ${activeTab} Entry` : `Add ${activeTab} Entry`}</h3>
          <FuelEntryForm
            mode="generator"
            entryType={entryType}
            lastEntry={editingEntry ? null : lastEntry}
            editing={editingEntry}
            onSubmit={handleEntrySubmit}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Daily sheet form */}
      {showForm && activeTab === 'Daily Sheets' && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">{editingSheet ? 'Edit Daily Sheet' : 'Add Daily Sheet'}</h3>
          <form onSubmit={handleSheetSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelCls}>Date</label>
                <input type="date" value={sheetForm.date} onChange={(e) => sf('date', e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Time Start (Generator ON)</label>
                <input type="time" value={sheetForm.timeStart} onChange={(e) => sf('timeStart', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Time Close (Generator OFF)</label>
                <input type="time" value={sheetForm.timeClose} onChange={(e) => sf('timeClose', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fuel Gauge ON (L) — Current Fuel</label>
                <input type="number" step="0.01" min="0" value={sheetForm.fuelGaugeOn} onChange={(e) => sf('fuelGaugeOn', e.target.value)} className={inputCls} placeholder="Auto-filled from last sheet" />
              </div>
              <div>
                <label className={labelCls}>Fuel Used Today (L)</label>
                <input type="number" step="0.01" min="0" value={sheetForm.fuelConsumed} onChange={(e) => sf('fuelConsumed', e.target.value)} className={inputCls} placeholder="Liters consumed" />
              </div>
              {sheetForm.fuelGaugeOff !== '' && (
                <div className="col-span-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center justify-between">
                    <span className="text-xs text-blue-600 font-medium">Remaining Fuel (Gauge OFF)</span>
                    <span className="text-lg font-bold text-blue-700">{parseFloat(sheetForm.fuelGaugeOff).toFixed(2)} L</span>
                  </div>
                </div>
              )}
              <div>
                <label className={labelCls}>1 Hour Fuel Assumption (L)</label>
                <input type="number" step="0.01" min="0" value={sheetForm.hourlyFuelAssumption} onChange={(e) => sf('hourlyFuelAssumption', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Last Reading (Hours)</label>
                <input type="number" step="0.01" min="0" value={sheetForm.lastReading} onChange={(e) => sf('lastReading', e.target.value)} className={inputCls} placeholder="Auto-filled" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className={labelCls}>Current Reading (Hours)</label>
                <input type="number" step="0.01" min="0" value={sheetForm.currentReading} onChange={(e) => sf('currentReading', e.target.value)} className={inputCls} />
              </div>
            </div>

            {sheetNetRunning !== null && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-center">
                <p className="text-xs text-amber-600">Net Running Hours</p>
                <p className="font-bold text-amber-800">{sheetNetRunning} hrs</p>
              </div>
            )}

            <div>
              <label className={labelCls}>Notes</label>
              <textarea rows={2} value={sheetForm.notes} onChange={(e) => sf('notes', e.target.value)} className={`${inputCls} resize-none`} placeholder="Optional..." />
            </div>
            <div className="flex gap-2">
              <Button type="submit" label={saving ? 'Saving...' : 'Save Sheet'} disabled={saving} />
              <Button type="button" label="Cancel" variant="secondary" onClick={() => { setShowForm(false); setEditingSheet(null); }} />
            </div>
          </form>
        </div>
      )}

      {/* Fuel / Oil table */}
      {activeTab !== 'Daily Sheets' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Qty (L)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Rate</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Last Hrs</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Current Hrs</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Net Hrs</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Avg</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {generatorEntries.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-slate-400 text-sm">No {activeTab.toLowerCase()} entries yet</td></tr>
                ) : generatorEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3 text-right">{fmtNum(e.quantity)}</td>
                    <td className="px-4 py-3 text-right">{fmtNum(e.rate)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{fmtNum(e.amount)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{fmtNum(e.lastHours)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{fmtNum(e.currentHours)}</td>
                    <td className="px-4 py-3 text-right">{fmtNum(e.netRunning)}</td>
                    <td className="px-4 py-3 text-right text-amber-700 font-medium">
                      {e.avgPerHour != null ? `${fmtNum(e.avgPerHour)} L/hr` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {activeTab === 'Oil' ? (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => { setEditingEntry(e); setShowForm(true); }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteEntry(e.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : e.transfer ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[11px] text-slate-400">via Transfer</span>
                          <button onClick={() => handleDeleteTransfer(e.transfer.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete transfer (returns fuel to tank)"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <span className="block text-right text-[11px] text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily sheets table */}
      {activeTab === 'Daily Sheets' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Start</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Close</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Gauge ON (L)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Gauge OFF (L)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">L/hr Assumed</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Last Hrs</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Current Hrs</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Net Hrs</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailySheets.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-10 text-slate-400 text-sm">No daily sheets yet</td></tr>
                ) : dailySheets.map((s) => {
                  const net = (s.lastReading != null && s.currentReading != null) ? (s.currentReading - s.lastReading).toFixed(2) : '-';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{fmtDateOnly(s.date)}</td>
                      <td className="px-4 py-3 text-slate-600">{s.timeStart || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{s.timeClose || '-'}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(s.fuelGaugeOn)}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(s.fuelGaugeOff)}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(s.hourlyFuelAssumption)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{fmtNum(s.lastReading)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{fmtNum(s.currentReading)}</td>
                      <td className="px-4 py-3 text-right font-medium text-amber-700">{net}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEditSheet(s)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteSheet(s.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showTransfer && (
        <FuelTransferModal
          tanks={tanks}
          generators={[generator]}
          defaultGeneratorId={gid}
          onClose={() => setShowTransfer(false)}
          onDone={() => {
            fetchGeneratorEntries({ generatorId: gid, entryType: 'fuel' });
            fetchLastGeneratorEntry({ generatorId: gid, entryType: 'fuel' }).then(setLastEntry).catch(() => {});
            fetchFuelBalance();
            fetchTanks().catch(() => {});
          }}
        />
      )}
    </div>
  );
}
