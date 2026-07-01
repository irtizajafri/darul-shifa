import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';
import NoTabAccess from '../../components/auth/NoTabAccess';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { useInventoryStore } from '../../store/useInventoryStore';

const TABS = ['Items', 'Categories', 'Subcategories', 'Suppliers', 'Storages', 'Departments'];
const STATUS_OPTIONS = ['active', 'inactive'];
const ITEM_TYPES = ['current asset', 'fixed asset'];
const UNIT_OPTIONS = ['kg', 'liters', 'pieces', 'boxes', 'ml', 'dozen', 'feet', 'inches', 'millimeters', 'centimeter'];
const FIXED_ASSET_CONDITIONS = ['working', 'under repair', 'condemned', 'in store'];
const USEFUL_LIFE_UNITS = ['years', 'months', 'hours'];

const EMPTY_FORM = {
  code: '',
  name: '',
  status: 'active',
  categoryId: '',
  subcategoryId: '',
  supplierId: '',
  storageId: '',
  itemType: 'current asset',
  unit: 'pieces',
  reorderLevel: '',
  purchasePrice: '',
  currentStock: 0,
  hasExpiry: false,
  brand: '',
  model: '',
  serialNumber: '',
  assetLocation: '',
  purchaseDate: '',
  warrantyUntil: '',
  usefulLifeYears: '',
  usefulLifeUnit: 'years',
  assetCondition: 'working',
  bookValue: '',
  address: '',
  contactDetails: '',
  bankingDetails: '',
  numberAllotment: '',
};

export default function MasterSetup() {
  const {
    loading,
    error,
    categories,
    subcategories,
    suppliers,
    storages,
  departments,
    items,
    masterOptions,
    fetchCategories,
    fetchSubcategories,
    fetchSuppliers,
    fetchStorages,
  fetchDepartments,
    fetchItems,
    fetchMastersOptions,
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    createStorage,
    updateStorage,
    deleteStorage,
  createDepartment,
    updateDepartment,
    deleteDepartment,
    createItem,
    updateItem,
    updateItemStatus,
    deleteItem,
  } = useInventoryStore();

  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('Items');
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingRow, setEditingRow] = useState(null);

  // Tabs the current user is allowed to see
  const visibleTabs = useMemo(
    () => TABS.filter((tab) => hasPermission(user, 'inventory', 'master-setup', tab.toLowerCase())),
    [user]
  );
  // Fallback if current activeTab is no longer accessible
  const effectiveTab = visibleTabs.includes(activeTab) ? activeTab : (visibleTabs[0] ?? activeTab);

  const currentRows = useMemo(() => {
    if (activeTab === 'Items') return items;
    if (activeTab === 'Categories') return categories;
    if (activeTab === 'Subcategories') return subcategories;
    if (activeTab === 'Suppliers') return suppliers;
    if (activeTab === 'Departments') return departments;
    return storages;
  }, [activeTab, items, categories, subcategories, suppliers, storages, departments]);

  const filteredSubcategoriesForItem = useMemo(() => {
    const selectedCategory = Number(formData.categoryId);
    if (!selectedCategory) return masterOptions.subcategories || [];
    return (masterOptions.subcategories || []).filter((s) => s.categoryId === selectedCategory);
  }, [masterOptions.subcategories, formData.categoryId]);

  const loadByTab = async (tabName, searchText) => {
    const payload = { search: searchText || '' };
    if (tabName === 'Items') return fetchItems(payload);
    if (tabName === 'Categories') return fetchCategories(payload);
    if (tabName === 'Subcategories') return fetchSubcategories(payload);
    if (tabName === 'Suppliers') return fetchSuppliers(payload);
    if (tabName === 'Departments') return fetchDepartments(payload);
    return fetchStorages(payload);
  };

  useEffect(() => {
    fetchMastersOptions().catch((err) => {
      toast.error(err.message || 'Failed to load master options');
    });
  }, [fetchMastersOptions]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadByTab(activeTab, query).catch((err) => {
        toast.error(err.message || `Failed to load ${activeTab.toLowerCase()}`);
      });
    }, 250);

    return () => clearTimeout(t);
  }, [activeTab, query]);

  const openAddModal = () => {
    setEditingRow(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (row) => {
    setEditingRow(row);
    setFormData({
      ...EMPTY_FORM,
      code: row.code || '',
      name: row.name || '',
      status: row.status || 'active',
      categoryId: row.categoryId || row.category?.id || '',
      subcategoryId: row.subcategoryId || row.subcategory?.id || '',
      supplierId: row.supplierId || row.supplier?.id || '',
      storageId: row.storageId || row.storage?.id || '',
      itemType: row.itemType || 'current asset',
      unit: row.unit || 'pieces',
      reorderLevel: row.reorderLevel ?? '',
      purchasePrice: row.purchasePrice ?? '',
      currentStock: row.currentStock ?? 0,
      hasExpiry: row.hasExpiry || false,
      brand: row.brand || '',
      model: row.model || '',
      serialNumber: row.serialNumber || '',
      assetLocation: row.assetLocation || '',
      purchaseDate: row.purchaseDate ? row.purchaseDate.slice(0, 10) : '',
      warrantyUntil: row.warrantyUntil ? row.warrantyUntil.slice(0, 10) : '',
      usefulLifeYears: row.usefulLifeYears ?? '',
      usefulLifeUnit: row.usefulLifeUnit || 'years',
      assetCondition: row.assetCondition || 'working',
      bookValue: row.bookValue ?? '',
      address: row.address || '',
      contactDetails: row.contactDetails || '',
      bankingDetails: row.bankingDetails || '',
      numberAllotment: row.numberAllotment || '',
    });
    setShowModal(true);
  };

  const closeAddModal = () => {
    setShowModal(false);
    setEditingRow(null);
  };

  const onFormChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const saveAndRefresh = async (fn, payload, message) => {
    await fn(payload);
    await Promise.all([loadByTab(activeTab, query), fetchMastersOptions()]);
    toast.success(message);
    closeAddModal();
  };

  const addRow = async (e) => {
    e.preventDefault();

    try {
      if (activeTab === 'Categories') {
        if (editingRow) {
          await saveAndRefresh((p) => updateCategory(editingRow.id, p), { name: formData.name, status: formData.status }, 'Category updated');
        } else {
          const enteredName = String(formData.name || '').trim().toLowerCase();
          if ((categories || []).some((r) => String(r.name || '').trim().toLowerCase() === enteredName)) {
            toast.error('Category with this name already exists');
            return;
          }
          await saveAndRefresh(createCategory, { code: formData.code || undefined, name: formData.name, status: formData.status }, 'Category created');
        }
        return;
      }

      if (activeTab === 'Subcategories') {
        if (editingRow) {
          await saveAndRefresh((p) => updateSubcategory(editingRow.id, p), { name: formData.name, categoryId: Number(formData.categoryId), status: formData.status }, 'Subcategory updated');
        } else {
          const enteredName = String(formData.name || '').trim().toLowerCase();
          const selectedCatId = Number(formData.categoryId);
          if ((subcategories || []).some((r) => String(r.name || '').trim().toLowerCase() === enteredName && Number(r.categoryId) === selectedCatId)) {
            toast.error('Subcategory with this name already exists in the selected category');
            return;
          }
          await saveAndRefresh(createSubcategory, { code: formData.code || undefined, name: formData.name, categoryId: Number(formData.categoryId), status: formData.status }, 'Subcategory created');
        }
        return;
      }

      if (activeTab === 'Suppliers') {
        const supplierPayload = { name: formData.name, address: formData.address, contactDetails: formData.contactDetails, bankingDetails: formData.bankingDetails, status: formData.status };
        if (editingRow) {
          await saveAndRefresh((p) => updateSupplier(editingRow.id, p), supplierPayload, 'Supplier updated');
        } else {
          const enteredName = String(formData.name || '').trim().toLowerCase();
          if ((suppliers || []).some((r) => String(r.name || '').trim().toLowerCase() === enteredName)) {
            toast.error('Supplier with this name already exists');
            return;
          }
          await saveAndRefresh(createSupplier, { code: formData.code || undefined, ...supplierPayload }, 'Supplier created');
        }
        return;
      }

      if (activeTab === 'Storages') {
        const storagePayload = { name: formData.name, numberAllotment: formData.numberAllotment, status: formData.status };
        if (editingRow) {
          await saveAndRefresh((p) => updateStorage(editingRow.id, p), storagePayload, 'Storage updated');
        } else {
          const enteredName = String(formData.name || '').trim().toLowerCase();
          if ((storages || []).some((r) => String(r.name || '').trim().toLowerCase() === enteredName)) {
            toast.error('Storage with this name already exists');
            return;
          }
          await saveAndRefresh(createStorage, { code: formData.code || undefined, ...storagePayload }, 'Storage created');
        }
        return;
      }

      if (activeTab === 'Departments') {
        if (editingRow) {
          await saveAndRefresh((p) => updateDepartment(editingRow.id, p), { name: formData.name, status: formData.status }, 'Department updated');
        } else {
          const enteredName = String(formData.name || '').trim().toLowerCase();
          if ((departments || []).some((r) => String(r.name || '').trim().toLowerCase() === enteredName)) {
            toast.error('Department with this name already exists');
            return;
          }
          await saveAndRefresh(createDepartment, { code: formData.code || undefined, name: formData.name, status: formData.status }, 'Department created');
        }
        return;
      }

      const itemPayload = {
        name: formData.name,
        categoryId: Number(formData.categoryId),
        subcategoryId: Number(formData.subcategoryId),
        supplierId: formData.supplierId ? Number(formData.supplierId) : undefined,
        storageId: formData.itemType === 'current asset' ? Number(formData.storageId) : undefined,
        itemType: formData.itemType,
        unit: formData.unit,
        reorderLevel: Number(formData.reorderLevel || 0),
        purchasePrice: formData.purchasePrice === '' ? undefined : Number(formData.purchasePrice),
        ...(!editingRow && { currentStock: Number(formData.currentStock || 0) }),
        hasExpiry: Boolean(formData.hasExpiry),
        status: formData.status,
        brand: formData.brand || undefined,
        model: formData.model || undefined,
        serialNumber: formData.serialNumber || undefined,
        assetLocation: formData.assetLocation || undefined,
        purchaseDate: formData.purchaseDate || undefined,
        warrantyUntil: formData.warrantyUntil || undefined,
        usefulLifeYears: formData.usefulLifeYears === '' ? undefined : Number(formData.usefulLifeYears),
        usefulLifeUnit: formData.usefulLifeUnit || 'years',
        assetCondition: formData.assetCondition || undefined,
        bookValue: formData.bookValue === '' ? undefined : Number(formData.bookValue),
      };

      if (editingRow) {
        await saveAndRefresh((p) => updateItem(editingRow.id, p), itemPayload, 'Item updated');
        return;
      }

      const enteredItemName = String(formData.name || '').trim().toLowerCase();
      const enteredModel = String(formData.model || '').trim().toLowerCase();
      const duplicateItem = (items || []).some((item) => {
        const sameName = String(item?.name || '').trim().toLowerCase() === enteredItemName;
        if (!sameName) return false;
        if (formData.itemType === 'fixed asset') {
          return String(item?.model || '').trim().toLowerCase() === enteredModel;
        }
        return true;
      });
      if (duplicateItem) {
        toast.error(formData.itemType === 'fixed asset'
          ? 'A fixed asset with the same name and model already exists'
          : 'Item with this name already exists');
        return;
      }

      await saveAndRefresh(createItem, { code: formData.code || undefined, ...itemPayload }, 'Item created');
    } catch (err) {
      toast.error(err.message || 'Failed to save record');
    }
  };

  const handleSetItemStatus = async (itemId, status) => {
    try {
      await updateItemStatus(itemId, status);
      await loadByTab(activeTab, query);
      toast.success(`Item marked ${status}`);
    } catch (err) {
      toast.error(err.message || `Failed to mark item ${status}`);
    }
  };

  const handleSetStatus = async (row, status) => {
    const tab = effectiveTab;
    try {
      if (tab === 'Items') {
        await updateItemStatus(row.id, status);
      } else if (tab === 'Categories') {
        await updateCategory(row.id, { name: row.name, status });
      } else if (tab === 'Subcategories') {
        await updateSubcategory(row.id, { name: row.name, categoryId: row.categoryId || row.category?.id, status });
      } else if (tab === 'Suppliers') {
        await updateSupplier(row.id, { name: row.name, address: row.address, contactDetails: row.contactDetails, bankingDetails: row.bankingDetails, status });
      } else if (tab === 'Storages') {
        await updateStorage(row.id, { name: row.name, numberAllotment: row.numberAllotment, status });
      } else if (tab === 'Departments') {
        await updateDepartment(row.id, { name: row.name, status });
      }
      await loadByTab(tab, query);
      toast.success(`Marked ${status}`);
    } catch (err) {
      toast.error(err.message || `Failed to mark ${status}`);
    }
  };

  const handleDelete = async (row) => {
    const label = effectiveTab.slice(0, -1);
    const isConfirmed = window.confirm(`Are you sure you want to delete this ${label}? If it has linked records, deletion will be blocked.`);
    if (!isConfirmed) return;
    try {
      if (activeTab === 'Items') await deleteItem(row.id);
      else if (activeTab === 'Categories') await deleteCategory(row.id);
      else if (activeTab === 'Subcategories') await deleteSubcategory(row.id);
      else if (activeTab === 'Suppliers') await deleteSupplier(row.id);
      else if (activeTab === 'Storages') await deleteStorage(row.id);
      else if (activeTab === 'Departments') await deleteDepartment(row.id);
      await loadByTab(activeTab, query);
      toast.success(`${label} deleted`);
    } catch (err) {
      toast.error(err.message || `Failed to delete ${label}`);
    }
  };

  const handleDeleteItem = async (itemId) => {
    const isConfirmed = window.confirm('Are you sure you want to delete this item? If it has transactions, deletion will be blocked.');
    if (!isConfirmed) return;

    try {
      await deleteItem(itemId);
      await loadByTab(activeTab, query);
      toast.success('Item deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete item');
    }
  };

  const recordCount = Array.isArray(currentRows) ? currentRows.length : 0;
  const tableColumnCount = activeTab === 'Items' ? 9 : 6;

  if (visibleTabs.length === 0) return <NoTabAccess />;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master Setup</h1>
          <p className="text-slate-500 text-sm">Inventory masters & item registration (API integrated)</p>
        </div>
        <Button label={`Add New ${effectiveTab.slice(0, -1)}`} icon={Plus} onClick={openAddModal} />
      </div>

      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-6 w-fit">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); openAddModal(); }}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              effectiveTab === tab
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${effectiveTab}...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">{recordCount} record(s)</p>
            <button
              onClick={() => setShowTable((prev) => !prev)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              {showTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showTable ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 text-red-600 text-sm border-b border-red-100">
            {error}
          </div>
        )}

        {showTable && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                {effectiveTab === 'Items' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Type/Unit</th>
                    <th className="px-6 py-4 font-semibold">Price</th>
                    <th className="px-6 py-4 font-semibold">Storage/Shelf</th>
                    <th className="px-6 py-4 font-semibold">Stock/Reorder</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Actions</th>
                  </>
                )}
                {effectiveTab === 'Categories' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Subcategories</th>
                    <th className="px-6 py-4 font-semibold">Items</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Actions</th>
                  </>
                )}
                {effectiveTab === 'Subcategories' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Items</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Actions</th>
                  </>
                )}
                {effectiveTab === 'Suppliers' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Contact</th>
                    <th className="px-6 py-4 font-semibold">Address</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Actions</th>
                  </>
                )}
                {effectiveTab === 'Storages' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Number Allotment</th>
                    <th className="px-6 py-4 font-semibold">Items</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Actions</th>
                  </>
                )}
                {effectiveTab === 'Departments' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">GD Requests</th>
                    <th className="px-6 py-4 font-semibold">GIN Issues</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={tableColumnCount} className="px-6 py-10 text-center text-slate-500">Loading...</td>
                </tr>
              ) : recordCount === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="px-6 py-12 text-center text-slate-500">
                    No {effectiveTab.toLowerCase()} found.
                  </td>
                </tr>
              ) : (
                currentRows.map((row) => (
                  <tr key={row.id}>
                    {effectiveTab === 'Items' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row.category?.name} / {row.subcategory?.name}</td>
                        <td className="px-6 py-4">
                          <div>{row.itemType} / {row.unit}</div>
                          {row.itemType === 'fixed asset' && (
                            <div className="text-xs text-slate-500">
                              {[row.brand, row.assetLocation].filter(Boolean).join(' • ') || '-'}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">{row.purchasePrice}</td>
                        <td className="px-6 py-4">{row.storage?.name || '-'}</td>
                        <td className="px-6 py-4">{row.currentStock} / {row.reorderLevel}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button
                              label="Edit"
                              size="sm"
                              variant="outline"
                              onClick={() => openEditModal(row)}
                            />
                            {row.status !== 'inactive' ? (
                              <Button
                                label="Inactive"
                                size="sm"
                                variant="secondary"
                                onClick={() => handleSetItemStatus(row.id, 'inactive')}
                              />
                            ) : (
                              <Button
                                label="Activate"
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetItemStatus(row.id, 'active')}
                              />
                            )}
                            <Button
                              label="Delete"
                              size="sm"
                              variant="danger"
                              onClick={() => handleDeleteItem(row.id)}
                            />
                          </div>
                        </td>
                      </>
                    )}

                    {effectiveTab === 'Categories' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row._count?.subcategories || 0}</td>
                        <td className="px-6 py-4">{row._count?.items || 0}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button label="Edit" size="sm" variant="outline" onClick={() => openEditModal(row)} />
                            {row.status !== 'inactive' ? (
                              <Button label="Inactive" size="sm" variant="secondary" onClick={() => handleSetStatus(row, 'inactive')} />
                            ) : (
                              <Button label="Activate" size="sm" variant="outline" onClick={() => handleSetStatus(row, 'active')} />
                            )}
                            <Button label="Delete" size="sm" variant="danger" onClick={() => handleDelete(row)} />
                          </div>
                        </td>
                      </>
                    )}

                    {effectiveTab === 'Subcategories' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row.category?.name}</td>
                        <td className="px-6 py-4">{row._count?.items || 0}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button label="Edit" size="sm" variant="outline" onClick={() => openEditModal(row)} />
                            {row.status !== 'inactive' ? (
                              <Button label="Inactive" size="sm" variant="secondary" onClick={() => handleSetStatus(row, 'inactive')} />
                            ) : (
                              <Button label="Activate" size="sm" variant="outline" onClick={() => handleSetStatus(row, 'active')} />
                            )}
                            <Button label="Delete" size="sm" variant="danger" onClick={() => handleDelete(row)} />
                          </div>
                        </td>
                      </>
                    )}

                    {effectiveTab === 'Suppliers' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row.contactDetails || '-'}</td>
                        <td className="px-6 py-4">{row.address || '-'}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button label="Edit" size="sm" variant="outline" onClick={() => openEditModal(row)} />
                            {row.status !== 'inactive' ? (
                              <Button label="Inactive" size="sm" variant="secondary" onClick={() => handleSetStatus(row, 'inactive')} />
                            ) : (
                              <Button label="Activate" size="sm" variant="outline" onClick={() => handleSetStatus(row, 'active')} />
                            )}
                            <Button label="Delete" size="sm" variant="danger" onClick={() => handleDelete(row)} />
                          </div>
                        </td>
                      </>
                    )}

                    {effectiveTab === 'Storages' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row.numberAllotment || '-'}</td>
                        <td className="px-6 py-4">{row._count?.items || 0}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button label="Edit" size="sm" variant="outline" onClick={() => openEditModal(row)} />
                            {row.status !== 'inactive' ? (
                              <Button label="Inactive" size="sm" variant="secondary" onClick={() => handleSetStatus(row, 'inactive')} />
                            ) : (
                              <Button label="Activate" size="sm" variant="outline" onClick={() => handleSetStatus(row, 'active')} />
                            )}
                            <Button label="Delete" size="sm" variant="danger" onClick={() => handleDelete(row)} />
                          </div>
                        </td>
                      </>
                    )}

                    {effectiveTab === 'Departments' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row._count?.gds || 0}</td>
                        <td className="px-6 py-4">{row._count?.gins || 0}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Button label="Edit" size="sm" variant="outline" onClick={() => openEditModal(row)} />
                            {row.status !== 'inactive' ? (
                              <Button label="Inactive" size="sm" variant="secondary" onClick={() => handleSetStatus(row, 'inactive')} />
                            ) : (
                              <Button label="Activate" size="sm" variant="outline" onClick={() => handleSetStatus(row, 'active')} />
                            )}
                            <Button label="Delete" size="sm" variant="danger" onClick={() => handleDelete(row)} />
                          </div>
                        </td>
                      </>
                    )}

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-3xl p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">{editingRow ? 'Edit' : 'Add'} {activeTab.slice(0, -1)}</h3>
              <button onClick={closeAddModal} className="text-slate-500 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={addRow} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  placeholder="Code (optional - auto generated if empty)"
                  value={formData.code}
                  onChange={(e) => onFormChange('code', e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                />

                <select
                  value={formData.status}
                  onChange={(e) => onFormChange('status', e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                {(activeTab === 'Categories' || activeTab === 'Subcategories' || activeTab === 'Suppliers' || activeTab === 'Storages' || activeTab === 'Departments' || activeTab === 'Items') && (
                  <input
                    placeholder={effectiveTab === 'Items' ? 'Item Name' : 'Name'}
                    value={formData.name}
                    onChange={(e) => onFormChange('name', e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    required
                  />
                )}

                {effectiveTab === 'Subcategories' && (
                  <select
                    value={formData.categoryId}
                    onChange={(e) => onFormChange('categoryId', e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    required
                  >
                    <option value="">Select Category</option>
                    {(masterOptions.categories || []).map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
                    ))}
                  </select>
                )}

                {effectiveTab === 'Suppliers' && (
                  <>
                    <input
                      placeholder="Contact Details"
                      value={formData.contactDetails}
                      onChange={(e) => onFormChange('contactDetails', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                    <input
                      placeholder="Address"
                      value={formData.address}
                      onChange={(e) => onFormChange('address', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                    <input
                      placeholder="Banking Details"
                      value={formData.bankingDetails}
                      onChange={(e) => onFormChange('bankingDetails', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm md:col-span-2"
                    />
                  </>
                )}

                {effectiveTab === 'Storages' && (
                  <input
                    placeholder="Number Allotment"
                    value={formData.numberAllotment}
                    onChange={(e) => onFormChange('numberAllotment', e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                )}

                {effectiveTab === 'Items' && (
                  <>
                    <SearchableSelect
                      options={masterOptions.categories || []}
                      value={formData.categoryId}
                      onChange={(selectedCategoryId) => {
                        setFormData((prev) => ({ ...prev, categoryId: selectedCategoryId, subcategoryId: '' }));
                      }}
                      placeholder="Select Category"
                      required
                    />

                    <SearchableSelect
                      options={filteredSubcategoriesForItem}
                      value={formData.subcategoryId}
                      onChange={(e) => onFormChange('subcategoryId', e)}
                      placeholder="Select Subcategory"
                      required
                    />

                    <SearchableSelect
                      options={masterOptions.suppliers || []}
                      value={formData.supplierId}
                      onChange={(e) => onFormChange('supplierId', e)}
                      placeholder="Select Suppliers (Optional)"
                    />

                    {formData.itemType === 'current asset' ? (
                      <SearchableSelect
                        options={masterOptions.storages || []}
                        value={formData.storageId}
                        onChange={(e) => onFormChange('storageId', e)}
                        placeholder="Select Storage"
                        required
                      />
                    ) : (
                      <input
                        value="No shelf required for fixed assets"
                        disabled
                        className="px-3 py-2 border border-slate-200 rounded-md text-sm bg-slate-50 text-slate-500"
                      />
                    )}

                    <select
                      value={formData.itemType}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          itemType: nextType,
                          storageId: nextType === 'fixed asset' ? '' : prev.storageId,
                        }));
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    >
                      {ITEM_TYPES.map((it) => (
                        <option key={it} value={it}>{it}</option>
                      ))}
                    </select>

                    <select
                      value={formData.unit}
                      onChange={(e) => onFormChange('unit', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>

                    <input
                      placeholder="Reorder Level"
                      type="number"
                      min="0"
                      value={formData.reorderLevel}
                      onChange={(e) => onFormChange('reorderLevel', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                      required
                    />

                    <input
                      placeholder="Purchase Price (optional - auto from last GRN if exists)"
                      type="number"
                      min="0"
                      step="any"
                      value={formData.purchasePrice}
                      onChange={(e) => onFormChange('purchasePrice', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />

                    {!editingRow && (
                      <input
                        placeholder="Opening Stock"
                        type="number"
                        min="0"
                        value={formData.currentStock}
                        onChange={(e) => onFormChange('currentStock', e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                      />
                    )}

                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formData.hasExpiry}
                        onChange={(e) => onFormChange('hasExpiry', e.target.checked)}
                      />
                      Expiry applicable
                    </label>

                    {formData.itemType === 'fixed asset' && (
                      <>
                        <div className="md:col-span-2 mt-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
                          Fixed Asset Details
                        </div>

                        <input
                          placeholder="Brand (e.g. Haier, Orient)"
                          value={formData.brand}
                          onChange={(e) => onFormChange('brand', e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                        />

                        <input
                          placeholder="Model *"
                          required
                          value={formData.model}
                          onChange={(e) => onFormChange('model', e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                        />

                        <input
                          placeholder="Serial Number"
                          value={formData.serialNumber}
                          onChange={(e) => onFormChange('serialNumber', e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                        />

                        <input
                          placeholder="Asset Location (ICU / OPD / Room)"
                          value={formData.assetLocation}
                          onChange={(e) => onFormChange('assetLocation', e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                        />

                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Purchase Date</label>
                          <input
                            type="date"
                            value={formData.purchaseDate}
                            onChange={(e) => onFormChange('purchaseDate', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Warranty Until</label>
                          <input
                            type="date"
                            value={formData.warrantyUntil}
                            onChange={(e) => onFormChange('warrantyUntil', e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:col-span-2">
                          <input
                            placeholder="Useful Life"
                            type="number"
                            min="1"
                            value={formData.usefulLifeYears}
                            onChange={(e) => onFormChange('usefulLifeYears', e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                          />

                          <select
                            value={formData.usefulLifeUnit || 'years'}
                            onChange={(e) => onFormChange('usefulLifeUnit', e.target.value)}
                            className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                          >
                            {USEFUL_LIFE_UNITS.map((unit) => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
                        </div>

                        <select
                          value={formData.assetCondition}
                          onChange={(e) => onFormChange('assetCondition', e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                        >
                          {FIXED_ASSET_CONDITIONS.map((condition) => (
                            <option key={condition} value={condition}>{condition}</option>
                          ))}
                        </select>

                        <select
                        value={formData.bookValue}
                        onChange={(e) => onFormChange('bookValue', e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white">
                        <option value="" disabled>Select Status</option>
                        <option value="New">New</option>
                        <option value="Used">Used</option>
                        </select>
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button label="Cancel" variant="secondary" onClick={closeAddModal} />
                <Button label="Save" type="submit" />
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
