import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useInventoryStore } from '../../store/useInventoryStore';
import { exportRowsToPdf } from '../../utils/exportInventoryReports';

function toDateInput(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

export default function SalesInvoice() {
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({
    itemId: '',
    customerType: '',
    dateFrom: '',
    dateTo: '',
  });

  const [form, setForm] = useState({
    itemId: '',
    invoiceDate: toDateInput(),
    customerType: 'walking',
    customerName: '',
    quantity: '',
    markupPercent: '',
  });

  const {
    loading,
    items,
    salesInvoices,
    fetchItems,
    fetchSalesInvoices,
    createSalesInvoice,
  } = useInventoryStore();

  useEffect(() => {
    Promise.all([
      fetchItems({ status: 'active' }),
      fetchSalesInvoices(),
    ]).catch((err) => toast.error(err.message || 'Failed to load sales invoices'));
  }, [fetchItems, fetchSalesInvoices]);

  const selectedItem = useMemo(() => {
    const id = Number(form.itemId);
    if (!id) return null;
    return (items || []).find((x) => Number(x.id) === id) || null;
  }, [items, form.itemId]);

  const pricingPreview = useMemo(() => {
    const purchasePrice = Number(selectedItem?.purchasePrice || 0);
    const retailPrice = Number(selectedItem?.lastGrnRate || selectedItem?.purchasePrice || 0);
    const percent = Number(form.markupPercent || 0);
    const quantity = Number(form.quantity || 0);
    const saleRate = retailPrice * (1 + percent / 100);
    const total = saleRate * quantity;

    return {
      purchasePrice,
      retailPrice,
      saleRate,
      total,
    };
  }, [selectedItem, form.markupPercent, form.quantity]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = salesInvoices || [];
    if (!q) return rows;
    return rows.filter((row) => [
      row.code,
      row.customerType,
      row.customerName,
      row.item?.name,
      row.item?.code,
    ].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [salesInvoices, query]);

  const applyFilters = async () => {
    try {
      await fetchSalesInvoices(filters);
    } catch (err) {
      toast.error(err.message || 'Failed to apply filters');
    }
  };

  const resetFilters = async () => {
    const empty = { itemId: '', customerType: '', dateFrom: '', dateTo: '' };
    setFilters(empty);
    try {
      await fetchSalesInvoices(empty);
    } catch (err) {
      toast.error(err.message || 'Failed to reset filters');
    }
  };

  const printSingleInvoice = (row) => {
    const pdfRows = [{
      invoiceCode: row.code,
      date: row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString() : '-',
      shop: 'Fair Price Shop',
      customerType: row.customerType,
      customerName: row.customerName || 'Walking Customer',
      itemCode: row.item?.code || '-',
      itemName: row.item?.name || '-',
      quantity: row.quantity,
      purchasePrice: row.purchasePrice,
      retailPrice: row.retailPrice,
      markupPercent: row.markupPercent,
      saleRate: row.saleRate,
      totalAmount: row.totalAmount,
    }];

    exportRowsToPdf({
      fileName: `sales-invoice-${row.code}`,
      title: 'Fair Price Shop - Sales Invoice',
      rows: pdfRows,
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        itemId: Number(form.itemId),
        invoiceDate: form.invoiceDate,
        customerType: form.customerType,
        quantity: Number(form.quantity),
        markupPercent: Number(form.markupPercent),
      };

      if (form.customerType === 'customer') {
        payload.customerName = form.customerName;
      }

      const created = await createSalesInvoice(payload);
      await Promise.all([
        fetchSalesInvoices(filters),
        fetchItems({ status: 'active' }),
      ]);

      setForm({
        itemId: '',
        invoiceDate: toDateInput(),
        customerType: 'walking',
        customerName: '',
        quantity: '',
        markupPercent: '',
      });
      setShowForm(false);
      toast.success('Sales invoice created');
      printSingleInvoice(created);
    } catch (err) {
      toast.error(err.message || 'Failed to create sales invoice');
    }
  };

  const invoiceExportRows = useMemo(() => filteredRows.map((row) => ({
    invoiceCode: row.code,
    date: row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString() : '-',
    item: row.item?.name || '-',
    customerType: row.customerType,
    customerName: row.customerName || 'Walking Customer',
    quantity: row.quantity,
    purchasePrice: row.purchasePrice,
    retailPrice: row.retailPrice,
    markupPercent: row.markupPercent,
    saleRate: row.saleRate,
    totalAmount: row.totalAmount,
  })), [filteredRows]);

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
        <Card className="mb-4" title="Create Sales Invoice (Fair Price Shop)">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={form.itemId}
              onChange={(e) => setForm((p) => ({ ...p, itemId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            >
              <option value="">Select Item</option>
              {(items || []).map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
              ))}
            </select>

            <input
              type="date"
              value={form.invoiceDate}
              onChange={(e) => setForm((p) => ({ ...p, invoiceDate: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            />

            <div className="md:col-span-2 border border-slate-200 rounded-md p-3">
              <p className="text-xs text-slate-500 mb-2">Customer Type</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="customerType"
                    value="walking"
                    checked={form.customerType === 'walking'}
                    onChange={(e) => setForm((p) => ({ ...p, customerType: e.target.value, customerName: '' }))}
                  />
                  Walking Customer
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="customerType"
                    value="customer"
                    checked={form.customerType === 'customer'}
                    onChange={(e) => setForm((p) => ({ ...p, customerType: e.target.value }))}
                  />
                  Customer
                </label>
              </div>
            </div>

            {form.customerType === 'customer' && (
              <input
                type="text"
                placeholder="Customer Name"
                value={form.customerName}
                onChange={(e) => setForm((p) => ({ ...p, customerName: e.target.value }))}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm md:col-span-2"
                required
              />
            )}

            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Quantity"
              value={form.quantity}
              onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            />

            <input
              type="number"
              min="1"
              max="100"
              step="0.01"
              placeholder="Markup % (1 - 100)"
              value={form.markupPercent}
              onChange={(e) => setForm((p) => ({ ...p, markupPercent: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            />

            <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-2 bg-slate-50 rounded-md"><span className="text-slate-500 block">Purchase</span>{pricingPreview.purchasePrice.toFixed(2)}</div>
              <div className="p-2 bg-slate-50 rounded-md"><span className="text-slate-500 block">Retail (GRN)</span>{pricingPreview.retailPrice.toFixed(2)}</div>
              <div className="p-2 bg-slate-50 rounded-md"><span className="text-slate-500 block">Sale Rate</span>{pricingPreview.saleRate.toFixed(2)}</div>
              <div className="p-2 bg-slate-50 rounded-md"><span className="text-slate-500 block">Total</span>{pricingPreview.total.toFixed(2)}</div>
            </div>

            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" label={loading ? 'Saving...' : 'Save Invoice'} disabled={loading} />
              <Button type="button" label="Cancel" variant="secondary" onClick={() => setShowForm(false)} />
            </div>
          </form>
        </Card>
      )}

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
              value={filters.itemId}
              onChange={(e) => setFilters((p) => ({ ...p, itemId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Items</option>
              {(items || []).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>

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
            <p className="text-xs text-slate-500">{filteredRows.length} invoice(s)</p>
            <Button
              size="sm"
              variant="outline"
              icon={FileText}
              label="PDF"
              onClick={() => exportRowsToPdf({
                fileName: 'sales-invoices',
                title: 'Fair Price Shop - Sales Invoice Report',
                rows: invoiceExportRows,
              })}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">Invoice No</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Item</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Qty</th>
                <th className="px-6 py-4 font-semibold">Retail</th>
                <th className="px-6 py-4 font-semibold">%</th>
                <th className="px-6 py-4 font-semibold">Sale Rate</th>
                <th className="px-6 py-4 font-semibold">Total</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-slate-500">No sales invoices found.</td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4">{row.code}</td>
                    <td className="px-6 py-4">{row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4">{row.item?.name || '-'} ({row.item?.code || '-'})</td>
                    <td className="px-6 py-4 capitalize">{row.customerType} - {row.customerName || 'Walking Customer'}</td>
                    <td className="px-6 py-4">{row.quantity}</td>
                    <td className="px-6 py-4">{Number(row.retailPrice || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">{Number(row.markupPercent || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">{Number(row.saleRate || 0).toFixed(2)}</td>
                    <td className="px-6 py-4">{Number(row.totalAmount || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="outline" icon={Download} label="PDF" onClick={() => printSingleInvoice(row)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
