import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useInventoryStore } from '../../store/useInventoryStore';

const TABS = ['Items', 'Categories', 'Subcategories', 'Suppliers', 'Storages', 'Departments'];
const STATUS_OPTIONS = ['active', 'inactive'];
const ITEM_TYPES = ['current asset', 'fixed asset'];
const UNIT_OPTIONS = ['kg', 'liters', 'pieces', 'boxes', 'ml', 'dozen', 'feet', 'inches', 'millimeters', 'centimeter'];
const FIXED_ASSET_CONDITIONS = ['working', 'under repair', 'condemned', 'in store'];

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
    createSubcategory,
    createSupplier,
    createStorage,
  createDepartment,
    createItem,
    updateItemStatus,
    deleteItem,
  } = useInventoryStore();

  const [activeTab, setActiveTab] = useState('Items');
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

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
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const closeAddModal = () => {
    setShowModal(false);
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
        await saveAndRefresh(createCategory, {
          code: formData.code || undefined,
          name: formData.name,
          status: formData.status,
        }, 'Category created');
        return;
      }

      if (activeTab === 'Subcategories') {
        await saveAndRefresh(createSubcategory, {
          code: formData.code || undefined,
          name: formData.name,
          categoryId: Number(formData.categoryId),
          status: formData.status,
        }, 'Subcategory created');
        return;
      }

      if (activeTab === 'Suppliers') {
        await saveAndRefresh(createSupplier, {
          code: formData.code || undefined,
          name: formData.name,
          address: formData.address,
          contactDetails: formData.contactDetails,
          bankingDetails: formData.bankingDetails,
          status: formData.status,
        }, 'Supplier created');
        return;
      }

      if (activeTab === 'Storages') {
        await saveAndRefresh(createStorage, {
          code: formData.code || undefined,
          name: formData.name,
          numberAllotment: formData.numberAllotment,
          status: formData.status,
        }, 'Storage created');
        return;
      }

      if (activeTab === 'Departments') {
        await saveAndRefresh(createDepartment, {
          code: formData.code || undefined,
          name: formData.name,
          status: formData.status,
        }, 'Department created');
        return;
      }

      await saveAndRefresh(createItem, {
        code: formData.code || undefined,
        name: formData.name,
        categoryId: Number(formData.categoryId),
        subcategoryId: Number(formData.subcategoryId),
        supplierId: Number(formData.supplierId),
        storageId: formData.itemType === 'current asset' ? Number(formData.storageId) : undefined,
        itemType: formData.itemType,
        unit: formData.unit,
        reorderLevel: Number(formData.reorderLevel || 0),
        purchasePrice: formData.purchasePrice === '' ? undefined : Number(formData.purchasePrice),
        currentStock: Number(formData.currentStock || 0),
        hasExpiry: Boolean(formData.hasExpiry),
        status: formData.status,
        brand: formData.brand || undefined,
        model: formData.model || undefined,
        serialNumber: formData.serialNumber || undefined,
        assetLocation: formData.assetLocation || undefined,
        purchaseDate: formData.purchaseDate || undefined,
        warrantyUntil: formData.warrantyUntil || undefined,
        usefulLifeYears: formData.usefulLifeYears === '' ? undefined : Number(formData.usefulLifeYears),
        assetCondition: formData.assetCondition || undefined,
        bookValue: formData.bookValue === '' ? undefined : Number(formData.bookValue),
      }, 'Item created');
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
  const tableColumnCount = activeTab === 'Items' ? 8 : 5;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master Setup</h1>
          <p className="text-slate-500 text-sm">Inventory masters & item registration (API integrated)</p>
        </div>
        <Button label={`Add New ${activeTab.slice(0, -1)}`} icon={Plus} onClick={openAddModal} />
      </div>

      <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-6 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab
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
                placeholder={`Search ${activeTab}...`} 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">{recordCount} record(s)</p>
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 text-red-600 text-sm border-b border-red-100">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                {activeTab === 'Items' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Type/Unit</th>
                    <th className="px-6 py-4 font-semibold">Price</th>
                    <th className="px-6 py-4 font-semibold">Stock/Reorder</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Actions</th>
                  </>
                )}
                {activeTab === 'Categories' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Subcategories</th>
                    <th className="px-6 py-4 font-semibold">Items</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </>
                )}
                {activeTab === 'Subcategories' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Items</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </>
                )}
                {activeTab === 'Suppliers' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Contact</th>
                    <th className="px-6 py-4 font-semibold">Address</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </>
                )}
                {activeTab === 'Storages' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Number Allotment</th>
                    <th className="px-6 py-4 font-semibold">Items</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                  </>
                )}
                {activeTab === 'Departments' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">GD Requests</th>
                    <th className="px-6 py-4 font-semibold">GIN Issues</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
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
                    No {activeTab.toLowerCase()} found.
                  </td>
                </tr>
              ) : (
                currentRows.map((row) => (
                  <tr key={row.id}>
                    {activeTab === 'Items' && (
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
                        <td className="px-6 py-4">{row.currentStock} / {row.reorderLevel}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
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

                    {activeTab === 'Categories' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row._count?.subcategories || 0}</td>
                        <td className="px-6 py-4">{row._count?.items || 0}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                      </>
                    )}

                    {activeTab === 'Subcategories' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row.category?.name}</td>
                        <td className="px-6 py-4">{row._count?.items || 0}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                      </>
                    )}

                    {activeTab === 'Suppliers' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row.contactDetails || '-'}</td>
                        <td className="px-6 py-4">{row.address || '-'}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                      </>
                    )}

                    {activeTab === 'Storages' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row.numberAllotment || '-'}</td>
                        <td className="px-6 py-4">{row._count?.items || 0}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                      </>
                    )}

                    {activeTab === 'Departments' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row._count?.gds || 0}</td>
                        <td className="px-6 py-4">{row._count?.gins || 0}</td>
                        <td className="px-6 py-4 capitalize">{row.status}</td>
                      </>
                    )}

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-3xl p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Add {activeTab.slice(0, -1)}</h3>
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
                    placeholder={activeTab === 'Items' ? 'Item Name' : 'Name'}
                    value={formData.name}
                    onChange={(e) => onFormChange('name', e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    required
                  />
                )}

                {activeTab === 'Subcategories' && (
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

                {activeTab === 'Suppliers' && (
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

                {activeTab === 'Storages' && (
                  <input
                    placeholder="Number Allotment"
                    value={formData.numberAllotment}
                    onChange={(e) => onFormChange('numberAllotment', e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                )}

                {activeTab === 'Items' && (
                  <>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => {
                        const selectedCategoryId = e.target.value;
                        setFormData((prev) => ({ ...prev, categoryId: selectedCategoryId, subcategoryId: '' }));
                      }}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                      required
                    >
                      <option value="">Select Category</option>
                      {(masterOptions.categories || []).map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name} ({cat.code})</option>
                      ))}
                    </select>

                    <select
                      value={formData.subcategoryId}
                      onChange={(e) => onFormChange('subcategoryId', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                      required
                    >
                      <option value="">Select Subcategory</option>
                      {filteredSubcategoriesForItem.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                      ))}
                    </select>

                    <select
                      value={formData.supplierId}
                      onChange={(e) => onFormChange('supplierId', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                      required
                    >
                      <option value="">Select Supplier</option>
                      {(masterOptions.suppliers || []).map((sup) => (
                        <option key={sup.id} value={sup.id}>{sup.name} ({sup.code})</option>
                      ))}
                    </select>

                    {formData.itemType === 'current asset' ? (
                      <select
                        value={formData.storageId}
                        onChange={(e) => onFormChange('storageId', e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                        required
                      >
                        <option value="">Select Storage</option>
                        {(masterOptions.storages || []).map((st) => (
                          <option key={st.id} value={st.id}>{st.name} ({st.code})</option>
                        ))}
                      </select>
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
                      value={formData.purchasePrice}
                      onChange={(e) => onFormChange('purchasePrice', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />

                    <input
                      placeholder="Opening Stock"
                      type="number"
                      min="0"
                      value={formData.currentStock}
                      onChange={(e) => onFormChange('currentStock', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />

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
                          placeholder="Model"
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

                        <input
                          placeholder="Useful Life (Years)"
                          type="number"
                          min="1"
                          value={formData.usefulLifeYears}
                          onChange={(e) => onFormChange('usefulLifeYears', e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                        />

                        <select
                          value={formData.assetCondition}
                          onChange={(e) => onFormChange('assetCondition', e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                        >
                          {FIXED_ASSET_CONDITIONS.map((condition) => (
                            <option key={condition} value={condition}>{condition}</option>
                          ))}
                        </select>

                        <input
                          placeholder="Book Value (optional/manual)"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.bookValue}
                          onChange={(e) => onFormChange('bookValue', e.target.value)}
                          className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                        />
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
