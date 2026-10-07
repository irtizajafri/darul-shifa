import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DoorOpen, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../components/ui/SearchableSelect';
import './AdmissionAdjustment.scss';
import './BedStatus.scss';

const STATUS_OPTIONS = [
  { value: 'available',   label: 'Available' },
  { value: 'occupied',    label: 'Occupied' },
  { value: 'not_working', label: 'Not Working' },
];

export default function BedStatus() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { roomCategories, fetchRoomCategories, beds, fetchBeds, setBedStatus } = useClinicStore();

  const [roomCategoryId, setRoomCategoryId] = useState('');
  const [bedId, setBedId] = useState('');
  const [status, setStatus] = useState('available');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoomCategories();
    fetchBeds();
  }, [fetchRoomCategories, fetchBeds]);

  // Deep-link from Bed parameter page: ?roomCategoryId=...&bedId=... pre-selects
  // that exact bed once the list has loaded.
  useEffect(() => {
    const rc = searchParams.get('roomCategoryId');
    const bId = searchParams.get('bedId');
    if (!rc || !bId || !beds.length) return;
    setRoomCategoryId(rc);
    setBedId(bId);
    const bed = beds.find(b => String(b.id) === String(bId));
    setStatus(bed?.status || 'available');
  }, [searchParams, beds]);

  const roomBeds = beds.filter(b => String(b.roomCategoryId) === String(roomCategoryId));
  const selectedBed = beds.find(b => String(b.id) === String(bedId));

  function handleRoomChange(val) {
    setRoomCategoryId(val);
    setBedId('');
    setStatus('available');
  }

  function handleBedChange(val) {
    setBedId(val);
    const bed = beds.find(b => String(b.id) === String(val));
    setStatus(bed?.status || 'available');
  }

  async function handleSave() {
    if (!bedId) return toast.error('Bed select karna zaroori hai');
    setSaving(true);
    try {
      await setBedStatus(bedId, status);
      toast.success('Bed status update ho gaya');
      await fetchBeds();
    } catch (err) {
      toast.error(err.message || 'Bed status update nahi hua');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-page">
      <ClinicMenuBar />

      <div className="aa-toolbar">
        <div className="aa-toolbar-icons">
          <button className="aa-tbtn aa-tbtn--exit" onClick={() => navigate(-1)} title="Exit">
            <DoorOpen size={16} />
          </button>
        </div>
        <span className="aa-toolbar-title">Bed Status</span>
      </div>

      <div className="bst-body">
        <div className="bst-card">
          <div className="bst-row">
            <div className="bst-field">
              <label>Room Category</label>
              <SearchableSelect
                options={roomCategories}
                value={roomCategoryId}
                onChange={v => handleRoomChange(v)}
                placeholder="— Select Room Category —"
                getLabel={r => r.name}
                getKey={r => r.id}
                size="sm"
              />
            </div>
            <div className="bst-field">
              <label>Bed</label>
              <SearchableSelect
                options={roomBeds}
                value={bedId}
                onChange={v => handleBedChange(v)}
                placeholder="— Select Bed —"
                getLabel={b => b.name}
                getKey={b => b.id}
                disabled={!roomCategoryId}
                size="sm"
              />
            </div>
          </div>

          {selectedBed && (
            <>
              <div className="bst-separator" />

              {status === 'occupied' && selectedBed.admission && (
                <div className="bst-occupant-box">
                  Currently: <strong>{selectedBed.admission.patientTitle} {selectedBed.admission.patientName}</strong>
                  {' '}(Admission # {selectedBed.admission.admissionNo})
                </div>
              )}

              <div className="bst-status-row">
                <label className="bst-status-label">Bed Status</label>
                {STATUS_OPTIONS.map(opt => (
                  <label key={opt.value} className={`bst-radio-btn bst-radio-btn--${opt.value} ${status === opt.value ? 'bst-radio-btn--active' : ''}`}>
                    <input
                      type="radio"
                      name="bedStatus"
                      value={opt.value}
                      checked={status === opt.value}
                      onChange={() => setStatus(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              <div className="bst-actions">
                <button className="adm-btn adm-btn--save" onClick={handleSave} disabled={saving}>
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
