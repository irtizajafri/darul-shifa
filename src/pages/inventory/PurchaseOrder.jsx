import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useModalKeys from '../../hooks/useModalKeys';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Plus, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';
import { printPODocument } from '../../utils/printPO';

function SearchableSelect({ options, value, onChange, placeholder, getLabel, getValue, className = '' }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const selected = options.find((o) => String(getValue(o)) === String(value));

  const filtered = useMemo(
    () => !search ? options : options.filter((o) => getLabel(o).toLowerCase().includes(search.toLowerCase())),
    [options, search, getLabel]
  );

  const openDropdown = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
    setSearch('');
    setOpen(true);
  };

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        value={open ? search : (selected ? getLabel(selected) : '')}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={openDropdown}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
        autoComplete="off"
      />
      {open && (
        <div style={dropdownStyle} className="bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-400">No results</div>
          ) : (
            filtered.map((o) => (
              <div
                key={getValue(o)}
                onMouseDown={() => { onChange(String(getValue(o))); setSearch(''); setOpen(false); }}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${String(getValue(o)) === String(value) ? 'bg-blue-50 font-medium' : ''}`}
              >
                {getLabel(o)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const createEmptyPoLine = () => ({
  itemId: '',
  requiredQuantity: '',
  orderedRate: '',
  lastGRNQuantity: '',
});


export default function PurchaseOrder() {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    supplierId: '',
    itemId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [formData, setFormData] = useState({
    supplierId: '',
    poDate: new Date().toISOString().slice(0, 10),
    expectedDate: new Date().toISOString().slice(0, 10),
    items: [],
  });
  const [draftLine, setDraftLine] = useState(createEmptyPoLine());

  const {
    loading,
    purchaseOrders,
    items,
    masterOptions,
    fetchItems,
    fetchMastersOptions,
    fetchPurchaseOrders,
    createPurchaseOrder,
  } = useInventoryStore();

  useEffect(() => {
    Promise.all([
      fetchPurchaseOrders({}),
      fetchItems({ status: 'active' }),
      fetchMastersOptions(),
    ]).catch((err) => toast.error(err.message || 'Failed to load PO data'));
  }, [fetchPurchaseOrders, fetchItems, fetchMastersOptions]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = purchaseOrders || [];
    if (!q) return rows;
    return rows.filter((r) => [
      r.code,
      r.supplier?.name,
      r.item?.name,
      r.status,
    ].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [purchaseOrders, query]);

  useEffect(() => {
    if (location.state?.openCreate) {
      setShowCreate(true);
    }
  }, [location.state]);

  const [showOnlyReorder, setShowOnlyReorder] = useState(true);

  const supplierScopedItems = useMemo(() => {
    let result = items || [];
    if (showOnlyReorder) {
      result = result.filter(
        (item) => Number(item.reorderLevel) > 0 && Number(item.currentStock) <= Number(item.reorderLevel)
      );
    }
    return result;
  }, [items, showOnlyReorder]);

  const handleCreatePO = async (e, shouldPrint = false) => {
    e.preventDefault();
    try {
      const validLines = (formData.items || []).filter((line) => (
        Number(line.itemId) > 0 && Number(line.requiredQuantity) > 0
      ));

      if (!Number(formData.supplierId)) {
        toast.error('Please select supplier');
        return;
      }

      if (validLines.length === 0) {
        toast.error('At least one valid item line is required');
        return;
      }

      const duplicateItemIds = validLines
        .map((line) => Number(line.itemId))
        .filter((itemId, idx, arr) => arr.indexOf(itemId) !== idx);

      if (duplicateItemIds.length) {
        toast.error('Same item cannot be added multiple times in one PO');
        return;
      }

      const result = await createPurchaseOrder({
        supplierId: Number(formData.supplierId),
        poDate: new Date(formData.poDate).toISOString(),
        expectedDate: new Date(formData.expectedDate).toISOString(),
        items: validLines.map((line) => ({
          itemId: Number(line.itemId),
          requiredQuantity: Number(line.requiredQuantity),
          orderedRate: line.orderedRate === '' ? undefined : Number(line.orderedRate),
        })),
      });

      if (shouldPrint) printPODocument(result);

      await fetchPurchaseOrders(filters);
      setFormData({
        supplierId: '',
        poDate: new Date().toISOString().slice(0, 10),
        expectedDate: new Date().toISOString().slice(0, 10),
        items: [],
      });
      setDraftLine(createEmptyPoLine());
      setShowCreate(false);
      toast.success('PO created');
    } catch (err) {
      toast.error(err.message || 'Failed to create PO');
    }
  };

  const fakeEvent = { preventDefault: () => {} };

  useModalKeys({
    active: showCreate,
    onEsc: () => { setShowCreate(false); setDraftLine(createEmptyPoLine()); },
    onCtrlS: () => handleCreatePO(fakeEvent, false),
    onCtrlP: () => handleCreatePO(fakeEvent, true),
  });

  const applyFilters = async () => {
    try {
      await fetchPurchaseOrders(filters);
    } catch (err) {
      toast.error(err.message || 'Failed to apply PO filters');
    }
  };

  const resetFilters = async () => {
    const empty = { status: '', supplierId: '', itemId: '', dateFrom: '', dateTo: '' };
    setFilters(empty);
    try {
      await fetchPurchaseOrders(empty);
    } catch (err) {
      toast.error(err.message || 'Failed to reset PO filters');
    }
  };

  const updateDraftLine = (key, value) => {
    setDraftLine((prev) => ({ ...prev, [key]: value }));
    if (key === 'itemId' && value) {
      const itemData = (items || []).find((i) => String(i.id) === String(value));
      const rate = itemData?.lastGrnRate ?? itemData?.purchasePrice ?? null;
      if (rate) {
        setDraftLine((prev) => ({ ...prev, orderedRate: String(rate) }));
      }
    }
  };

  const handleAddDraftLine = () => {
    if (!draftLine.itemId) {
      toast.error('Please select an item');
      return;
    }
    if (!draftLine.requiredQuantity || Number(draftLine.requiredQuantity) < 1) {
      toast.error('Please enter a valid quantity');
      return;
    }
    const duplicate = (formData.items || []).some((l) => String(l.itemId) === String(draftLine.itemId));
    if (duplicate) {
      toast.error('This item is already added');
      return;
    }
    setFormData((prev) => ({ ...prev, items: [...(prev.items || []), { ...draftLine }] }));
    setDraftLine(createEmptyPoLine());
  };

  const removePoLine = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: (prev.items || []).filter((_, idx) => idx !== index),
    }));
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Orders (PO)</h1>
          <p className="text-slate-500 text-sm">Generate and track supplier orders</p>
        </div>
        <Button label="Create New PO" icon={Plus} onClick={() => setShowCreate((s) => !s)} />
      </div>

      {showCreate && (
        <Card className="mb-4">
          <form onSubmit={handleCreatePO} className="space-y-4">
            {/* Header: Supplier + PO Date + Expected Date */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SearchableSelect
                options={masterOptions.suppliers || []}
                value={formData.supplierId}
                onChange={(val) => setFormData((p) => ({ ...p, supplierId: val }))}
                placeholder="Select Supplier"
                getLabel={(s) => `${s.name} (${s.code})`}
                getValue={(s) => s.id}
              />
              <div>
                <label className="block text-xs text-slate-500 mb-1">PO Date</label>
                <input
                  type="date"
                  value={formData.poDate}
                  onChange={(e) => setFormData((p) => ({ ...p, poDate: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Expected Delivery Date</label>
                <input
                  type="date"
                  value={formData.expectedDate}
                  onChange={(e) => setFormData((p) => ({ ...p, expectedDate: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm w-full"
                  required
                />
              </div>
            </div>

            {/* Draft row: add a new item line */}
            <div className="border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Add Item</p>
                <button
                  type="button"
                  onClick={() => setShowOnlyReorder((v) => !v)}
                  className={`text-xs px-2 py-1 rounded-full border font-medium transition-colors ${
                    showOnlyReorder
                      ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'bg-slate-100 border-slate-300 text-slate-500'
                  }`}
                >
                  {showOnlyReorder ? `Reorder items only (${supplierScopedItems.length})` : 'Showing all items'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <SearchableSelect
                  options={supplierScopedItems}
                  value={draftLine.itemId}
                  onChange={(val) => updateDraftLine('itemId', val)}
                  placeholder={showOnlyReorder ? 'Search reorder items...' : 'Search all items...'}
                  getLabel={(item) => `${item.name} (${item.code}) — Stock: ${item.currentStock} / Reorder: ${item.reorderLevel}`}
                  getValue={(item) => item.id}
                  className="w-80"
                />
                <input
                  type="number"
                  min="1"
                  placeholder="Quantity"
                  value={draftLine.requiredQuantity}
                  onChange={(e) => updateDraftLine('requiredQuantity', e.target.value)}
                  className="w-28 px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Rate"
                  value={draftLine.orderedRate}
                  onChange={(e) => updateDraftLine('orderedRate', e.target.value)}
                  className="w-28 px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
                {draftLine.lastGRNQuantity !== '' && (
                  <span className="text-xs text-slate-500 self-center">
                    Last GRN Qty: <strong>{draftLine.lastGRNQuantity}</strong>
                  </span>
                )}
                <Button type="button" label="Add" icon={Plus} onClick={handleAddDraftLine} />
              </div>
            </div>

            {/* Added items table */}
            {(formData.items || []).length > 0 && (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="px-4 py-2">#</th>
                      <th className="px-4 py-2">Item</th>
                      <th className="px-4 py-2">Qty</th>
                      <th className="px-4 py-2">Rate</th>
                      <th className="px-4 py-2">Amount</th>
                      <th className="px-4 py-2">Last GRN Qty</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(formData.items || []).map((line, idx) => {
                      const qty = Number(line.requiredQuantity) || 0;
                      const rate = Number(line.orderedRate) || 0;
                      const amount = qty > 0 && rate > 0 ? qty * rate : 0;
                      const itemObj = (items || []).find((i) => String(i.id) === String(line.itemId));
                      return (
                        <tr key={`added-line-${idx}`} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-2 font-medium text-slate-800">
                            {itemObj ? `${itemObj.name} (${itemObj.code})` : '-'}
                          </td>
                          <td className="px-4 py-2">{line.requiredQuantity}</td>
                          <td className="px-4 py-2">{line.orderedRate || '-'}</td>
                          <td className="px-4 py-2">{amount > 0 ? amount.toFixed(2) : '-'}</td>
                          <td className="px-4 py-2 text-slate-500">{line.lastGRNQuantity || '-'}</td>
                          <td className="px-4 py-2">
                            <button
                              type="button"
                              onClick={() => removePoLine(idx)}
                              className="text-slate-400 hover:text-red-500"
                              aria-label="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                label={loading ? 'Saving...' : `Save PO (${(formData.items || []).length} item${(formData.items || []).length !== 1 ? 's' : ''})`}
                disabled={loading || (formData.items || []).length === 0}
              />
              <Button
                type="button"
                label={loading ? 'Saving...' : 'Save & Print'}
                disabled={loading || (formData.items || []).length === 0}
                onClick={(e) => handleCreatePO(e, true)}
              />
              <Button type="button" variant="secondary" label="Cancel" onClick={() => { setShowCreate(false); setDraftLine(createEmptyPoLine()); }} />
            </div>
          </form>
        </Card>
      )}

      {/* <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search PO Number or Supplier..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 w-64"
              />
            </div>

            <select
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="received">Received</option>
            </select>

            <select
              value={filters.supplierId}
              onChange={(e) => setFilters((p) => ({ ...p, supplierId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Suppliers</option>
              {(masterOptions.suppliers || []).map((sup) => (
                <option key={sup.id} value={sup.id}>{sup.name}</option>
              ))}
            </select>

            <select
              value={filters.itemId}
              onChange={(e) => setFilters((p) => ({ ...p, itemId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Items</option>
              {(items || []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              title="From date"
            />

            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              title="To date"
            />

            <Button label="Apply" size="sm" variant="outline" onClick={applyFilters} />
            <Button label="Reset" size="sm" variant="secondary" onClick={resetFilters} />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">{filteredRows.length} record(s)</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">PO Number</th>
                <th className="px-6 py-4 font-semibold">Supplier</th>
                <th className="px-6 py-4 font-semibold">Item</th>
                <th className="px-6 py-4 font-semibold">Req Qty</th>
                <th className="px-6 py-4 font-semibold">Rate</th>
                <th className="px-6 py-4 font-semibold">Expected Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                    No Purchase Orders found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4">{row.code}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{row.supplier?.name || '-'}</td>
                    <td className="px-6 py-4">{row.item?.name || '-'}</td>
                    <td className="px-6 py-4">{row.requiredQuantity}</td>
                    <td className="px-6 py-4">{row.orderedRate ?? '-'}</td>
                    <td className="px-6 py-4">{row.expectedDate ? new Date(row.expectedDate).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 capitalize">{row.status}</td>
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
