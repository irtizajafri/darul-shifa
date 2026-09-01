import { useState } from 'react';
import { X, Fuel, Zap, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useFuelStore } from '../../store/useFuelStore';

const fmtNum = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Tank → Generator flow diagram. Same markup for all three phases — only the
// connector (dots / arrow) and caption change, so the layout never jumps.
function FlowDiagram({ tank, generator, phase, quantity }) {
  return (
    <div className="flex items-center justify-center gap-4 py-6">
      <div className="flex flex-col items-center gap-2 w-20">
        <div className="w-16 h-16 rounded-xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center">
          <Fuel className="w-8 h-8 text-blue-600" />
        </div>
        <span className="text-xs font-medium text-slate-600 text-center truncate w-full">{tank?.name || 'Tank'}</span>
      </div>

      <div className="relative w-24 h-6 shrink-0">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 rounded-full" />
        {phase === 'transferring' && [0, 0.35, 0.7].map((delay) => (
          <span
            key={delay}
            className="absolute top-1/2 left-0 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-blue-500 animate-fuel-flow"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
        {phase === 'done' && (
          <ArrowRight className="absolute inset-0 m-auto w-5 h-5 text-emerald-500" />
        )}
        {phase === 'error' && (
          <AlertCircle className="absolute inset-0 m-auto w-5 h-5 text-red-500" />
        )}
      </div>

      <div className="flex flex-col items-center gap-2 w-20">
        <div className="w-16 h-16 rounded-xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
          <Zap className="w-8 h-8 text-amber-600" />
        </div>
        <span className="text-xs font-medium text-slate-600 text-center truncate w-full">{generator?.name || 'Generator'}</span>
      </div>

      {quantity != null && (
        <div className="absolute top-1 text-center w-full text-[11px] font-semibold text-slate-400">
          {fmtNum(quantity)} L
        </div>
      )}
    </div>
  );
}

export default function FuelTransferModal({ tanks, generators, defaultTankId, defaultGeneratorId, onClose, onDone }) {
  const { createTransfer } = useFuelStore();
  const [tankId, setTankId] = useState(defaultTankId ? String(defaultTankId) : '');
  const [generatorId, setGeneratorId] = useState(defaultGeneratorId ? String(defaultGeneratorId) : '');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const [lastHours, setLastHours] = useState('');
  const [currentHours, setCurrentHours] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [phase, setPhase] = useState('form'); // form | transferring | done | error
  const [errorMsg, setErrorMsg] = useState('');

  const tank = tanks.find((t) => String(t.id) === tankId);
  const generator = generators.find((g) => String(g.id) === generatorId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tankId) return toast.error('Select a tank');
    if (!generatorId) return toast.error('Select a generator');
    const qty = Number(quantity);
    if (!qty || qty <= 0) return toast.error('Enter a valid quantity');
    if (tank && qty > tank.balance) return toast.error(`Tank mein sirf ${fmtNum(tank.balance)} L available hai`);

    setPhase('transferring');
    // Minimum visible duration so the animation isn't a flash even on a fast response.
    const minDelay = new Promise((res) => setTimeout(res, 1200));
    try {
      await Promise.all([
        createTransfer({
          tankId: Number(tankId),
          generatorId: Number(generatorId),
          quantity: qty,
          rate: rate || undefined,
          date,
          lastHours: lastHours || undefined,
          currentHours: currentHours || undefined,
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

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';
  const locked = phase === 'transferring' || phase === 'done';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={locked ? undefined : onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">Transfer Fuel</h3>
          {!locked && (
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {(phase === 'transferring' || phase === 'done' || phase === 'error') && (
          <div className="relative px-5 pt-3">
            <FlowDiagram tank={tank} generator={generator} phase={phase} quantity={quantity} />
            <p className="text-center text-sm font-medium -mt-2 mb-1">
              {phase === 'transferring' && <span className="text-blue-600">Transferring…</span>}
              {phase === 'done' && <span className="text-emerald-600 flex items-center justify-center gap-1"><CheckCircle2 className="w-4 h-4" /> Transfer complete</span>}
              {phase === 'error' && <span className="text-red-600">{errorMsg}</span>}
            </p>
          </div>
        )}

        {phase === 'form' && (
          <form onSubmit={handleSubmit} className="p-5 space-y-3">
            <div>
              <label className={labelCls}>From Tank *</label>
              <select value={tankId} onChange={(e) => setTankId(e.target.value)} className={inputCls} required>
                <option value="">— Select Tank —</option>
                {tanks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {fmtNum(t.balance)} L available</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>To Generator *</label>
              <select value={generatorId} onChange={(e) => setGeneratorId(e.target.value)} className={inputCls} required disabled={!!defaultGeneratorId}>
                <option value="">— Select Generator —</option>
                {generators.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Quantity (L) *</label>
                <input type="number" step="0.01" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputCls} placeholder="e.g. 35" required />
                {tank && <p className="text-[11px] text-slate-400 mt-1">Tank balance: {fmtNum(tank.balance)} L</p>}
              </div>
              <div>
                <label className={labelCls}>Rate (Rs/L)</label>
                <input type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} className={inputCls} placeholder="Optional" />
              </div>
            </div>
            {quantity && rate && (
              <p className="text-[11px] text-slate-400 -mt-1">Amount: {fmtNum(Number(quantity) * Number(rate))} Rs</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Last Hours</label>
                <input type="number" step="0.01" min="0" value={lastHours} onChange={(e) => setLastHours(e.target.value)} className={inputCls} placeholder="Optional" />
              </div>
              <div>
                <label className={labelCls}>Current Hours</label>
                <input type="number" step="0.01" min="0" value={currentHours} onChange={(e) => setCurrentHours(e.target.value)} className={inputCls} placeholder="Optional" />
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
