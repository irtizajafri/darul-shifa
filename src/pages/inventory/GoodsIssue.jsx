import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Download, FileText, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useInventoryStore } from '../../store/useInventoryStore';
import { exportRowsToExcel, exportRowsToPdf } from '../../utils/exportInventoryReports';

export default function GoodsIssue() {
  const [ginQuery, setGinQuery] = useState('');
  const [gdQuery, setGdQuery] = useState('');
  const [showGDForm, setShowGDForm] = useState(false);
  const [showGINForm, setShowGINForm] = useState(false);
  const [gdFilters, setGdFilters] = useState({
    status: '',
    departmentId: '',
    categoryId: '',
    subcategoryId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [ginFilters, setGinFilters] = useState({
    departmentId: '',
    categoryId: '',
    subcategoryId: '',
    dateFrom: '',
    dateTo: '',
  });

  const [gdForm, setGdForm] = useState({
    itemId: '',
    departmentId: '',
    quantityRequested: '',
  });

  const [ginForm, setGinForm] = useState({
    gdId: '',
    issuedQuantity: '',
  });

  const {
    loading,
    gds,
    gins,
    items,
    masterOptions,
    fetchItems,
    fetchMastersOptions,
    fetchGDs,
    fetchGINs,
    createGD,
    createGIN,
  } = useInventoryStore();

  useEffect(() => {
    Promise.all([
      fetchItems({ status: 'active' }),
      fetchMastersOptions(),
      fetchGDs(),
      fetchGINs(),
    ]).catch((err) => toast.error(err.message || 'Failed to load issuance data'));
  }, [fetchItems, fetchMastersOptions, fetchGDs, fetchGINs]);

  const filteredGINRows = useMemo(() => {
    const q = ginQuery.trim().toLowerCase();
    const rows = gins || [];
    if (!q) return rows;
    return rows.filter((r) => [
      r.code,
      r.department?.name,
      r.item?.name,
      r.gd?.code,
    ].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [gins, ginQuery]);

  const filteredGDRows = useMemo(() => {
    const q = gdQuery.trim().toLowerCase();
    const rows = gds || [];
    if (!q) return rows;
    return rows.filter((r) => [
      r.code,
      r.item?.name,
      r.department?.name,
      r.demandCategoryType?.name,
      r.status,
    ].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [gds, gdQuery]);

  const openGDs = useMemo(() => (gds || []).filter((gd) => gd.status !== 'closed'), [gds]);

  const filteredGdSubcategories = useMemo(() => {
    const catId = Number(gdFilters.categoryId);
    if (!catId) return masterOptions.subcategories || [];
    return (masterOptions.subcategories || []).filter((sub) => Number(sub.categoryId) === catId);
  }, [gdFilters.categoryId, masterOptions.subcategories]);

  const filteredGinSubcategories = useMemo(() => {
    const catId = Number(ginFilters.categoryId);
    if (!catId) return masterOptions.subcategories || [];
    return (masterOptions.subcategories || []).filter((sub) => Number(sub.categoryId) === catId);
  }, [ginFilters.categoryId, masterOptions.subcategories]);

  const handleCreateGD = async (e) => {
    e.preventDefault();
    try {
      await createGD({
        itemId: Number(gdForm.itemId),
        departmentId: Number(gdForm.departmentId),
        quantityRequested: Number(gdForm.quantityRequested),
      });
  await fetchGDs(gdFilters);
      setGdForm({ itemId: '', departmentId: '', quantityRequested: '' });
      setShowGDForm(false);
      toast.success('GD created');
    } catch (err) {
      toast.error(err.message || 'Failed to create GD');
    }
  };

  const handleCreateGIN = async (e) => {
    e.preventDefault();
    try {
      await createGIN({
        gdId: Number(ginForm.gdId),
        issuedQuantity: Number(ginForm.issuedQuantity),
      });
  await Promise.all([fetchGINs(ginFilters), fetchGDs(gdFilters), fetchItems()]);
      setGinForm({ gdId: '', issuedQuantity: '' });
      setShowGINForm(false);
      toast.success('GIN created');
    } catch (err) {
      toast.error(err.message || 'Failed to create GIN');
    }
  };

  const applyGDFilters = async () => {
    try {
      await fetchGDs(gdFilters);
    } catch (err) {
      toast.error(err.message || 'Failed to apply GD filters');
    }
  };

  const resetGDFilters = async () => {
    const empty = {
      status: '', departmentId: '', categoryId: '', subcategoryId: '', dateFrom: '', dateTo: '',
    };
    setGdFilters(empty);
    try {
      await fetchGDs(empty);
    } catch (err) {
      toast.error(err.message || 'Failed to reset GD filters');
    }
  };

  const applyGINFilters = async () => {
    try {
      await fetchGINs(ginFilters);
    } catch (err) {
      toast.error(err.message || 'Failed to apply GIN filters');
    }
  };

  const resetGINFilters = async () => {
    const empty = { departmentId: '', categoryId: '', subcategoryId: '', dateFrom: '', dateTo: '' };
    setGinFilters(empty);
    try {
      await fetchGINs(empty);
    } catch (err) {
      toast.error(err.message || 'Failed to reset GIN filters');
    }
  };

  const gdExportRows = useMemo(() => filteredGDRows.map((row) => ({
    gdCode: row.code,
    item: row.item?.name || '-',
    category: row.item?.category?.name || '-',
    subcategory: row.item?.subcategory?.name || '-',
    department: row.department?.name || '-',
    demandCategoryType: row.demandCategoryType?.name || '-',
    quantityRequested: row.quantityRequested,
    status: row.status,
    requestDate: row.requestDate ? new Date(row.requestDate).toLocaleDateString() : '-',
  })), [filteredGDRows]);

  const ginExportRows = useMemo(() => filteredGINRows.map((row) => ({
    ginCode: row.code,
    gdCode: row.gd?.code || '-',
    item: row.item?.name || '-',
    category: row.item?.category?.name || '-',
    subcategory: row.item?.subcategory?.name || '-',
    department: row.department?.name || '-',
    issuedQuantity: row.issuedQuantity,
    issueDate: row.issueDate ? new Date(row.issueDate).toLocaleDateString() : '-',
  })), [filteredGINRows]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Goods Issuance Note (GIN)</h1>
          <p className="text-slate-500 text-sm">Issue stock to hospital departments</p>
        </div>
        <div className="flex gap-2">
          <Button label="New GD" icon={Plus} variant="secondary" onClick={() => setShowGDForm((s) => !s)} />
          <Button label="Issue Goods (GIN)" icon={Plus} onClick={() => setShowGINForm((s) => !s)} />
        </div>
      </div>

      {showGDForm && (
        <Card className="mb-4" title="Create Goods Demand (GD)">
          <form onSubmit={handleCreateGD} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={gdForm.itemId}
              onChange={(e) => setGdForm((p) => ({ ...p, itemId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            >
              <option value="">Select Item</option>
              {(items || []).map((item) => (
                <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
              ))}
            </select>

            <select
              value={gdForm.departmentId}
              onChange={(e) => setGdForm((p) => ({ ...p, departmentId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            >
              <option value="">Select Department</option>
              {(masterOptions.departments || []).map((dep) => (
                <option key={dep.id} value={dep.id}>{dep.name} ({dep.code})</option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              placeholder="Quantity Requested"
              value={gdForm.quantityRequested}
              onChange={(e) => setGdForm((p) => ({ ...p, quantityRequested: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            />

            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" label={loading ? 'Saving...' : 'Save GD'} disabled={loading} />
              <Button type="button" variant="secondary" label="Cancel" onClick={() => setShowGDForm(false)} />
            </div>
          </form>
        </Card>
      )}

      {showGINForm && (
        <Card className="mb-4" title="Create Goods Issuance (GIN)">
          <form onSubmit={handleCreateGIN} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              value={ginForm.gdId}
              onChange={(e) => setGinForm((p) => ({ ...p, gdId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            >
              <option value="">Select Open GD</option>
              {openGDs.map((gd) => (
                <option key={gd.id} value={gd.id}>
                  {gd.code} - {gd.item?.name || '-'} ({gd.department?.name || '-'}) [{gd.status}]
                </option>
              ))}
            </select>

            <input
              type="number"
              min="1"
              placeholder="Issued Quantity"
              value={ginForm.issuedQuantity}
              onChange={(e) => setGinForm((p) => ({ ...p, issuedQuantity: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              required
            />

            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" label={loading ? 'Saving...' : 'Save GIN'} disabled={loading} />
              <Button type="button" variant="secondary" label="Cancel" onClick={() => setShowGINForm(false)} />
            </div>
          </form>
        </Card>
      )}

      <Card className="p-0 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search GD..."
                value={gdQuery}
                onChange={(e) => setGdQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 w-56"
              />
            </div>

            <select
              value={gdFilters.status}
              onChange={(e) => setGdFilters((p) => ({ ...p, status: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="partial">Partial</option>
              <option value="closed">Closed</option>
            </select>

            <select
              value={gdFilters.departmentId}
              onChange={(e) => setGdFilters((p) => ({ ...p, departmentId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Departments</option>
              {(masterOptions.departments || []).map((dep) => (
                <option key={dep.id} value={dep.id}>{dep.name}</option>
              ))}
            </select>

            <select
              value={gdFilters.categoryId}
              onChange={(e) => setGdFilters((p) => ({ ...p, categoryId: e.target.value, subcategoryId: '' }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Categories</option>
              {(masterOptions.categories || []).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              value={gdFilters.subcategoryId}
              onChange={(e) => setGdFilters((p) => ({ ...p, subcategoryId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Subcategories</option>
              {filteredGdSubcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={gdFilters.dateFrom}
              onChange={(e) => setGdFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <input
              type="date"
              value={gdFilters.dateTo}
              onChange={(e) => setGdFilters((p) => ({ ...p, dateTo: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />

            <Button label="Apply" size="sm" variant="outline" onClick={applyGDFilters} />
            <Button label="Reset" size="sm" variant="secondary" onClick={resetGDFilters} />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">{filteredGDRows.length} GD(s)</p>
            <Button
              label="Excel"
              icon={Download}
              size="sm"
              variant="outline"
              onClick={() => exportRowsToExcel({ fileName: 'inventory-gd-report', sheetName: 'GD', rows: gdExportRows })}
            />
            <Button
              label="PDF"
              icon={FileText}
              size="sm"
              variant="outline"
              onClick={() => exportRowsToPdf({ fileName: 'inventory-gd-report', title: 'GD Report', rows: gdExportRows })}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">GD No</th>
                <th className="px-6 py-4 font-semibold">Item</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Qty Requested</th>
                <th className="px-6 py-4 font-semibold">Request Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGDRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">No GD records found.</td>
                </tr>
              ) : (
                filteredGDRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4">{row.code}</td>
                    <td className="px-6 py-4">{row.item?.name || '-'}</td>
                    <td className="px-6 py-4">{row.department?.name || '-'}</td>
                    <td className="px-6 py-4">{row.quantityRequested}</td>
                    <td className="px-6 py-4">{row.requestDate ? new Date(row.requestDate).toLocaleDateString() : '-'}</td>
                    <td className="px-6 py-4 capitalize">{row.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search Issue Notes..." 
                value={ginQuery}
                onChange={(e) => setGinQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 w-56"
              />
            </div>

            <select
              value={ginFilters.departmentId}
              onChange={(e) => setGinFilters((p) => ({ ...p, departmentId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Departments</option>
              {(masterOptions.departments || []).map((dep) => (
                <option key={dep.id} value={dep.id}>{dep.name}</option>
              ))}
            </select>

            <select
              value={ginFilters.categoryId}
              onChange={(e) => setGinFilters((p) => ({ ...p, categoryId: e.target.value, subcategoryId: '' }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Categories</option>
              {(masterOptions.categories || []).map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <select
              value={ginFilters.subcategoryId}
              onChange={(e) => setGinFilters((p) => ({ ...p, subcategoryId: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            >
              <option value="">All Subcategories</option>
              {filteredGinSubcategories.map((sub) => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={ginFilters.dateFrom}
              onChange={(e) => setGinFilters((p) => ({ ...p, dateFrom: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />
            <input
              type="date"
              value={ginFilters.dateTo}
              onChange={(e) => setGinFilters((p) => ({ ...p, dateTo: e.target.value }))}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm"
            />

            <Button label="Apply" size="sm" variant="outline" onClick={applyGINFilters} />
            <Button label="Reset" size="sm" variant="secondary" onClick={resetGINFilters} />
          </div>

          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">{filteredGINRows.length} GIN(s)</p>
            <Button
              label="Excel"
              icon={Download}
              size="sm"
              variant="outline"
              onClick={() => exportRowsToExcel({ fileName: 'inventory-gin-report', sheetName: 'GIN', rows: ginExportRows })}
            />
            <Button
              label="PDF"
              icon={FileText}
              size="sm"
              variant="outline"
              onClick={() => exportRowsToPdf({ fileName: 'inventory-gin-report', title: 'GIN Report', rows: ginExportRows })}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-4 font-semibold">GIN No</th>
                <th className="px-6 py-4 font-semibold">GD Ref</th>
                <th className="px-6 py-4 font-semibold">Item</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Issued Qty</th>
                <th className="px-6 py-4 font-semibold">Issue Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGINRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    No Issuance Note (GIN) records found.
                  </td>
                </tr>
              ) : (
                filteredGINRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4">{row.code}</td>
                    <td className="px-6 py-4">{row.gd?.code || '-'}</td>
                    <td className="px-6 py-4">{row.item?.name || '-'}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{row.department?.name || '-'}</td>
                    <td className="px-6 py-4">{row.issuedQuantity}</td>
                    <td className="px-6 py-4">{row.issueDate ? new Date(row.issueDate).toLocaleDateString() : '-'}</td>
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
