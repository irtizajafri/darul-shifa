import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Search, RotateCcw, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useInventoryStore } from '../../store/useInventoryStore';

// ─── helpers ─────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);

function fmt(val, dec = 2) {
  const n = parseFloat(val);
  return isNaN(n) ? '0' : n.toFixed(dec);
}

function fmtDate(str) {
  if (!str) return '-';
  return new Date(str).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Print MRN ───────────────────────────────────────────────────────────────

function printMRN(mrn) {
  const rows = (mrn.mrnItems || [])
    .map(
      (mi, i) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${i + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${mi.item?.code || '-'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${mi.item?.name || '-'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${fmt(mi.returnedQty)} ${mi.item?.unit || ''}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><title>MRN ${mrn.code}</title>
  <style>*{font-family:sans-serif;margin:0;padding:0;box-sizing:border-box;}body{padding:24px;font-size:13px;}
  h1{font-size:18px;font-weight:700;}table{width:100%;border-collapse:collapse;margin-top:12px;}
  th{background:#f3f4f6;padding:6px 8px;text-align:left;font-weight:600;border-bottom:2px solid #d1d5db;}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin:12px 0;}
  .meta span{font-weight:600;}
  </style></head><body>
  <h1>Material Return Note (MRN)</h1>
  <p style="color:#6b7280;font-size:12px;margin-top:2px;">Darul Shifa Hospital</p>
  <hr style="margin:12px 0;border-color:#e5e7eb;">
  <div class="meta">
    <div>MRN # <span>${mrn.code}</span></div>
    <div>Return Date <span>${fmtDate(mrn.returnDate)}</span></div>
    <div>GIN # <span>${mrn.gin?.code || '-'}</span></div>
    <div>Department <span>${mrn.department?.name || '-'}</span></div>
    <div>Received By <span>${mrn.receivedBy || '-'}</span></div>
    ${mrn.notes ? `<div style="grid-column:span 2">Notes <span>${mrn.notes}</span></div>` : ''}
  </div>
  <table>
    <thead><tr>
      <th style="width:40px;">#</th>
      <th>Item Code</th>
      <th>Item Name</th>
      <th style="text-align:center;">Returned Qty</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="margin-top:32px;display:flex;justify-content:space-between;">
    <div style="text-align:center;"><div style="border-top:1px solid #374151;padding-top:4px;width:160px;">Returned By</div></div>
    <div style="text-align:center;"><div style="border-top:1px solid #374151;padding-top:4px;width:160px;">Received By (Store)</div></div>
  </div>
  </body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 400);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GoodsReturn() {
  const { gins, fetchGINs, mrns, fetchMRNs, createMRN, fetchItems } = useInventoryStore();

  // GIN search state
  const [ginSearch, setGinSearch] = useState('');
  const [selectedGIN, setSelectedGIN] = useState(null);
  const [showGINDropdown, setShowGINDropdown] = useState(false);
  const ginSearchRef = useRef(null);

  // Form state
  const [returnDate, setReturnDate] = useState(today());
  const [receivedBy, setReceivedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [returnQtys, setReturnQtys] = useState({}); // itemId → qty string
  const [saving, setSaving] = useState(false);

  // Reprint state
  const [showReprint, setShowReprint] = useState(false);
  const [reprintSearch, setReprintSearch] = useState('');

  useEffect(() => {
    fetchGINs({ dateFrom: '', dateTo: '' }).catch(() => {});
    fetchMRNs().catch(() => {});
  }, [fetchGINs, fetchMRNs]);

  // Filter GINs for dropdown
  const filteredGINs = (gins || []).filter((g) => {
    const q = ginSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      g.code?.toLowerCase().includes(q) ||
      g.department?.name?.toLowerCase().includes(q) ||
      g.gdHeader?.code?.toLowerCase().includes(q)
    );
  }).slice(0, 20);

  const selectGIN = (g) => {
    setSelectedGIN(g);
    setGinSearch(g.code);
    setShowGINDropdown(false);
    // init return qtys to blank
    const init = {};
    (g.ginItems || []).forEach((gi) => { init[gi.itemId] = ''; });
    setReturnQtys(init);
  };

  const clearGIN = () => {
    setSelectedGIN(null);
    setGinSearch('');
    setReturnQtys({});
  };

  // For each item in selected GIN: already returned across all MRNs
  const alreadyReturnedMap = (() => {
    if (!selectedGIN) return {};
    const map = {};
    (mrns || [])
      .filter((m) => m.ginId === selectedGIN.id)
      .forEach((m) => {
        (m.mrnItems || []).forEach((mi) => {
          map[mi.itemId] = (map[mi.itemId] || 0) + Number(mi.returnedQty || 0);
        });
      });
    return map;
  })();

  const handleSubmit = async (e, andPrint = false) => {
    e.preventDefault();
    if (!selectedGIN) return toast.error('GIN select karein pehle');

    const items = Object.entries(returnQtys)
      .map(([itemId, qty]) => ({ itemId: Number(itemId), returnedQty: parseFloat(qty) || 0 }))
      .filter((x) => x.returnedQty > 0);

    if (!items.length) return toast.error('Kam az kam ek item ki wapsi qty enter karein');

    setSaving(true);
    try {
      const mrn = await createMRN({
        ginId: selectedGIN.id,
        returnDate,
        receivedBy: receivedBy.trim() || undefined,
        notes: notes.trim() || undefined,
        items,
      });
      toast.success(`MRN ${mrn.code} bana diya`);
      await Promise.all([
        fetchMRNs(),
        fetchItems(),
      ]);
      clearGIN();
      setReturnDate(today());
      setReceivedBy('');
      setNotes('');
      if (andPrint) printMRN(mrn);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Reprint list
  const filteredMRNs = (mrns || []).filter((m) => {
    const q = reprintSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      m.code?.toLowerCase().includes(q) ||
      m.department?.name?.toLowerCase().includes(q) ||
      m.gin?.code?.toLowerCase().includes(q) ||
      (m.receivedBy || '').toLowerCase().includes(q)
    );
  }).slice(0, 20);

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-emerald-500';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
          <RotateCcw className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Material Return Note (MRN)</h1>
          <p className="text-sm text-slate-500">Department se maal wapas lena — stock restore hoga</p>
        </div>
      </div>

      {/* Create Form */}
      <Card className="p-5">
        <h2 className="text-base font-semibold text-slate-700 mb-4">Naya MRN</h2>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* GIN Search */}
          <div className="relative">
            <label className={labelCls}>GIN Select karein *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                ref={ginSearchRef}
                value={ginSearch}
                onChange={(e) => { setGinSearch(e.target.value); setShowGINDropdown(true); if (!e.target.value) clearGIN(); }}
                onFocus={() => setShowGINDropdown(true)}
                placeholder="GIN code ya department se dhundhein..."
                className={`${inputCls} pl-9`}
              />
              {selectedGIN && (
                <button type="button" onClick={clearGIN}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                  ✕
                </button>
              )}
            </div>

            {showGINDropdown && !selectedGIN && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredGINs.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400">Koi GIN nahi mili</div>
                ) : (
                  filteredGINs.map((g) => (
                    <button key={g.id} type="button"
                      onMouseDown={() => selectGIN(g)}
                      className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 border-b border-slate-100 last:border-0">
                      <span className="font-semibold text-sm text-slate-800">{g.code}</span>
                      <span className="text-xs text-slate-500 ml-2">
                        {g.department?.name || ''} — {fmtDate(g.issueDate)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected GIN details + items */}
          {selectedGIN && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <div><span className="text-slate-500">GIN:</span> <span className="font-semibold text-slate-800">{selectedGIN.code}</span></div>
                <div><span className="text-slate-500">Department:</span> <span className="font-semibold">{selectedGIN.department?.name || '-'}</span></div>
                <div><span className="text-slate-500">Issue Date:</span> <span className="font-semibold">{fmtDate(selectedGIN.issueDate)}</span></div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white border border-slate-200 rounded">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Item</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Issued</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Already Returned</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Max Returnable</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-emerald-700">Wapsi Qty *</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedGIN.ginItems || []).map((gi) => {
                      const issued = Number(gi.issuedQuantity || 0);
                      const returned = alreadyReturnedMap[gi.itemId] || 0;
                      const maxRet = Math.max(0, issued - returned);
                      const enteredQty = parseFloat(returnQtys[gi.itemId] || '0') || 0;
                      const isOver = enteredQty > maxRet;
                      return (
                        <tr key={gi.id} className="bg-white">
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-800">{gi.item?.name || '-'}</div>
                            <div className="text-xs text-slate-400">{gi.item?.code}</div>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-600">{fmt(issued)} {gi.item?.unit}</td>
                          <td className="px-3 py-2 text-right text-orange-600">{fmt(returned)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-700">{fmt(maxRet)}</td>
                          <td className="px-3 py-2 text-right">
                            {maxRet <= 0 ? (
                              <span className="text-xs text-slate-400 italic">Sab wapas</span>
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={maxRet}
                                value={returnQtys[gi.itemId] ?? ''}
                                onChange={(e) => setReturnQtys((p) => ({ ...p, [gi.itemId]: e.target.value }))}
                                className={`w-24 px-2 py-1 border rounded text-sm text-right focus:outline-none ${
                                  isOver
                                    ? 'border-red-400 bg-red-50 focus:border-red-500'
                                    : 'border-slate-300 focus:border-emerald-500'
                                }`}
                                placeholder="0"
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Return Date, Received By, Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Return Date *</label>
              <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
                className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Received By (Store)</label>
              <input type="text" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)}
                className={inputCls} placeholder="Store person ka naam" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                className={`${inputCls} resize-none`} placeholder="Wajah ya remarks..." />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" label={saving ? 'Saving...' : 'MRN Save Karein'} disabled={saving || !selectedGIN} />
            <Button type="button" label="Save + Print"
              onClick={(e) => handleSubmit(e, true)}
              disabled={saving || !selectedGIN} variant="outline"
              icon={Printer} />
          </div>
        </form>
      </Card>

      {/* Reprint Section */}
      <Card className="p-5">
        <button
          type="button"
          className="w-full flex items-center justify-between"
          onClick={() => setShowReprint((p) => !p)}
        >
          <h2 className="text-base font-semibold text-slate-700">
            Reprint / MRN List
            {mrns.length > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-400">({mrns.length} records)</span>
            )}
          </h2>
          {showReprint ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showReprint && (
          <div className="mt-4 space-y-3">
            <input
              type="text"
              value={reprintSearch}
              onChange={(e) => setReprintSearch(e.target.value)}
              placeholder="MRN code, GIN code, department se dhundhein..."
              className={inputCls}
            />

            {filteredMRNs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">Koi MRN nahi mili</div>
            ) : (
              <div className="space-y-2">
                {filteredMRNs.map((mrn) => (
                  <div key={mrn.id}
                    className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-800 text-sm">{mrn.code}</span>
                        <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">
                          GIN: {mrn.gin?.code || '-'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {mrn.department?.name} — {fmtDate(mrn.returnDate)}
                        {mrn.receivedBy && ` — ${mrn.receivedBy}`}
                      </div>
                      <div className="text-xs text-emerald-700 mt-0.5">
                        {(mrn.mrnItems || []).map((mi) =>
                          `${mi.item?.name} (${fmt(mi.returnedQty)} ${mi.item?.unit || ''})`
                        ).join(', ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => printMRN(mrn)}
                      className="p-2 rounded-md hover:bg-white hover:shadow text-slate-500 hover:text-emerald-600 transition-colors"
                      title="Print MRN"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
