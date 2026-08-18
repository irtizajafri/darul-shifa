import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import PageHeader from '../../../components/shared/PageHeader';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useClinicStore } from '../../../store/useClinicStore';
import './ClinicParameterPage.scss';

// Provisional Bill > Pharmacy Bill > Outside Hospital Store dropdown is fed
// entirely by this list — the "Hospital / In-House Store" side needs no such
// list, it's derived live from Inventory Sales Invoices instead.
export default function ClinicPharmacyStorePage() {
  const { pharmacyStores, loading, fetchPharmacyStores, createPharmacyStore, updatePharmacyStore, deletePharmacyStore } =
    useClinicStore();

  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchPharmacyStores(); }, [fetchPharmacyStores]);

  const filtered = pharmacyStores.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  function openAdd() {
    setEditing(null);
    setName('');
    setShowModal(true);
  }

  function openEdit(store) {
    setEditing(store);
    setName(store.name);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setName('');
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Store name is required');
    setSaving(true);
    try {
      if (editing) {
        await updatePharmacyStore(editing.id, { name });
        toast.success('Store updated');
      } else {
        await createPharmacyStore({ name });
        toast.success('Store created');
      }
      closeModal();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(store) {
    try {
      await updatePharmacyStore(store.id, { status: store.status === 'active' ? 'inactive' : 'active' });
      toast.success(store.status === 'active' ? 'Store disabled' : 'Store enabled');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDelete(store) {
    try {
      await deletePharmacyStore(store.id);
      toast.success('Store deleted');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div className="clinic-parameter-page">
      <ClinicMenuBar />

      <div className="cpp-body">
        <PageHeader
          breadcrumbs={[
            { label: 'Clinic', link: '/clinic-module' },
            { label: 'Parameters' },
            { label: 'Pharmacy Stores' },
          ]}
          title="Pharmacy Stores"
          actionLabel="Add Store"
          actionIcon={Plus}
          onAction={openAdd}
        />

        <div className="cpp-toolbar">
          <div className="cpp-search">
            <Search className="cpp-search-icon" />
            <input
              type="text"
              placeholder="Search stores..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="cpp-search-input"
            />
          </div>
          <span className="cpp-count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="cpp-table-wrap">
          {loading ? (
            <p className="cpp-empty">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="cpp-empty">No pharmacy stores found.</p>
          ) : (
            <table className="cpp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th className="cpp-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((store, i) => (
                  <tr key={store.id}>
                    <td className="cpp-num">{i + 1}</td>
                    <td>{store.name}</td>
                    <td>
                      <span className={`cpp-status-badge ${store.status === 'active' ? 'cpp-status-badge--active' : 'cpp-status-badge--inactive'}`}>
                        {store.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="cpp-actions">
                      <button className="cpp-btn-icon" onClick={() => toggleStatus(store)} title={store.status === 'active' ? 'Disable' : 'Enable'}>
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button className="cpp-btn-icon cpp-edit" onClick={() => openEdit(store)} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="cpp-btn-icon cpp-delete" onClick={() => setConfirmDelete(store)} title="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Pharmacy Store' : 'Add Pharmacy Store'} size="sm">
        <div className="flex flex-col gap-4">
          <Input
            label="Store Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Saboor Medical Store"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <div className="flex justify-end gap-2">
            <Button label="Cancel" variant="secondary" onClick={closeModal} />
            <Button label={editing ? 'Update' : 'Save'} onClick={handleSave} loading={saving} />
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Remove Pharmacy Store" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Remove <strong>{confirmDelete?.name}</strong>? Agar ye kisi outside-pharmacy entry se
          linked hui to remove nahi hogi — pehle "Disable" istemal karein.
        </p>
        <div className="flex justify-end gap-2">
          <Button label="Cancel" variant="secondary" onClick={() => setConfirmDelete(null)} />
          <Button label="Remove" variant="danger" onClick={() => handleDelete(confirmDelete)} />
        </div>
      </Modal>
    </div>
  );
}
