import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, PlugZap, Building2, Flame, BarChart3, TrendingUp, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useUtilitiesStore } from '../../store/useUtilitiesStore';
import MeterReport from './MeterReport';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtNum = (n) => (n != null && n !== '') ? Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { dateStyle: 'medium' }) : '-';

const EMPTY_READING = { date: todayStr(), dayStart: '', dayEnd: '', nightStart: '', nightEnd: '', notes: '' };
const EMPTY_RATE = { rate: '', effectiveFrom: todayStr() };
const EMPTY_BILL = { fromDate: '', toDate: '', amount: '', unitsCharges: '', fixedCharges: '', notes: '' };

export default function MeterDetail({ meter, onBack }) {
  const isBilling = meter.type === 'billing';
  const isGas = meter.utility === 'gas';
  const {
    fetchReadings, fetchLastReading, saveReading, deleteReading,
    fetchRates, createRate, deleteRate,
    fetchBills, createBill, deleteBill,
    fetchCurrentEstimate,
  } = useUtilitiesStore();

  const [activeTab, setActiveTab] = useState('readings'); // readings | rates | bills
  const [showReport, setShowReport] = useState(false);

  const [readings, setReadings] = useState([]);
  const [lastReading, setLastReading] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [rates, setRates] = useState([]);
  const [bills, setBills] = useState([]);

  const [showReadingForm, setShowReadingForm] = useState(false);
  const [editingReading, setEditingReading] = useState(null);
  const [readingForm, setReadingForm] = useState(EMPTY_READING);
  const [savingReading, setSavingReading] = useState(false);

  const [showRateForm, setShowRateForm] = useState(false);
  const [rateForm, setRateForm] = useState(EMPTY_RATE);
  const [savingRate, setSavingRate] = useState(false);

  const [showBillForm, setShowBillForm] = useState(false);
  const [billForm, setBillForm] = useState(EMPTY_BILL);
  const [savingBill, setSavingBill] = useState(false);

  const loadReadings = () => {
    fetchReadings({ meterId: meter.id }).then(setReadings).catch((e) => toast.error(e.message));
    fetchLastReading(meter.id).then(setLastReading).catch(() => setLastReading(null));
  };
  const loadEstimate = () => fetchCurrentEstimate(meter.id).then(setEstimate).catch(() => setEstimate(null));
  const loadRates = () => fetchRates(meter.id).then(setRates).catch((e) => toast.error(e.message));
  const loadBills = () => { if (isBilling) fetchBills(meter.id).then(setBills).catch((e) => toast.error(e.message)); };

  useEffect(() => { loadReadings(); loadEstimate(); loadRates(); loadBills(); }, [meter.id]);

  // ── Daily reading ────────────────────────────────────────────────────────
  const openAddReading = () => {
    const auto = lastReading?.nightEnd ?? lastReading?.dayEnd;
    setReadingForm({ ...EMPTY_READING, date: todayStr(), dayStart: auto != null ? String(auto) : '' });
    setEditingReading(null);
    setShowReadingForm(true);
  };

  const openEditReading = (r) => {
    setReadingForm({
      date: r.date.slice(0, 10),
      dayStart: r.dayStart ?? '', dayEnd: r.dayEnd ?? '',
      nightStart: r.nightStart ?? '', nightEnd: r.nightEnd ?? '',
      notes: r.notes || '',
    });
    setEditingReading(r);
    setShowReadingForm(true);
  };

  const rf = (k, v) => setReadingForm((p) => {
    const next = { ...p, [k]: v };
    // Night usually starts right where the Day shift ended — auto-carry unless user has typed something else.
    if (k === 'dayEnd' && (p.nightStart === '' || p.nightStart === p.dayEnd)) {
      next.nightStart = v;
    }
    return next;
  });

  const handleReadingSubmit = async (e) => {
    e.preventDefault();
    setSavingReading(true);
    try {
      await saveReading({ meterId: meter.id, ...readingForm });
      toast.success('Reading saved');
      setShowReadingForm(false);
      setEditingReading(null);
      loadReadings();
      loadEstimate();
    } catch (err) { toast.error(err.message); }
    finally { setSavingReading(false); }
  };

  const handleDeleteReading = async (id) => {
    if (!confirm('Delete this reading?')) return;
    try {
      await deleteReading(id);
      toast.success('Deleted');
      loadReadings();
      loadEstimate();
    } catch (err) { toast.error(err.message); }
  };

  const previewDayUnits = (readingForm.dayStart !== '' && readingForm.dayEnd !== '')
    ? Math.max(0, parseFloat(readingForm.dayEnd) - parseFloat(readingForm.dayStart)) : null;
  const previewNightUnits = (readingForm.nightStart !== '' && readingForm.nightEnd !== '')
    ? Math.max(0, parseFloat(readingForm.nightEnd) - parseFloat(readingForm.nightStart)) : null;
  const previewTotal = (previewDayUnits != null || previewNightUnits != null) ? (previewDayUnits || 0) + (previewNightUnits || 0) : null;

  // ── Rate history ─────────────────────────────────────────────────────────
  const handleRateSubmit = async (e) => {
    e.preventDefault();
    const rt = Number(rateForm.rate);
    if (!rt || rt <= 0) return toast.error('Valid rate darj karein');
    setSavingRate(true);
    try {
      await createRate(meter.id, rateForm);
      toast.success('Rate added');
      setShowRateForm(false);
      loadRates();
      loadEstimate();
    } catch (err) { toast.error(err.message); }
    finally { setSavingRate(false); }
  };

  const handleDeleteRate = async (id) => {
    if (!confirm('Delete this rate entry?')) return;
    try {
      await deleteRate(id);
      toast.success('Deleted');
      loadRates();
      loadEstimate();
    } catch (err) { toast.error(err.message); }
  };

  // ── Actual bills ─────────────────────────────────────────────────────────
  const handleBillSubmit = async (e) => {
    e.preventDefault();
    if (!billForm.fromDate || !billForm.toDate) return toast.error('From aur To date dono required hain');
    const amt = Number(billForm.amount);
    if (!amt || amt <= 0) return toast.error('Valid amount darj karein');
    setSavingBill(true);
    try {
      await createBill({ meterId: meter.id, ...billForm });
      toast.success('Actual bill posted');
      setShowBillForm(false);
      setBillForm(EMPTY_BILL);
      loadBills();
      loadEstimate();
    } catch (err) { toast.error(err.message); }
    finally { setSavingBill(false); }
  };

  const handleDeleteBill = async (id) => {
    if (!confirm('Delete this bill?')) return;
    try {
      await deleteBill(id);
      toast.success('Deleted');
      loadBills();
      loadEstimate();
    } catch (err) { toast.error(err.message); }
  };

  if (showReport) {
    return <MeterReport meter={meter} onBack={() => setShowReport(false)} />;
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';
  const Icon = isGas ? Flame : (isBilling ? PlugZap : Building2);

  const tabs = isBilling ? ['readings', 'rates', 'bills'] : ['readings', 'rates'];
  const tabLabel = { readings: 'Daily Readings', rates: 'Rate History', bills: 'Actual Bills' };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Icon className="w-5 h-5 text-slate-400" />
            {isBilling ? meter.meterNo : meter.departmentName}
          </h1>
          <p className="text-sm text-slate-500">
            {meter.location || (isGas ? 'Gas Meter' : (isBilling ? 'Billing Meter' : 'Department Meter'))}
          </p>
        </div>
        <Button label="Report" icon={BarChart3} size="sm" variant="outline" onClick={() => setShowReport(true)} />
      </div>

      {/* Running estimate */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 flex items-center gap-4 mb-5">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            {estimate?.sinceDate ? `Last Actual Bill ke baad ka andaza` : 'Ab tak ka andaza (koi actual bill posted nahi)'}
          </p>
          <p className="text-2xl font-bold text-emerald-700 leading-tight">Rs {fmtNum(estimate?.estimatedAmount)}</p>
          <p className="text-xs text-emerald-600 mt-0.5">
            {fmtNum(estimate?.totalUnits)} units {estimate?.sinceDate ? `since ${fmtDate(estimate.sinceDate)}` : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-5 w-fit">
        {tabs.map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === t ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {/* Readings tab */}
      {activeTab === 'readings' && (
        <>
          <div className="flex justify-end mb-3">
            {!showReadingForm && <Button label="Add Reading" icon={Plus} size="sm" onClick={openAddReading} />}
          </div>

          {showReadingForm && (
            <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-700 mb-4">{editingReading ? 'Edit Reading' : 'Add Daily Reading'}</h3>
              <form onSubmit={handleReadingSubmit} className="space-y-4">
                <div>
                  <label className={labelCls}>Date</label>
                  <input type="date" value={readingForm.date} onChange={(e) => rf('date', e.target.value)} className={inputCls} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-blue-600 uppercase">Day</p>
                    <div>
                      <label className={labelCls}>Start</label>
                      <input type="number" step="0.01" min="0" value={readingForm.dayStart} onChange={(e) => rf('dayStart', e.target.value)} className={inputCls} placeholder="Auto-filled" />
                    </div>
                    <div>
                      <label className={labelCls}>End</label>
                      <input type="number" step="0.01" min="0" value={readingForm.dayEnd} onChange={(e) => rf('dayEnd', e.target.value)} className={inputCls} />
                    </div>
                    {previewDayUnits != null && <p className="text-xs text-blue-600 font-medium">{fmtNum(previewDayUnits)} units</p>}
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-indigo-600 uppercase">Night</p>
                    <div>
                      <label className={labelCls}>Start</label>
                      <input type="number" step="0.01" min="0" value={readingForm.nightStart} onChange={(e) => rf('nightStart', e.target.value)} className={inputCls} placeholder="Auto = Day End" />
                    </div>
                    <div>
                      <label className={labelCls}>End</label>
                      <input type="number" step="0.01" min="0" value={readingForm.nightEnd} onChange={(e) => rf('nightEnd', e.target.value)} className={inputCls} />
                    </div>
                    {previewNightUnits != null && <p className="text-xs text-indigo-600 font-medium">{fmtNum(previewNightUnits)} units</p>}
                  </div>
                </div>
                {previewTotal != null && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-center">
                    <p className="text-xs text-amber-600">Total Units</p>
                    <p className="font-bold text-amber-800">{fmtNum(previewTotal)}</p>
                  </div>
                )}
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea rows={2} value={readingForm.notes} onChange={(e) => rf('notes', e.target.value)} className={`${inputCls} resize-none`} placeholder="Optional..." />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" label={savingReading ? 'Saving...' : 'Save Reading'} disabled={savingReading} />
                  <Button type="button" label="Cancel" variant="secondary" onClick={() => { setShowReadingForm(false); setEditingReading(null); }} />
                </div>
              </form>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Day Start</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Day End</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Night Start</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Night End</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total Units</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {readings.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">Koi reading nahi hai abhi tak</td></tr>
                  ) : readings.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(r.dayStart)}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(r.dayEnd)}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(r.nightStart)}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(r.nightEnd)}</td>
                      <td className="px-4 py-3 text-right font-medium text-amber-700">{fmtNum(r.totalUnits)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEditReading(r)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteReading(r.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Rate history tab */}
      {activeTab === 'rates' && (
        <>
          <div className="flex justify-end mb-3">
            {!showRateForm && <Button label="Add Rate" icon={Plus} size="sm" onClick={() => { setRateForm(EMPTY_RATE); setShowRateForm(true); }} />}
          </div>

          {showRateForm && (
            <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-700 mb-4">Add Rate</h3>
              <form onSubmit={handleRateSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Rate (Rs/Unit) *</label>
                    <input type="number" step="0.01" min="0" value={rateForm.rate} onChange={(e) => setRateForm((p) => ({ ...p, rate: e.target.value }))} className={inputCls} required />
                  </div>
                  <div>
                    <label className={labelCls}>Effective From *</label>
                    <input type="date" value={rateForm.effectiveFrom} onChange={(e) => setRateForm((p) => ({ ...p, effectiveFrom: e.target.value }))} className={inputCls} required />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" label={savingRate ? 'Saving...' : 'Add'} disabled={savingRate} size="sm" />
                  <Button type="button" label="Cancel" variant="secondary" size="sm" onClick={() => setShowRateForm(false)} />
                </div>
              </form>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Effective From</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Rate (Rs/Unit)</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rates.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-10 text-slate-400 text-sm">Koi rate add nahi hui abhi tak</td></tr>
                  ) : rates.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{fmtDate(r.effectiveFrom)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{fmtNum(r.rate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button onClick={() => handleDeleteRate(r.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Actual bills tab (billing meters only) */}
      {activeTab === 'bills' && isBilling && (
        <>
          <div className="flex justify-end mb-3">
            {!showBillForm && <Button label="Post Actual Bill" icon={Receipt} size="sm" onClick={() => { setBillForm(EMPTY_BILL); setShowBillForm(true); }} />}
          </div>

          {showBillForm && (
            <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-700 mb-4">Post Actual Bill</h3>
              <form onSubmit={handleBillSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>From Date *</label>
                    <input type="date" value={billForm.fromDate} onChange={(e) => setBillForm((p) => ({ ...p, fromDate: e.target.value }))} className={inputCls} required />
                  </div>
                  <div>
                    <label className={labelCls}>To Date *</label>
                    <input type="date" value={billForm.toDate} onChange={(e) => setBillForm((p) => ({ ...p, toDate: e.target.value }))} className={inputCls} required />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Total Amount (Rs) *</label>
                    <input type="number" step="0.01" min="0" value={billForm.amount} onChange={(e) => setBillForm((p) => ({ ...p, amount: e.target.value }))} className={inputCls} required />
                  </div>
                  <div>
                    <label className={labelCls}>Units Charges</label>
                    <input type="number" step="0.01" min="0" value={billForm.unitsCharges} onChange={(e) => setBillForm((p) => ({ ...p, unitsCharges: e.target.value }))} className={inputCls} placeholder="Optional" />
                  </div>
                  <div>
                    <label className={labelCls}>Fixed / Tax Charges</label>
                    <input type="number" step="0.01" min="0" value={billForm.fixedCharges} onChange={(e) => setBillForm((p) => ({ ...p, fixedCharges: e.target.value }))} className={inputCls} placeholder="Optional" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea rows={2} value={billForm.notes} onChange={(e) => setBillForm((p) => ({ ...p, notes: e.target.value }))} className={`${inputCls} resize-none`} placeholder="Optional..." />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" label={savingBill ? 'Saving...' : 'Post Bill'} disabled={savingBill} />
                  <Button type="button" label="Cancel" variant="secondary" onClick={() => setShowBillForm(false)} />
                </div>
              </form>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Period</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Units Charges</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Fixed/Tax</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total Amount</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bills.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-slate-400 text-sm">Koi actual bill post nahi hua abhi tak</td></tr>
                  ) : bills.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fmtDate(b.fromDate)} – {fmtDate(b.toDate)}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(b.unitsCharges)}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(b.fixedCharges)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{fmtNum(b.amount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button onClick={() => handleDeleteBill(b.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">Estimated vs Actual comparison ke liye "Report" button use karein aur usi period ki From/To date select karein.</p>
        </>
      )}
    </div>
  );
}
