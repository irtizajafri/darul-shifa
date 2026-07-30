import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import PageHeader from '../../../components/shared/PageHeader';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useClinicStore } from '../../../store/useClinicStore';
import './ClinicParameterPage.scss';
import './ClinicBedPage.scss';


export default function ClinicBedPage() {
  const navigate = useNavigate();
  const {
    roomCategories,
    beds,
    loading,
    fetchRoomCategories,
    fetchBeds,
    createBed,
    updateBed,
    deleteBed,
  } = useClinicStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', roomCategoryId: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [selectedBed, setSelectedBed] = useState(null);

  useEffect(() => {
    fetchRoomCategories();
    fetchBeds();
  }, [fetchRoomCategories, fetchBeds]);

  const grouped = roomCategories.map((rc) => ({
    ...rc,
    beds: beds.filter((b) => b.roomCategoryId === rc.id),
  })).filter((rc) => rc.beds.length > 0);

  const ungrouped = beds.filter((b) => !roomCategories.find((rc) => rc.id === b.roomCategoryId));

  function openAdd() {
    setEditing(null);
    setForm({ name: '', roomCategoryId: '' });
    setShowAddModal(true);
  }

  function openEdit(bed, e) {
    e.stopPropagation();
    setEditing(bed);
    setForm({ name: bed.name, roomCategoryId: String(bed.roomCategoryId) });
    setShowAddModal(true);
  }

  function closeModal() {
    setShowAddModal(false);
    setEditing(null);
    setForm({ name: '', roomCategoryId: '' });
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Bed name is required');
    if (!form.roomCategoryId) return toast.error('Room Category is required');
    setSaving(true);
    try {
      if (editing) {
        await updateBed(editing.id, { name: form.name, roomCategoryId: Number(form.roomCategoryId) });
        toast.success('Bed updated');
      } else {
        await createBed({ name: form.name, roomCategoryId: Number(form.roomCategoryId) });
        toast.success('Bed created');
      }
      closeModal();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bed) {
    try {
      await deleteBed(bed.id);
      toast.success('Bed deleted');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmDelete(null);
    }
  }

  function BedCard({ bed }) {
    const occupied   = bed.status === 'occupied';
    const notWorking = bed.status === 'not_working';
    return (
      <div
        className={`bed-card ${occupied ? 'bed-card--occupied' : notWorking ? 'bed-card--not-working' : 'bed-card--available'}`}
        onClick={() => setSelectedBed(bed)}
      >
        <div className="bed-card__actions">
          <button className="bed-card__icon-btn bed-card__edit" onClick={(e) => openEdit(bed, e)} title="Edit">
            <Pencil size={11} />
          </button>
          <button
            className="bed-card__icon-btn bed-card__delete"
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(bed); }}
            title="Delete"
          >
            <Trash2 size={11} />
          </button>
        </div>

        <div className="bed-card__name">{bed.name}</div>

        {occupied ? (
          <div className="bed-card__info">
            <span className="bed-card__mr">MR# {bed.admission?.mrNo || '—'}</span>
            <span className="bed-card__patient">{bed.admission?.patientTitle} {bed.admission?.patientName || '—'}</span>
            <span className="bed-card__adm">Adm# {bed.admission?.admissionNo || '—'}</span>
          </div>
        ) : notWorking ? (
          <div className="bed-card__status-label bed-card__status-label--not-working">Not Working</div>
        ) : (
          <div className="bed-card__status-label">Available</div>
        )}

        {bed.roomCategory?.rate > 0 && (
          <div className="bed-card__rate">Rs. {bed.roomCategory.rate.toLocaleString()}/day</div>
        )}
      </div>
    );
  }

  return (
    <div className="clinic-parameter-page">
      <ClinicMenuBar />

      <div className="cpp-body">
        <PageHeader
          breadcrumbs={[
            { label: 'Clinic', link: '/clinic-module' },
            { label: 'Parameters' },
            { label: 'Bed' },
          ]}
          title="Bed Management"
          actionLabel="Add Bed"
          actionIcon={Plus}
          onAction={openAdd}
        />

        {loading ? (
          <p className="cpp-empty">Loading...</p>
        ) : beds.length === 0 ? (
          <p className="cpp-empty">No beds found. Add beds to get started.</p>
        ) : (
          <div className="bed-dashboard">
            {grouped.map((rc) => (
              <div key={rc.id} className="bed-section">
                <h3 className="bed-section__title">
                  {rc.name}
                  {rc.rate > 0 && <span className="bed-section__rate">Rs. {rc.rate.toLocaleString()} / day</span>}
                </h3>
                <div className="bed-grid">
                  {rc.beds.map((bed) => (
                    <BedCard key={bed.id} bed={bed} />
                  ))}
                </div>
              </div>
            ))}

            {ungrouped.length > 0 && (
              <div className="bed-section">
                <h3 className="bed-section__title">Other</h3>
                <div className="bed-grid">
                  {ungrouped.map((bed) => (
                    <BedCard key={bed.id} bed={bed} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={showAddModal} onClose={closeModal} title={editing ? 'Edit Bed' : 'Add Bed'} size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Category <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              value={form.roomCategoryId}
              onChange={(e) => setForm((f) => ({ ...f, roomCategoryId: e.target.value }))}
            >
              <option value="">Select Room Category</option>
              {roomCategories.map((rc) => (
                <option key={rc.id} value={String(rc.id)}>{rc.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Bed Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Bed 1, Bed 2"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <div className="flex justify-end gap-2">
            <Button label="Cancel" variant="secondary" onClick={closeModal} />
            <Button label={editing ? 'Update' : 'Save'} onClick={handleSave} loading={saving} />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Bed" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{confirmDelete?.name}</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <Button label="Cancel" variant="secondary" onClick={() => setConfirmDelete(null)} />
          <Button label="Delete" variant="danger" onClick={() => handleDelete(confirmDelete)} />
        </div>
      </Modal>

      {/* Bed Detail Modal */}
      {selectedBed && (
        <div className="bed-detail-overlay" onClick={() => setSelectedBed(null)}>
          <div className="bed-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`bed-detail-header ${selectedBed.status === 'occupied' ? 'bed-detail-header--red' : selectedBed.status === 'not_working' ? 'bed-detail-header--amber' : 'bed-detail-header--green'}`}>
              <span>{selectedBed.name}</span>
              <button className="bed-detail-close" onClick={() => setSelectedBed(null)}>✕</button>
            </div>
            <div className="bed-detail-body">
              {selectedBed.status === 'occupied' ? (
                <table className="bed-detail-table">
                  <tbody>
                    <tr><td>Patient Name</td><td>{selectedBed.admission?.patientTitle} {selectedBed.admission?.patientName || '—'}</td></tr>
                    <tr><td>Admission No</td><td>{selectedBed.admission?.admissionNo || '—'}</td></tr>
                    <tr><td>MR Number</td><td>{selectedBed.admission?.mrNo || '—'}</td></tr>
                    <tr><td>Admission Date</td><td>{selectedBed.admission?.createdAt ? new Date(selectedBed.admission.createdAt).toLocaleDateString() : '—'}</td></tr>
                    {selectedBed.roomCategory?.rate > 0 && (
                      <tr><td>Room Rate</td><td>Rs. {selectedBed.roomCategory.rate.toLocaleString()} / day</td></tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="bed-detail-table">
                  <tbody>
                    <tr><td>Room Category</td><td>{selectedBed.roomCategory?.name || '—'}</td></tr>
                    {selectedBed.roomCategory?.rate > 0 && (
                      <tr><td>Rate</td><td>Rs. {selectedBed.roomCategory.rate.toLocaleString()} / day</td></tr>
                    )}
                    <tr>
                      <td>Status</td>
                      <td style={{ color: selectedBed.status === 'not_working' ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                        {selectedBed.status === 'not_working' ? 'Not Working' : 'Available'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}

              <div className="bed-detail-actions">
                {selectedBed.status === 'occupied' && selectedBed.admission?.admissionNo && (
                  <>
                    <button onClick={() => navigate(`/clinic/transactions/receiving-against-admission?admissionNo=${encodeURIComponent(selectedBed.admission.admissionNo)}`)}>
                      Receiving against Admission
                    </button>
                    <button onClick={() => navigate(`/clinic/transactions/bed-shifting?admissionNo=${encodeURIComponent(selectedBed.admission.admissionNo)}`)}>
                      Bed Shifting
                    </button>
                    <button onClick={() => navigate(`/clinic/transactions/admission-adjustment?admissionNo=${encodeURIComponent(selectedBed.admission.admissionNo)}`)}>
                      Admission Adjustment
                    </button>
                    <button onClick={() => navigate(`/clinic/billing/provisional-bill?admissionNo=${encodeURIComponent(selectedBed.admission.admissionNo)}`)}>
                      Provisional Bill
                    </button>
                  </>
                )}
                <button onClick={() => navigate(`/clinic/transactions/bed-status?roomCategoryId=${selectedBed.roomCategoryId}&bedId=${selectedBed.id}`)}>
                  Bed Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
