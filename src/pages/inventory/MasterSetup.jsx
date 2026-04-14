import { useMemo, useState } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Plus, Search, Trash2, X } from 'lucide-react';

const TABS = ['Items', 'Categories', 'Suppliers', 'Departments', 'Shelves'];

const INITIAL_DATA = {
  Items: [
    { id: 1, code: 'ITM-001', name: 'Panadol 500mg', category: 'Medicine', stock: 120, pp: 8, sp: 10 },
  ],
  Categories: [
    { id: 1, code: 'CAT-001', name: 'Medicine', totalItems: 1, status: 'Active' },
  ],
  Suppliers: [
    { id: 1, code: 'SUP-001', company: 'ABC Pharma', contact: 'Ahmed', phone: '0300-1234567' },
  ],
  Departments: [
    { id: 1, code: 'DEP-001', name: 'ICU', authorizedBy: 'Admin' },
  ],
  Shelves: [
    { id: 1, code: 'SH-01', location: 'Store A / Rack 2', items: 15 },
  ],
};

const EMPTY_FORM = {
  code: '',
  name: '',
  category: '',
  stock: '',
  pp: '',
  sp: '',
  company: '',
  contact: '',
  phone: '',
  totalItems: '',
  status: 'Active',
  authorizedBy: '',
  location: '',
  items: '',
};

export default function MasterSetup() {
  const [activeTab, setActiveTab] = useState('Items');
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [dataByTab, setDataByTab] = useState(INITIAL_DATA);

  const currentRows = dataByTab[activeTab] || [];

  const filteredRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return currentRows;
    return currentRows.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(text))
    );
  }, [currentRows, query]);

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

  const addRow = (e) => {
    e.preventDefault();
    const id = Date.now();

    const nextRowByTab = {
      Items: {
        id,
        code: formData.code || `ITM-${id.toString().slice(-4)}`,
        name: formData.name || 'New Item',
        category: formData.category || 'General',
        stock: Number(formData.stock || 0),
        pp: Number(formData.pp || 0),
        sp: Number(formData.sp || 0),
      },
      Categories: {
        id,
        code: formData.code || `CAT-${id.toString().slice(-3)}`,
        name: formData.name || 'New Category',
        totalItems: Number(formData.totalItems || 0),
        status: formData.status || 'Active',
      },
      Suppliers: {
        id,
        code: formData.code || `SUP-${id.toString().slice(-3)}`,
        company: formData.company || 'New Supplier',
        contact: formData.contact || '-',
        phone: formData.phone || '-',
      },
      Departments: {
        id,
        code: formData.code || `DEP-${id.toString().slice(-3)}`,
        name: formData.name || 'New Department',
        authorizedBy: formData.authorizedBy || '-',
      },
      Shelves: {
        id,
        code: formData.code || `SH-${id.toString().slice(-2)}`,
        location: formData.location || 'Store / Rack',
        items: Number(formData.items || 0),
      },
    };

    setDataByTab((prev) => ({
      ...prev,
      [activeTab]: [nextRowByTab[activeTab], ...(prev[activeTab] || [])],
    }));

    closeAddModal();
  };

  const deleteRow = (id) => {
    setDataByTab((prev) => ({
      ...prev,
      [activeTab]: (prev[activeTab] || []).filter((row) => row.id !== id),
    }));
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master Setup</h1>
          <p className="text-slate-500 text-sm">Manage inventory core configuration data</p>
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
          <p className="text-xs text-slate-500">{filteredRows.length} record(s)</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                {activeTab === 'Items' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Item Code</th>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold">Stock</th>
                    <th className="px-6 py-4 font-semibold">Pricing (PP/SP)</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </>
                )}
                {activeTab === 'Categories' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Code</th>
                    <th className="px-6 py-4 font-semibold">Category Name</th>
                    <th className="px-6 py-4 font-semibold">Total Items</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </>
                )}
                {activeTab === 'Suppliers' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Vendor Code</th>
                    <th className="px-6 py-4 font-semibold">Company Name</th>
                    <th className="px-6 py-4 font-semibold">Contact Person</th>
                    <th className="px-6 py-4 font-semibold">Phone</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </>
                )}
                {activeTab === 'Departments' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Dept ID</th>
                    <th className="px-6 py-4 font-semibold">Department Name</th>
                    <th className="px-6 py-4 font-semibold">Authorized By</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </>
                )}
                {activeTab === 'Shelves' && (
                  <>
                    <th className="px-6 py-4 font-semibold">Shelf Code</th>
                    <th className="px-6 py-4 font-semibold">Location / Rack</th>
                    <th className="px-6 py-4 font-semibold">Stored Items</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                    No {activeTab.toLowerCase()} found. Click "Add New" to get started.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    {activeTab === 'Items' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row.category}</td>
                        <td className="px-6 py-4">{row.stock}</td>
                        <td className="px-6 py-4">{row.pp} / {row.sp}</td>
                        <td className="px-6 py-4 text-right">
                          <Button label="Delete" variant="ghost" icon={Trash2} onClick={() => deleteRow(row.id)} />
                        </td>
                      </>
                    )}

                    {activeTab === 'Categories' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row.totalItems}</td>
                        <td className="px-6 py-4">{row.status}</td>
                        <td className="px-6 py-4 text-right">
                          <Button label="Delete" variant="ghost" icon={Trash2} onClick={() => deleteRow(row.id)} />
                        </td>
                      </>
                    )}

                    {activeTab === 'Suppliers' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.company}</td>
                        <td className="px-6 py-4">{row.contact}</td>
                        <td className="px-6 py-4">{row.phone}</td>
                        <td className="px-6 py-4 text-right">
                          <Button label="Delete" variant="ghost" icon={Trash2} onClick={() => deleteRow(row.id)} />
                        </td>
                      </>
                    )}

                    {activeTab === 'Departments' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.name}</td>
                        <td className="px-6 py-4">{row.authorizedBy}</td>
                        <td className="px-6 py-4 text-right" colSpan="2">
                          <Button label="Delete" variant="ghost" icon={Trash2} onClick={() => deleteRow(row.id)} />
                        </td>
                      </>
                    )}

                    {activeTab === 'Shelves' && (
                      <>
                        <td className="px-6 py-4">{row.code}</td>
                        <td className="px-6 py-4 font-medium text-slate-800">{row.location}</td>
                        <td className="px-6 py-4">{row.items}</td>
                        <td className="px-6 py-4 text-right" colSpan="2">
                          <Button label="Delete" variant="ghost" icon={Trash2} onClick={() => deleteRow(row.id)} />
                        </td>
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
          <Card className="w-full max-w-xl p-0 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Add {activeTab.slice(0, -1)}</h3>
              <button onClick={closeAddModal} className="text-slate-500 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={addRow} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  placeholder="Code"
                  value={formData.code}
                  onChange={(e) => onFormChange('code', e.target.value)}
                  className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                />

                {(activeTab === 'Items' || activeTab === 'Categories' || activeTab === 'Departments') && (
                  <input
                    placeholder={activeTab === 'Categories' ? 'Category Name' : 'Name'}
                    value={formData.name}
                    onChange={(e) => onFormChange('name', e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                )}

                {activeTab === 'Items' && (
                  <>
                    <input
                      placeholder="Category"
                      value={formData.category}
                      onChange={(e) => onFormChange('category', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                    <input
                      placeholder="Stock"
                      type="number"
                      value={formData.stock}
                      onChange={(e) => onFormChange('stock', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                    <input
                      placeholder="Purchase Price"
                      type="number"
                      value={formData.pp}
                      onChange={(e) => onFormChange('pp', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                    <input
                      placeholder="Sale Price"
                      type="number"
                      value={formData.sp}
                      onChange={(e) => onFormChange('sp', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                  </>
                )}

                {activeTab === 'Categories' && (
                  <>
                    <input
                      placeholder="Total Items"
                      type="number"
                      value={formData.totalItems}
                      onChange={(e) => onFormChange('totalItems', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                    <select
                      value={formData.status}
                      onChange={(e) => onFormChange('status', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    >
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </>
                )}

                {activeTab === 'Suppliers' && (
                  <>
                    <input
                      placeholder="Company Name"
                      value={formData.company}
                      onChange={(e) => onFormChange('company', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                    <input
                      placeholder="Contact Person"
                      value={formData.contact}
                      onChange={(e) => onFormChange('contact', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                    <input
                      placeholder="Phone"
                      value={formData.phone}
                      onChange={(e) => onFormChange('phone', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                  </>
                )}

                {activeTab === 'Departments' && (
                  <input
                    placeholder="Authorized By"
                    value={formData.authorizedBy}
                    onChange={(e) => onFormChange('authorizedBy', e.target.value)}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                  />
                )}

                {activeTab === 'Shelves' && (
                  <>
                    <input
                      placeholder="Location / Rack"
                      value={formData.location}
                      onChange={(e) => onFormChange('location', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
                    <input
                      placeholder="Stored Items"
                      type="number"
                      value={formData.items}
                      onChange={(e) => onFormChange('items', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-md text-sm"
                    />
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
