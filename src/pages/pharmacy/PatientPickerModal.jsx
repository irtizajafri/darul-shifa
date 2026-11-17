import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { CLINIC_API } from './pharmacyApi';

// Pick an admitted patient (Admission #) or an active panel OPD slip — the
// same lists Inventory's GD uses.
export default function PatientPickerModal({ mode = 'admission', onSelect, onClose }) {
  const isSlip = mode === 'slip';
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  const run = (term) => {
    fetch(isSlip
      ? `${CLINIC_API}/opd-panel-billing/search?q=${encodeURIComponent(term)}`
      : `${CLINIC_API}/admission/adjustment/search?q=${encodeURIComponent(term)}`)
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    run('');
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = (v) => {
    setQ(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setLoading(true); run(v); }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={isSlip ? 'Select panel slip' : 'Select admitted patient'}>
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85dvh]">
        <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-3 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold text-emerald-900">{isSlip ? 'Select Panel OPD Slip' : 'Select Admitted Patient'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="px-5 py-3 border-b border-slate-100 shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => change(e.target.value)}
              placeholder={isSlip ? 'Search by Slip # or patient name…' : 'Search by Admission # or patient name…'}
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
        <div className="overflow-y-auto">
          {loading ? (
            <div className="text-center text-sm text-slate-400 py-8">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                  <th className="px-4 py-2 text-left">{isSlip ? 'Slip #' : 'Admission #'}</th>
                  <th className="px-4 py-2 text-left">Patient</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => onSelect(r)} className="cursor-pointer hover:bg-emerald-50">
                    <td className="px-4 py-2 font-medium">{r.admissionNo}</td>
                    <td className="px-4 py-2">{r.patientName}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={2} className="text-center text-slate-400 py-6">{isSlip ? 'No panel slip found' : 'No admitted patient found'}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
