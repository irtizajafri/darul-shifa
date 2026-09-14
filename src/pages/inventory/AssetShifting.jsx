import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Search, MapPin, Clock, ChevronRight, X, Filter, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useInventoryStore } from '../../store/useInventoryStore';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDT = (d) =>
  d ? new Date(d).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-PK', { dateStyle: 'medium' }) : '-';

const CONDITIONS = ['working', 'under-maintenance', 'disposed', 'lost'];
const COND_COLOR = {
  working: 'bg-green-100 text-green-700',
  'under-maintenance': 'bg-yellow-100 text-yellow-700',
  disposed: 'bg-red-100 text-red-700',
  lost: 'bg-slate-100 text-slate-500',
};

export default function AssetShifting() {
  const { fetchAssetInstances, shiftAsset, fetchShiftLogs, fetchLocations } = useInventoryStore();

  // ── view toggle ─────────────────────────────────────────────────────────
  const [view, setView] = useState('assets'); // 'assets' | 'history'

  // ── asset list state ─────────────────────────────────────────────────────
  const [instances, setInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [searchAsset, setSearchAsset] = useState('');
  const [filterCondition, setFilterCondition] = useState('');

  // ── shift modal ──────────────────────────────────────────────────────────
  const [shiftTarget, setShiftTarget] = useState(null); // AssetInstance object
  const [shiftForm, setShiftForm] = useState({ toLocation: '', reason: '', shiftedBy: '' });
  const [shifting, setShifting] = useState(false);

  // ── history state ─────────────────────────────────────────────────────────
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState(todayStr());

  // ── locations list for autocomplete ──────────────────────────────────────
  const [locationsList, setLocationsList] = useState([]);

  // ── per-asset history panel ───────────────────────────────────────────────
  const [assetHistoryPanel, setAssetHistoryPanel] = useState(null); // instance object
  const [assetLogs, setAssetLogs] = useState([]);
  const [loadingAssetLogs, setLoadingAssetLogs] = useState(false);

  // ── load all asset instances ─────────────────────────────────────────────
  const loadInstances = useCallback(async () => {
    setLoadingInstances(true);
    try {
      const data = await fetchAssetInstances({});
      // only fixed assets
      const fixed = (data || []).filter((i) => i.item?.itemType === 'fixed asset' || !i.item?.itemType);
      setInstances(fixed);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingInstances(false);
    }
  }, [fetchAssetInstances]);

  useEffect(() => { loadInstances(); }, [loadInstances]);

  // load locations once for autocomplete
  useEffect(() => {
    fetchLocations({}).then((data) => setLocationsList(Array.isArray(data) ? data : [])).catch(() => {});
  }, [fetchLocations]);

  // ── load global history ───────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const data = await fetchShiftLogs({
        search: historySearch,
        dateFrom: historyDateFrom,
        dateTo: historyDateTo,
      });
      setLogs(data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingLogs(false);
    }
  }, [fetchShiftLogs, historySearch, historyDateFrom, historyDateTo]);

  useEffect(() => { if (view === 'history') loadLogs(); }, [view, loadLogs]);

  // ── load per-asset history ────────────────────────────────────────────────
  const openAssetHistory = async (inst) => {
    setAssetHistoryPanel(inst);
    setLoadingAssetLogs(true);
    try {
      const data = await fetchShiftLogs({ assetInstanceId: inst.id });
      setAssetLogs(data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingAssetLogs(false);
    }
  };

  // ── open shift modal ──────────────────────────────────────────────────────
  const openShift = (inst) => {
    setShiftTarget(inst);
    setShiftForm({ toLocation: '', reason: '', shiftedBy: '' });
  };

  // ── submit shift ──────────────────────────────────────────────────────────
  const handleShift = async () => {
    if (!shiftForm.toLocation.trim()) {
      toast.error('New location enter karein');
      return;
    }
    setShifting(true);
    try {
      await shiftAsset(shiftTarget.id, shiftForm);
      toast.success(`${shiftTarget.assetTag} shift ho gaya → ${shiftForm.toLocation}`);
      setShiftTarget(null);
      loadInstances();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setShifting(false);
    }
  };

  // ── filtered assets ───────────────────────────────────────────────────────
  const filteredInstances = instances.filter((i) => {
    const q = searchAsset.toLowerCase();
    const matchSearch = !q || (
      i.assetTag?.toLowerCase().includes(q) ||
      i.item?.name?.toLowerCase().includes(q) ||
      i.location?.toLowerCase().includes(q) ||
      i.serialNumber?.toLowerCase().includes(q)
    );
    const matchCond = !filterCondition || i.condition === filterCondition;
    return matchSearch && matchCond;
  });

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ArrowLeftRight size={20} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Asset Shifting</h1>
            <p className="text-xs text-slate-500 mt-0.5">Fixed assets ko ek location se doosri location pe shift karo</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView('assets')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'assets' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          >
            Assets
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${view === 'history' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}
          >
            <Clock size={14} /> Shifting History
          </button>
        </div>
      </div>

      {/* ════════════════ ASSETS VIEW ════════════════ */}
      {view === 'assets' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
                placeholder="Search by tag, item name, location..."
                value={searchAsset}
                onChange={(e) => setSearchAsset(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
              value={filterCondition}
              onChange={(e) => setFilterCondition(e.target.value)}
            >
              <option value="">All Conditions</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <button
              onClick={loadInstances}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={14} className={loadingInstances ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* Asset Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Asset Tag</th>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-left">Serial No</th>
                    <th className="px-4 py-3 text-left">Current Location</th>
                    <th className="px-4 py-3 text-left">Condition</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingInstances ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">Loading...</td></tr>
                  ) : filteredInstances.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">Koi asset nahi mila</td></tr>
                  ) : filteredInstances.map((inst) => (
                    <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-blue-700">{inst.assetTag}</td>
                      <td className="px-4 py-3 text-slate-800">{inst.item?.name || '-'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{inst.serialNumber || '-'}</td>
                      <td className="px-4 py-3">
                        {inst.location ? (
                          <span className="flex items-center gap-1 text-slate-700">
                            <MapPin size={12} className="text-slate-400" />
                            {inst.location}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COND_COLOR[inst.condition] || 'bg-slate-100 text-slate-500'}`}>
                          {inst.condition}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openShift(inst)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <ArrowLeftRight size={12} /> Shift
                          </button>
                          <button
                            onClick={() => openAssetHistory(inst)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            <Clock size={12} /> History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredInstances.length > 0 && (
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                {filteredInstances.length} assets shown
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════ HISTORY VIEW ════════════════ */}
      {view === 'history' && (
        <>
          {/* History Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
                placeholder="Search by tag, item, location, shifted by..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
            <input type="date" className={`px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500`}
              value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} />
            <input type="date" className={`px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500`}
              value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} />
            <Button onClick={loadLogs} disabled={loadingLogs} size="sm">
              {loadingLogs ? 'Loading...' : 'Search'}
            </Button>
          </div>

          {/* History Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="font-semibold text-slate-700 text-sm">All Shifting Records</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wide bg-slate-50">
                    <th className="px-4 py-3 text-left">Asset Tag</th>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-left">From</th>
                    <th className="px-4 py-3 text-center">→</th>
                    <th className="px-4 py-3 text-left">To</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                    <th className="px-4 py-3 text-left">Shifted By</th>
                    <th className="px-4 py-3 text-left">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingLogs ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Loading...</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Koi shifting record nahi mila</td></tr>
                  ) : logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-semibold text-blue-700">{log.assetTag}</td>
                      <td className="px-4 py-3 text-slate-700">{log.itemName}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-slate-500">
                          <MapPin size={11} />
                          {log.fromLocation || <span className="italic text-xs">Unassigned</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400">→</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-green-700 font-medium">
                          <MapPin size={11} />
                          {log.toLocation}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-32 truncate">{log.reason || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{log.shiftedBy || '-'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDT(log.shiftedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {logs.length > 0 && (
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                {logs.length} records
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════ SHIFT MODAL ════════ */}
      {shiftTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ArrowLeftRight size={18} className="text-blue-600" />
                <h2 className="font-bold text-slate-800">Shift Asset</h2>
              </div>
              <button onClick={() => setShiftTarget(null)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>

            {/* Asset Info */}
            <div className="mx-5 mt-4 bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-mono font-bold text-blue-700 text-sm">{shiftTarget.assetTag}</p>
                  <p className="text-sm text-slate-700 mt-0.5">{shiftTarget.item?.name}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COND_COLOR[shiftTarget.condition] || ''}`}>
                  {shiftTarget.condition}
                </span>
              </div>
              {/* Current Location */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-slate-500">Current Location:</span>
                <span className="flex items-center gap-1 text-sm font-semibold text-slate-700">
                  <MapPin size={12} className="text-red-400" />
                  {shiftTarget.location || <span className="italic text-slate-400 font-normal">Not assigned</span>}
                </span>
              </div>
            </div>

            {/* Form */}
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className={labelCls}>New Location <span className="text-red-500">*</span></label>
                <input
                  className={inputCls}
                  placeholder="e.g. Laboratory, ICU, OPD..."
                  list="locations-list"
                  value={shiftForm.toLocation}
                  onChange={(e) => setShiftForm((f) => ({ ...f, toLocation: e.target.value }))}
                  autoFocus
                />
                <datalist id="locations-list">
                  {locationsList.map((loc) => (
                    <option key={loc.id} value={loc.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className={labelCls}>Reason (optional)</label>
                <input
                  className={inputCls}
                  placeholder="Shifting ki wajah..."
                  value={shiftForm.reason}
                  onChange={(e) => setShiftForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Shifted By (optional)</label>
                <input
                  className={inputCls}
                  placeholder="Naam daalein..."
                  value={shiftForm.shiftedBy}
                  onChange={(e) => setShiftForm((f) => ({ ...f, shiftedBy: e.target.value }))}
                />
              </div>
            </div>

            {/* Arrow indicator */}
            {shiftForm.toLocation.trim() && (
              <div className="mx-5 mb-3 flex items-center gap-3 text-sm bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">
                <span className="text-slate-500">{shiftTarget.location || 'Unassigned'}</span>
                <ChevronRight size={16} className="text-blue-500 shrink-0" />
                <span className="font-semibold text-blue-700">{shiftForm.toLocation}</span>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 px-5 pb-5">
              <button
                onClick={() => setShiftTarget(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <Button onClick={handleShift} disabled={shifting || !shiftForm.toLocation.trim()}>
                {shifting ? 'Shifting...' : 'Confirm Shift'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ PER-ASSET HISTORY PANEL ════════ */}
      {assetHistoryPanel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-slate-500" />
                  <h2 className="font-bold text-slate-800">Shifting History</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-mono font-semibold text-blue-700">{assetHistoryPanel.assetTag}</span>
                  {' — '}{assetHistoryPanel.item?.name}
                </p>
              </div>
              <button onClick={() => setAssetHistoryPanel(null)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                <X size={18} />
              </button>
            </div>

            {/* Timeline */}
            <div className="overflow-y-auto flex-1 px-5 py-4">
              {loadingAssetLogs ? (
                <p className="text-center text-slate-400 py-8">Loading...</p>
              ) : assetLogs.length === 0 ? (
                <div className="text-center py-10">
                  <Clock size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-400 text-sm">Is asset ki koi shifting history nahi hai</p>
                </div>
              ) : (
                <div className="relative">
                  {/* vertical line */}
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
                  <div className="space-y-4">
                    {assetLogs.map((log, idx) => (
                      <div key={log.id} className="relative flex gap-4 pl-10">
                        {/* dot */}
                        <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-blue-500' : 'bg-slate-300'}`} />
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-1 text-xs text-slate-500">
                                <MapPin size={10} />
                                {log.fromLocation || 'Unassigned'}
                              </span>
                              <ChevronRight size={12} className="text-slate-400 shrink-0" />
                              <span className="flex items-center gap-1 text-xs font-semibold text-green-700">
                                <MapPin size={10} />
                                {log.toLocation}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">{fmtDT(log.shiftedAt)}</span>
                          </div>
                          {(log.reason || log.shiftedBy) && (
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                              {log.reason    && <span>Reason: {log.reason}</span>}
                              {log.shiftedBy && <span>By: <strong>{log.shiftedBy}</strong></span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 shrink-0 text-right">
              <button
                onClick={() => setAssetHistoryPanel(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
