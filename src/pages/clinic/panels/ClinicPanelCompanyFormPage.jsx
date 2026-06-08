import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import './ClinicPanelCompanyFormPage.scss';

const EMPTY_FORM = {
  code: '',
  name: '',
  billingTo: 'same',
  status: 'active',
};

function buildSubDeptRows(subDepartments, existing = []) {
  return subDepartments.map((sd) => {
    const ex = existing.find((e) => e.subDeptId === sd.id);
    return {
      subDeptId: sd.id,
      deptName: sd.department?.name || '—',
      subDeptName: sd.name,
      enabled: ex ? ex.enabled : true,
      rate: ex ? ex.rate : 0,
      status: ex ? ex.status : 'active',
    };
  });
}

function buildAdmissionRows(billHeads, existing = []) {
  return billHeads.map((bh) => {
    const ex = existing.find((e) => e.billHeadId === bh.id);
    return {
      billHeadId: bh.id,
      headCode: bh.headCode,
      description: bh.description,
      enabled: ex ? ex.enabled : true,
      rate: ex ? ex.rate : 0,
      status: ex ? ex.status : 'active',
    };
  });
}

function buildRoomRows(roomCategories, existing = []) {
  return roomCategories.map((rc) => {
    const ex = existing.find((e) => e.roomCategoryId === rc.id);
    return {
      roomCategoryId: rc.id,
      code: rc.code,
      name: rc.name,
      enabled: ex ? ex.enabled : true,
    };
  });
}

export default function ClinicPanelCompanyFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const {
    subDepartments, fetchSubDepartments,
    billHeads, fetchBillHeads,
    roomCategories, fetchRoomCategories,
    createPanelCompany, updatePanelCompany, fetchPanelCompanyById,
  } = useClinicStore();

  const [form, setForm] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState('subdept');
  const [subDeptRows, setSubDeptRows] = useState([]);
  const [admissionRows, setAdmissionRows] = useState([]);
  const [roomRows, setRoomRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    Promise.all([fetchSubDepartments(), fetchBillHeads(), fetchRoomCategories()]).then(() => {
      if (!isEdit) setLoadingData(false);
    });
  }, [fetchSubDepartments, fetchBillHeads, fetchRoomCategories, isEdit]);

  useEffect(() => {
    if (!isEdit || subDepartments.length === 0 || billHeads.length === 0) return;
    fetchPanelCompanyById(id).then((pc) => {
      if (!pc) { toast.error('Panel Company not found'); navigate('/clinic/panels/companies'); return; }
      setForm({
        code: pc.code,
        name: pc.name,
        billingTo: pc.billingTo || 'same',
        status: pc.status || 'active',
      });
      setSubDeptRows(buildSubDeptRows(subDepartments, pc.subDeptRates || []));
      setAdmissionRows(buildAdmissionRows(billHeads, pc.admissionRates || []));
      setRoomRows(buildRoomRows(roomCategories, pc.roomEntitlements || []));
      setLoadingData(false);
    }).catch(() => setLoadingData(false));
  }, [isEdit, id, subDepartments, billHeads, roomCategories, fetchPanelCompanyById, navigate]);

  useEffect(() => {
    if (!isEdit && subDepartments.length > 0 && billHeads.length > 0 && roomCategories.length > 0 && !loadingData) {
      setSubDeptRows(buildSubDeptRows(subDepartments));
      setAdmissionRows(buildAdmissionRows(billHeads));
      setRoomRows(buildRoomRows(roomCategories));
    }
  }, [isEdit, subDepartments, billHeads, roomCategories, loadingData]);

  function setF(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  function updateSubDeptRate(idx, val) {
    setSubDeptRows((rows) => rows.map((r, i) => i === idx ? { ...r, rate: val } : r));
  }
  function toggleSubDeptEnabled(idx) {
    setSubDeptRows((rows) => rows.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r));
  }
  function setSubDeptStatus(idx, val) {
    setSubDeptRows((rows) => rows.map((r, i) => i === idx ? { ...r, status: val } : r));
  }

  function updateAdmissionRate(idx, val) {
    setAdmissionRows((rows) => rows.map((r, i) => i === idx ? { ...r, rate: val } : r));
  }
  function toggleAdmissionEnabled(idx) {
    setAdmissionRows((rows) => rows.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r));
  }
  function setAdmissionStatus(idx, val) {
    setAdmissionRows((rows) => rows.map((r, i) => i === idx ? { ...r, status: val } : r));
  }

  function toggleRoomEnabled(idx) {
    setRoomRows((rows) => rows.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r));
  }

  async function handleSave() {
    if (!form.code.trim()) return toast.error('Code is required');
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    const payload = {
      ...form,
      subDeptRates: subDeptRows.map((r) => ({
        subDeptId: r.subDeptId,
        enabled: r.enabled,
        rate: Number(r.rate) || 0,
        status: r.status,
      })),
      admissionRates: admissionRows.map((r) => ({
        billHeadId: r.billHeadId,
        enabled: r.enabled,
        rate: Number(r.rate) || 0,
        status: r.status,
      })),
      roomEntitlements: roomRows.map((r) => ({
        roomCategoryId: r.roomCategoryId,
        enabled: r.enabled,
      })),
    };
    try {
      if (isEdit) {
        await updatePanelCompany(Number(id), payload);
        toast.success('Panel Company updated');
      } else {
        await createPanelCompany(payload);
        toast.success('Panel Company created');
      }
      navigate('/clinic/panels/companies');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loadingData) {
    return (
      <div className="pc-page">
        <ClinicMenuBar />
        <p className="pc-loading">Loading...</p>
      </div>
    );
  }

  return (
    <div className="pc-page">
      <ClinicMenuBar />

      <div className="pc-body">
        {/* ── Title bar ── */}
        <div className="pc-titlebar">
          <button className="pc-back-btn" onClick={() => navigate('/clinic/panels/companies')}>
            <ArrowLeft size={15} /> Back
          </button>
          <span className="pc-title">Panel Company</span>
        </div>

        {/* ── Main form card ── */}
        <div className="pc-form-card">
          {/* Row 1: Code + Name */}
          <div className="pc-form-row">
            <div className="pc-field pc-field--code">
              <label className="pc-label">Code</label>
              <input
                className="pc-input"
                value={form.code}
                onChange={(e) => setF('code', e.target.value.toUpperCase())}
                placeholder="e.g. ADM"
                maxLength={20}
              />
            </div>
            <div className="pc-field pc-field--name">
              <label className="pc-label">Name</label>
              <input
                className="pc-input"
                value={form.name}
                onChange={(e) => setF('name', e.target.value)}
                placeholder="Company full name"
              />
            </div>
            <div className="pc-field pc-field--status">
              <label className="pc-label">Status</label>
              <label className="pc-check">
                <input
                  type="checkbox"
                  checked={form.status === 'active'}
                  onChange={(e) => setF('status', e.target.checked ? 'active' : 'inactive')}
                />
                Active
              </label>
            </div>
          </div>

          {/* Row 2: Billing To */}
          <div className="pc-form-row pc-form-row--billing">
            <span className="pc-label">Billing To</span>
            <label className="pc-radio">
              <input
                type="radio"
                name="billingTo"
                value="same"
                checked={form.billingTo === 'same'}
                onChange={() => setF('billingTo', 'same')}
              />
              Same Company
            </label>
            <label className="pc-radio">
              <input
                type="radio"
                name="billingTo"
                value="other"
                checked={form.billingTo === 'other'}
                onChange={() => setF('billingTo', 'other')}
              />
              Other Company
            </label>
          </div>
        </div>

        {/* ── Tabs section ── */}
        <div className="pc-tabs-section">
          <div className="pc-tab-strip">
            <button
              className={`pc-tab-btn ${activeTab === 'subdept' ? 'pc-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('subdept')}
            >
              Rates of Sub Departments
            </button>
            <button
              className={`pc-tab-btn ${activeTab === 'admission' ? 'pc-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('admission')}
            >
              Rates of Admission Heads
            </button>
            <button
              className={`pc-tab-btn ${activeTab === 'room' ? 'pc-tab-btn--active' : ''}`}
              onClick={() => setActiveTab('room')}
            >
              Room Entitlement
            </button>
          </div>

          <div className="pc-tab-content">
            {/* ── Tab 1: Sub Department Rates ── */}
            {activeTab === 'subdept' && (
              <div className="pc-tab-table-wrap">
                <table className="pc-tab-table">
                  <thead>
                    <tr>
                      <th className="pc-th-check"></th>
                      <th>Department</th>
                      <th>Sub. Department</th>
                      <th>Rates</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subDeptRows.map((row, idx) => (
                      <tr key={row.subDeptId}>
                        <td className="pc-td-check">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={() => toggleSubDeptEnabled(idx)}
                          />
                        </td>
                        <td className="pc-td-dept">{row.deptName}</td>
                        <td>{row.subDeptName}</td>
                        <td>
                          <input
                            className="pc-rate-input"
                            type="number"
                            value={row.rate}
                            onChange={(e) => updateSubDeptRate(idx, e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            className="pc-status-select"
                            value={row.status}
                            onChange={(e) => setSubDeptStatus(idx, e.target.value)}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Tab 2: Admission Head Rates ── */}
            {activeTab === 'admission' && (
              <div className="pc-tab-table-wrap">
                <table className="pc-tab-table">
                  <thead>
                    <tr>
                      <th className="pc-th-check"></th>
                      <th>Head Code</th>
                      <th>Description</th>
                      <th>Rates</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admissionRows.map((row, idx) => (
                      <tr key={row.billHeadId}>
                        <td className="pc-td-check">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={() => toggleAdmissionEnabled(idx)}
                          />
                        </td>
                        <td className="pc-td-code">{row.headCode}</td>
                        <td>{row.description}</td>
                        <td>
                          <input
                            className="pc-rate-input"
                            type="number"
                            value={row.rate}
                            onChange={(e) => updateAdmissionRate(idx, e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            className="pc-status-select"
                            value={row.status}
                            onChange={(e) => setAdmissionStatus(idx, e.target.value)}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Tab 3: Room Entitlement ── */}
            {activeTab === 'room' && (
              <div className="pc-tab-table-wrap">
                <table className="pc-tab-table">
                  <thead>
                    <tr>
                      <th className="pc-th-check"></th>
                      <th>Code</th>
                      <th>Room Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomRows.map((row, idx) => (
                      <tr key={row.roomCategoryId}>
                        <td className="pc-td-check">
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={() => toggleRoomEnabled(idx)}
                          />
                        </td>
                        <td className="pc-td-code">{row.code}</td>
                        <td>{row.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="pc-footer">
          <div className="pc-footer__status">
            <span className="pc-footer__info">
              {isEdit ? `Editing: ${form.code}` : 'New Panel Company'}
            </span>
          </div>
          <button className="pc-save-btn" onClick={handleSave} disabled={saving}>
            <Save size={15} />
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
