import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import useModalKeys from '../../hooks/useModalKeys';
import { ChevronDown, ChevronUp, Download, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useAuthStore } from '../../store/useAuthStore';
import AdmissionPickerModal from '../../components/inventory/AdmissionPickerModal';
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
  const { user } = useAuthStore();
  // Saved on every invoice line — shows as "Created" in the Medicine Issuance reports.
  const createdByName = user?.name || user?.username || user?.email || null;
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

  const [admQuery, setAdmQuery] = useState('');
  const [admGINs, setAdmGINs] = useState(null);
  const [admLoading, setAdmLoading] = useState(false);
  const [admRates, setAdmRates] = useState({});
  const [showAdmPicker, setShowAdmPicker] = useState(false);

  const {
    loading,
    items,
    salesInvoiceHeaders,
    fetchItems,
    fetchSalesInvoiceHeaders,
    createSalesInvoiceWithItems,
    fetchGINsByAdmission,
    fetchAdmissionInvoices,
    updateSalesInvoiceLineRate,
  } = useInventoryStore();

  // Saved invoices for the searched admission — shown under "Already billed",
  // where each line's rate can be corrected (invoice-only change).
  const [admInvoices, setAdmInvoices] = useState([]);
  const [billedRateDrafts, setBilledRateDrafts] = useState({});
  const [savingLineId, setSavingLineId] = useState(null);

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

  const handleSave = async (withPrint = false) => {
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
        createdByName,
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
      if (withPrint) printInvoice(created);
    } catch (err) {
      toast.error(err.message || 'Failed to create sales invoice');
    }
  };

  const printInvoice = (inv) => generateSalesInvoicePdf({ inv, mode: 'print' });
  const handlePrint = (inv) => generateSalesInvoicePdf({ inv, mode: 'print' });

  const handleAdmSearch = async (admissionNoOverride) => {
    const admNo = (admissionNoOverride ?? admQuery).trim();
    if (!admNo) { toast.error('Enter admission number'); return; }
    setAdmLoading(true);
    try {
      const [data, invoices] = await Promise.all([
        fetchGINsByAdmission(admNo),
        fetchAdmissionInvoices(admNo),
      ]);
      const gins = Array.isArray(data) ? data : [];
      setAdmGINs(gins);
      setAdmInvoices(invoices);
      setBilledRateDrafts({});
      if (gins.length === 0) { toast('No GINs found for this admission number'); return; }
      // Editable rates start empty — each GIN line shows its own locked rate
      // until the user types a different one.
      setAdmRates({});
    } catch (err) {
      toast.error(err.message || 'Failed to search');
    } finally {
      setAdmLoading(false);
    }
  };

  // Admission search shows every GIN of the admission date-wise, one block
  // per GIN with its own lines and total, never merged across GINs. Each line
  // keeps the rate locked on its GIN (see createGINFromHeader's unitRate).
  //   • Not yet billed → rate editable here, billed by "Save Invoice".
  //   • Billed        → shows its invoice line's rate (editable, invoice-only
  //     change). New invoice lines point at their GIN line (ginItemId/ginId);
  //     older ones were merged across GINs, so they are matched by item when
  //     only one invoice line has that item, else the locked GIN rate shows.
  const admInvoiceLines = useMemo(() => admInvoices.flatMap((h) => (h.items || []).map((l) => ({ ...l, headerCode: h.code }))), [admInvoices]);
  const admGinBlocks = useMemo(() => {
    if (!admGINs) return [];
    const byGinItem = new Map();
    const byGin = new Map();
    const legacyByItem = new Map();
    admInvoiceLines.forEach((l) => {
      if (l.mrnItemId || Number(l.quantity) < 0) return; // MRN return lines — shown on their own below
      if (l.ginItemId) byGinItem.set(l.ginItemId, l);
      else if (l.ginId) byGin.set(l.ginId, l);
      else {
        const list = legacyByItem.get(l.itemId) || [];
        list.push(l);
        legacyByItem.set(l.itemId, list);
      }
    });
    const legacyLine = (itemId) => {
      const list = legacyByItem.get(itemId);
      return list && list.length === 1 ? list[0] : null;
    };

    return [...admGINs]
      .sort((a, b) => (new Date(a.issueDate || a.createdAt) - new Date(b.issueDate || b.createdAt)) || (a.id - b.id))
      .map((gin) => {
        const dept = gin.department?.name || gin.gdHeader?.department?.name || '-';
        const entries = gin.ginItems && gin.ginItems.length > 0
          ? gin.ginItems.map((gi) => ({
              key: `gi-${gi.id}`, ginItemIds: [gi.id], ginIds: [], billed: !!gi.isBilled,
              itemId: gi.item?.id, itemCode: gi.item?.code || '-', item: gi.item?.name || '-',
              qty: Number(gi.issuedQuantity || 0),
              lockedRate: Number(gi.unitRate ?? gi.item?.lastGrnRate ?? gi.item?.purchasePrice ?? 0),
              invoiceLine: gi.isBilled ? (byGinItem.get(gi.id) || legacyLine(gi.item?.id)) : null,
            }))
          : [{
              key: `g-${gin.id}`, ginItemIds: [], ginIds: [gin.id], billed: !!gin.isBilled,
              itemId: gin.item?.id, itemCode: gin.item?.code || '-', item: gin.item?.name || '-',
              qty: Number(gin.issuedQuantity || 0),
              lockedRate: Number(gin.unitRate ?? gin.item?.lastGrnRate ?? gin.item?.purchasePrice ?? 0),
              invoiceLine: gin.isBilled ? (byGin.get(gin.id) || legacyLine(gin.item?.id)) : null,
            }];
        // Zero quantity isn't a billable line (and used to fail the save).
        const lines = entries.filter((e) => e.qty > 0).map((e) => {
          let rate = e.lockedRate;
          if (!e.billed) rate = Number(admRates[e.key] ?? e.lockedRate);
          else if (e.invoiceLine) rate = Number(billedRateDrafts[e.invoiceLine.id] ?? e.invoiceLine.saleRate);
          return { ...e, rate, amount: e.qty * rate };
        });
        return {
          id: gin.id, code: gin.code, date: gin.issueDate || gin.createdAt, dept, lines,
          total: lines.reduce((s, l) => s + l.amount, 0),
        };
      })
      .filter((b) => b.lines.length > 0);
  }, [admGINs, admInvoiceLines, admRates, billedRateDrafts]);

  // Medicine the patient gave back (MRN) — minus lines on the bill.
  const admReturnLines = admInvoiceLines.filter((l) => l.mrnItemId || Number(l.quantity) < 0);
  const admReturnTotal = admReturnLines.reduce((s, l) => s + Number(l.totalAmount || 0), 0);

  const admPendingLines = admGinBlocks.flatMap((b) => b.lines.filter((l) => !l.billed));
  const admGrandTotal = admGinBlocks.reduce((s, b) => s + b.total, 0) + admReturnTotal;
  const admPendingTotal = admPendingLines.reduce((s, l) => s + l.amount, 0);

  const saveBilledRate = async (line) => {
    const draft = billedRateDrafts[line.id];
    const rate = Number(draft);
    if (draft === undefined || draft === '' || !Number.isFinite(rate) || rate < 0) {
      toast.error('Enter a valid rate');
      return;
    }
    setSavingLineId(line.id);
    try {
      const updatedHeader = await updateSalesInvoiceLineRate(line.id, rate);
      setAdmInvoices((prev) => prev.map((h) => (h.id === updatedHeader?.id ? updatedHeader : h)));
      setBilledRateDrafts((prev) => { const next = { ...prev }; delete next[line.id]; return next; });
      toast.success('Invoice rate updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update rate');
    } finally {
      setSavingLineId(null);
    }
  };

  const buildAdmInvObject = (code = `ADM-${admQuery}`) => ({
    code,
    customerType: 'customer',
    customerName: admQuery,
    invoiceDate: new Date().toISOString(),
    items: admPendingLines.map((l) => ({ item: { name: l.item }, saleRate: l.rate, quantity: l.qty, totalAmount: l.amount })),
    subTotal: admPendingTotal,
    totalAmount: admPendingTotal,
    discountPercent: 0,
    discountAmount: 0,
  });

  const printAdmInvoice = () => {
    if (admPendingLines.length === 0) return;
    generateSalesInvoicePdf({ inv: buildAdmInvObject(), mode: 'print' });
  };

  const [admSaving, setAdmSaving] = useState(false);

  const saveAdmInvoice = async () => {
    if (admPendingLines.length === 0) { toast.error('No items to save'); return; }
    const invalidItem = admPendingLines.find((r) => !r.itemId);
    if (invalidItem) { toast.error(`Item ID missing for: ${invalidItem.item}`); return; }
    setAdmSaving(true);
    try {
      const payload = {
        invoiceDate: new Date().toISOString(),
        customerType: 'admission',
        customerName: admQuery,
        discountPercent: 0,
        createdByName,
        // One invoice line per GIN line (not merged across GINs), each
        // pointing at the GIN line it bills — flipped to isBilled server-side
        // and remembered on the invoice line.
        items: admPendingLines.map((l) => ({
          itemId: Number(l.itemId),
          quantity: l.qty,
          saleRate: l.rate,
          ginIds: l.ginIds,
          ginItemIds: l.ginItemIds,
        })),
      };
      const created = await createSalesInvoiceWithItems(payload);
      await fetchSalesInvoiceHeaders(filters);
      toast.success('Admission invoice saved');
      generateSalesInvoicePdf({ inv: created, mode: 'print' });
      // Reload the same admission so the just-saved items stay on screen,
      // now marked "Billed", instead of the search clearing to empty.
      await handleAdmSearch(admQuery);
    } catch (err) {
      toast.error(err.message || 'Failed to save admission invoice');
    } finally {
      setAdmSaving(false);
    }
  };

  useModalKeys({
    active: showForm,
    onEsc: () => { setShowForm(false); setLines([]); setDraftLine(createEmptyLine()); setDiscountPercent(''); },
    onCtrlS: () => handleSave(true),
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
            <div className="border border-slate-200 rounded-md overflow-x-auto mb-3">
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
              label={loading ? 'Saving...' : 'Save Invoice'}
              disabled={loading || lines.length === 0}
              onClick={() => handleSave(false)}
            />
            <Button
              type="button"
              icon={Printer}
              label={loading ? 'Saving...' : 'Save & Print'}
              variant="outline"
              disabled={loading || lines.length === 0}
              onClick={() => handleSave(true)}
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

      {/* Admission Number Search */}
      <Card className="mb-4" title="Search by Admission Number">
        <div className="flex gap-2 items-center mb-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Enter admission number..."
              value={admQuery}
              onChange={(e) => { setAdmQuery(e.target.value); setAdmGINs(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdmSearch()}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm w-full focus:outline-none focus:border-blue-500"
            />
          </div>
          <Button label={admLoading ? 'Searching...' : 'Search'} disabled={admLoading} onClick={() => handleAdmSearch()} />
          <Button label="Browse" variant="outline" onClick={() => setShowAdmPicker(true)} />
          {admPendingLines.length > 0 && (
            <>
              <Button icon={Printer} label="Print" variant="outline" onClick={printAdmInvoice} />
              <Button label={admSaving ? 'Saving...' : 'Save Invoice'} disabled={admSaving} onClick={saveAdmInvoice} />
            </>
          )}
          {admGINs !== null && (
            <button
              onClick={() => { setAdmGINs(null); setAdmQuery(''); setAdmInvoices([]); setBilledRateDrafts({}); }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>

        {admGINs !== null && admGinBlocks.length > 0 && admPendingLines.length === 0 && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mb-2">
            All issued items for admission <strong>{admQuery}</strong> are already billed. Nothing new to invoice.
          </p>
        )}
        {admGINs !== null && (
          admGinBlocks.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No records found for admission number <strong>{admQuery}</strong></p>
          ) : (
            <div className="border border-slate-200 rounded-md overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="px-3 py-2">Item Code</th>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {admGinBlocks.map((b) => (
                    <Fragment key={`gin-${b.id}`}>
                      <tr className="bg-slate-100/80">
                        <td colSpan={5} className="px-3 py-1.5 text-xs text-slate-700">
                          <strong>{b.date ? new Date(b.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</strong>
                          <span className="mx-2 text-slate-400">·</span>
                          GIN <strong>{b.code}</strong>
                          <span className="mx-2 text-slate-400">·</span>
                          {b.dept}
                        </td>
                      </tr>
                      {b.lines.map((l) => {
                        const inv = l.invoiceLine;
                        const draft = inv ? billedRateDrafts[inv.id] : undefined;
                        const changed = inv && draft !== undefined && Number(draft) !== Number(inv.saleRate);
                        const saving = inv && savingLineId === inv.id;
                        return (
                          <tr key={l.key}>
                            <td className="px-3 py-2 text-slate-500">{l.itemCode}</td>
                            <td className="px-3 py-2">
                              {l.item}
                              {l.billed && (
                                <span
                                  className="ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800"
                                  title={inv ? `Invoice ${inv.headerCode}` : 'Billed'}
                                >
                                  Billed
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">{l.qty}</td>
                            <td className="px-3 py-2 text-right">
                              {!l.billed ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={admRates[l.key] ?? l.lockedRate}
                                  onChange={(e) => setAdmRates((prev) => ({ ...prev, [l.key]: e.target.value }))}
                                  className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right focus:outline-none focus:border-blue-500"
                                />
                              ) : inv ? (
                                <div className="inline-flex items-center gap-1">
                                  {saving && <span className="text-xs text-slate-400">Saving…</span>}
                                  {/* Saves itself on Enter or when the box loses focus — the
                                      invoice and the patient's bill follow; the GIN's own
                                      rate, item rates and stock are untouched. */}
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={draft ?? inv.saleRate}
                                    disabled={saving}
                                    title="Rate change applies to this invoice only — saves on Enter or when you leave the box"
                                    onChange={(e) => setBilledRateDrafts((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                    onBlur={() => { if (changed) saveBilledRate(inv); }}
                                    className={`w-24 px-2 py-1 border rounded text-sm text-right focus:outline-none focus:border-blue-500 ${changed ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                                  />
                                </div>
                              ) : (
                                <span className="text-slate-600">{l.rate.toFixed(2)}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">{l.amount.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 font-semibold">
                        <td colSpan={4} className="px-3 py-1.5 text-right text-slate-700">Total</td>
                        <td className="px-3 py-1.5 text-right">{b.total.toFixed(2)}</td>
                      </tr>
                    </Fragment>
                  ))}
                  {admReturnLines.length > 0 && (
                    <>
                      <tr className="bg-amber-50">
                        <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold text-amber-800 uppercase tracking-wide">
                          Wapsi (MRN) — patient ne jo medicine wapas ki
                        </td>
                      </tr>
                      {admReturnLines.map((l) => (
                        <tr key={`ret-${l.id}`}>
                          <td className="px-3 py-2 text-slate-500">{l.item?.code || '-'}</td>
                          <td className="px-3 py-2">
                            Return: {l.item?.name || '-'}
                            <span className="ml-2 text-xs text-slate-400">
                              {l.invoiceDate ? new Date(l.invoiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{l.quantity}</td>
                          <td className="px-3 py-2 text-right text-slate-600">{Number(l.saleRate).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-medium text-amber-700">{Number(l.totalAmount).toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="bg-amber-50/60 font-semibold">
                        <td colSpan={4} className="px-3 py-1.5 text-right text-slate-700">Wapsi Total</td>
                        <td className="px-3 py-1.5 text-right text-amber-700">{admReturnTotal.toFixed(2)}</td>
                      </tr>
                    </>
                  )}
                  <tr className="bg-slate-200/70 font-bold">
                    <td colSpan={4} className="px-3 py-2 text-right text-slate-800">Grand Total</td>
                    <td className="px-3 py-2 text-right">{admGrandTotal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        )}
      </Card>

      {/* List */}
      {/* <div className="flex items-center justify-between mb-2">
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
      )} */}

      {showAdmPicker && (
        <AdmissionPickerModal
          onClose={() => setShowAdmPicker(false)}
          onSelect={(r) => {
            setShowAdmPicker(false);
            setAdmQuery(r.admissionNo);
            setAdmGINs(null);
            handleAdmSearch(r.admissionNo);
          }}
        />
      )}
    </div>
  );
}