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

export default function ClinicStaffCategoryPage() {
  const { staffCategories, loading, fetchStaffCategories, createStaffCategory, updateStaffCategory, deleteStaffCategory } =
    useClinicStore();

  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchStaffCategories(); }, [fetchStaffCategories]);

  const filtered = staffCategories.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  function openAdd() {
    setEditing(null);
    setName('');
    setShowModal(true);
  }

  function openEdit(cat) {
    setEditing(cat);
    setName(cat.name);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setName('');
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      if (editing) {
        await updateStaffCategory(editing.id, { name });
        toast.success('Staff Category updated');
      } else {
        await createStaffCategory({ name });
        toast.success('Staff Category created');
      }
      closeModal();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat) {
    try {
      await deleteStaffCategory(cat.id);
      toast.success('Staff Category deleted');
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
            { label: 'Staff Category' },
          ]}
          title="Staff Category"
          actionLabel="Add Staff Category"
          actionIcon={Plus}
          onAction={openAdd}
        />

        <div className="cpp-toolbar">
          <div className="cpp-search">
            <Search className="cpp-search-icon" />
            <input
              type="text"
              placeholder="Search staff categories..."
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
            <p className="cpp-empty">No staff categories found.</p>
          ) : (
            <table className="cpp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th className="cpp-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cat, i) => (
                  <tr key={cat.id}>
                    <td className="cpp-num">{i + 1}</td>
                    <td>{cat.name}</td>
                    <td className="cpp-actions">
                      <button className="cpp-btn-icon cpp-edit" onClick={() => openEdit(cat)} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="cpp-btn-icon cpp-delete" onClick={() => setConfirmDelete(cat)} title="Delete">
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

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Staff Category' : 'Add Staff Category'} size="sm">
        <div className="flex flex-col gap-4">
          <Input
            label="Staff Category Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Doctor, Nurse, Technician"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <div className="flex justify-end gap-2">
            <Button label="Cancel" variant="secondary" onClick={closeModal} />
            <Button label={editing ? 'Update' : 'Save'} onClick={handleSave} loading={saving} />
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Staff Category" size="sm">
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
