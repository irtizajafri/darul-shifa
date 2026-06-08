import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import PageHeader from '../../../components/shared/PageHeader';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useClinicStore } from '../../../store/useClinicStore';
import './ClinicParameterPage.scss';

export default function ClinicRoomCategoryPage() {
  const { roomCategories, loading, fetchRoomCategories, createRoomCategory, updateRoomCategory, deleteRoomCategory } =
    useClinicStore();

  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', rate: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchRoomCategories(); }, [fetchRoomCategories]);

  const filtered = roomCategories.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase())
  );

  function openAdd() {
    setEditing(null);
    setForm({ code: '', name: '', rate: '' });
    setShowModal(true);
  }

  function openEdit(rc) {
    setEditing(rc);
    setForm({ code: rc.code || '', name: rc.name, rate: rc.rate ?? '' });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm({ code: '', name: '', rate: '' });
  }

  async function handleSave() {
    if (!form.code.trim()) return toast.error('Code is required');
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      if (editing) {
        await updateRoomCategory(editing.id, form);
        toast.success('Room Category updated');
      } else {
        await createRoomCategory(form);
        toast.success('Room Category created');
      }
      closeModal();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rc) {
    try {
      await deleteRoomCategory(rc.id);
      toast.success('Room Category deleted');
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
            { label: 'Room Category' },
          ]}
          title="Room Category"
          actionLabel="Add Room Category"
          actionIcon={Plus}
          onAction={openAdd}
        />

        <div className="cpp-toolbar">
          <div className="cpp-search">
            <Search className="cpp-search-icon" />
            <input
              type="text"
              placeholder="Search room categories..."
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
            <p className="cpp-empty">No room categories found.</p>
          ) : (
            <table className="cpp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Rate (Rs.)</th>
                  <th className="cpp-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rc, i) => (
                  <tr key={rc.id}>
                    <td className="cpp-num">{i + 1}</td>
                    <td><strong>{rc.code}</strong></td>
                    <td>{rc.name}</td>
                    <td>{rc.rate > 0 ? `${rc.rate.toLocaleString()}` : '—'}</td>
                    <td className="cpp-actions">
                      <button className="cpp-btn-icon cpp-edit" onClick={() => openEdit(rc)} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="cpp-btn-icon cpp-delete" onClick={() => setConfirmDelete(rc)} title="Delete">
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

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Room Category' : 'Add Room Category'} size="sm">
        <div className="flex flex-col gap-4">
          <Input
            label="Code"
            required
            value={form.code}
            onChange={(e) => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="e.g. BW, CCU, ICU"
          />
          <Input
            label="Room Category Name"
            required
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Blue Ward, ICU, Deluxe"
          />
          <Input
            label="Rate (Rs. per day)"
            type="number"
            value={form.rate}
            onChange={(e) => setForm(f => ({ ...f, rate: e.target.value }))}
            placeholder="e.g. 5000"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <div className="flex justify-end gap-2">
            <Button label="Cancel" variant="secondary" onClick={closeModal} />
            <Button label={editing ? 'Update' : 'Save'} onClick={handleSave} loading={saving} />
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Room Category" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{confirmDelete?.name}</strong>? All beds under it will also be deleted.
        </p>
        <div className="flex justify-end gap-2">
          <Button label="Cancel" variant="secondary" onClick={() => setConfirmDelete(null)} />
          <Button label="Delete" variant="danger" onClick={() => handleDelete(confirmDelete)} />
        </div>
      </Modal>
    </div>
  );
}
