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

export default function ClinicSubDepartmentPage() {
  const {
    departments,
    subDepartments,
    loading,
    fetchDepartments,
    fetchSubDepartments,
    createSubDepartment,
    updateSubDepartment,
    deleteSubDepartment,
  } = useClinicStore();

  const [query, setQuery] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', departmentId: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    fetchDepartments();
    fetchSubDepartments();
  }, [fetchDepartments, fetchSubDepartments]);

  const filtered = subDepartments.filter((sd) => {
    const matchQuery = sd.name.toLowerCase().includes(query.toLowerCase());
    const matchDept = filterDept ? String(sd.departmentId) === filterDept : true;
    return matchQuery && matchDept;
  });

  function openAdd() {
    setEditing(null);
    setForm({ name: '', departmentId: '' });
    setShowModal(true);
  }

  function openEdit(sd) {
    setEditing(sd);
    setForm({ name: sd.name, departmentId: String(sd.departmentId) });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm({ name: '', departmentId: '' });
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.departmentId) return toast.error('Department is required');
    setSaving(true);
    try {
      if (editing) {
        await updateSubDepartment(editing.id, { name: form.name, departmentId: Number(form.departmentId) });
        toast.success('Sub Department updated');
      } else {
        await createSubDepartment({ name: form.name, departmentId: Number(form.departmentId) });
        toast.success('Sub Department created');
      }
      closeModal();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sd) {
    try {
      await deleteSubDepartment(sd.id);
      toast.success('Sub Department deleted');
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
            { label: 'Sub Department' },
          ]}
          title="Sub Department"
          actionLabel="Add Sub Department"
          actionIcon={Plus}
          onAction={openAdd}
        />

        <div className="cpp-toolbar">
          <div className="cpp-search">
            <Search className="cpp-search-icon" />
            <input
              type="text"
              placeholder="Search sub departments..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="cpp-search-input"
            />
          </div>

          <select
            className="cpp-filter-select"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>{d.name}</option>
            ))}
          </select>

          <span className="cpp-count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="cpp-table-wrap">
          {loading ? (
            <p className="cpp-empty">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="cpp-empty">No sub departments found.</p>
          ) : (
            <table className="cpp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th style={{ width: 80 }}>Code</th>
                  <th>Department</th>
                  <th>Sub Department</th>
                  <th className="cpp-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sd, i) => (
                  <tr key={sd.id}>
                    <td className="cpp-num">{i + 1}</td>
                    <td><span style={{ fontWeight: 600, color: '#2563eb' }}>{sd.code || '—'}</span></td>
                    <td>{sd.department?.name}</td>
                    <td>{sd.name}</td>
                    <td className="cpp-actions">
                      <button className="cpp-btn-icon cpp-edit" onClick={() => openEdit(sd)} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="cpp-btn-icon cpp-delete" onClick={() => setConfirmDelete(sd)} title="Delete">
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

      {/* Add / Edit Modal */}
      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Sub Department' : 'Add Sub Department'} size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
            >
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>
          </div>

          <Input
            label="Sub Department Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. ICU Ward 1, ICU Ward 2"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />

          <div className="flex justify-end gap-2">
            <Button label="Cancel" variant="secondary" onClick={closeModal} />
            <Button label={editing ? 'Update' : 'Save'} onClick={handleSave} loading={saving} />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Sub Department" size="sm">
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
