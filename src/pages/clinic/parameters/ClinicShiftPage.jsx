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

export default function ClinicShiftPage() {
  const { shifts, loading, fetchShifts, createShift, updateShift, deleteShift } = useClinicStore();

  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [fromTime, setFromTime] = useState('08:00');
  const [toTime, setToTime] = useState('15:59');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  const filtered = shifts.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  function openAdd() {
    setEditing(null);
    setName('');
    setFromTime('08:00');
    setToTime('15:59');
    setShowModal(true);
  }

  function openEdit(item) {
    setEditing(item);
    setName(item.name);
    setFromTime(item.fromTime);
    setToTime(item.toTime);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setName('');
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Name is required');
    if (!fromTime || !toTime) return toast.error('From/To time is required');
    setSaving(true);
    try {
      if (editing) {
        await updateShift(editing.id, { name, fromTime, toTime });
        toast.success('Shift updated');
      } else {
        await createShift({ name, fromTime, toTime });
        toast.success('Shift created');
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
      await deleteShift(item.id);
      toast.success('Shift deleted');
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
            { label: 'Shift' },
          ]}
          title="Shift"
          actionLabel="Add Shift"
          actionIcon={Plus}
          onAction={openAdd}
        />

        <div className="cpp-toolbar">
          <div className="cpp-search">
            <Search className="cpp-search-icon" />
            <input
              type="text"
              placeholder="Search shifts..."
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
            <p className="cpp-empty">No shifts found — add Shift A/B/C with their timing here.</p>
          ) : (
            <table className="cpp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>From</th>
                  <th>To</th>
                  <th className="cpp-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr key={item.id}>
                    <td className="cpp-num">{i + 1}</td>
                    <td>{item.name}</td>
                    <td>{item.fromTime}</td>
                    <td>{item.toTime}</td>
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

      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Shift' : 'Add Shift'} size="sm">
        <div className="flex flex-col gap-4">
          <Input
            label="Shift Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Shift A, Shift B, Shift C"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <div className="flex gap-3">
            <Input label="From Time" type="time" required value={fromTime} onChange={(e) => setFromTime(e.target.value)} />
            <Input label="To Time" type="time" required value={toTime} onChange={(e) => setToTime(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button label="Cancel" variant="secondary" onClick={closeModal} />
            <Button label={editing ? 'Update' : 'Save'} onClick={handleSave} loading={saving} />
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Shift" size="sm">
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
