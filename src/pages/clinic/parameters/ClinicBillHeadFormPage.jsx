import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import './ClinicBillHeadFormPage.scss';

const TYPE_OPTIONS = [
  { value: 'both', label: 'Both' },
  { value: 'provisional', label: 'Provisional Bill' },
  { value: 'final', label: 'Final Bill' },
    { value: 'final', label: 'miscellaneous' },

];

const EMPTY_FORM = {
  headCode: '',
  description: '',
  type: 'both',
  refDepartmentId: '',
  staffCategoryRequired: false,
  status: 'active',
};

function buildWardRows(roomCategories, existing = []) {
  return roomCategories.map((rc) => {
    const ex = existing.find((e) => e.roomCategoryId === rc.id);
    return {
      roomCategoryId: rc.id,
      code: rc.code,
      wardName: rc.name,
      enabled: ex ? ex.enabled : true,
      rate: ex ? ex.rate : 0,
      status: ex ? ex.status : 'active',
      payContractor: ex ? ex.payContractor : false,
    };
  });
}

function nextHeadCode(billHeads) {
  const nums = billHeads.map((b) => parseInt(b.headCode, 10)).filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return String(max + 1).padStart(3, '0');
}

export default function ClinicBillHeadFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const {
    departments, fetchDepartments,
    staffCategories, fetchStaffCategories,
    roomCategories, fetchRoomCategories,
    billHeads, fetchBillHeads,
    createBillHead, updateBillHead, fetchBillHeadById,
  } = useClinicStore();

  const [form, setForm] = useState(EMPTY_FORM);
  const [wardRows, setWardRows] = useState([]);
  const [selectedStaffCats, setSelectedStaffCats] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [editBar, setEditBar] = useState({ status: 'active', payContractor: false });
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    Promise.all([fetchDepartments(), fetchStaffCategories(), fetchRoomCategories(), fetchBillHeads()]).then(() => {
      if (!isEdit) setLoadingData(false);
    });
  }, [fetchDepartments, fetchStaffCategories, fetchRoomCategories, fetchBillHeads, isEdit]);

  useEffect(() => {
    if (!isEdit || roomCategories.length === 0) return;
    fetchBillHeadById(id).then((bh) => {
      if (!bh) { toast.error('Bill Head not found'); navigate('/clinic/parameters/bill-heads'); return; }
      setForm({
        headCode: bh.headCode,
        description: bh.description || '',
        type: bh.type || 'both',
        refDepartmentId: bh.refDepartmentId ? String(bh.refDepartmentId) : '',
        staffCategoryRequired: bh.staffCategoryRequired,
        status: bh.status || 'active',
      });
      setSelectedStaffCats(bh.staffCategories?.map((sc) => sc.staffCategoryId) || []);
      setWardRows(buildWardRows(roomCategories, bh.wardRates || []));
      setLoadingData(false);
    }).catch(() => setLoadingData(false));
  }, [isEdit, id, roomCategories, fetchBillHeadById, navigate]);

  useEffect(() => {
    if (!isEdit && roomCategories.length > 0) {
      setWardRows(buildWardRows(roomCategories));
    }
  }, [isEdit, roomCategories]);

  useEffect(() => {
    if (!isEdit && billHeads.length >= 0 && !loadingData) {
      setF('headCode', nextHeadCode(billHeads));
    }
  }, [isEdit, billHeads, loadingData]);

  function setF(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  function handleRowClick(idx) {
    setSelectedRows((prev) => {
      const isSelected = prev.includes(idx);
      const next = isSelected ? prev.filter((i) => i !== idx) : [...prev, idx];
      if (next.length === 1) {
        const r = wardRows[next[0]];
        setEditBar({ status: r.status, payContractor: r.payContractor });
      }
      return next;
    });
  }

  function handleConfirm() {
    if (selectedRows.length === 0) return;
    setWardRows((rows) => rows.map((r, i) =>
      selectedRows.includes(i) ? { ...r, ...editBar } : r
    ));
    toast.success(`${selectedRows.length} row${selectedRows.length > 1 ? 's' : ''} updated`);
  }

  function toggleEnabled(idx) {
    setWardRows((rows) => rows.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r));
  }

  function updateRowRate(idx, val) {
    setWardRows((rows) => rows.map((r, i) => i === idx ? { ...r, rate: val } : r));
  }

  function toggleStaffCat(id) {
    setSelectedStaffCats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (!form.headCode) return toast.error('Head Code not generated yet');
    setSaving(true);
    const payload = {
      ...form,
      accountReceivable: null,
      discountApply: false,
      discountSeq: 0,
      refDepartmentId: form.refDepartmentId || null,
      wardRates: wardRows.map((r) => ({
        roomCategoryId: r.roomCategoryId,
        enabled: r.enabled,
        rate: Number(r.rate) || 0,
        unit: '',
        status: r.status,
        payContractor: r.payContractor,
        disSeq: 0,
      })),
      staffCategoryIds: form.staffCategoryRequired ? selectedStaffCats : [],
    };
    try {
      if (isEdit) {
        await updateBillHead(Number(id), payload);
        toast.success('Bill Head updated');
      } else {
        await createBillHead(payload);
        toast.success('Bill Head created');
      }
      navigate('/clinic/parameters/bill-heads');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingData) {
    return (
      <div className="bh-page">
        <ClinicMenuBar />
        <p className="bh-loading">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bh-page">
      <ClinicMenuBar />

      <div className="bh-body">
        {/* ── Title bar ── */}
        <div className="bh-titlebar">
          <button className="bh-back-btn" onClick={() => navigate('/clinic/parameters/bill-heads')}>
            <ArrowLeft size={15} /> Back
          </button>
          <span className="bh-title">Bill Heads</span>
        </div>

        {/* ── Main form ── */}
        <div className="bh-form-card">
          {/* Row 1: Head Code (auto-generated) */}
          <div className="bh-row">
            <div className="bh-field bh-field--sm">
              <label className="bh-label">Head Code</label>
              <input className="bh-input bh-input--readonly" value={form.headCode} readOnly />
            </div>
          </div>

          {/* Row 2: Description */}
          <div className="bh-row">
            <div className="bh-field bh-field--full">
              <label className="bh-label">Description</label>
              <input className="bh-input" value={form.description} onChange={(e) => setF('description', e.target.value)} placeholder="Description" />
            </div>
          </div>

          {/* Row 3: Type + Ref Department */}
          <div className="bh-row">
            <div className="bh-field bh-field--md">
              <label className="bh-label">Type</label>
              <select className="bh-select" value={form.type} onChange={(e) => setF('type', e.target.value)}>
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="bh-field bh-field--md">
              <label className="bh-label">Ref. Department</label>
              <select className="bh-select" value={form.refDepartmentId} onChange={(e) => setF('refDepartmentId', e.target.value)}>
                <option value="">NA - Not Applicable</option>
                {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Row 4: Checkboxes */}
          <div className="bh-row bh-row--checks">
            <label className="bh-check">
              <input type="checkbox" checked={form.staffCategoryRequired} onChange={(e) => setF('staffCategoryRequired', e.target.checked)} />
              Staff Category Required
            </label>
          </div>

          {/* Staff Categories (shown when required) */}
          {form.staffCategoryRequired && (
            <div className="bh-staff-cats">
              <div className="bh-staff-cats__label">Staff Categories</div>
              <div className="bh-staff-cats__list">
                {staffCategories.map((sc) => (
                  <label key={sc.id} className="bh-check">
                    <input
                      type="checkbox"
                      checked={selectedStaffCats.includes(sc.id)}
                      onChange={() => toggleStaffCat(sc.id)}
                    />
                    {sc.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Ward wise Rates ── */}
        <div className="bh-ward-section">
          <div className="bh-ward-title">Ward wise Rates</div>

          <div className="bh-ward-table-wrap">
            <table className="bh-ward-table">
              <thead>
                <tr>
                  <th className="bh-th-check"></th>
                  <th>Code</th>
                  <th>Ward</th>
                  <th>Rate</th>
                  <th>Status</th>
                  <th>Pay Cont.</th>
                </tr>
              </thead>
              <tbody>
                {wardRows.map((row, idx) => (
                  <tr
                    key={row.roomCategoryId}
                    className={`bh-ward-row ${selectedRows.includes(idx) ? 'bh-ward-row--selected' : ''}`}
                    onClick={() => handleRowClick(idx)}
                  >
                    <td className="bh-td-check">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={() => toggleEnabled(idx)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="bh-td-code">{row.code}</td>
                    <td>{row.wardName}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        className="bh-input bh-input--xs bh-input--inline"
                        type="number"
                        value={row.rate}
                        onChange={(e) => updateRowRate(idx, e.target.value)}
                      />
                    </td>
                    <td>
                      <span className={`bh-status-badge ${row.status === 'active' ? 'bh-status-badge--active' : 'bh-status-badge--inactive'}`}>
                        {row.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{row.payContractor ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Bottom editing bar ── */}
          <div className="bh-edit-bar">
            <div className="bh-edit-bar__item">
              <span className="bh-edit-bar__label">Status</span>
              <label className="bh-check bh-check--bar">
                <input type="checkbox" checked={editBar.status === 'active'} onChange={(e) => setEditBar((b) => ({ ...b, status: e.target.checked ? 'active' : 'inactive' }))} />
                Active
              </label>
            </div>
            <div className="bh-edit-bar__item">
              <span className="bh-edit-bar__label">Pay Contractor</span>
              <label className="bh-check bh-check--bar">
                <input type="checkbox" checked={editBar.payContractor} onChange={(e) => setEditBar((b) => ({ ...b, payContractor: e.target.checked }))} />
                Yes
              </label>
            </div>
            <button className="bh-confirm-btn" onClick={handleConfirm} disabled={selectedRows.length === 0}>
              Confirm
            </button>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="bh-footer">
          <div className="bh-footer__status">
            <label className="bh-check">
              <input type="checkbox" checked={form.status === 'active'} onChange={(e) => setF('status', e.target.checked ? 'active' : 'inactive')} />
              Active
            </label>
          </div>
          <button className="bh-save-btn" onClick={handleSave} disabled={saving}>
            <Save size={15} />
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
