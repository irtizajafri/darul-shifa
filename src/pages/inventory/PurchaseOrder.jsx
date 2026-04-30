import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Download, FileText, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/exportInventoryReports';

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
    itemId: '',
    requiredQuantity: '',
    orderedRate: '',
    expectedDate: new Date().toISOString().slice(0, 10),
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

  const handleCreatePO = async (e) => {
    e.preventDefault();
    try {
      await createPurchaseOrder({
        supplierId: Number(formData.supplierId),
        itemId: Number(formData.itemId),
        requiredQuantity: Number(formData.requiredQuantity),
        orderedRate: formData.orderedRate === '' ? undefined : Number(formData.orderedRate),
        expectedDate: new Date(formData.expectedDate).toISOString(),
      });

  await fetchPurchaseOrders(filters);
      setFormData({
        supplierId: '',
        itemId: '',
        requiredQuantity: '',
        orderedRate: '',
        expectedDate: new Date().toISOString().slice(0, 10),
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
          <form onSubmit={handleCreatePO} className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

            <select
              value={formData.itemId}
              onChange={(e) => setFormData((p) => ({ ...p, itemId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            >
              <option value="">Select Item</option>
              {(items || []).map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              placeholder="Required Quantity"
              value={formData.requiredQuantity}
              onChange={(e) => setFormData((p) => ({ ...p, requiredQuantity: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            />

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Ordered Rate (optional if item has GRN history)"
              value={formData.orderedRate}
              onChange={(e) => setFormData((p) => ({ ...p, orderedRate: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />

            <input
              type="date"
              value={formData.expectedDate}
              onChange={(e) => setFormData((p) => ({ ...p, expectedDate: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            />

            <div className="flex gap-2">
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
