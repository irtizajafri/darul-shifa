import { useState } from 'react';
import { X, Fuel, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useFuelStore } from '../../store/useFuelStore';

const fmtNum = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function FlowDiagram({ fromTank, toTank, phase, quantity }) {
  return (
    <div className="flex items-center justify-center gap-4 py-5">
      <div className="flex flex-col items-center gap-2 w-20">
        <div className="w-14 h-14 rounded-xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center">
          <Fuel className="w-7 h-7 text-blue-600" />
        </div>
        <span className="text-xs font-medium text-slate-600 text-center truncate w-full text-center">{fromTank?.name || 'From'}</span>
      </div>

      <div className="flex flex-col items-center gap-1 w-20 shrink-0">
        <div className="relative w-full h-5">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 rounded-full" />
          {phase === 'transferring' && [0, 0.35, 0.7].map((delay) => (
            <span key={delay} className="absolute top-1/2 left-0 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-indigo-500 animate-fuel-flow" style={{ animationDelay: `${delay}s` }} />
          ))}
          {phase === 'done' && <ArrowRight className="absolute inset-0 m-auto w-5 h-5 text-emerald-500" />}
          {phase === 'error' && <AlertCircle className="absolute inset-0 m-auto w-5 h-5 text-red-500" />}
        </div>
        {quantity && phase !== 'form' && (
          <span className="text-[11px] font-semibold text-slate-400">{fmtNum(quantity)} L</span>
        )}
      </div>

      <div className="flex flex-col items-center gap-2 w-20">
        <div className="w-14 h-14 rounded-xl bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center">
          <Fuel className="w-7 h-7 text-indigo-600" />
        </div>
        <span className="text-xs font-medium text-slate-600 text-center truncate w-full text-center">{toTank?.name || 'To'}</span>
      </div>
    </div>
  );
}

export default function TankToTankModal({ tanks, defaultFromTankId, onClose, onDone }) {
  const { createTankTransfer } = useFuelStore();

  const [fromTankId, setFromTankId] = useState(defaultFromTankId ? String(defaultFromTankId) : '');
  const [toTankId,   setToTankId]   = useState('');
  const [quantity,   setQuantity]   = useState('');
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [notes,      setNotes]      = useState('');
  const [phase, setPhase]           = useState('form'); // form | transferring | done | error
  const [errorMsg, setErrorMsg]     = useState('');

  const fromTank = tanks.find((t) => String(t.id) === fromTankId);
  const toTank   = tanks.find((t) => String(t.id) === toTankId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fromTankId)   return toast.error('Source tank select karein');
    if (!toTankId)     return toast.error('Destination tank select karein');
    if (fromTankId === toTankId) return toast.error('Source aur destination alag honi chahiye');
    const qty = Number(quantity);
    if (!qty || qty <= 0) return toast.error('Valid quantity enter karein');
    if (fromTank && qty > fromTank.balance) return toast.error(`Tank mein sirf ${fmtNum(fromTank.balance)} L available hai`);

    setPhase('transferring');
    const minDelay = new Promise((res) => setTimeout(res, 1200));
    try {
      await Promise.all([
        createTankTransfer({
          fromTankId: Number(fromTankId),
          toTankId:   Number(toTankId),
          quantity:   qty,
          date,
          notes,
        }),
        minDelay,
      ]);
      setPhase('done');
      onDone?.();
      setTimeout(onClose, 1100);
    } catch (err) {
      await minDelay;
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-indigo-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';
  const locked   = phase === 'transferring' || phase === 'done';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={locked ? undefined : onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Tank → Tank Transfer</h3>
          {!locked && (
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {phase !== 'form' && (
          <div className="px-5 pt-3">
            <FlowDiagram fromTank={fromTank} toTank={toTank} phase={phase} quantity={quantity} />
            <p className="text-center text-sm font-medium -mt-1 mb-1">
              {phase === 'transferring' && <span className="text-indigo-600">Transferring…</span>}
              {phase === 'done'         && <span className="text-emerald-600 flex items-center justify-center gap-1"><CheckCircle2 className="w-4 h-4" /> Transfer complete</span>}
              {phase === 'error'        && <span className="text-red-600">{errorMsg}</span>}
            </p>
          </div>
        )}

        {phase === 'form' && (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <div>
              <label className={labelCls}>From Tank (Source) *</label>
              <select value={fromTankId} onChange={(e) => setFromTankId(e.target.value)} className={inputCls} required>
                <option value="">— Source Tank Select Karein —</option>
                {tanks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {fmtNum(t.balance)} L available</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>To Tank (Destination) *</label>
              <select value={toTankId} onChange={(e) => setToTankId(e.target.value)} className={inputCls} required>
                <option value="">— Destination Tank Select Karein —</option>
                {tanks.filter((t) => String(t.id) !== fromTankId).map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {fmtNum(t.balance)} L available</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Quantity (L) *</label>
                <input type="number" step="0.01" min="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} placeholder="e.g. 50" required />
                {fromTank && <p className="text-[11px] text-slate-400 mt-1">Available: {fmtNum(fromTank.balance)} L</p>}
              </div>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none`} placeholder="Optional..." />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" label="Transfer" fullWidth />
              <Button type="button" label="Cancel" variant="secondary" onClick={onClose} />
            </div>
          </form>
        )}

        {phase === 'error' && (
          <div className="px-5 pb-5">
            <Button label="Try Again" fullWidth onClick={() => setPhase('form')} />
          </div>
        )}
      </div>
    </div>
  );
}
