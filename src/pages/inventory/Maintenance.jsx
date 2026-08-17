import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import SearchableSelect from '../../components/ui/SearchableSelect';
import toast from 'react-hot-toast';
import { Download, Printer, CheckCircle, Trash2, X } from 'lucide-react';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { generateMaintenanceBillPdf } from '../../utils/exportInventoryReports';

// Status badge
function StatusBadge({ status }) {
  const map = {
    in_repair:  { label: 'In Repair',  cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    completed:  { label: 'Completed',  cls: 'bg-green-100 text-green-700 border-green-200' },
    discarded:  { label: 'Discarded',  cls: 'bg-red-100 text-red-700 border-red-200' },
  };
  const s = map[status] || { label: status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

// Receive Modal
function ReceiveModal({ record, onClose, onDone }) {
  const { receiveMaintenance, fetchMaintenanceRecords } = useInventoryStore();
  const [action, setAction] = useState('complete');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [checkedBy, setCheckedBy] = useState('');
  const [actualCost, setActualCost] = useState('');
  const [warrantyDays, setWarrantyDays] = useState('');
  const [scrapValue, setScrapValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!checkedBy.trim()) { toast.error('Checked By is required'); return; }
    setSaving(true);
    try {
      const updated = await receiveMaintenance(record.id, {
        action,
        receivedDate,
        checkedBy,
        actualCost: actualCost !== '' ? actualCost : undefined,
        warrantyDays: warrantyDays !== '' ? warrantyDays : undefined,
        scrapValue: action === 'discard' ? scrapValue : undefined,
      });
      await fetchMaintenanceRecords();
      toast.success(action === 'complete' ? 'Marked as completed ✅' : 'Discarded & GDN created 🗑️');
      // Auto-print received bill
      generateMaintenanceBillPdf({ record: updated, billType: 'received', mode: 'print' });
      onDone(updated);
    } catch (err) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-base font-semibold text-slate-800 mb-1">Mark as Received</h2>
        <p className="text-xs text-slate-500 mb-4">
          MO: <span className="font-mono font-bold">{record.moNumber || record.id}</span> — {record.item?.name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Action */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAction('complete')}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                action === 'complete'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <CheckCircle className="w-6 h-6" />
              <span className="text-xs font-semibold">Repaired ✅</span>
              <span className="text-xs opacity-70">Item is fixed</span>
            </button>
            <button
              type="button"
              onClick={() => setAction('discard')}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                action === 'discard'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <Trash2 className="w-6 h-6" />
              <span className="text-xs font-semibold">Discard 🗑️</span>
              <span className="text-xs opacity-70">Cannot be repaired</span>
            </button>
          </div>

          {/* Date & Checked By */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date Received *</label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Checked By *</label>
              <input
                type="text"
                placeholder="Name"
                value={checkedBy}
                onChange={(e) => setCheckedBy(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                required
              />
            </div>
          </div>

          {/* Actual Cost + Warranty */}
          <div className={`grid gap-3 ${action === 'discard' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <label className="block text-xs font-medium text-blue-700 mb-1">
                Actual Cost (PKR)
                {record.cost != null && (
                  <span className="ml-1 text-slate-400 font-normal">
                    (Est: {Number(record.cost).toLocaleString()})
                  </span>
                )}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={actualCost}
                onChange={(e) => setActualCost(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
              />
            </div>
            {action !== 'discard' && (
              <div className="p-3 bg-violet-50 border border-violet-200 rounded-md">
                <label className="block text-xs font-medium text-violet-700 mb-1">
                  Warranty (Days)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 30"
                  value={warrantyDays}
                  onChange={(e) => setWarrantyDays(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-violet-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500/30 bg-white"
                />
              </div>
            )}
          </div>

          {/* Scrap Value (discard only) */}
          {action === 'discard' && (
            <div>
              <label className="block text-xs font-medium text-red-600 mb-1">Scrap Value (PKR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={scrapValue}
                onChange={(e) => setScrapValue(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
              <p className="text-xs text-red-500 mt-1">GDN will be auto-created and item will be discarded from stock.</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              label={saving ? 'Saving...' : (action === 'complete' ? 'Mark Completed' : 'Discard & Create GDN')}
              disabled={saving}
            />
            <Button type="button" variant="secondary" label="Cancel" onClick={onClose} />
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Maintenance() {
  const today = new Date().toISOString().split('T')[0];
  const { user } = useAuthStore();
  const { employees, fetchEmployees } = useEmployeeStore();

  const [formData, setFormData] = useState({
    itemId: '',
    natureOfRepair: '',
    cost: '',
    supplierId: '',
    employeeId: '',
    date: today,
  });
  const [lastRepair, setLastRepair] = useState(null);
  const [lastRepairLoading, setLastRepairLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assetInstances, setAssetInstances] = useState([]);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState([]);
  const [receiveRecord, setReceiveRecord] = useState(null); // modal
  const [showHistory, setShowHistory] = useState(false);

  const {
    loading,
    items,
    maintenanceRecords,
    masterOptions,
    fetchItems,
    fetchMastersOptions,
    fetchMaintenanceRecords,
    createMaintenanceRecord,
    fetchAssetInstances,
  } = useInventoryStore();

  useEffect(() => {
    Promise.all([fetchItems(), fetchMastersOptions(), fetchMaintenanceRecords(), fetchEmployees()]).catch((err) =>
      toast.error(err.message || 'Failed to load data')
    );
  }, [fetchItems, fetchMastersOptions, fetchMaintenanceRecords, fetchEmployees]);

  const selectedItem = useMemo(
    () => (items || []).find((i) => String(i.id) === String(formData.itemId)),
    [items, formData.itemId]
  );

  // Format employees for SearchableSelect
  const employeeOptions = useMemo(
    () => (employees || []).map((e) => ({
      id: e.id,
      name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
      code: e.empCode || '',
    })),
    [employees]
  );

  const handleItemChange = async (itemId) => {
    setFormData((prev) => ({ ...prev, itemId }));
    setLastRepair(null);
    setAssetInstances([]);
    setSelectedInstanceIds([]);
    if (!itemId) return;
    setLastRepairLoading(true);
    try {
      const records = await fetchMaintenanceRecords({ itemId });
      if (Array.isArray(records) && records.length > 0) setLastRepair(records[0]);
      const item = (items || []).find((i) => String(i.id) === String(itemId));
      if (item?.itemType === 'fixed asset') {
        const instances = await fetchAssetInstances({ itemId });
        setAssetInstances(Array.isArray(instances) ? instances : []);
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
    const now = new Date();
    const printedBy = user ? `${user.name || user.username || user.email || 'Unknown'}` : 'Unknown';
    const generatedAt = now.toISOString();
    try {
      const created = await createMaintenanceRecord({
        itemId: Number(formData.itemId),
        natureOfRepair: formData.natureOfRepair.trim(),
        cost: formData.cost !== '' ? Number(formData.cost) : null,
        supplierId: Number(formData.supplierId),
        employeeId: formData.employeeId ? Number(formData.employeeId) : undefined,
        date: formData.date,
        assetInstanceIds: selectedInstanceIds,
        printedBy,
        generatedAt,
      });
      toast.success('Maintenance record saved');
      setFormData({ itemId: '', natureOfRepair: '', cost: '', supplierId: '', employeeId: '', date: today });
      setLastRepair(null);
      setAssetInstances([]);
      setSelectedInstanceIds([]);
      fetchMaintenanceRecords().catch(() => {});
      // Auto-print Bill 1 (sent for repair)
      generateMaintenanceBillPdf({ record: created, billType: 'sent', mode: 'print', printedBy, generatedAt });
    } catch (err) {
      toast.error(err.message || 'Failed to save record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      {receiveRecord && (
        <ReceiveModal
          record={receiveRecord}
          onClose={() => setReceiveRecord(null)}
          onDone={() => setReceiveRecord(null)}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">Maintenance</h1>
        <p className="text-sm text-[#64748B] mt-1">Record item repairs and track repair lifecycle</p>
      </div>

      {/* Form */}
      <Card className="p-5">
        <h2 className="text-base font-semibold text-[#1E293B] mb-4">New Repair Record</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Item Name *</label>
              <SearchableSelect
                options={(items || []).filter((i) => i.itemType === 'fixed asset')}
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

          {/* Employee who is taking the item for repair */}
          <div>
            <label className="block text-xs font-medium text-[#64748B] mb-1">
              Employee / Carrier
              <span className="ml-1 text-slate-400 font-normal">(who is taking the item for repair)</span>
            </label>
            <SearchableSelect
              options={employeeOptions}
              value={formData.employeeId}
              onChange={(val) => setFormData((prev) => ({ ...prev, employeeId: val }))}
              placeholder="Search employee by name or code..."
            />
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
                  <p className="text-xs text-[#64748B] mb-0.5">MO No</p>
                  <p className="text-sm font-mono font-medium text-[#1E293B]">{lastRepair.moNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] mb-0.5">Date</p>
                  <p className="text-sm font-medium text-[#1E293B]">
                    {lastRepair.date ? new Date(lastRepair.date).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] mb-0.5">Supplier</p>
                  <p className="text-sm font-medium text-[#1E293B]">
                    {lastRepair.supplier?.name || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#64748B] mb-0.5">Status</p>
                  <StatusBadge status={lastRepair.status || 'in_repair'} />
                </div>
              </div>
            </div>
          )}

          {assetInstances.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-2">
                Select Asset Units for Repair ({selectedInstanceIds.length} selected)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto border border-[#E2E8F0] rounded-lg p-3">
                {assetInstances.map((inst) => (
                  <label key={inst.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedInstanceIds.includes(inst.id)}
                      onChange={(e) =>
                        setSelectedInstanceIds((prev) =>
                          e.target.checked ? [...prev, inst.id] : prev.filter((id) => id !== inst.id)
                        )
                      }
                    />
                    <span className="font-mono text-xs">{inst.assetTag}</span>
                    <span className={`text-xs px-1 rounded ${inst.condition === 'working' ? 'text-green-700 bg-green-50' : inst.condition === 'under repair' ? 'text-orange-700 bg-orange-50' : 'text-red-700 bg-red-50'}`}>
                      {inst.condition}
                    </span>
                  </label>
                ))}
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
              {submitting ? 'Saving...' : 'Save & Print Bill'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Active Records (In Repair only) */}
      {(() => {
        const activeRecords = (maintenanceRecords || []).filter(r => !r.status || r.status === 'in_repair');
        const historyRecords = (maintenanceRecords || []).filter(r => r.status && r.status !== 'in_repair');

        const getReprintMeta = () => {
          const name = user ? `${user.name || user.username || user.email || 'Unknown'}` : 'Unknown';
          return { printedBy: name, generatedAt: new Date().toISOString() };
        };

        const renderRow = (r) => (
          <tr key={r.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
            <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{r.moNumber || '-'}</td>
            <td className="px-4 py-3 text-[#475569]">{r.date ? new Date(r.date).toLocaleDateString() : '—'}</td>
            <td className="px-4 py-3 font-medium text-[#1E293B]">{r.item?.name || '—'}</td>
            <td className="px-4 py-3 text-[#475569] text-xs">
              {Array.isArray(r.assetInstances) && r.assetInstances.length > 0
                ? r.assetInstances.map((a) => a.assetTag).join(', ') : '—'}
            </td>
            <td className="px-4 py-3 text-[#475569]">{r.supplier?.name || '—'}</td>
            <td className="px-4 py-3 text-[#475569] text-xs">
              {r.employee
                ? `${r.employee.firstName || ''} ${r.employee.lastName || ''}`.trim() || '—'
                : '—'}
            </td>
            <td className="px-4 py-3 text-[#475569]">{r.cost != null ? Number(r.cost).toLocaleString() : '—'}</td>
            <td className="px-4 py-3"><StatusBadge status={r.status || 'in_repair'} /></td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1 flex-wrap">
                <button title="Download Sent Bill" onClick={() => generateMaintenanceBillPdf({ record: r, billType: 'sent', mode: 'download', ...getReprintMeta() })}
                  className="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button title="Print Sent Bill" onClick={() => generateMaintenanceBillPdf({ record: r, billType: 'sent', mode: 'print', ...getReprintMeta() })}
                  className="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                  <Printer className="w-3.5 h-3.5" />
                </button>
                {(!r.status || r.status === 'in_repair') && (
                  <button onClick={() => setReceiveRecord(r)}
                    className="px-2 py-1 text-xs rounded bg-orange-100 text-orange-700 hover:bg-orange-200 font-medium transition-colors">
                    Received?
                  </button>
                )}
                {r.status && r.status !== 'in_repair' && (
                  <>
                    <button title="Download Received Bill" onClick={() => generateMaintenanceBillPdf({ record: r, billType: 'received', mode: 'download', ...getReprintMeta() })}
                      className="p-1.5 rounded text-slate-500 hover:text-green-600 hover:bg-green-50 transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button title="Print Received Bill" onClick={() => generateMaintenanceBillPdf({ record: r, billType: 'received', mode: 'print', ...getReprintMeta() })}
                      className="p-1.5 rounded text-slate-500 hover:text-green-600 hover:bg-green-50 transition-colors">
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </td>
          </tr>
        );

        const tableHead = (
          <thead>
            <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              {['MO No', 'Date Sent', 'Item', 'Asset Tags', 'Supplier', 'Employee', 'Cost (PKR)', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
        );

        return (
          <>
            {/* Active — In Repair */}
            <Card className="p-0 overflow-hidden">
              <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
                <h2 className="font-semibold text-[#1E293B] text-sm">
                  🔴 In Repair
                  <span className="ml-2 text-xs font-normal text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                    {activeRecords.length} active
                  </span>
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  {tableHead}
                  <tbody>
                    {activeRecords.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-10 text-[#94A3B8]">No active repair records</td></tr>
                    ) : activeRecords.map(renderRow)}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* History toggle */}
            {/* <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-600">📋 Repair History (Completed / Discarded)</p>
              <button
                onClick={() => setShowHistory(p => !p)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                {showHistory ? '▲ Hide' : '▼ Show'} ({historyRecords.length})
              </button>
            </div>

            {showHistory && (
              <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    {tableHead}
                    <tbody>
                      {historyRecords.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-10 text-[#94A3B8]">No history records</td></tr>
                      ) : historyRecords.map(renderRow)}
                    </tbody>
                  </table>
                </div>
              </Card>
            )} */}
          </>
        );
      })()}
    </div>
  );
}
