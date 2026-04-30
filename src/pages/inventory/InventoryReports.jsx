import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Printer, Download, Filter, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';

const REPORT_TYPES = [
  'Item List', 'Stock Position', 'Item Ledger', 'Reorder Report', 
  'Receiving Report', 'Issuance Report', 'Discard Report', 'Repairing Report', 
  'Short Expiry', 'Expiry', 'Daily Sales', 'Supplier Ledger'
];

export default function InventoryReports() {
  const [activeReport, setActiveReport] = useState('Stock Position');
  const { items, reorderAlerts, fetchItems, fetchReorderAlerts } = useInventoryStore();

  useEffect(() => {
    Promise.all([fetchItems(), fetchReorderAlerts()]).catch((err) => {
      toast.error(err.message || 'Failed to load inventory reports data');
    });
  }, [fetchItems, fetchReorderAlerts]);

  const reportRows = useMemo(() => {
    if (activeReport === 'Reorder Report') {
      return (reorderAlerts || []).map((row) => ({
        key: row.id,
        code: row.item?.code,
        name: row.item?.name,
        category: row.item?.category?.name || '-',
        stock: row.currentQty,
        threshold: row.thresholdQty,
        status: row.status,
      }));
    }

    if (activeReport === 'Stock Position') {
      return (items || []).map((row) => ({
        key: row.id,
        code: row.code,
        name: row.name,
        category: row.category?.name || '-',
        stock: row.currentStock,
        threshold: row.reorderLevel,
        status: row.status,
      }));
    }

    return [];
  }, [activeReport, items, reorderAlerts]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Reports</h1>
          <p className="text-slate-500 text-sm">View, print and export analytical stock reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" label="Export PDF" icon={Download} />
          <Button label="Print" icon={Printer} />
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar menus for reports */}
        <div className="w-64 flex-shrink-0">
          <Card className="p-2">
            <div className="space-y-1">
              {REPORT_TYPES.map(report => (
                <button
                  key={report}
                  onClick={() => setActiveReport(report)}
                  className={`w-full text-left px-4 py-2.5 rounded-md text-sm transition-colors ${
                    activeReport === report 
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {report}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Report Content */}
        <div className="flex-1">
          <Card className="p-0 overflow-hidden h-full min-h-[500px] flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">{activeReport}</h2>
              <Button variant="outline" size="sm" label="Filters" icon={Filter} />
            </div>
            {reportRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Current Stock</th>
                      <th className="px-4 py-3">Reorder Level</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportRows.map((row) => (
                      <tr key={row.key}>
                        <td className="px-4 py-3">{row.code}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                        <td className="px-4 py-3">{row.category}</td>
                        <td className="px-4 py-3">{row.stock}</td>
                        <td className="px-4 py-3">{row.threshold}</td>
                        <td className="px-4 py-3 capitalize">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 p-12 text-center">
                <div>
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>
                    {activeReport === 'Stock Position' || activeReport === 'Reorder Report'
                      ? `No data found for ${activeReport}.`
                      : `Select date ranges and filters to generate the ${activeReport} data.`}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
