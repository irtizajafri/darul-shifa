import { useState, useEffect } from 'react';
import { ArrowLeft, Printer, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useFuelStore } from '../../store/useFuelStore';

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const fmtNum = (n) => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const fmtRs = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { dateStyle: 'medium' }) : '-';
const fmtDateLabel = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

// Same fix as the Utilities Bill reports — the app's main content area
// scrolls inside a fixed-height container, so window.print() on the live
// page prints blank/cut-off. Build the table in a separate popup window.
const PRINT_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:10px; color:#000; background:#fff; padding:14px; }
  h2 { text-align:center; font-size:14px; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.03em; }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #999; padding:4px 6px; text-align:right; }
  th:first-child, td:first-child { text-align:left; }
  th { background:#f3f3f3; font-weight:700; }
  tfoot td { background:#f3f3f3; font-weight:700; }
  @page { size: landscape; margin: 10mm; }
`;

// One row per day, across the whole Fuel Management module — Tank stock-in,
// Tank→Generator transfers, Vehicle fuel/oil, Generator oil. Generator fuel
// isn't shown separately since it's already reflected in the transfer figure
// (double-counting the same litres would inflate the daily total).
export default function FuelDailyReport({ onBack }) {
  const { fetchDailyFuelReport } = useFuelStore();

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const doFetch = () => {
    fetchDailyFuelReport({ from, to })
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(doFetch, []);

  const load = () => { setLoading(true); doFetch(); };

  const handlePrint = () => {
    if (!data) return;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Print popup was blocked by the browser'); return; }
    const title = 'Fuel Management — Daily Report';
    const rowsHtml = data.rows.map((r) => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${fmtNum(r.tankStockIn)}</td>
        <td>${fmtRs(r.tankStockAmount)}</td>
        <td>${fmtNum(r.transferOut)}</td>
        <td>${fmtNum(r.vehicleFuel)}</td>
        <td>${fmtRs(r.vehicleFuelAmount)}</td>
        <td>${fmtNum(r.vehicleOil)}</td>
        <td>${fmtRs(r.vehicleOilAmount)}</td>
        <td>${fmtNum(r.generatorOil)}</td>
        <td>${fmtRs(r.generatorOilAmount)}</td>
        <td>${fmtRs(r.totalAmount)}</td>
      </tr>`).join('') || `<tr><td colspan="11" style="text-align:center;">Is range mein koi activity nahi hai</td></tr>`;
    const t = data.totals;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${PRINT_CSS}</style></head><body>
      <h2>${title} — ${fmtDateLabel(from)} to ${fmtDateLabel(to)}</h2>
      <table>
        <thead><tr>
          <th>Date</th>
          <th>Tank Stock In (L)</th><th>Amount</th>
          <th>Tank→Gen Transfer (L)</th>
          <th>Vehicle Fuel (L)</th><th>Amount</th>
          <th>Vehicle Oil (L)</th><th>Amount</th>
          <th>Generator Oil (L)</th><th>Amount</th>
          <th>Daily Total (Rs)</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot><tr>
          <td>Total</td>
          <td>${fmtNum(t.tankStockIn)}</td><td>${fmtRs(t.tankStockAmount)}</td>
          <td>${fmtNum(t.transferOut)}</td>
          <td>${fmtNum(t.vehicleFuel)}</td><td>${fmtRs(t.vehicleFuelAmount)}</td>
          <td>${fmtNum(t.vehicleOil)}</td><td>${fmtRs(t.vehicleOilAmount)}</td>
          <td>${fmtNum(t.generatorOil)}</td><td>${fmtRs(t.generatorOilAmount)}</td>
          <td>${fmtRs(t.totalAmount)}</td>
        </tr></tfoot>
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
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-slate-400" />
            Daily Report
          </h1>
          <p className="text-sm text-slate-500">Tanks, Vehicles & Generators — din-wise activity</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-blue-600">Tank Stock In</p>
              <p className="text-lg font-bold text-blue-700">{fmtNum(data.totals.tankStockIn)} L</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-amber-600">Tank → Generator</p>
              <p className="text-lg font-bold text-amber-700">{fmtNum(data.totals.transferOut)} L</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-slate-500">Vehicle Fuel + Oil</p>
              <p className="text-lg font-bold text-slate-800">{fmtNum(data.totals.vehicleFuel + data.totals.vehicleOil)} L</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-emerald-600">Total Spend</p>
              <p className="text-lg font-bold text-emerald-700">Rs {fmtRs(data.totals.totalAmount)}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th rowSpan={2} className="text-left px-3 py-2 font-semibold text-slate-500 uppercase align-bottom border-r border-slate-200">Date</th>
                    <th colSpan={2} className="text-center px-2 py-1.5 font-semibold text-blue-600 border-r border-slate-200 border-b border-slate-200">Tank Stock In</th>
                    <th className="text-center px-2 py-1.5 font-semibold text-amber-600 border-r border-slate-200 border-b border-slate-200">Tank→Gen</th>
                    <th colSpan={2} className="text-center px-2 py-1.5 font-semibold text-slate-600 border-r border-slate-200 border-b border-slate-200">Vehicle Fuel</th>
                    <th colSpan={2} className="text-center px-2 py-1.5 font-semibold text-slate-600 border-r border-slate-200 border-b border-slate-200">Vehicle Oil</th>
                    <th colSpan={2} className="text-center px-2 py-1.5 font-semibold text-slate-600 border-r border-slate-200 border-b border-slate-200">Generator Oil</th>
                    <th rowSpan={2} className="text-right px-3 py-2 font-semibold text-emerald-700 uppercase align-bottom">Daily Total</th>
                  </tr>
                  <tr>
                    <th className="text-right px-2 py-1 font-medium text-slate-400">Litres</th>
                    <th className="text-right px-2 py-1 font-medium text-slate-400 border-r border-slate-200">Amount</th>
                    <th className="text-right px-2 py-1 font-medium text-slate-400 border-r border-slate-200">Litres</th>
                    <th className="text-right px-2 py-1 font-medium text-slate-400">Litres</th>
                    <th className="text-right px-2 py-1 font-medium text-slate-400 border-r border-slate-200">Amount</th>
                    <th className="text-right px-2 py-1 font-medium text-slate-400">Litres</th>
                    <th className="text-right px-2 py-1 font-medium text-slate-400 border-r border-slate-200">Amount</th>
                    <th className="text-right px-2 py-1 font-medium text-slate-400">Litres</th>
                    <th className="text-right px-2 py-1 font-medium text-slate-400 border-r border-slate-200">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.length === 0 ? (
                    <tr><td colSpan={11} className="text-center py-10 text-slate-400 text-sm">Is range mein koi activity nahi hai</td></tr>
                  ) : data.rows.map((r) => (
                    <tr key={r.date} className="hover:bg-slate-50">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700 border-r border-slate-100">{fmtDate(r.date)}</td>
                      <td className="text-right px-2 py-2">{fmtNum(r.tankStockIn)}</td>
                      <td className="text-right px-2 py-2 border-r border-slate-100 text-slate-500">{fmtRs(r.tankStockAmount)}</td>
                      <td className="text-right px-2 py-2 border-r border-slate-100 text-amber-700">{fmtNum(r.transferOut)}</td>
                      <td className="text-right px-2 py-2">{fmtNum(r.vehicleFuel)}</td>
                      <td className="text-right px-2 py-2 border-r border-slate-100 text-slate-500">{fmtRs(r.vehicleFuelAmount)}</td>
                      <td className="text-right px-2 py-2">{fmtNum(r.vehicleOil)}</td>
                      <td className="text-right px-2 py-2 border-r border-slate-100 text-slate-500">{fmtRs(r.vehicleOilAmount)}</td>
                      <td className="text-right px-2 py-2">{fmtNum(r.generatorOil)}</td>
                      <td className="text-right px-2 py-2 border-r border-slate-100 text-slate-500">{fmtRs(r.generatorOilAmount)}</td>
                      <td className="text-right px-3 py-2 font-semibold text-emerald-700">{fmtRs(r.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                {data.rows.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold">
                    <tr>
                      <td className="px-3 py-2.5 text-slate-800 border-r border-slate-200">Total</td>
                      <td className="text-right px-2 py-2.5">{fmtNum(data.totals.tankStockIn)}</td>
                      <td className="text-right px-2 py-2.5 border-r border-slate-200">{fmtRs(data.totals.tankStockAmount)}</td>
                      <td className="text-right px-2 py-2.5 border-r border-slate-200 text-amber-700">{fmtNum(data.totals.transferOut)}</td>
                      <td className="text-right px-2 py-2.5">{fmtNum(data.totals.vehicleFuel)}</td>
                      <td className="text-right px-2 py-2.5 border-r border-slate-200">{fmtRs(data.totals.vehicleFuelAmount)}</td>
                      <td className="text-right px-2 py-2.5">{fmtNum(data.totals.vehicleOil)}</td>
                      <td className="text-right px-2 py-2.5 border-r border-slate-200">{fmtRs(data.totals.vehicleOilAmount)}</td>
                      <td className="text-right px-2 py-2.5">{fmtNum(data.totals.generatorOil)}</td>
                      <td className="text-right px-2 py-2.5 border-r border-slate-200">{fmtRs(data.totals.generatorOilAmount)}</td>
                      <td className="text-right px-3 py-2.5 text-emerald-700">{fmtRs(data.totals.totalAmount)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
