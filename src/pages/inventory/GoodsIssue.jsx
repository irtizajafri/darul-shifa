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

  const [gdDepartmentId, setGdDepartmentId] = useState('');
  const [gdItemSearch, setGdItemSearch] = useState('');
  const [gdItemDropdownOpen, setGdItemDropdownOpen] = useState(false);
  const [gdSelectedItems, setGdSelectedItems] = useState([]);

  const [selectedGDHeaderId, setSelectedGDHeaderId] = useState('');
  const [ginIssuedQtys, setGinIssuedQtys] = useState({});
  const [createdGDHeader, setCreatedGDHeader] = useState(null);

  const {
    loading,
    gds,
    gdHeaders,
    gins,
    items,
    masterOptions,
    fetchItems,
    fetchMastersOptions,
    fetchGDs,
    fetchGDHeaders,
    fetchGINs,
    createGDBatch,
    createGIN,
  } = useInventoryStore();

  useEffect(() => {
    Promise.all([
      fetchItems({ status: 'active' }),
      fetchMastersOptions(),
      fetchGDs(),
      fetchGDHeaders(),
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

  const gdItemSearchResults = useMemo(() => {
    const q = gdItemSearch.trim().toLowerCase();
    if (!q) return (items || []).slice(0, 10);
    return (items || []).filter((it) =>
      String(it.name || '').toLowerCase().includes(q) ||
      String(it.code || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }, [items, gdItemSearch]);

  const addGdItem = (item) => {
    if (gdSelectedItems.find((i) => i.itemId === item.id)) {
      toast.error('Item already added');
      return;
    }
    setGdSelectedItems((prev) => [...prev, { itemId: item.id, itemName: item.name, itemCode: item.code, quantityRequested: '' }]);
    setGdItemSearch('');
    setGdItemDropdownOpen(false);
  };

  const removeGdItem = (itemId) => setGdSelectedItems((prev) => prev.filter((i) => i.itemId !== itemId));

  const updateGdItemQty = (itemId, qty) =>
    setGdSelectedItems((prev) => prev.map((i) => i.itemId === itemId ? { ...i, quantityRequested: qty } : i));

  const handleCreateGD = async (e) => {
    e.preventDefault();
    if (!gdDepartmentId) { toast.error('Please select a department'); return; }
    if (gdSelectedItems.length === 0) { toast.error('Please add at least one item'); return; }
    const badQty = gdSelectedItems.find((i) => !i.quantityRequested || Number(i.quantityRequested) <= 0);
    if (badQty) { toast.error(`Enter quantity for: ${badQty.itemName}`); return; }
    try {
      const result = await createGDBatch({
        departmentId: Number(gdDepartmentId),
        items: gdSelectedItems.map((i) => ({ itemId: i.itemId, quantityRequested: Number(i.quantityRequested) })),
      });
      await Promise.all([fetchGDs(gdFilters), fetchGDHeaders()]);
      setGdDepartmentId('');
      setGdSelectedItems([]);
      setGdItemSearch('');
      setShowGDForm(false);
      setCreatedGDHeader(result);
    } catch (err) {
      toast.error(err.message || 'Failed to create GD');
    }
  };

  const selectedGDHeader = useMemo(
    () => (gdHeaders || []).find((h) => h.id === Number(selectedGDHeaderId)) || null,
    [gdHeaders, selectedGDHeaderId]
  );

  const handleCreateGIN = async (e) => {
    e.preventDefault();
    if (!selectedGDHeaderId) { toast.error('Please select a GD'); return; }
    const items = (selectedGDHeader?.gdItems || []).map((gdItem) => ({
      gdItemId: gdItem.id,
      issuedQuantity: Number(ginIssuedQtys[gdItem.id] ?? gdItem.quantityRequested),
    }));
    try {
      await createGIN({ gdHeaderId: Number(selectedGDHeaderId), items });
      await Promise.all([fetchGINs(ginFilters), fetchGDHeaders(), fetchGDs(gdFilters), fetchItems()]);
      setSelectedGDHeaderId('');
      setGinIssuedQtys({});
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

  const ginExportRows = useMemo(() => {
    const rows = [];
    for (const row of filteredGINRows) {
      const ginCode = row.code;
      const gdRef = row.gdHeader?.code || row.gd?.code || '-';
      const dept = row.department?.name || row.gdHeader?.department?.name || '-';
      const date = row.issueDate ? new Date(row.issueDate).toLocaleDateString() : '-';
      if (row.ginItems && row.ginItems.length > 0) {
        for (const gi of row.ginItems) {
          rows.push({ ginCode, gdRef, department: dept, item: gi.item?.name || '-', issuedQuantity: gi.issuedQuantity, issueDate: date });
        }
      } else {
        rows.push({ ginCode, gdRef, department: dept, item: row.item?.name || '-', issuedQuantity: row.issuedQuantity ?? '-', issueDate: date });
      }
    }
    return rows;
  }, [filteredGINRows]);

  return (
    <div className="p-6">

      {createdGDHeader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-green-800">GD Created Successfully</h2>
                <p className="text-sm text-green-600 mt-0.5">Code: <span className="font-semibold">{createdGDHeader.code}</span></p>
              </div>
              <span className="text-2xl">✓</span>
            </div>
            <div className="px-6 py-4">
              <div className="flex justify-between text-sm text-slate-500 mb-3">
                <span>Department: <span className="font-medium text-slate-800">{createdGDHeader.department?.name || '-'}</span></span>
                <span>Date: <span className="font-medium text-slate-800">{new Date(createdGDHeader.requestDate).toLocaleDateString()}</span></span>
              </div>
              <table className="w-full text-sm border border-slate-200 rounded-md overflow-hidden">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Item</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(createdGDHeader.gdItems || []).map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-2 font-medium">{item.item?.name || '-'}</td>
                      <td className="px-4 py-2 text-right">{item.quantityRequested}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button label="Close" onClick={() => setCreatedGDHeader(null)} />
            </div>
          </div>
        </div>
      )}

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
          <form onSubmit={handleCreateGD} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={gdDepartmentId}
                onChange={(e) => setGdDepartmentId(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                required
              >
                <option value="">Select Department</option>
                {(masterOptions.departments || []).map((dep) => (
                  <option key={dep.id} value={dep.id}>{dep.name} ({dep.code})</option>
                ))}
              </select>

              <div className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search and add item..."
                    value={gdItemSearch}
                    onChange={(e) => { setGdItemSearch(e.target.value); setGdItemDropdownOpen(true); }}
                    onFocus={() => setGdItemDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setGdItemDropdownOpen(false), 150)}
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm w-full focus:outline-none focus:border-blue-500"
                  />
                </div>
                {gdItemDropdownOpen && gdItemSearchResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {gdItemSearchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => addGdItem(item)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0"
                      >
                        <span className="font-medium">{item.name}</span>
                        <span className="text-slate-400 ml-2 text-xs">({item.code})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {gdSelectedItems.length > 0 && (
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                      <th className="px-4 py-2 text-left font-semibold">#</th>
                      <th className="px-4 py-2 text-left font-semibold">Item</th>
                      <th className="px-4 py-2 text-left font-semibold">Code</th>
                      <th className="px-4 py-2 text-left font-semibold">Qty Requested</th>
                      <th className="px-4 py-2 text-left font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gdSelectedItems.map((row, idx) => (
                      <tr key={row.itemId}>
                        <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium">{row.itemName}</td>
                        <td className="px-4 py-2 text-slate-500">{row.itemCode}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={row.quantityRequested}
                            onChange={(e) => updateGdItemQty(row.itemId, e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded text-sm w-24 focus:outline-none focus:border-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => removeGdItem(row.itemId)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" label={loading ? 'Saving...' : `Save GD (${gdSelectedItems.length} item${gdSelectedItems.length !== 1 ? 's' : ''})`} disabled={loading || gdSelectedItems.length === 0} />
              <Button type="button" variant="secondary" label="Cancel" onClick={() => { setShowGDForm(false); setGdDepartmentId(''); setGdSelectedItems([]); setGdItemSearch(''); }} />
            </div>
          </form>
        </Card>
      )}

      {showGINForm && (
        <Card className="mb-4" title="Create Goods Issuance (GIN)">
          <form onSubmit={handleCreateGIN} className="space-y-4">
            <select
              value={selectedGDHeaderId}
              onChange={(e) => { setSelectedGDHeaderId(e.target.value); setGinIssuedQtys({}); }}
              className="px-3 py-2 border border-slate-300 rounded-md text-sm w-full md:w-1/2"
              required
            >
              <option value="">Select GD (by header code)</option>
              {(gdHeaders || []).filter((h) => h.status !== 'closed').map((h) => (
                <option key={h.id} value={h.id}>
                  {h.code} — {h.department?.name || '-'} [{h.status}] ({h.gdItems?.length || 0} items)
                </option>
              ))}
            </select>

            {selectedGDHeader && (
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase border-b border-slate-200">
                      <th className="px-4 py-2 text-left font-semibold">#</th>
                      <th className="px-4 py-2 text-left font-semibold">Item</th>
                      <th className="px-4 py-2 text-left font-semibold">Demanded</th>
                      <th className="px-4 py-2 text-left font-semibold">Issue Qty</th>
                      <th className="px-4 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedGDHeader.gdItems || []).map((gdItem, idx) => (
                      <tr key={gdItem.id} className={gdItem.status === 'closed' ? 'opacity-40' : ''}>
                        <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium">{gdItem.item?.name || '-'}</td>
                        <td className="px-4 py-2 text-slate-600">{gdItem.quantityRequested}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="1"
                            placeholder={gdItem.quantityRequested}
                            value={ginIssuedQtys[gdItem.id] ?? ''}
                            onChange={(e) => setGinIssuedQtys((prev) => ({ ...prev, [gdItem.id]: e.target.value }))}
                            disabled={gdItem.status === 'closed'}
                            className="px-2 py-1 border border-slate-300 rounded text-sm w-24 focus:outline-none focus:border-blue-500 disabled:bg-slate-100"
                          />
                        </td>
                        <td className="px-4 py-2 capitalize text-xs">
                          <span className={`px-2 py-0.5 rounded-full font-medium ${gdItem.status === 'closed' ? 'bg-green-100 text-green-700' : gdItem.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                            {gdItem.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" label={loading ? 'Saving...' : 'Save GIN'} disabled={loading || !selectedGDHeaderId} />
              <Button type="button" variant="secondary" label="Cancel" onClick={() => { setShowGINForm(false); setSelectedGDHeaderId(''); setGinIssuedQtys({}); }} />
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
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Items Issued</th>
                <th className="px-6 py-4 font-semibold">Issue Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGINRows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    No Issuance Note (GIN) records found.
                  </td>
                </tr>
              ) : (
                filteredGINRows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-6 py-4 font-medium">{row.code}</td>
                    <td className="px-6 py-4 text-slate-500">{row.gdHeader?.code || row.gd?.code || '-'}</td>
                    <td className="px-6 py-4">{row.department?.name || row.gdHeader?.department?.name || '-'}</td>
                    <td className="px-6 py-4">
                      {row.ginItems && row.ginItems.length > 0 ? (
                        <ul className="space-y-0.5">
                          {row.ginItems.map((gi) => (
                            <li key={gi.id} className="text-sm">
                              {gi.item?.name || '-'} <span className="text-slate-400">× {gi.issuedQuantity}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm">{row.item?.name || '-'} × {row.issuedQuantity ?? '-'}</span>
                      )}
                    </td>
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
