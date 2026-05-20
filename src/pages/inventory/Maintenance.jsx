import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import SearchableSelect from '../../components/ui/SearchableSelect';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';

export default function Maintenance() {
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    itemId: '',
    natureOfRepair: '',
    cost: '',
    supplierId: '',
    date: today,
  });
  const [lastRepair, setLastRepair] = useState(null);
  const [lastRepairLoading, setLastRepairLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    loading,
    items,
    maintenanceRecords,
    masterOptions,
    fetchItems,
    fetchMastersOptions,
    fetchMaintenanceRecords,
    createMaintenanceRecord,
  } = useInventoryStore();

  useEffect(() => {
    Promise.all([fetchItems(), fetchMastersOptions(), fetchMaintenanceRecords()]).catch((err) =>
      toast.error(err.message || 'Failed to load data')
    );
  }, [fetchItems, fetchMastersOptions, fetchMaintenanceRecords]);

  const selectedItem = useMemo(
    () => (items || []).find((i) => String(i.id) === String(formData.itemId)),
    [items, formData.itemId]
  );

  const handleItemChange = async (itemId) => {
    setFormData((prev) => ({ ...prev, itemId }));
    setLastRepair(null);
    if (!itemId) return;
    setLastRepairLoading(true);
    try {
      const records = await fetchMaintenanceRecords({ itemId });
      if (Array.isArray(records) && records.length > 0) {
        setLastRepair(records[0]);
      }
    } catch {
      // silently ignore
    } finally {
      setLastRepairLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'itemId') {
      handleItemChange(value);
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.itemId) { toast.error('Item is required'); return; }
    if (!formData.natureOfRepair.trim()) { toast.error('Nature of repairing is required'); return; }
    if (!formData.supplierId) { toast.error('Vendor / Supplier is required'); return; }
    if (!formData.date) { toast.error('Date is required'); return; }

    setSubmitting(true);
    try {
      await createMaintenanceRecord({
        itemId: Number(formData.itemId),
        natureOfRepair: formData.natureOfRepair.trim(),
        cost: formData.cost !== '' ? Number(formData.cost) : null,
        supplierId: Number(formData.supplierId),
        date: formData.date,
      });
      toast.success('Maintenance record saved');
      setFormData({ itemId: '', natureOfRepair: '', cost: '', supplierId: '', date: today });
      setLastRepair(null);
      fetchMaintenanceRecords().catch(() => {});
    } catch (err) {
      toast.error(err.message || 'Failed to save record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Maintenance</h1>
        <p className="text-sm text-[#64748B] mt-1">Record item repairs and maintenance history</p>
      </div>

      {/* Form */}
      <Card className="p-5">
        <h2 className="text-base font-semibold text-[#1E293B] mb-4">New Repair Record</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Item Name *</label>
              <SearchableSelect
                options={items || []}
                value={formData.itemId}
                onChange={handleItemChange}
                placeholder="Search item by name or code..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Vendor / Supplier *</label>
              <SearchableSelect
                options={masterOptions.suppliers || []}
                value={formData.supplierId}
                onChange={(val) => setFormData((prev) => ({ ...prev, supplierId: val }))}
                placeholder="Search supplier by name or code..."
              />
            </div>
          </div>

          {/* Last Repair Info */}
          {lastRepairLoading && (
            <p className="text-xs text-[#64748B]">Loading last repair history...</p>
          )}
          {!lastRepairLoading && lastRepair && (
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-4">
              <p className="text-xs font-semibold text-[#2563EB] mb-3">
                Last Repairing — {selectedItem?.name}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <p className="text-xs text-[#64748B] mb-0.5">Date</p>
                  <p className="text-sm font-medium text-[#1E293B]">
                    {lastRepair.date ? new Date(lastRepair.date).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] mb-0.5">Supplier</p>
                  <p className="text-sm font-medium text-[#1E293B]">
                    {lastRepair.supplier?.name || lastRepair.supplierName || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] mb-0.5">Cost</p>
                  <p className="text-sm font-medium text-[#1E293B]">
                    {lastRepair.cost != null ? `PKR ${Number(lastRepair.cost).toLocaleString()}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] mb-0.5">Nature of Repair</p>
                  <p className="text-sm font-medium text-[#1E293B] line-clamp-2">
                    {lastRepair.natureOfRepair || '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">
              Nature of Repairing *
            </label>
            <textarea
              name="natureOfRepair"
              value={formData.natureOfRepair}
              onChange={handleChange}
              rows={3}
              placeholder="Describe the repair work in detail..."
              className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Cost (PKR)</label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Date *</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={submitting || loading}>
              {submitting ? 'Saving...' : 'Save Repair Record'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Records Table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F0]">
          <h2 className="font-semibold text-[#1E293B] text-sm">Maintenance Records</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                {['Date', 'Item', 'Category', 'Subcategory', 'Supplier', 'Cost (PKR)', 'Nature of Repair'].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {(maintenanceRecords || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-[#94A3B8]">
                    No maintenance records found
                  </td>
                </tr>
              ) : (
                (maintenanceRecords || []).map((r) => (
                  <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3 text-[#475569]">
                      {r.date ? new Date(r.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#1E293B]">
                      {r.item?.name || r.itemName || '—'}
                    </td>
                    <td className="px-4 py-3 text-[#475569]">
                      {r.item?.category?.name || r.categoryName || '—'}
                    </td>
                    <td className="px-4 py-3 text-[#475569]">
                      {r.item?.subcategory?.name || r.subcategoryName || '—'}
                    </td>
                    <td className="px-4 py-3 text-[#475569]">
                      {r.supplier?.name || r.supplierName || '—'}
                    </td>
                    <td className="px-4 py-3 text-[#475569]">
                      {r.cost != null ? Number(r.cost).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#475569] max-w-[220px] truncate">
                      {r.natureOfRepair || '—'}
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
