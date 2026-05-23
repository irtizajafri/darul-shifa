import { useEffect, useMemo, useRef, useState } from 'react';
import useModalKeys from '../../hooks/useModalKeys';
import { ChevronDown, ChevronUp, Download, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useInventoryStore } from '../../store/useInventoryStore';
import { generateSalesInvoicePdf } from '../../utils/exportInventoryReports';

function toDateInput(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function SearchableSelect({ options = [], value, onChange, placeholder = 'Search...', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setSearch(''); }}
        className="w-full flex items-center justify-between px-3 py-2 border border-slate-300 rounded-md text-sm bg-white text-left disabled:opacity-50"
      >
        <span className={selected ? 'text-slate-800' : 'text-slate-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to search..."
              className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-400">No results</li>
            ) : (
              filtered.map((o) => (
                <li
                  key={o.value}
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 ${String(o.value) === String(value) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'}`}
                >
                  {o.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function createEmptyLine() {
  return { itemId: '', quantity: '' };
}

export default function SalesInvoice() {
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(true);
  const [showInvoiceTable, setShowInvoiceTable] = useState(false);

  const [header, setHeader] = useState({
    invoiceDate: toDateInput(),
    customerType: 'walking',
    customerName: '',
  });

  const [draftLine, setDraftLine] = useState(createEmptyLine());
  const [lines, setLines] = useState([]);
  const [discountPercent, setDiscountPercent] = useState('');

  const [filters, setFilters] = useState({ customerType: '', dateFrom: '', dateTo: '' });

  const {
    loading,
    items,
    salesInvoiceHeaders,
    fetchItems,
    fetchSalesInvoiceHeaders,
    createSalesInvoiceWithItems,
  } = useInventoryStore();

  useEffect(() => {
    Promise.all([
      fetchItems({ status: 'active' }),
      fetchSalesInvoiceHeaders(),
    ]).catch((err) => toast.error(err.message || 'Failed to load'));
  }, [fetchItems, fetchSalesInvoiceHeaders]);

  const itemOptions = useMemo(() =>
    (items || []).map((i) => ({ value: i.id, label: `${i.name} (${i.code})` })),
    [items]
  );

  const getItemById = (id) => (items || []).find((i) => Number(i.id) === Number(id)) || null;

  const getPricing = (itemId, qty) => {
    const item = getItemById(itemId);
    if (!item) return null;
    const saleRate = Number(item.lastGrnRate || item.purchasePrice || 0);
    const total = saleRate * Number(qty || 0);
    return { saleRate, total };
  };

  const draftPricing = useMemo(
    () => getPricing(draftLine.itemId, draftLine.quantity),
    [draftLine, items]
  );

  const handleAddLine = () => {
    if (!draftLine.itemId) { toast.error('Please select an item'); return; }
    if (!draftLine.quantity || Number(draftLine.quantity) <= 0) { toast.error('Please enter a valid quantity'); return; }
    const duplicate = lines.some((l) => String(l.itemId) === String(draftLine.itemId));
    if (duplicate) { toast.error('This item is already added'); return; }
    setLines((prev) => [...prev, { ...draftLine }]);
    setDraftLine(createEmptyLine());
  };

  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const grandTotal = useMemo(() =>
    lines.reduce((sum, l) => {
      const p = getPricing(l.itemId, l.quantity);
      return sum + (p ? p.total : 0);
    }, 0),
    [lines, items]
  );

  const discountAmount = grandTotal * (Number(discountPercent || 0) / 100);
  const finalTotal = grandTotal - discountAmount;

  const handleSave = async () => {
    if (lines.length === 0) { toast.error('Add at least one item'); return; }
    if (header.customerType === 'customer' && !header.customerName.trim()) {
      toast.error('Please enter patient name');
      return;
    }

    try {
      const payload = {
        invoiceDate: header.invoiceDate,
        customerType: header.customerType,
        customerName: header.customerType === 'customer' ? header.customerName : undefined,
        discountPercent: Number(discountPercent || 0),
        items: lines.map((l) => ({
          itemId: Number(l.itemId),
          quantity: Number(l.quantity),
        })),
      };

      const created = await createSalesInvoiceWithItems(payload);
      await Promise.all([
        fetchSalesInvoiceHeaders(filters),
        fetchItems({ status: 'active' }),
      ]);

      setLines([]);
      setDraftLine(createEmptyLine());
      setDiscountPercent('');
      setHeader({ invoiceDate: toDateInput(), customerType: 'walking', customerName: '' });
      setShowForm(false);
      toast.success('Sales invoice created');
      printInvoice(created);
    } catch (err) {
      toast.error(err.message || 'Failed to create sales invoice');
    }
  };

  const printInvoice = (inv) => generateSalesInvoicePdf({ inv, mode: 'download' });
  const handlePrint = (inv) => generateSalesInvoicePdf({ inv, mode: 'print' });

  useModalKeys({
    active: showForm,
    onEsc: () => { setShowForm(false); setLines([]); setDraftLine(createEmptyLine()); setDiscountPercent(''); },
    onCtrlS: handleSave,
  });

  const applyFilters = async () => {
    try { await fetchSalesInvoiceHeaders(filters); }
    catch (err) { toast.error(err.message || 'Failed to apply filters'); }
  };

  const resetFilters = async () => {
    const empty = { customerType: '', dateFrom: '', dateTo: '' };
    setFilters(empty);
    try { await fetchSalesInvoiceHeaders(empty); }
    catch (err) { toast.error(err.message || 'Failed to reset filters'); }
  };

  const filteredHeaders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = salesInvoiceHeaders || [];
    if (!q) return rows;
    return rows.filter((h) =>
      [h.code, h.customerType, h.customerName].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [salesInvoiceHeaders, query]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Invoice</h1>
          <p className="text-slate-500 text-sm">Fair Price Shop billing with markup percentage & stock deduction</p>
        </div>
        <Button label="New Invoice" icon={Plus} onClick={() => setShowForm((s) => !s)} />
      </div>

      {showForm && (
        <Card className="mb-4" title="Create Sales Invoice">
          {/* Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="md:col-span-3 border border-slate-200 rounded-md p-3">
              <p className="text-xs text-slate-500 mb-2">Customer Type</p>
              <div className="flex gap-4">
                {['walking', 'customer'].map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="customerType"
                      value={type}
                      checked={header.customerType === type}
                      onChange={(e) => setHeader((p) => ({ ...p, customerType: e.target.value, customerName: '' }))}
                    />
                    {type === 'walking' ? 'Walking Customer' : 'Patient Name'}
                  </label>
                ))}
              </div>
            </div>

            {header.customerType === 'customer' && (
              <input
                type="text"
                placeholder="Patient Name"
                value={header.customerName}
                onChange={(e) => setHeader((p) => ({ ...p, customerName: e.target.value }))}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm md:col-span-2"
              />
            )}

            <input
              type="date"
              value={header.invoiceDate}
              onChange={(e) => setHeader((p) => ({ ...p, invoiceDate: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
          </div>

          {/* Draft line */}
          <div className="border border-dashed border-slate-300 rounded-md p-3 mb-3 bg-slate-50">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Add Item</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 items-end">
              <div className="md:col-span-2">
                <SearchableSelect
                  options={itemOptions}
                  value={draftLine.itemId}
                  onChange={(val) => setDraftLine((p) => ({ ...p, itemId: val }))}
                  placeholder="Select Item"
                />
              </div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Quantity"
                value={draftLine.quantity}
                onChange={(e) => setDraftLine((p) => ({ ...p, quantity: e.target.value }))}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            {draftPricing && draftLine.itemId && (
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                <span className="bg-white border border-slate-200 rounded px-2 py-1">Rate: {draftPricing.saleRate.toFixed(2)}</span>
                <span className="bg-white border border-slate-200 rounded px-2 py-1">Total: {draftPricing.total.toFixed(2)}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleAddLine}
              className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="w-4 h-4" /> Add to Invoice
            </button>
          </div>

          {/* Lines table */}
          {lines.length > 0 && (
            <div className="border border-slate-200 rounded-md overflow-hidden mb-3">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Rate</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l, idx) => {
                    const p = getPricing(l.itemId, l.quantity);
                    const item = getItemById(l.itemId);
                    return (
                      <tr key={idx}>
                        <td className="px-3 py-2">{item ? `${item.name} (${item.code})` : '-'}</td>
                        <td className="px-3 py-2">{l.quantity}</td>
                        <td className="px-3 py-2">{p ? p.saleRate.toFixed(2) : '-'}</td>
                        <td className="px-3 py-2 font-medium">{p ? p.total.toFixed(2) : '-'}</td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50">
                    <td colSpan={3} className="px-3 py-2 text-right text-slate-600 text-sm">Sub Total</td>
                    <td className="px-3 py-2 text-slate-700">{grandTotal.toFixed(2)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Discount */}
          {lines.length > 0 && (
            <div className="flex items-center justify-between gap-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <label className="text-sm font-medium text-slate-700">Discount %</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="px-3 py-1.5 border border-amber-300 rounded-md text-sm w-28 text-right focus:outline-none focus:border-amber-500"
              />
              <div className="flex flex-col items-end text-sm gap-0.5">
                {Number(discountPercent) > 0 && (
                  <span className="text-red-500">- {discountAmount.toFixed(2)}</span>
                )}
                <span className="font-bold text-slate-900 text-base">Final: {finalTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              label={loading ? 'Saving...' : `Save Invoice (${lines.length} item${lines.length !== 1 ? 's' : ''})`}
              disabled={loading || lines.length === 0}
              onClick={handleSave}
            />
            <Button
              type="button"
              label="Cancel"
              variant="secondary"
              onClick={() => { setShowForm(false); setLines([]); setDraftLine(createEmptyLine()); setDiscountPercent(''); }}
            />
          </div>
        </Card>
      )}

      {/* List */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-slate-700">🧾 Sales Invoices</p>
        <button
          onClick={() => setShowInvoiceTable((prev) => !prev)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
        >
          {showInvoiceTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showInvoiceTable ? 'Hide' : 'Show'}
        </button>
      </div>

      {showInvoiceTable && (
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2 bg-slate-50">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm w-56"
              />
            </div>

            <select
              value={filters.customerType}
              onChange={(e) => setFilters((p) => ({ ...p, customerType: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Types</option>
              <option value="walking">Walking</option>
              <option value="customer">Customer</option>
            </select>

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
            <p className="text-xs text-slate-500">{filteredHeaders.length} invoice(s)</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">Invoice No</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Items</th>
                <th className="px-6 py-4 font-semibold">Grand Total</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHeaders.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">No sales invoices found.</td>
                </tr>
              ) : (
                filteredHeaders.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-6 py-4 font-medium">{inv.code}</td>
                    <td className="px-6 py-4">{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 capitalize">{inv.customerType === 'customer' ? inv.customerName : 'Walking Customer'}</td>
                    <td className="px-6 py-4">
                      <ul className="text-xs text-slate-600 space-y-0.5">
                        {(inv.items || []).map((line) => (
                          <li key={line.id}>{line.item?.name || '-'} × {line.quantity}</li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4 font-semibold">{Number(inv.totalAmount || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" icon={Download} label="PDF" onClick={() => printInvoice(inv)} />
                        <Button size="sm" variant="outline" icon={Printer} label="Print" onClick={() => handlePrint(inv)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      )}
    </div>
  );
}