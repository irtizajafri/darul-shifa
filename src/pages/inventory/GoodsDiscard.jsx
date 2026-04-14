import { useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Plus, Search, Filter } from 'lucide-react';

export default function GoodsDiscard() {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([
    { id: 1, gdnNo: 'GDN-1001', itemQty: 'Panadol x 10', reason: 'Expired', date: '2026-04-08', authorizedBy: 'Admin' },
  ]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
  }, [rows, query]);

  const addGDN = () => {
    const id = Date.now();
    setRows((prev) => [
      {
        id,
        gdnNo: `GDN-${String(id).slice(-4)}`,
        itemQty: 'New Item x 1',
        reason: 'Damaged',
        date: new Date().toISOString().slice(0, 10),
        authorizedBy: 'Admin',
      },
      ...prev,
    ]);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Goods Discard Note (GDN)</h1>
          <p className="text-slate-500 text-sm">Discard expired or damaged goods and reduce stock</p>
        </div>
        <Button label="Discard Goods" icon={Plus} onClick={addGDN} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
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
            <Button variant="outline" icon={Filter} className="px-3" />
          </div>
          <p className="text-xs text-slate-500">{filteredRows.length} record(s)</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">GDN No</th>
                <th className="px-6 py-4 font-semibold">Item & Qty</th>
                <th className="px-6 py-4 font-semibold">Reason</th>
                <th className="px-6 py-4 font-semibold">Discarded Date</th>
                <th className="px-6 py-4 font-semibold">Authorized By</th>
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
                    <td className="px-6 py-4">{row.gdnNo}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{row.itemQty}</td>
                    <td className="px-6 py-4">{row.reason}</td>
                    <td className="px-6 py-4">{row.date}</td>
                    <td className="px-6 py-4">{row.authorizedBy}</td>
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
