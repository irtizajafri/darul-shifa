import { useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Plus, Search, Filter } from 'lucide-react';

export default function GoodsReceipt() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([
    { id: 1, grnNo: 'GRN-1001', poNo: 'PO-1001', supplier: 'ABC Pharma', date: '2026-04-08', status: 'Received' },
  ]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
  }, [rows, query]);

  const addGRN = () => {
    const id = Date.now();
    setRows((prev) => [
      {
        id,
        grnNo: `GRN-${String(id).slice(-4)}`,
        poNo: 'PO-NEW',
        supplier: 'New Supplier',
        date: new Date().toISOString().slice(0, 10),
        status: 'Pending',
      },
      ...prev,
    ]);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Goods Receiving Note (GRN)</h1>
          <p className="text-slate-500 text-sm">Receive items and update inward stock</p>
        </div>
        <Button label="New GRN" icon={Plus} onClick={addGRN} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
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
            <Button variant="outline" icon={Filter} className="px-3" />
          </div>
          <p className="text-xs text-slate-500">{filteredRows.length} record(s)</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">GRN No</th>
                <th className="px-6 py-4 font-semibold">Linked PO</th>
                <th className="px-6 py-4 font-semibold">Supplier</th>
                <th className="px-6 py-4 font-semibold">Date Received</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
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
                    <td className="px-6 py-4">{row.grnNo}</td>
                    <td className="px-6 py-4">{row.poNo}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{row.supplier}</td>
                    <td className="px-6 py-4">{row.date}</td>
                    <td className="px-6 py-4">{row.status}</td>
                    <td className="px-6 py-4 text-right text-blue-600 text-sm">View</td>
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
