import { useState, useEffect } from 'react';
import { ArrowLeft, Printer, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useUtilitiesStore } from '../../store/useUtilitiesStore';

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const fmtNum = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { dateStyle: 'medium' }) : '-';
const fmtDateLabel = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const PRINT_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:11px; color:#000; background:#fff; padding:16px; }
  h2 { font-size:15px; margin-bottom:4px; text-transform:uppercase; }
  h3 { font-size:11px; font-weight:400; color:#555; margin-bottom:12px; }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #999; padding:5px 7px; text-align:left; }
  th { background:#f3f3f3; font-weight:700; }
  td:last-child, th:last-child { text-align:right; }
  tfoot td { background:#f3f3f3; font-weight:700; }
  @page { margin: 12mm; }
`;

// The single PTCL report — every phone number's bills, side by side, for the
// selected period. No readings/estimate involved, just posted actual bills.
export default function PtclReport({ lines, onBack }) {
  const { fetchBills } = useUtilitiesStore();

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const doFetch = () => {
    Promise.all(
      lines.map((l) => fetchBills(l.id).then((bills) => ({ line: l, bills })).catch(() => ({ line: l, bills: [] })))
    )
      .then((results) => {
        const rFrom = new Date(from), rTo = new Date(to);
        const flat = [];
        results.forEach(({ line, bills }) => {
          (bills || []).forEach((b) => {
            const bFrom = new Date(b.fromDate), bTo = new Date(b.toDate);
            if (bTo >= rFrom && bFrom <= rTo) flat.push({ line, bill: b });
          });
        });
        flat.sort((a, b) => new Date(a.bill.fromDate) - new Date(b.bill.fromDate) || a.line.meterNo.localeCompare(b.line.meterNo));
        setRows(flat);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(doFetch, [lines]);

  const load = () => { setLoading(true); doFetch(); };

  const total = rows.reduce((s, r) => s + (r.bill.amount || 0), 0);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) { toast.error('Print popup was blocked by the browser'); return; }
    const title = 'PTCL — Combined Report';
    const rowsHtml = rows.map((r) => `
      <tr>
        <td>${r.line.meterNo}</td>
        <td>${r.line.location || ''}</td>
        <td>${fmtDate(r.bill.fromDate)} – ${fmtDate(r.bill.toDate)}</td>
        <td>${fmtNum(r.bill.amount)}</td>
      </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;">Is range mein koi bill nahi hai</td></tr>`;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${PRINT_CSS}</style></head><body>
      <h2>${title}</h2><h3>For the period ${fmtDateLabel(from)} to ${fmtDateLabel(to)}</h3>
      <table>
        <thead><tr><th>Phone Number</th><th>Location</th><th>Period</th><th>Amount</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr><td colspan="3">Grand Total</td><td>${fmtNum(total)}</td></tr></tfoot>
      </table>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.onafterprint = () => win.close();
    }, 400);
  };

  const inputCls = 'px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500';

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Phone className="w-5 h-5 text-slate-400" />
            PTCL — Combined Report
          </h1>
          <p className="text-sm text-slate-500">{lines.length} phone number{lines.length === 1 ? '' : 's'}</p>
        </div>
        <Button label="Print" icon={Printer} size="sm" variant="outline" onClick={handlePrint} />
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </div>
        <Button label={loading ? 'Loading...' : 'Apply'} size="sm" onClick={load} disabled={loading} />
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 mb-5 flex items-center justify-between">
        <span className="text-sm font-medium text-teal-700">Grand Total</span>
        <span className="text-lg font-bold text-teal-800">Rs {fmtNum(total)}</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Phone Number</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Period</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-slate-400 text-sm">{loading ? 'Loading...' : 'Is range mein koi bill nahi hai'}</td></tr>
              ) : rows.map((r) => (
                <tr key={r.bill.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{r.line.meterNo}</td>
                  <td className="px-4 py-3 text-slate-500">{r.line.location || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(r.bill.fromDate)} – {fmtDate(r.bill.toDate)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{fmtNum(r.bill.amount)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-slate-800">Grand Total</td>
                  <td className="px-4 py-3 text-right text-teal-700">{fmtNum(total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
