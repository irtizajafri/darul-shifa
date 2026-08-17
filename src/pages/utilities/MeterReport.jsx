import { useState, useEffect } from 'react';
import { ArrowLeft, Printer, PlugZap, Building2, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useUtilitiesStore } from '../../store/useUtilitiesStore';

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const fmtNum = (n) => (n != null) ? Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { dateStyle: 'medium' }) : '-';

// Same fix as CombinedReport.jsx / VoucherReprint.jsx — the app's main
// content area scrolls inside a fixed-height container, so window.print()
// on the live page prints blank/cut-off. Build the table in a separate
// popup window instead.
const PRINT_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:11px; color:#000; background:#fff; padding:16px; }
  h2 { font-size:15px; margin-bottom:4px; }
  h3 { font-size:11px; font-weight:400; color:#555; margin-bottom:12px; }
  .stats { display:flex; gap:14px; margin-bottom:14px; }
  .stat { border:1px solid #ccc; border-radius:4px; padding:6px 12px; text-align:center; }
  .stat-label { font-size:9px; color:#666; text-transform:uppercase; }
  .stat-value { font-size:13px; font-weight:700; }
  table { width:100%; border-collapse:collapse; margin-bottom:14px; }
  th, td { border:1px solid #999; padding:4px 6px; text-align:right; }
  th:first-child, td:first-child { text-align:left; }
  th { background:#f3f3f3; font-weight:700; }
  @page { margin: 12mm; }
`;

export default function MeterReport({ meter, onBack }) {
  const isBilling = meter.type === 'billing';
  const isGas = meter.utility === 'gas';
  const { fetchReport } = useUtilitiesStore();

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const doFetch = () => {
    fetchReport({ meterId: meter.id, from, to })
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  // Initial load — `loading` already starts true, so no setState is needed
  // synchronously inside the effect body itself.
  useEffect(doFetch, [meter.id]);

  const load = () => { setLoading(true); doFetch(); };

  // Built straight from `data`, not read off the live (Tailwind-styled) DOM —
  // the popup document has no Tailwind, so this guarantees the print output
  // looks intentional instead of unstyled.
  const handlePrint = () => {
    if (!data) return;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Print popup was blocked by the browser'); return; }
    const title = `${isBilling ? meter.meterNo : meter.departmentName} — Report`;
    const stats = `
      <div class="stats">
        <div class="stat"><div class="stat-label">Total Units</div><div class="stat-value">${fmtNum(data.totalUnits)}</div></div>
        <div class="stat"><div class="stat-label">Estimated Bill</div><div class="stat-value">Rs ${fmtNum(data.estimatedAmount)}</div></div>
        ${isBilling ? `<div class="stat"><div class="stat-label">Actual Bill</div><div class="stat-value">Rs ${fmtNum(data.totalActual)}</div></div>` : ''}
        ${isBilling ? `<div class="stat"><div class="stat-label">Difference</div><div class="stat-value">Rs ${fmtNum(data.difference)}</div></div>` : ''}
      </div>`;
    const rows = data.readings.map((r) => `
        <tr>
          <td>${fmtDate(r.date)}</td>
          <td>${fmtNum(r.dayUnits)}</td>
          <td>${fmtNum(r.nightUnits)}</td>
          <td>${fmtNum(r.totalUnits)}</td>
          <td>${fmtNum(r.rateApplied)}</td>
          <td>${fmtNum(r.estimatedAmount)}</td>
        </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;">Is range mein koi reading nahi hai</td></tr>`;
    const table = `
      <table>
        <thead><tr><th>Date</th><th>Day Units</th><th>Night Units</th><th>Total Units</th><th>Rate Applied</th><th>Estimated Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${PRINT_CSS}</style></head><body><h2>${title}</h2><h3>${fmtDate(from)} to ${fmtDate(to)}</h3>${stats}${table}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.onafterprint = () => win.close();
    }, 400);
  };

  const Icon = isGas ? Flame : (isBilling ? PlugZap : Building2);
  const inputCls = 'px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Icon className="w-5 h-5 text-slate-400" />
            {isBilling ? meter.meterNo : meter.departmentName} — Report
          </h1>
          <p className="text-sm text-slate-500">{isGas ? 'Gas Meter' : (isBilling ? 'Billing Meter' : 'Department Meter')}</p>
        </div>
        <Button label="Print" icon={Printer} size="sm" variant="outline" onClick={handlePrint} disabled={!data} />
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

      {data && (
        <>
          <div className={`grid gap-3 mb-5 ${isBilling ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-slate-500">Total Units</p>
              <p className="text-lg font-bold text-slate-800">{fmtNum(data.totalUnits)}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-blue-600">Estimated Bill</p>
              <p className="text-lg font-bold text-blue-700">Rs {fmtNum(data.estimatedAmount)}</p>
            </div>
            {isBilling && (
              <>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-center">
                  <p className="text-xs text-emerald-600">Actual Bill</p>
                  <p className="text-lg font-bold text-emerald-700">Rs {fmtNum(data.totalActual)}</p>
                </div>
                <div className={`rounded-lg px-4 py-3 text-center border ${data.difference >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-xs ${data.difference >= 0 ? 'text-amber-600' : 'text-red-600'}`}>Difference (Actual − Estimated)</p>
                  <p className={`text-lg font-bold ${data.difference >= 0 ? 'text-amber-700' : 'text-red-700'}`}>Rs {fmtNum(data.difference)}</p>
                </div>
              </>
            )}
          </div>

          {isBilling && data.actualBills?.length > 0 && (
            <div className="mb-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">Matched Actual Bills</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {data.actualBills.map((b) => (
                      <tr key={b.id}>
                        <td className="px-4 py-2.5 text-slate-700">{fmtDate(b.fromDate)} – {fmtDate(b.toDate)}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-800">Rs {fmtNum(b.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Day Units</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Night Units</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Total Units</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Rate Applied</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Estimated Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.readings.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-slate-400 text-sm">Is range mein koi reading nahi hai</td></tr>
                  ) : data.readings.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(r.dayUnits)}</td>
                      <td className="px-4 py-3 text-right">{fmtNum(r.nightUnits)}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{fmtNum(r.totalUnits)}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{fmtNum(r.rateApplied)}</td>
                      <td className="px-4 py-3 text-right font-medium text-blue-700">{fmtNum(r.estimatedAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
