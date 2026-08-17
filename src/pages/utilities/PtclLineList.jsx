import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Pencil, Phone, ChevronDown, ChevronRight, Trash2, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useUtilitiesStore } from '../../store/useUtilitiesStore';
import PtclReport from './PtclReport';

const EMPTY_LINE = { meterNo: '', location: '' };
const EMPTY_BILL = { fromDate: '', toDate: '', amount: '', notes: '' };
const fmtNum = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { dateStyle: 'medium' }) : '-';

// PTCL has no meter reading / rate / estimate — just a monthly bill posted
// straight against each phone number. Reuses the same Meter + ActualBill
// backend records as Electricity/Gas, just without ever creating readings.
export default function PtclLineList({ onBack }) {
  const { fetchMeters, createMeter, updateMeter, fetchBills, createBill, deleteBill } = useUtilitiesStore();

  const [lines, setLines] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_LINE);
  const [saving, setSaving] = useState(false);

  const [openLineId, setOpenLineId] = useState(null);
  const [bills, setBills] = useState([]);
  const [showBillForm, setShowBillForm] = useState(false);
  const [billForm, setBillForm] = useState(EMPTY_BILL);
  const [savingBill, setSavingBill] = useState(false);

  const [showReport, setShowReport] = useState(false);

  const load = () => { fetchMeters({ type: 'billing', utility: 'ptcl' }).then(setLines).catch((e) => toast.error(e.message)); };
  useEffect(load, []);

  const openAdd = () => { setForm(EMPTY_LINE); setEditing(null); setShowForm(true); };
  const openEdit = (l) => { setForm({ meterNo: l.meterNo || '', location: l.location || '' }); setEditing(l); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.meterNo.trim()) return toast.error('Phone number is required');
    setSaving(true);
    try {
      if (editing) { await updateMeter(editing.id, form); toast.success('Updated'); }
      else { await createMeter({ type: 'billing', utility: 'ptcl', ...form }); toast.success('Phone number added'); }
      setShowForm(false);
      load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const toggleLine = (lineId) => {
    if (openLineId === lineId) { setOpenLineId(null); return; }
    setOpenLineId(lineId);
    setShowBillForm(false);
    fetchBills(lineId).then(setBills).catch((e) => toast.error(e.message));
  };

  const handleBillSubmit = async (e) => {
    e.preventDefault();
    if (!billForm.fromDate || !billForm.toDate) return toast.error('From aur To date dono required hain');
    const amt = Number(billForm.amount);
    if (!amt || amt <= 0) return toast.error('Valid amount darj karein');
    setSavingBill(true);
    try {
      await createBill({ meterId: openLineId, ...billForm });
      toast.success('Bill posted');
      setShowBillForm(false);
      setBillForm(EMPTY_BILL);
      fetchBills(openLineId).then(setBills);
    } catch (err) { toast.error(err.message); }
    finally { setSavingBill(false); }
  };

  const handleDeleteBill = async (id) => {
    if (!confirm('Delete this bill?')) return;
    try {
      await deleteBill(id);
      toast.success('Deleted');
      fetchBills(openLineId).then(setBills);
    } catch (err) { toast.error(err.message); }
  };

  if (showReport) {
    return <PtclReport lines={lines} onBack={() => setShowReport(false)} />;
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
          <h1 className="text-xl font-bold text-slate-800">PTCL</h1>
          <p className="text-sm text-slate-500">{lines.length} phone number{lines.length === 1 ? '' : 's'}</p>
        </div>
        <Button label="Report" icon={BarChart3} size="sm" variant="outline" onClick={() => setShowReport(true)} disabled={!lines.length} />
        <Button label="Add Phone Number" icon={Plus} size="sm" onClick={openAdd} />
      </div>

      {showForm && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-700 mb-4">{editing ? 'Edit Phone Number' : 'Add Phone Number'}</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className={labelCls}>Phone Number *</label>
              <input value={form.meterNo} onChange={(e) => setForm((p) => ({ ...p, meterNo: e.target.value }))} className={inputCls} placeholder="e.g. 021-1234567" required />
            </div>
            <div>
              <label className={labelCls}>Location / Label</label>
              <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} className={inputCls} placeholder="Optional — e.g. Reception, Admin Office" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" label={saving ? 'Saving...' : (editing ? 'Update' : 'Add')} disabled={saving} size="sm" />
              <Button type="button" label="Cancel" variant="secondary" size="sm" onClick={() => setShowForm(false)} />
            </div>
          </form>
        </div>
      )}

      {lines.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Koi phone number add nahi hua abhi tak</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div onClick={() => toggleLine(l.id)} className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{l.meterNo}</p>
                    <p className="text-xs text-slate-500 truncate">{l.location || 'No location set'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(l); }} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {openLineId === l.id ? <ChevronDown className="w-5 h-5 text-slate-300" /> : <ChevronRight className="w-5 h-5 text-slate-300" />}
                </div>
              </div>

              {openLineId === l.id && (
                <div className="border-t border-slate-100 px-5 py-4">
                  <div className="flex justify-end mb-3">
                    {!showBillForm && <Button label="Post Bill" icon={Plus} size="sm" onClick={() => { setBillForm(EMPTY_BILL); setShowBillForm(true); }} />}
                  </div>

                  {showBillForm && (
                    <form onSubmit={handleBillSubmit} className="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
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
                          <label className={labelCls}>Amount (Rs) *</label>
                          <input type="number" step="0.01" min="0" value={billForm.amount} onChange={(e) => setBillForm((p) => ({ ...p, amount: e.target.value }))} className={inputCls} required />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Notes</label>
                        <textarea rows={2} value={billForm.notes} onChange={(e) => setBillForm((p) => ({ ...p, notes: e.target.value }))} className={`${inputCls} resize-none`} placeholder="Optional..." />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" label={savingBill ? 'Saving...' : 'Post Bill'} disabled={savingBill} size="sm" />
                        <Button type="button" label="Cancel" variant="secondary" size="sm" onClick={() => setShowBillForm(false)} />
                      </div>
                    </form>
                  )}

                  {bills.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-3">Koi bill post nahi hua abhi tak</p>
                  ) : (
                    <div className="space-y-1.5">
                      {bills.map((b) => (
                        <div key={b.id} className="flex items-center justify-between gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2">
                          <span className="text-slate-600">{fmtDate(b.fromDate)} – {fmtDate(b.toDate)}</span>
                          <span className="font-medium text-slate-800">Rs {fmtNum(b.amount)}</span>
                          <button onClick={() => handleDeleteBill(b.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
