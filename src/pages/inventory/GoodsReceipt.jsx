import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Download, FileText, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/exportInventoryReports';

export default function GoodsReceipt() {
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [poCodeInput, setPoCodeInput] = useState('');
  const [filters, setFilters] = useState({
    supplierId: '',
    categoryId: '',
    subcategoryId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [formData, setFormData] = useState({
    poId: '',
    receivedQuantity: '',
    receivedRate: '',
  });

  const {
    loading,
    grns,
    purchaseOrders,
    masterOptions,
    fetchGRNs,
    fetchPurchaseOrders,
    fetchMastersOptions,
    createGRN,
  } = useInventoryStore();

  useEffect(() => {
    Promise.all([
      fetchGRNs(),
      fetchPurchaseOrders({ status: 'open' }),
      fetchMastersOptions(),
    ]).catch((err) => toast.error(err.message || 'Failed to load GRN data'));
  }, [fetchGRNs, fetchPurchaseOrders, fetchMastersOptions]);

  const filteredSubcategories = useMemo(() => {
    const catId = Number(filters.categoryId);
    if (!catId) return masterOptions.subcategories || [];
    return (masterOptions.subcategories || []).filter((sub) => Number(sub.categoryId) === catId);
  }, [filters.categoryId, masterOptions.subcategories]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = grns || [];
    if (!q) return rows;
    return rows.filter((r) => [
      r.code,
      r.purchaseOrder?.code,
      r.supplier?.name,
      r.item?.name,
    ].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [grns, query]);

  const selectedPO = useMemo(
    () => (purchaseOrders || []).find((po) => Number(po.id) === Number(formData.poId)),
    [purchaseOrders, formData.poId]
  );

  useEffect(() => {
    const code = String(poCodeInput || '').trim().toLowerCase();
    if (!code) {
      return;
    }

    const matchedPO = (purchaseOrders || []).find(
      (po) => String(po.code || '').trim().toLowerCase() === code
    );

    if (matchedPO) {
      setFormData((prev) => {
        if (Number(prev.poId) === Number(matchedPO.id)) return prev;
        return {
          ...prev,
          poId: String(matchedPO.id),
          receivedQuantity: prev.receivedQuantity || String(matchedPO.requiredQuantity || ''),
          receivedRate: prev.receivedRate || String(matchedPO.orderedRate || ''),
        };
      });
    }
  }, [poCodeInput, purchaseOrders]);

  const handleCreateGRN = async (e) => {
    e.preventDefault();
    try {
      await createGRN({
        poId: Number(formData.poId),
        receivedQuantity: Number(formData.receivedQuantity),
        receivedRate: Number(formData.receivedRate),
      });
      await Promise.all([fetchGRNs(filters), fetchPurchaseOrders({ status: 'open' })]);
  setPoCodeInput('');
      setFormData({ poId: '', receivedQuantity: '', receivedRate: '' });
      setShowCreate(false);
      toast.success('GRN created');
    } catch (err) {
      toast.error(err.message || 'Failed to create GRN');
    }
  };

  const applyFilters = async () => {
    try {
      await fetchGRNs(filters);
    } catch (err) {
      toast.error(err.message || 'Failed to apply GRN filters');
    }
  };

  const resetFilters = async () => {
    const empty = { supplierId: '', categoryId: '', subcategoryId: '', dateFrom: '', dateTo: '' };
    setFilters(empty);
    try {
      await fetchGRNs(empty);
    } catch (err) {
      toast.error(err.message || 'Failed to reset GRN filters');
    }
  };

  const grnExportRows = useMemo(() => filteredRows.map((row) => ({
    grnCode: row.code,
    poCode: row.purchaseOrder?.code || '-',
    supplier: row.supplier?.name || '-',
    item: row.item?.name || '-',
    category: row.category?.name || '-',
    subcategory: row.subcategory?.name || '-',
    receivedQuantity: row.receivedQuantity,
    receivedRate: row.receivedRate,
    totalAmount: row.totalAmount,
    receivedDate: row.receivedDate ? new Date(row.receivedDate).toLocaleDateString() : '-',
  })), [filteredRows]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Goods Receiving Note (GRN)</h1>
          <p className="text-slate-500 text-sm">Receive items and update inward stock</p>
        </div>
        <Button label="New GRN" icon={Plus} onClick={() => setShowCreate((s) => !s)} />
      </div>

      {showCreate && (
        <Card className="mb-4">
          <form onSubmit={handleCreateGRN} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              list="open-po-codes"
              value={poCodeInput}
              onChange={(e) => setPoCodeInput(e.target.value)}
              placeholder="Type PO Number (e.g. 20260425001-po)"
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <datalist id="open-po-codes">
              {(purchaseOrders || []).map((po) => (
                <option key={po.id} value={po.code} />
              ))}
            </datalist>

            <select
              value={formData.poId}
              onChange={(e) => {
                const nextPoId = e.target.value;
                const po = (purchaseOrders || []).find((x) => Number(x.id) === Number(nextPoId));
                setPoCodeInput(po?.code || '');
                setFormData((p) => ({
                  ...p,
                  poId: nextPoId,
                  receivedQuantity: p.receivedQuantity || String(po?.requiredQuantity || ''),
                  receivedRate: p.receivedRate || String(po?.orderedRate || ''),
                }));
              }}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            >
              <option value="">Select Open PO</option>
              {(purchaseOrders || []).map((po) => (
                <option key={po.id} value={po.id}>
                  {po.code} - {po.item?.name || '-'} ({po.supplier?.name || '-'})
                </option>
              ))}
            </select>

            {poCodeInput && !selectedPO && (
              <p className="text-xs text-amber-600 md:col-span-2">
                Typed PO number not found in open POs. Please check code or select from dropdown.
              </p>
            )}

            {selectedPO && (
              <div className="md:col-span-2 p-3 rounded-md border border-blue-100 bg-blue-50 text-sm text-slate-700">
                <p><strong>PO:</strong> {selectedPO.code}</p>
                <p><strong>Supplier:</strong> {selectedPO.supplier?.name || '-'}</p>
                <p><strong>Item:</strong> {selectedPO.item?.name || '-'} ({selectedPO.item?.code || '-'})</p>
                <p><strong>Required Qty:</strong> {selectedPO.requiredQuantity} | <strong>Ordered Rate:</strong> {selectedPO.orderedRate ?? '-'}</p>
              </div>
            )}

            <input
              type="number"
              min="1"
              placeholder="Received Quantity"
              value={formData.receivedQuantity}
              onChange={(e) => setFormData((p) => ({ ...p, receivedQuantity: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            />

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Received Rate"
              value={formData.receivedRate}
              onChange={(e) => setFormData((p) => ({ ...p, receivedRate: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            />

            <div className="flex gap-2">
              <Button type="submit" label={loading ? 'Saving...' : 'Save GRN'} disabled={loading} />
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
                placeholder="Search GRN List..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 w-64"
              />
            </div>

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
              value={filters.categoryId}
              onChange={(e) => setFilters((p) => ({ ...p, categoryId: e.target.value, subcategoryId: '' }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Categories</option>
              {(masterOptions.categories || []).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              value={filters.subcategoryId}
              onChange={(e) => setFilters((p) => ({ ...p, subcategoryId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Subcategories</option>
              {filteredSubcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
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
              onClick={() => exportRowsToExcel({ fileName: 'inventory-grn-report', sheetName: 'GRN', rows: grnExportRows })}
            />
            <Button
              label="PDF"
              icon={FileText}
              size="sm"
              variant="outline"
              onClick={() => exportRowsToPdf({ fileName: 'inventory-grn-report', title: 'GRN Report', rows: grnExportRows })}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">GRN No</th>
                <th className="px-6 py-4 font-semibold">Linked PO</th>
                <th className="px-6 py-4 font-semibold">Supplier</th>
                <th className="px-6 py-4 font-semibold">Date Received</th>
                <th className="px-6 py-4 font-semibold">Qty @ Rate</th>
                <th className="px-6 py-4 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    No GRN records found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4">{row.code}</td>
                    <td className="px-6 py-4">{row.purchaseOrder?.code || '-'}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{row.supplier?.name || '-'}</td>
                    <td className="px-6 py-4">{row.receivedDate ? new Date(row.receivedDate).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4">{row.receivedQuantity} @ {row.receivedRate}</td>
                    <td className="px-6 py-4">{row.totalAmount}</td>
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
