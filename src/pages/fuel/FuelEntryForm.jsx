import { useState, useEffect } from 'react';
import Button from '../../components/ui/Button';

const now = () => {
  const d = new Date();
  return d.toISOString().slice(0, 16);
};

const empty = (mode) => ({
  date: now(),
  driverName: '',
  quantity: '',
  rate: '',
  amount: '',
  lastReading: '',
  currentReading: '',
  notes: '',
});

export default function FuelEntryForm({ mode = 'vehicle', entryType, lastEntry, onSubmit, onCancel, editing = null }) {
  const readingLabel = mode === 'vehicle' ? 'KM' : 'Hours';

  const [form, setForm] = useState(() => {
    if (editing) {
      return {
        date: editing.date ? new Date(editing.date).toISOString().slice(0, 16) : now(),
        driverName: editing.driverName || '',
        quantity: editing.quantity ?? '',
        rate: editing.rate ?? '',
        amount: editing.amount ?? '',
        lastReading: mode === 'vehicle' ? (editing.lastKm ?? '') : (editing.lastHours ?? ''),
        currentReading: mode === 'vehicle' ? (editing.currentKm ?? '') : (editing.currentHours ?? ''),
        notes: editing.notes || '',
      };
    }
    return {
      date: now(),
      driverName: '',
      quantity: '',
      rate: '',
      amount: '',
      lastReading: lastEntry
        ? (mode === 'vehicle' ? (lastEntry.currentKm ?? '') : (lastEntry.currentHours ?? ''))
        : '',
      currentReading: '',
      notes: '',
    };
  });

  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Interlinked qty / rate / amount
  const handleNumChange = (field, val) => {
    const updated = { ...form, [field]: val };
    const q = parseFloat(updated.quantity);
    const r = parseFloat(updated.rate);
    const a = parseFloat(updated.amount);

    if (field === 'quantity' && !isNaN(r)) updated.amount = (parseFloat(val) * r).toFixed(2);
    else if (field === 'rate' && !isNaN(q)) updated.amount = (q * parseFloat(val)).toFixed(2);
    else if (field === 'amount') {
      if (!isNaN(q) && q > 0) updated.rate = (parseFloat(val) / q).toFixed(2);
      else if (!isNaN(r) && r > 0) updated.quantity = (parseFloat(val) / r).toFixed(2);
    }
    setForm(updated);
  };

  const netRunning = (() => {
    const l = parseFloat(form.lastReading);
    const c = parseFloat(form.currentReading);
    return !isNaN(l) && !isNaN(c) ? (c - l).toFixed(2) : '-';
  })();

  const avg = (() => {
    const nr = parseFloat(netRunning);
    const q = parseFloat(form.quantity);
    if (isNaN(nr) || isNaN(q) || q === 0 || nr === 0) return '-';
    return mode === 'vehicle'
      ? `${(nr / q).toFixed(2)} km/L`
      : `${(q / nr).toFixed(2)} L/hr`;
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        entryType,
        date: form.date,
        quantity: parseFloat(form.quantity),
        rate: parseFloat(form.rate),
        amount: parseFloat(form.amount),
        notes: form.notes || undefined,
      };
      if (mode === 'vehicle') {
        payload.driverName = form.driverName || undefined;
        payload.lastKm = form.lastReading !== '' ? parseFloat(form.lastReading) : undefined;
        payload.currentKm = form.currentReading !== '' ? parseFloat(form.currentReading) : undefined;
      } else {
        payload.lastHours = form.lastReading !== '' ? parseFloat(form.lastReading) : undefined;
        payload.currentHours = form.currentReading !== '' ? parseFloat(form.currentReading) : undefined;
      }
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Date & Time</label>
          <input type="datetime-local" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputCls} required />
        </div>

        {mode === 'vehicle' && (
          <div className="col-span-2">
            <label className={labelCls}>Driver Name</label>
            <input type="text" value={form.driverName} onChange={(e) => set('driverName', e.target.value)} className={inputCls} placeholder="Optional" />
          </div>
        )}

        <div>
          <label className={labelCls}>Quantity (L)</label>
          <input type="number" step="0.01" min="0" value={form.quantity}
            onChange={(e) => handleNumChange('quantity', e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Rate (Rs/L)</label>
          <input type="number" step="0.01" min="0" value={form.rate}
            onChange={(e) => handleNumChange('rate', e.target.value)} className={inputCls} required />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Amount (Rs)</label>
          <input type="number" step="0.01" min="0" value={form.amount}
            onChange={(e) => handleNumChange('amount', e.target.value)} className={inputCls} required />
        </div>

        <div>
          <label className={labelCls}>Last Refuel Reading ({readingLabel})</label>
          <input type="number" step="0.01" min="0" value={form.lastReading}
            onChange={(e) => set('lastReading', e.target.value)} className={inputCls} placeholder="Auto-filled" />
        </div>
        <div>
          <label className={labelCls}>Current Refuel Reading ({readingLabel})</label>
          <input type="number" step="0.01" min="0" value={form.currentReading}
            onChange={(e) => set('currentReading', e.target.value)} className={inputCls} />
        </div>
      </div>

      {(netRunning !== '-' || avg !== '-') && (
        <div className="flex gap-3">
          <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-slate-500">Net Running</p>
            <p className="font-semibold text-slate-800 text-sm">{netRunning} {readingLabel}</p>
          </div>
          <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
            <p className="text-xs text-blue-500">Average</p>
            <p className="font-semibold text-blue-800 text-sm">{avg}</p>
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>Notes</label>
        <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)}
          className={`${inputCls} resize-none`} placeholder="Optional remarks..." />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" label={submitting ? 'Saving...' : 'Save Entry'} disabled={submitting} />
        <Button type="button" label="Cancel" variant="secondary" onClick={onCancel} />
      </div>
    </form>
  );
}
