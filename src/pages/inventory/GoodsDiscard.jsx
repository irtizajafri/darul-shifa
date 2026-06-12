import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Download, FileText, Plus, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';
import { exportRowsToPdf } from '../../utils/exportInventoryReports';

// ── Portal dropdown list (escapes overflow-hidden containers) ─────────────────
function DropdownPortal({ inputRef, open, children }) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (open && inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left, width: r.width });
    }
  }, [open, inputRef]);

  if (!open) return null;

  return createPortal(
    <ul
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
      }}
      className="bg-white border border-slate-200 rounded-md shadow-xl max-h-48 overflow-y-auto"
    >
      {children}
    </ul>,
    document.body
  );
}

// ── Searchable Item Dropdown (form rows) ──────────────────────────────────────
function ItemSearchInput({ items, value, label, onChange }) {
  const [text, setText] = useState(label || '');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const q = text.toLowerCase();
    if (!q) return (items || []).slice(0, 15);
    return (items || [])
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.code || '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [text, items]);

  useEffect(() => {
    const h = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target)
      )
        setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={containerRef}>
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search item..."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            onChange(null, '');
          }}
          onFocus={() => setOpen(true)}
          className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
        />
        {value && (
          <span
            className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500"
            title="Item selected"
          />
        )}
      </div>

      <DropdownPortal inputRef={inputRef} open={open}>
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-xs text-slate-400 text-center">
            No items found
          </li>
        ) : (
          filtered.map((item) => (
            <li
              key={item.id}
              onMouseDown={() => {
                const lbl = `${item.name} (${item.code})`;
                setText(lbl);
                onChange(item.id, lbl);
                setOpen(false);
              }}
              className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer flex justify-between items-center gap-2"
            >
              <span className="font-medium text-slate-800 truncate">{item.name}</span>
              <span className="text-slate-400 text-xs shrink-0">{item.code}</span>
            </li>
          ))
        )}
      </DropdownPortal>
    </div>
  );
}

// ── Searchable filter dropdown (toolbar, with clear ×) ────────────────────────
function FilterItemSearch({ items, value, onChange }) {
  const selectedItem = (items || []).find((i) => String(i.id) === String(value));
  const [text, setText] = useState(
    selectedItem ? `${selectedItem.name} (${selectedItem.code})` : ''
  );
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const q = text.toLowerCase();
    if (!q) return (items || []).slice(0, 15);
    return (items || [])
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.code || '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [text, items]);

  useEffect(() => {
    const h = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const clear = () => { setText(''); onChange(''); };

  return (
    <div className="relative w-52" ref={containerRef}>
      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Filter by item..."
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        className="w-full pl-8 pr-7 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
      />
      {value && (
        <button
          type="button"
          onMouseDown={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
          title="Clear filter"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      <DropdownPortal inputRef={inputRef} open={open}>
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-xs text-slate-400 text-center">
            No items found
          </li>
        ) : (
          filtered.map((item) => (
            <li
              key={item.id}
              onMouseDown={() => {
                const lbl = `${item.name} (${item.code})`;
                setText(lbl);
                onChange(String(item.id));
                setOpen(false);
              }}
              className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer flex justify-between items-center gap-2"
            >
              <span className="font-medium text-slate-800 truncate">{item.name}</span>
              <span className="text-slate-400 text-xs shrink-0">{item.code}</span>
            </li>
          ))
        )}
      </DropdownPortal>
    </div>
  );
}

// ── Unique line factory ───────────────────────────────────────────────────────
const mkLine = () => ({
  uid: `${Date.now()}-${Math.random()}`,
  itemId: '',
  itemLabel: '',
  quantity: '',
  scrapValue: '',
});

// ─────────────────────────────────────────────────────────────────────────────
export default function GoodsDiscard() {
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(true);
  const [filters, setFilters] = useState({ itemId: '', dateFrom: '', dateTo: '' });

  const [form, setForm] = useState({
    lines: [mkLine()],
    reason: '',
    discardedDate: new Date().toISOString().slice(0, 10),
  });

  const { loading, items, gdns, fetchItems, fetchGDNs, createGDN } = useInventoryStore();

  useEffect(() => {
    Promise.all([fetchItems({ status: 'active' }), fetchGDNs()]).catch(
      (err) => toast.error(err.message || 'Failed to load GDN data')
    );
  }, [fetchItems, fetchGDNs]);

  // ── Filtered table rows ───────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = gdns || [];
    if (!q) return rows;
    return rows.filter((r) =>
      [r.code, r.reason, r.item?.name, r.item?.code].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );
  }, [gdns, query]);

  // ── Filter controls ───────────────────────────────────────────────────────
  const applyFilters = async () => {
    try { await fetchGDNs(filters); }
    catch (err) { toast.error(err.message || 'Failed to apply filters'); }
  };

  const resetFilters = async () => {
    const empty = { itemId: '', dateFrom: '', dateTo: '' };
    setFilters(empty);
    try { await fetchGDNs(empty); }
    catch (err) { toast.error(err.message || 'Failed to reset filters'); }
  };

  // ── PDF for a single GDN record ───────────────────────────────────────────
  const printSingleGdn = (row) => {
    exportRowsToPdf({
      fileName: `gdn-${row.code}`,
      title: 'Goods Discard Note (GDN)',
      rows: [{
        gdnCode: row.code,
        itemCode: row.item?.code || '-',
        itemName: row.item?.name || '-',
        quantity: row.quantity,
        reason: row.reason,
        discardedDate: row.discardedDate
          ? new Date(row.discardedDate).toLocaleDateString()
          : '-',
      }],
    });
  };

  // ── Line helpers ──────────────────────────────────────────────────────────
  const addLine = () => setForm((p) => ({ ...p, lines: [...p.lines, mkLine()] }));

  const removeLine = (idx) =>
    setForm((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }));

  const updateLine = (idx, field, val, lbl) =>
    setForm((p) => {
      const lines = [...p.lines];
      lines[idx] = { ...lines[idx], [field]: val };
      if (lbl !== undefined) lines[idx].itemLabel = lbl;
      return { ...p, lines };
    });

  const resetForm = () =>
    setForm({
      lines: [mkLine()],
      reason: '',
      discardedDate: new Date().toISOString().slice(0, 10),
    });

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleCreateGdn = async (e) => {
    e.preventDefault();

    for (const line of form.lines) {
      if (!line.itemId) {
        toast.error('Please select an item for all rows');
        return;
      }
      if (!line.quantity || Number(line.quantity) <= 0) {
        toast.error('Enter a valid quantity for all rows');
        return;
      }
    }

    try {
      const created = [];
      for (const line of form.lines) {
        const gdn = await createGDN({
          itemId: Number(line.itemId),
          quantity: Number(line.quantity),
          reason: form.reason,
          scrapValue: line.scrapValue !== '' ? Number(line.scrapValue) : null,
          discardedDate: form.discardedDate,
        });
        created.push(gdn);
      }

      await Promise.all([fetchGDNs(filters), fetchItems({ status: 'active' })]);
      resetForm();
      setShowForm(false);
      toast.success(`${created.length} GDN${created.length > 1 ? 's' : ''} created`);
      created.forEach((gdn) => printSingleGdn(gdn));
    } catch (err) {
      toast.error(err.message || 'Failed to create GDN');
    }
  };

  // ── Export rows for bulk PDF ──────────────────────────────────────────────
  const gdnExportRows = useMemo(
    () =>
      filteredRows.map((row) => ({
        gdnCode: row.code,
        itemCode: row.item?.code || '-',
        itemName: row.item?.name || '-',
        quantity: row.quantity,
        reason: row.reason,
        discardedDate: row.discardedDate
          ? new Date(row.discardedDate).toLocaleDateString()
          : '-',
      })),
    [filteredRows]
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Goods Discard Note (GDN)</h1>
          <p className="text-slate-500 text-sm">Discard expired or damaged goods and reduce stock</p>
        </div>
        <Button
          label="Discard Goods"
          icon={Plus}
          onClick={() => { resetForm(); setShowForm((s) => !s); }}
        />
      </div>

      {/* ── Create Form ──────────────────────────────────────────────────── */}
      {showForm && (
        <Card className="mb-4" title="Create Goods Discard Note (GDN)">
          <form onSubmit={handleCreateGdn} className="space-y-4">

            {/* Common fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Discard Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={form.discardedDate}
                  onChange={(e) => setForm((p) => ({ ...p, discardedDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Reason <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Expired / Damaged"
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>

            {/* Multi-item grid */}
            <div className="border border-slate-200 rounded-lg overflow-visible">
              {/* Grid header */}
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 rounded-t-lg">
                <div className="grid grid-cols-[2fr_1fr_1fr_32px] gap-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <span>Item</span>
                  <span>Quantity</span>
                  <span>Scrap Value (PKR)</span>
                  <span />
                </div>
              </div>

              {/* Item rows */}
              {form.lines.map((line, idx) => (
                <div
                  key={line.uid}
                  className="px-4 py-3 border-b border-slate-100 last:border-b-0 last:rounded-b-lg bg-white"
                >
                  <div className="grid grid-cols-[2fr_1fr_1fr_32px] gap-3 items-center">
                    <ItemSearchInput
                      key={line.uid}
                      items={items || []}
                      value={line.itemId}
                      label={line.itemLabel}
                      onChange={(id, lbl) =>
                        updateLine(idx, 'itemId', id || '', lbl || '')
                      }
                    />

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
                      required
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Optional"
                      value={line.scrapValue}
                      onChange={(e) => updateLine(idx, 'scrapValue', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
                    />

                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={form.lines.length === 1}
                      className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add item + submit */}
            <div className="flex justify-between items-center pt-1">
              <button
                type="button"
                onClick={addLine}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>

              <div className="flex gap-2 items-center">
                <span className="text-xs text-slate-400">
                  {form.lines.length} item{form.lines.length > 1 ? 's' : ''}
                </span>
                <Button
                  type="submit"
                  label={loading ? 'Saving...' : 'Save GDN'}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="secondary"
                  label="Cancel"
                  onClick={() => { resetForm(); setShowForm(false); }}
                />
              </div>
            </div>
          </form>
        </Card>
      )}

      {/* ── Records Table ─────────────────────────────────────────────────── */}
      {/* <Card className="p-0 overflow-hidden">
       
        <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 bg-slate-50">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Discard Notes..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 w-64"
              />
            </div>

            <FilterItemSearch
              items={items || []}
              value={filters.itemId}
              onChange={(id) => setFilters((p) => ({ ...p, itemId: id }))}
            />

            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />

            <Button size="sm" variant="outline" label="Apply" onClick={applyFilters} />
            <Button size="sm" variant="secondary" label="Reset" onClick={resetFilters} />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">{filteredRows.length} record(s)</p>
            <Button
              size="sm"
              variant="outline"
              icon={FileText}
              label="PDF"
              onClick={() =>
                exportRowsToPdf({
                  fileName: 'gdn-report',
                  title: 'Goods Discard Note Report',
                  rows: gdnExportRows,
                })
              }
            />
          </div>
        </div>

        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">GDN No</th>
                <th className="px-6 py-4 font-semibold">Item</th>
                <th className="px-6 py-4 font-semibold">Quantity</th>
                <th className="px-6 py-4 font-semibold">Reason</th>
                <th className="px-6 py-4 font-semibold">Scrap Value</th>
                <th className="px-6 py-4 font-semibold">Discarded Date</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    No Goods Discard Note (GDN) records found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-blue-700">{row.code}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {row.item?.name || '-'}
                      <span className="text-slate-400 font-normal ml-1 text-xs">
                        ({row.item?.code || '-'})
                      </span>
                    </td>
                    <td className="px-6 py-4">{row.quantity}</td>
                    <td className="px-6 py-4 text-slate-600">{row.reason}</td>
                    <td className="px-6 py-4">
                      {row.scrapValue != null
                        ? <span className="text-green-700 font-medium">PKR {Number(row.scrapValue).toLocaleString()}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      {row.discardedDate
                        ? new Date(row.discardedDate).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={Download}
                        label="PDF"
                        onClick={() => printSingleGdn(row)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card> */}
    </div>
  );
}
