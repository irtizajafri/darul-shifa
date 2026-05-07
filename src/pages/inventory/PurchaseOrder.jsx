import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Download, FileText, Plus, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/exportInventoryReports';

const createEmptyPoLine = () => ({
  itemId: '',
  requiredQuantity: '',
  orderedRate: '',
});

export default function PurchaseOrder() {
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
    expectedDate: new Date().toISOString().slice(0, 10),
    items: [createEmptyPoLine()],
  });

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

  const supplierScopedItems = useMemo(() => {
    const selectedSupplierId = Number(formData.supplierId);
    if (!selectedSupplierId) return items || [];
    return (items || []).filter((item) => Number(item.supplierId) === selectedSupplierId);
  }, [items, formData.supplierId]);

  const handleCreatePO = async (e) => {
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

      await createPurchaseOrder({
        supplierId: Number(formData.supplierId),
        expectedDate: new Date(formData.expectedDate).toISOString(),
        items: validLines.map((line) => ({
          itemId: Number(line.itemId),
          requiredQuantity: Number(line.requiredQuantity),
          orderedRate: line.orderedRate === '' ? undefined : Number(line.orderedRate),
        })),
      });

  await fetchPurchaseOrders(filters);
      setFormData({
        supplierId: '',
        expectedDate: new Date().toISOString().slice(0, 10),
        items: [createEmptyPoLine()],
      });
      setShowCreate(false);
      toast.success('PO created');
    } catch (err) {
      toast.error(err.message || 'Failed to create PO');
    }
  };

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

  const poExportRows = useMemo(() => filteredRows.map((row) => ({
    poCode: row.code,
    supplier: row.supplier?.name || '-',
    item: row.item?.name || '-',
    requiredQuantity: row.requiredQuantity,
    orderedRate: row.orderedRate ?? '-',
    expectedDate: row.expectedDate ? new Date(row.expectedDate).toLocaleDateString() : '-',
    status: row.status,
  })), [filteredRows]);

  const updatePoLine = (index, key, value) => {
    setFormData((prev) => {
      const nextItems = [...(prev.items || [])];
      nextItems[index] = {
        ...(nextItems[index] || createEmptyPoLine()),
        [key]: value,
      };
      return { ...prev, items: nextItems };
    });
  };

  const addPoLine = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...(prev.items || []), createEmptyPoLine()],
    }));
  };

  const removePoLine = (index) => {
    setFormData((prev) => {
      const nextItems = [...(prev.items || [])].filter((_, idx) => idx !== index);
      return {
        ...prev,
        items: nextItems.length ? nextItems : [createEmptyPoLine()],
      };
    });
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
          <form onSubmit={handleCreatePO} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={formData.supplierId}
                onChange={(e) => setFormData((p) => ({ ...p, supplierId: e.target.value }))}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                required
              >
                <option value="">Select Supplier</option>
                {(masterOptions.suppliers || []).map((sup) => (
                  <option key={sup.id} value={sup.id}>{sup.name} ({sup.code})</option>
                ))}
              </select>

              <input
                type="date"
                value={formData.expectedDate}
                onChange={(e) => setFormData((p) => ({ ...p, expectedDate: e.target.value }))}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                required
              />
            </div>

            <div className="space-y-2">
              {(formData.items || []).map((line, idx) => {
                const qty = Number(line.requiredQuantity) || 0;
                const rate = Number(line.orderedRate) || 0;
                const amount = qty > 0 && rate > 0 ? (qty * rate) : 0;

                return (
                  <div key={`po-line-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <select
                      value={line.itemId}
                      onChange={(e) => updatePoLine(idx, 'itemId', e.target.value)}
                      className="md:col-span-5 px-3 py-2 border border-slate-300 rounded-md text-sm"
                      required
                    >
                      <option value="">Select Item</option>
                      {supplierScopedItems.map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={line.requiredQuantity}
                      onChange={(e) => updatePoLine(idx, 'requiredQuantity', e.target.value)}
                      className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-md text-sm"
                      required
                    />

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Rate"
                      value={line.orderedRate}
                      onChange={(e) => updatePoLine(idx, 'orderedRate', e.target.value)}
                      className="md:col-span-2 px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />

                    <div className="md:col-span-2 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-700">
                      {amount > 0 ? amount.toFixed(2) : '-'}
                    </div>

                    <button
                      type="button"
                      className="md:col-span-1 inline-flex items-center justify-center px-2 py-2 border border-slate-300 rounded-md text-slate-500 hover:text-red-600 hover:border-red-300"
                      onClick={() => removePoLine(idx)}
                      aria-label="Remove item line"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div>
              <Button type="button" variant="outline" label="Add Item" icon={Plus} onClick={addPoLine} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" label={loading ? 'Saving...' : 'Save PO'} disabled={loading} />
              <Button type="button" variant="secondary" label="Cancel" onClick={() => setShowCreate(false)} />
            </div>
          </form>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
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
            <Button
              label="Excel"
              icon={Download}
              size="sm"
              variant="outline"
              onClick={() => exportRowsToExcel({
                fileName: 'inventory-po-report',
                sheetName: 'PO',
                rows: poExportRows,
              })}
            />
            <Button
              label="PDF"
              icon={FileText}
              size="sm"
              variant="outline"
              onClick={() => exportRowsToPdf({
                fileName: 'inventory-po-report',
                title: 'Purchase Order Report',
                rows: poExportRows,
              })}
            />
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
      </Card>
    </div>
  );
}
