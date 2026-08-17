import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Printer, PlugZap, Building2, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useUtilitiesStore } from '../../store/useUtilitiesStore';

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const fmtNum = (n) => (n != null) ? Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
const fmtCell = (n) => (n != null) ? Number(n).toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }) : '-';
const fmtDateLabel = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

// The app's main content area (TabsContainer.jsx) is a fixed-height,
// overflow-auto scroller — the browser's native window.print() can't
// capture content that scrolls inside it, so it prints blank/cut-off.
// Same fix as VoucherReprint.jsx: build the table in a separate popup
// window with its own plain HTML/CSS, and print that instead.
const PRINT_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:10px; color:#000; background:#fff; padding:14px; }
  h2 { text-align:center; font-size:14px; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.03em; }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #999; padding:3px 5px; text-align:center; }
  th { background:#f3f3f3; font-weight:700; }
  td:first-child, th:first-child { text-align:left; }
  tfoot td { background:#f3f3f3; font-weight:700; }
  @page { size: landscape; margin: 10mm; }
`;

// Date x Meter matrix — one row per date, one Day/Night column pair per
// meter, with Grand Day/Night/Total columns at the end. Mirrors the paper
// "FOR THE MONTH OF ... TO ..." meter reading sheet this hospital already uses.
export default function CombinedReport({ type, utility = 'electricity', meters, onBack }) {
  const isBilling = type === 'billing';
  const isGas = utility === 'gas';
  const groupLabel = isGas ? 'Gas Meters' : (isBilling ? 'Billing Meters' : 'Department Meters');
  const { fetchReport } = useUtilitiesStore();
  const tableRef = useRef(null);

  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayStr());
  const [perMeter, setPerMeter] = useState([]); // [{ meter, totalUnits, estimatedAmount, totalActual, difference, readings }]
  const [loading, setLoading] = useState(true);

  const doFetch = () => {
    Promise.all(
      meters.map((m) =>
        fetchReport({ meterId: m.id, from, to })
          .then((d) => ({ meter: m, ...d }))
          .catch(() => ({ meter: m, totalUnits: 0, estimatedAmount: 0, totalActual: 0, difference: 0, readings: [] }))
      )
    )
      .then(setPerMeter)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(doFetch, [meters]);

  const load = () => { setLoading(true); doFetch(); };

  const handlePrint = () => {
    if (!tableRef.current) return;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Print popup was blocked by the browser'); return; }
    const title = `Combined Report — ${groupLabel}`;
    const heading = `<h2>${title} — For the period ${fmtDateLabel(from)} to ${fmtDateLabel(to)}</h2>`;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${PRINT_CSS}</style></head><body>${heading}${tableRef.current.outerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.onafterprint = () => win.close();
    }, 400);
  };

  // ── Build the date × meter matrix ──────────────────────────────────────────
  const dateSet = new Set();
  const byDate = {}; // dateKey -> { [meterId]: { dayUnits, nightUnits } }
  perMeter.forEach(({ meter, readings }) => {
    (readings || []).forEach((r) => {
      const key = r.date.slice(0, 10);
      dateSet.add(key);
      byDate[key] = byDate[key] || {};
      byDate[key][meter.id] = { dayUnits: r.dayUnits, nightUnits: r.nightUnits };
    });
  });
  const dates = Array.from(dateSet).sort();

  const rows = dates.map((dateKey) => {
    let gDay = 0, gNight = 0;
    const cells = meters.map((m) => {
      const c = byDate[dateKey]?.[m.id];
      if (c) { gDay += c.dayUnits || 0; gNight += c.nightUnits || 0; }
      return c || null;
    });
    return { dateKey, cells, gDay, gNight, gTotal: gDay + gNight };
  });

  const colTotals = meters.map((m) => {
    const t = (perMeter.find((p) => p.meter.id === m.id)?.readings || []).reduce(
      (acc, r) => ({ day: acc.day + (r.dayUnits || 0), night: acc.night + (r.nightUnits || 0) }),
      { day: 0, night: 0 }
    );
    return t;
  });
  const grandDay = rows.reduce((s, r) => s + r.gDay, 0);
  const grandNight = rows.reduce((s, r) => s + r.gNight, 0);

  const summary = perMeter.reduce((acc, p) => ({
    totalUnits: acc.totalUnits + (p.totalUnits || 0),
    estimatedAmount: acc.estimatedAmount + (p.estimatedAmount || 0),
    totalActual: acc.totalActual + (p.totalActual || 0),
    difference: acc.difference + (p.difference || 0),
  }), { totalUnits: 0, estimatedAmount: 0, totalActual: 0, difference: 0 });

  const Icon = isGas ? Flame : (isBilling ? PlugZap : Building2);
  const inputCls = 'px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500';

  return (
    <div className="p-4 sm:p-6 max-w-full mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Icon className="w-5 h-5 text-slate-400" />
            Combined Report — {groupLabel}
          </h1>
          <p className="text-sm text-slate-500">{meters.length} meter{meters.length === 1 ? '' : 's'}, ek sath</p>
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

      <div className={`grid gap-3 mb-5 ${isBilling ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-center">
          <p className="text-xs text-slate-500">Total Units</p>
          <p className="text-lg font-bold text-slate-800">{fmtNum(summary.totalUnits)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
          <p className="text-xs text-blue-600">Estimated Bill</p>
          <p className="text-lg font-bold text-blue-700">Rs {fmtNum(summary.estimatedAmount)}</p>
        </div>
        {isBilling && (
          <>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-emerald-600">Actual Bill</p>
              <p className="text-lg font-bold text-emerald-700">Rs {fmtNum(summary.totalActual)}</p>
            </div>
            <div className={`rounded-lg px-4 py-3 text-center border ${summary.difference >= 0 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-xs ${summary.difference >= 0 ? 'text-amber-600' : 'text-red-600'}`}>Difference</p>
              <p className={`text-lg font-bold ${summary.difference >= 0 ? 'text-amber-700' : 'text-red-700'}`}>Rs {fmtNum(summary.difference)}</p>
            </div>
          </>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full text-xs border-collapse">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th rowSpan={2} className="sticky left-0 bg-slate-50 text-left px-3 py-2 font-semibold text-slate-500 uppercase border-r border-slate-200 align-bottom">Date</th>
                {meters.map((m) => (
                  <th key={m.id} colSpan={2} className="text-center px-2 py-1.5 font-semibold text-slate-600 border-r border-slate-200 border-b border-slate-200">
                    {isBilling ? m.meterNo : m.departmentName}
                  </th>
                ))}
                <th colSpan={3} className="text-center px-2 py-1.5 font-semibold text-amber-700 border-b border-slate-200">Total</th>
              </tr>
              <tr className="border-b border-slate-300">
                {meters.flatMap((m) => ([
                  <th key={`${m.id}-d`} className="text-center px-2 py-1 font-medium text-slate-400">Day</th>,
                  <th key={`${m.id}-n`} className="text-center px-2 py-1 font-medium text-slate-400 border-r border-slate-200">Night</th>,
                ]))}
                <th className="text-center px-2 py-1 font-medium text-amber-600">Day</th>
                <th className="text-center px-2 py-1 font-medium text-amber-600">Night</th>
                <th className="text-center px-2 py-1 font-medium text-amber-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr><td colSpan={meters.length * 2 + 4} className="text-center py-10 text-slate-400 text-sm">{loading ? 'Loading...' : 'Is range mein koi reading nahi hai'}</td></tr>
              ) : rows.map((row) => (
                <tr key={row.dateKey} className="hover:bg-slate-50">
                  <td className="sticky left-0 bg-white px-3 py-1.5 text-slate-700 whitespace-nowrap border-r border-slate-200">{fmtDate(row.dateKey)}</td>
                  {row.cells.flatMap((c, i) => ([
                    <td key={`${row.dateKey}-${meters[i].id}-d`} className="text-center px-2 py-1.5 text-slate-600">{fmtCell(c?.dayUnits)}</td>,
                    <td key={`${row.dateKey}-${meters[i].id}-n`} className="text-center px-2 py-1.5 text-slate-600 border-r border-slate-200">{fmtCell(c?.nightUnits)}</td>,
                  ]))}
                  <td className="text-center px-2 py-1.5 font-medium text-amber-700">{fmtCell(row.gDay)}</td>
                  <td className="text-center px-2 py-1.5 font-medium text-amber-700">{fmtCell(row.gNight)}</td>
                  <td className="text-center px-2 py-1.5 font-semibold text-amber-800">{fmtCell(row.gTotal)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold">
                <tr>
                  <td className="sticky left-0 bg-slate-50 px-3 py-2 text-slate-800 border-r border-slate-200">Total</td>
                  {colTotals.flatMap((t, i) => ([
                    <td key={`ct-${meters[i].id}-d`} className="text-center px-2 py-2 text-slate-800">{fmtCell(t.day)}</td>,
                    <td key={`ct-${meters[i].id}-n`} className="text-center px-2 py-2 text-slate-800 border-r border-slate-200">{fmtCell(t.night)}</td>,
                  ]))}
                  <td className="text-center px-2 py-2 text-amber-800">{fmtCell(grandDay)}</td>
                  <td className="text-center px-2 py-2 text-amber-800">{fmtCell(grandNight)}</td>
                  <td className="text-center px-2 py-2 text-amber-900">{fmtCell(grandDay + grandNight)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
