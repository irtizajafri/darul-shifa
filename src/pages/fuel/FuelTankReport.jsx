import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Printer, FileBarChart2, Fuel } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../../components/ui/Button';
import { useFuelStore } from '../../store/useFuelStore';

const todayStr    = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const fmtNum  = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PK', { dateStyle: 'medium' }) : '-';
const fmtDateLabel = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

const PRINT_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:10px; color:#000; background:#fff; padding:14px; }
  h2 { text-align:center; font-size:13px; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.03em; }
  h3 { font-size:11px; margin:14px 0 5px; text-transform:uppercase; letter-spacing:0.02em; border-bottom:1px solid #ccc; padding-bottom:3px; }
  .summary { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; }
  .card { border:1px solid #ccc; border-radius:4px; padding:6px 10px; min-width:110px; }
  .card-label { font-size:9px; color:#555; }
  .card-val { font-size:12px; font-weight:700; }
  table { width:100%; border-collapse:collapse; margin-bottom:14px; }
  th, td { border:1px solid #bbb; padding:3px 6px; text-align:right; }
  th:first-child, td:first-child { text-align:left; }
  th { background:#f0f0f0; font-weight:700; font-size:9px; text-transform:uppercase; }
  tfoot td { background:#f0f0f0; font-weight:700; }
  @page { size: A4; margin: 10mm; }
`;

export default function FuelTankReport({ onBack }) {
  const { tanks: allTanks, fetchTanks, fetchTankReport } = useFuelStore();

  const [tankId,  setTankId]  = useState('');
  const [from,    setFrom]    = useState(firstOfMonth());
  const [to,      setTo]      = useState(todayStr());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Load tank list for dropdown
  useEffect(() => { fetchTanks().catch(() => {}); }, []);

  const doFetch = useCallback(() => {
    setLoading(true);
    fetchTankReport({ tankId: tankId || undefined, from, to })
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [tankId, from, to, fetchTankReport]);

  useEffect(() => { doFetch(); }, []);

  const load = () => doFetch();

  // ── Print ──────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!data) return;
    const win = window.open('', '_blank');
    if (!win) { toast.error('Print popup blocked by browser'); return; }

    const title = tankId
      ? `Tank Report — ${allTanks.find((t) => String(t.id) === tankId)?.name || 'Tank'}`
      : 'All Tanks — Fuel Tank Report';

    const tankCards = data.tanks.map((t) => `
      <div class="card">
        <div class="card-label">${t.name}</div>
        <div class="card-val">${fmtNum(t.balance)} L</div>
      </div>`).join('');

    const stockRows = data.stock.map((r) => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${r.tank?.name || '-'}</td>
        <td>${fmtNum(r.quantity)}</td>
        <td>${r.rate ? fmtNum(r.rate) : '-'}</td>
        <td>${r.amount ? fmtNum(r.amount) : '-'}</td>
        <td>${r.supplier || '-'}</td>
        <td>${r.notes || '-'}</td>
      </tr>`).join('') || '<tr><td colspan="7" style="text-align:center">Koi record nahi</td></tr>';

    const genRows = data.genTransfers.map((r) => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${r.tank?.name || '-'}</td>
        <td>${r.generator?.name || '-'}</td>
        <td>${fmtNum(r.quantity)}</td>
        <td>${r.notes || '-'}</td>
      </tr>`).join('') || '<tr><td colspan="5" style="text-align:center">Koi record nahi</td></tr>';

    const tankOutRows = data.tankTransfersOut.map((r) => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${r.fromTank?.name || '-'}</td>
        <td>${r.toTank?.name || '-'}</td>
        <td>${fmtNum(r.quantity)}</td>
        <td>${r.notes || '-'}</td>
      </tr>`).join('') || '<tr><td colspan="5" style="text-align:center">Koi record nahi</td></tr>';

    const tankInRows = data.tankTransfersIn.map((r) => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${r.fromTank?.name || '-'}</td>
        <td>${r.toTank?.name || '-'}</td>
        <td>${fmtNum(r.quantity)}</td>
        <td>${r.notes || '-'}</td>
      </tr>`).join('') || '<tr><td colspan="5" style="text-align:center">Koi record nahi</td></tr>';

    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${PRINT_CSS}</style></head><body>
      <h2>${title}</h2>
      <p style="text-align:center;font-size:9px;color:#666;margin-bottom:10px">Period: ${fmtDateLabel(from)} — ${fmtDateLabel(to)}</p>

      <div class="summary">
        <div class="card"><div class="card-label">Total Purchased (L)</div><div class="card-val">${fmtNum(data.totals.stockQty)}</div></div>
        <div class="card"><div class="card-label">Purchase Amount (Rs)</div><div class="card-val">${fmtNum(data.totals.stockAmount)}</div></div>
        <div class="card"><div class="card-label">→ Generator (L)</div><div class="card-val">${fmtNum(data.totals.genTransferQty)}</div></div>
        <div class="card"><div class="card-label">Tank → Tank Out (L)</div><div class="card-val">${fmtNum(data.totals.tankOutQty)}</div></div>
        <div class="card"><div class="card-label">Tank → Tank In (L)</div><div class="card-val">${fmtNum(data.totals.tankInQty)}</div></div>
        <div class="card"><div class="card-label">Current Balance (L)</div><div class="card-val">${fmtNum(data.totals.totalBalance)}</div></div>
        ${tankCards}
      </div>

      <h3>Fuel Purchased (Stock In)</h3>
      <table>
        <thead><tr><th>Date</th><th>Tank</th><th>Qty (L)</th><th>Rate</th><th>Amount (Rs)</th><th>Supplier</th><th>Notes</th></tr></thead>
        <tbody>${stockRows}</tbody>
        <tfoot><tr>
          <td colspan="2">Total</td>
          <td>${fmtNum(data.totals.stockQty)}</td>
          <td>-</td>
          <td>${fmtNum(data.totals.stockAmount)}</td>
          <td colspan="2"></td>
        </tr></tfoot>
      </table>

      <h3>Transferred → Generators</h3>
      <table>
        <thead><tr><th>Date</th><th>From Tank</th><th>Generator</th><th>Qty (L)</th><th>Notes</th></tr></thead>
        <tbody>${genRows}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td>${fmtNum(data.totals.genTransferQty)}</td><td></td></tr></tfoot>
      </table>

      <h3>Transferred → Other Tanks (Out)</h3>
      <table>
        <thead><tr><th>Date</th><th>From Tank</th><th>To Tank</th><th>Qty (L)</th><th>Notes</th></tr></thead>
        <tbody>${tankOutRows}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td>${fmtNum(data.totals.tankOutQty)}</td><td></td></tr></tfoot>
      </table>

      <h3>Received From Other Tanks (In)</h3>
      <table>
        <thead><tr><th>Date</th><th>From Tank</th><th>To Tank</th><th>Qty (L)</th><th>Notes</th></tr></thead>
        <tbody>${tankInRows}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td>${fmtNum(data.totals.tankInQty)}</td><td></td></tr></tfoot>
      </table>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 400);
  };

  const inputCls = 'px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500';

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileBarChart2 className="w-5 h-5 text-slate-400" />
            Fuel Tank Report
          </h1>
          <p className="text-sm text-slate-500">Purchases, transfers & remaining balance per tank</p>
        </div>
        <Button label="Print / PDF" icon={Printer} size="sm" variant="outline" onClick={handlePrint} disabled={!data || loading} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tank</label>
          <select value={tankId} onChange={(e) => setTankId(e.target.value)} className={inputCls}>
            <option value="">— Sab Tanks —</option>
            {allTanks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
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

      {/* Summary cards */}
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center col-span-1">
              <p className="text-xs text-blue-600">Purchased (L)</p>
              <p className="text-lg font-bold text-blue-700">{fmtNum(data.totals.stockQty)}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-center col-span-1">
              <p className="text-xs text-emerald-600">Purchase Amount</p>
              <p className="text-lg font-bold text-emerald-700">Rs {fmtNum(data.totals.stockAmount)}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-center col-span-1">
              <p className="text-xs text-amber-600">→ Generator (L)</p>
              <p className="text-lg font-bold text-amber-700">{fmtNum(data.totals.genTransferQty)}</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-center col-span-1">
              <p className="text-xs text-purple-600">Tank→Tank Out (L)</p>
              <p className="text-lg font-bold text-purple-700">{fmtNum(data.totals.tankOutQty)}</p>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 text-center col-span-1">
              <p className="text-xs text-teal-600">Tank→Tank In (L)</p>
              <p className="text-lg font-bold text-teal-700">{fmtNum(data.totals.tankInQty)}</p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-center col-span-1">
              <p className="text-xs text-slate-300">Current Balance</p>
              <p className="text-lg font-bold text-white">{fmtNum(data.totals.totalBalance)} L</p>
            </div>
          </div>

          {/* Per-tank balance chips */}
          {data.tanks.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {data.tanks.map((t) => (
                <div key={t.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                  <Fuel className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm font-medium text-slate-700">{t.name}</span>
                  <span className={`text-sm font-bold ${t.balance < 0 ? 'text-red-600' : 'text-blue-700'}`}>{fmtNum(t.balance)} L</span>
                </div>
              ))}
            </div>
          )}

          {/* Section 1: Purchases */}
          <Section title="Fuel Purchased (Stock In)" color="blue" count={data.stock.length}>
            {data.stock.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                    <tr>
                      <Th>Date</Th>
                      <Th>Tank</Th>
                      <Th right>Qty (L)</Th>
                      <Th right>Rate</Th>
                      <Th right>Amount (Rs)</Th>
                      <Th>Supplier</Th>
                      <Th>Notes</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.stock.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <Td>{fmtDate(r.date)}</Td>
                        <Td><span className="font-medium text-blue-700">{r.tank?.name || '-'}</span></Td>
                        <Td right className="font-semibold text-slate-800">{fmtNum(r.quantity)}</Td>
                        <Td right>{r.rate ? fmtNum(r.rate) : '-'}</Td>
                        <Td right className="text-emerald-700 font-medium">{r.amount ? `Rs ${fmtNum(r.amount)}` : '-'}</Td>
                        <Td>{r.supplier || '-'}</Td>
                        <Td>{r.notes || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-xs">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-slate-700">Total</td>
                      <td className="px-3 py-2 text-right text-slate-800">{fmtNum(data.totals.stockQty)}</td>
                      <td className="px-3 py-2 text-right text-slate-400">-</td>
                      <td className="px-3 py-2 text-right text-emerald-700">Rs {fmtNum(data.totals.stockAmount)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          {/* Section 2: Transfers to Generators */}
          <Section title="Transferred → Generators" color="amber" count={data.genTransfers.length}>
            {data.genTransfers.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                    <tr>
                      <Th>Date</Th>
                      <Th>From Tank</Th>
                      <Th>Generator</Th>
                      <Th right>Qty (L)</Th>
                      <Th>Notes</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.genTransfers.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <Td>{fmtDate(r.date)}</Td>
                        <Td><span className="font-medium text-blue-700">{r.tank?.name || '-'}</span></Td>
                        <Td><span className="font-medium text-amber-700">{r.generator?.name || '-'}</span></Td>
                        <Td right className="font-semibold text-slate-800">{fmtNum(r.quantity)}</Td>
                        <Td>{r.notes || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-xs">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-slate-700">Total</td>
                      <td className="px-3 py-2 text-right text-slate-800">{fmtNum(data.totals.genTransferQty)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          {/* Section 3: Tank→Tank Out */}
          <Section title="Transferred → Other Tanks (Out)" color="purple" count={data.tankTransfersOut.length}>
            {data.tankTransfersOut.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                    <tr>
                      <Th>Date</Th>
                      <Th>From Tank</Th>
                      <Th>To Tank</Th>
                      <Th right>Qty (L)</Th>
                      <Th>Notes</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.tankTransfersOut.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <Td>{fmtDate(r.date)}</Td>
                        <Td><span className="font-medium text-blue-700">{r.fromTank?.name || '-'}</span></Td>
                        <Td><span className="font-medium text-purple-700">{r.toTank?.name || '-'}</span></Td>
                        <Td right className="font-semibold text-slate-800">{fmtNum(r.quantity)}</Td>
                        <Td>{r.notes || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-xs">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-slate-700">Total</td>
                      <td className="px-3 py-2 text-right text-slate-800">{fmtNum(data.totals.tankOutQty)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          {/* Section 4: Tank→Tank In */}
          <Section title="Received From Other Tanks (In)" color="teal" count={data.tankTransfersIn.length}>
            {data.tankTransfersIn.length === 0 ? <Empty /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
                    <tr>
                      <Th>Date</Th>
                      <Th>From Tank</Th>
                      <Th>To Tank</Th>
                      <Th right>Qty (L)</Th>
                      <Th>Notes</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.tankTransfersIn.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <Td>{fmtDate(r.date)}</Td>
                        <Td><span className="font-medium text-slate-600">{r.fromTank?.name || '-'}</span></Td>
                        <Td><span className="font-medium text-teal-700">{r.toTank?.name || '-'}</span></Td>
                        <Td right className="font-semibold text-slate-800">{fmtNum(r.quantity)}</Td>
                        <Td>{r.notes || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-xs">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-slate-700">Total</td>
                      <td className="px-3 py-2 text-right text-slate-800">{fmtNum(data.totals.tankInQty)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>
        </>
      )}

      {loading && !data && (
        <div className="text-center py-16 text-slate-400 text-sm">Loading...</div>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

const colorMap = {
  blue:   'border-blue-400 text-blue-700',
  amber:  'border-amber-400 text-amber-700',
  purple: 'border-purple-400 text-purple-700',
  teal:   'border-teal-400 text-teal-700',
};

function Section({ title, color, count, children }) {
  return (
    <div className="mb-5">
      <div className={`flex items-center gap-2 border-l-4 pl-3 mb-3 ${colorMap[color] || 'border-slate-400 text-slate-700'}`}>
        <h2 className="font-semibold text-sm">{title}</h2>
        <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{count}</span>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Th({ children, right }) {
  return <th className={`px-3 py-2 font-semibold tracking-wide ${right ? 'text-right' : 'text-left'}`}>{children}</th>;
}

function Td({ children, right, className = '' }) {
  return <td className={`px-3 py-2 text-slate-600 ${right ? 'text-right' : ''} ${className}`}>{children}</td>;
}

function Empty() {
  return <p className="text-xs text-slate-400 text-center py-6">Is period mein koi record nahi hai</p>;
}
