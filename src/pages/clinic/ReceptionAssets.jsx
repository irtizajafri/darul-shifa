import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import PageHeader from '../../components/shared/PageHeader';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useClinicStore } from '../../store/useClinicStore';
import './parameters/ClinicParameterPage.scss';

const CONDITIONS = ['working', 'damaged', 'maintenance'];

const emptyForm = () => ({ name: '', quantity: '', condition: 'working', notes: '' });

// Reception's own items list — deliberately independent of the Inventory
// module's AssetInstance/GRN/GIN tracking (per explicit request). Cashier
// Handover snapshots this list at handover time; managing the list itself
// (this page) never touches Handover records already saved.
export default function ReceptionAssets() {
  const { receptionAssets, loading, fetchReceptionAssets, createReceptionAsset, updateReceptionAsset, deleteReceptionAsset } =
    useClinicStore();

  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchReceptionAssets(); }, [fetchReceptionAssets]);

  const filtered = (receptionAssets || []).filter((a) =>
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ name: item.name, quantity: String(item.quantity ?? 0), condition: item.condition || 'working', notes: item.notes || '' });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm());
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Item name is required');
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), quantity: Number(form.quantity) || 0, condition: form.condition, notes: form.notes.trim() || null };
      if (editing) {
        await updateReceptionAsset(editing.id, payload);
        toast.success('Item updated');
      } else {
        await createReceptionAsset(payload);
        toast.success('Item added');
      }
      closeModal();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    try {
      await deleteReceptionAsset(item.id);
      toast.success('Item deleted');
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
            { label: 'Transactions' },
            { label: 'Reception Assets' },
          ]}
          title="Reception Assets"
          actionLabel="Add Item"
          actionIcon={Plus}
          onAction={openAdd}
        />

        <div className="cpp-toolbar">
          <div className="cpp-search">
            <Search className="cpp-search-icon" />
            <input
              type="text"
              placeholder="Search items..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="cpp-search-input"
            />
          </div>
          <span className="cpp-count">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="cpp-table-wrap">
          {loading ? (
            <p className="cpp-empty">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="cpp-empty">No items found. "Add Item" se Reception ka saman list mein daalein.</p>
          ) : (
            <table className="cpp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item Name</th>
                  <th>Quantity</th>
                  <th>Condition</th>
                  <th>Notes</th>
                  <th className="cpp-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr key={item.id}>
                    <td className="cpp-num">{i + 1}</td>
                    <td>{item.name}</td>
                    <td className="cpp-num">{item.quantity}</td>
                    <td style={{ textTransform: 'capitalize' }}>{item.condition}</td>
                    <td>{item.notes || '—'}</td>
                    <td className="cpp-actions">
                      <button className="cpp-btn-icon cpp-edit" onClick={() => openEdit(item)} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="cpp-btn-icon cpp-delete" onClick={() => setConfirmDelete(item)} title="Delete">
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

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Item' : 'Add Item'} size="sm">
        <div className="flex flex-col gap-4">
          <Input
            label="Item Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Office Chair, Telephone Set"
          />
          <Input
            label="Quantity"
            type="number"
            min="0"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            placeholder="0"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.condition}
              onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
            >
              {CONDITIONS.map((c) => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>)}
            </select>
          </div>
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Optional"
          />
          <div className="flex justify-end gap-2">
            <Button label="Cancel" variant="secondary" onClick={closeModal} />
            <Button label={editing ? 'Update' : 'Save'} onClick={handleSave} loading={saving} />
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Item" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{confirmDelete?.name}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <Button label="Cancel" variant="secondary" onClick={() => setConfirmDelete(null)} />
          <Button label="Delete" variant="danger" onClick={() => handleDelete(confirmDelete)} />
        </div>
      </Modal>
    </div>
  );
}
