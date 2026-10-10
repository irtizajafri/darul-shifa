import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

const CLINIC_API = 'http://localhost:5001/api/clinic';

function fmtAdmDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Browse admitted patients instead of typing the admission number blind —
// used by Sales Invoice and MRN (Admission # mode).
export default function AdmissionPickerModal({ onSelect, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const timer = useRef(null);

  const runSearch = (term) => {
    fetch(`${CLINIC_API}/admission/adjustment/search?q=${encodeURIComponent(term)}`)
      .then((r) => r.json())
      .then((j) => setRows(j?.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { runSearch(''); }, []);

  const handleQueryChange = (val) => {
    setQ(val);
    setLoading(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(val), 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <span className="font-semibold text-slate-800">Select Admitted Patient</span>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="px-4 py-2 border-b border-slate-200 relative">
          <Search className="w-4 h-4 absolute left-7 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            className="pl-8 pr-2 py-1.5 border border-slate-300 rounded-md text-sm w-full focus:outline-none focus:border-blue-500"
            placeholder="Search Admission # or Patient Name…"
            value={q}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center text-sm text-slate-400 py-6">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-6">No admitted patients found</div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase sticky top-0">
                <tr>
                  <th className="px-3 py-2">Admission #</th>
                  <th className="px-3 py-2">Patient</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-blue-50 border-t border-slate-100" onClick={() => onSelect(r)}>
                    <td className="px-3 py-2 font-medium text-slate-700">{r.admissionNo}</td>
                    <td className="px-3 py-2">{r.patientName}</td>
                    <td className="px-3 py-2 text-slate-500">{fmtAdmDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
