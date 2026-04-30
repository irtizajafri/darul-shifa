import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Download, FileText, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';
import { exportRowsToPdf } from '../../utils/exportInventoryReports';

export default function GoodsDiscard() {
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({
    itemId: '',
    dateFrom: '',
    dateTo: '',
  });

  const [form, setForm] = useState({
    itemId: '',
    quantity: '',
    reason: '',
    discardedDate: new Date().toISOString().slice(0, 10),
  });

  const {
    loading,
    items,
    gdns,
    fetchItems,
    fetchGDNs,
    createGDN,
  } = useInventoryStore();

  useEffect(() => {
    Promise.all([
      fetchItems({ status: 'active' }),
      fetchGDNs(),
    ]).catch((err) => toast.error(err.message || 'Failed to load GDN data'));
  }, [fetchItems, fetchGDNs]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = gdns || [];
    if (!q) return rows;
    return rows.filter((r) => [
      r.code,
      r.reason,
      r.item?.name,
      r.item?.code,
    ].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [gdns, query]);

  const applyFilters = async () => {
    try {
      await fetchGDNs(filters);
    } catch (err) {
      toast.error(err.message || 'Failed to apply filters');
    }
  };

  const resetFilters = async () => {
    const empty = { itemId: '', dateFrom: '', dateTo: '' };
    setFilters(empty);
    try {
      await fetchGDNs(empty);
    } catch (err) {
      toast.error(err.message || 'Failed to reset filters');
    }
  };

  const printSingleGdn = (row) => {
    const pdfRows = [{
      gdnCode: row.code,
      itemCode: row.item?.code || '-',
      itemName: row.item?.name || '-',
      quantity: row.quantity,
      reason: row.reason,
      discardedDate: row.discardedDate ? new Date(row.discardedDate).toLocaleDateString() : '-',
    }];

    exportRowsToPdf({
      fileName: `gdn-${row.code}`,
      title: 'Goods Discard Note (GDN)',
      rows: pdfRows,
    });
  };

  const handleCreateGdn = async (e) => {
    e.preventDefault();
    try {
      const created = await createGDN({
        itemId: Number(form.itemId),
        quantity: Number(form.quantity),
        reason: form.reason,
        discardedDate: form.discardedDate,
      });

      await Promise.all([
        fetchGDNs(filters),
        fetchItems({ status: 'active' }),
      ]);

      setForm({
        itemId: '',
        quantity: '',
        reason: '',
        discardedDate: new Date().toISOString().slice(0, 10),
      });
      setShowForm(false);
      toast.success('GDN created');
      printSingleGdn(created);
    } catch (err) {
      toast.error(err.message || 'Failed to create GDN');
    }
  };

  const gdnExportRows = useMemo(() => filteredRows.map((row) => ({
    gdnCode: row.code,
    itemCode: row.item?.code || '-',
    itemName: row.item?.name || '-',
    quantity: row.quantity,
    reason: row.reason,
    discardedDate: row.discardedDate ? new Date(row.discardedDate).toLocaleDateString() : '-',
  })), [filteredRows]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Goods Discard Note (GDN)</h1>
          <p className="text-slate-500 text-sm">Discard expired or damaged goods and reduce stock</p>
        </div>
        <Button label="Discard Goods" icon={Plus} onClick={() => setShowForm((s) => !s)} />
      </div>

      {showForm && (
        <Card className="mb-4" title="Create Goods Discard Note (GDN)">
          <form onSubmit={handleCreateGdn} className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              type="date"
              value={form.discardedDate}
              onChange={(e) => setForm((p) => ({ ...p, discardedDate: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            />

            <input
              type="text"
              placeholder="Reason (e.g. Expired / Damaged)"
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            />

            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" label={loading ? 'Saving...' : 'Save GDN'} disabled={loading} />
              <Button type="button" variant="secondary" label="Cancel" onClick={() => setShowForm(false)} />
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
                placeholder="Search Discard Notes..." 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 w-64"
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
              onClick={() => exportRowsToPdf({
                fileName: 'gdn-report',
                title: 'Goods Discard Note Report',
                rows: gdnExportRows,
              })}
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
                <th className="px-6 py-4 font-semibold">Discarded Date</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    No Goods Discard Note (GDN) records found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4">{row.code}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{row.item?.name || '-'} ({row.item?.code || '-'})</td>
                    <td className="px-6 py-4">{row.quantity}</td>
                    <td className="px-6 py-4">{row.reason}</td>
                    <td className="px-6 py-4">{row.discardedDate ? new Date(row.discardedDate).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <Button size="sm" variant="outline" icon={Download} label="PDF" onClick={() => printSingleGdn(row)} />
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
