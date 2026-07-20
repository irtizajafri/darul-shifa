import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import './ClinicPanelEmployeeFormPage.scss';

const TITLES = ['MR', 'MRS', 'MISS', 'DR', 'PROF'];
const RELATIONS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Other'];

function buildSubDeptRows(subDepts, existing = []) {
  return subDepts.map((sd) => {
    const ex = existing.find((r) => r.subDeptId === sd.id);
    return {
      subDeptId: sd.id,
      deptName: sd.department?.name || '',
      subDeptName: sd.name,
      enabled: ex ? ex.enabled : false,
      rate: ex ? ex.rate : 0,
      status: ex ? ex.status : 'active',
    };
  });
}

function buildAdmissionRows(billHeads, existing = []) {
  return billHeads.map((bh) => {
    const ex = existing.find((r) => r.billHeadId === bh.id);
    return {
      billHeadId: bh.id,
      headCode: bh.headCode,
      description: bh.description,
      enabled: ex ? ex.enabled : false,
      rate: ex ? ex.rate : 0,
      status: ex ? ex.status : 'active',
    };
  });
}

function buildRoomRows(roomCategories, existing = []) {
  return roomCategories.map((rc) => {
    const ex = existing.find((r) => r.roomCategoryId === rc.id);
    return {
      roomCategoryId: rc.id,
      code: rc.code,
      name: rc.name,
      enabled: ex ? ex.enabled : false,
    };
  });
}

export default function ClinicPanelEmployeeFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const {
    panelCompanies,
    fetchPanelCompanies,
    subDepartments,
    fetchSubDepartments,
    billHeads,
    fetchBillHeads,
    roomCategories,
    fetchRoomCategories,
    fetchPanelEmployeeById,
    createPanelEmployee,
    updatePanelEmployee,
  } = useClinicStore();

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('subdept');

  // ── Main fields ────────────────────────────────────────────────────────────
  const [companyId, setCompanyId] = useState('');
  const [empCode, setEmpCode] = useState('');
  const [title, setTitle] = useState('MR');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [compCardNo, setCompCardNo] = useState('');
  const [billCompanyId, setBillCompanyId] = useState('');
  const [gender, setGender] = useState('male');
  const [insuranceExpOn, setInsuranceExpOn] = useState('');
  const [entitlement, setEntitlement] = useState('general');
  const [status, setStatus] = useState(true);

  // ── Tab rows ───────────────────────────────────────────────────────────────
  const [subDeptRows, setSubDeptRows] = useState([]);
  const [admissionRows, setAdmissionRows] = useState([]);
  const [roomRows, setRoomRows] = useState([]);

  // ── Dependents ─────────────────────────────────────────────────────────────
  const [depTitle, setDepTitle] = useState('MR');
  const [depCode, setDepCode] = useState('');
  const [depName, setDepName] = useState('');
  const [depRelation, setDepRelation] = useState('');
  const [depDob, setDepDob] = useState('');
  const [depGender, setDepGender] = useState('male');
  const [depStatus, setDepStatus] = useState(true);
  const [dependents, setDependents] = useState([]);
  const [editingDepIdx, setEditingDepIdx] = useState(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const initRows = useCallback((sds, bhs, rcs, emp = null) => {
    setSubDeptRows(buildSubDeptRows(sds, emp?.subDeptRates || []));
    setAdmissionRows(buildAdmissionRows(bhs, emp?.admissionRates || []));
    setRoomRows(buildRoomRows(rcs, emp?.roomEntitlements || []));
  }, []);

  useEffect(() => {
    Promise.all([
      fetchPanelCompanies(),
      fetchSubDepartments(),
      fetchBillHeads(),
      fetchRoomCategories(),
    ]).then(async () => {
      if (isEdit) {
        try {
          const emp = await fetchPanelEmployeeById(id);
          setCompanyId(String(emp.companyId));
          setEmpCode(emp.empCode);
          setTitle(emp.title);
          setName(emp.name);
          setDob(emp.dob ? emp.dob.split('T')[0] : '');
          setCompCardNo(emp.compCardNo || '');
          setBillCompanyId(emp.billCompanyId ? String(emp.billCompanyId) : '');
          setGender(emp.gender);
          setInsuranceExpOn(emp.insuranceExpOn ? emp.insuranceExpOn.split('T')[0] : '');
          setEntitlement(emp.entitlement);
          setStatus(emp.status === 'active');
          setDependents(emp.dependents || []);
          initRows(
            useClinicStore.getState().subDepartments,
            useClinicStore.getState().billHeads,
            useClinicStore.getState().roomCategories,
            emp
          );
        } catch {
          toast.error('Failed to load employee');
          navigate('/clinic/panels/employees');
        } finally {
          setLoading(false);
        }
      } else {
        initRows(
          useClinicStore.getState().subDepartments,
          useClinicStore.getState().billHeads,
          useClinicStore.getState().roomCategories
        );
      }
    });
  }, [id, isEdit]);

  // ── Sub dept tab helpers ───────────────────────────────────────────────────
  function toggleSubDept(idx) {
    setSubDeptRows((rows) => rows.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r));
  }
  function setSubDeptRate(idx, val) {
    setSubDeptRows((rows) => rows.map((r, i) => i === idx ? { ...r, rate: val } : r));
  }
  function setSubDeptStatus(idx, val) {
    setSubDeptRows((rows) => rows.map((r, i) => i === idx ? { ...r, status: val } : r));
  }

  // ── Admission tab helpers ──────────────────────────────────────────────────
  function toggleAdmission(idx) {
    setAdmissionRows((rows) => rows.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r));
  }
  function setAdmissionRate(idx, val) {
    setAdmissionRows((rows) => rows.map((r, i) => i === idx ? { ...r, rate: val } : r));
  }
  function setAdmissionStatus(idx, val) {
    setAdmissionRows((rows) => rows.map((r, i) => i === idx ? { ...r, status: val } : r));
  }

  // ── Room tab helpers ───────────────────────────────────────────────────────
  function toggleRoom(idx) {
    setRoomRows((rows) => rows.map((r, i) => i === idx ? { ...r, enabled: !r.enabled } : r));
  }

  // ── Dependent helpers ──────────────────────────────────────────────────────
  function clearDepForm() {
    setDepTitle('MR'); setDepCode(''); setDepName('');
    setDepRelation(''); setDepDob(''); setDepGender('male'); setDepStatus(true);
    setEditingDepIdx(null);
  }

  function handleAddDependent() {
    if (!depCode.trim()) return toast.error('Dependent code is required');
    if (!depName.trim()) return toast.error('Dependent name is required');
    if (!depRelation) return toast.error('Relation is required');
    const dep = {
      code: depCode.trim().toUpperCase(),
      title: depTitle,
      name: depName.trim(),
      relation: depRelation,
      dob: depDob || null,
      gender: depGender,
      status: depStatus ? 'active' : 'inactive',
    };
    if (editingDepIdx !== null) {
      setDependents((prev) => prev.map((d, i) => i === editingDepIdx ? dep : d));
    } else {
      setDependents((prev) => [...prev, dep]);
    }
    clearDepForm();
  }

  function handleEditDependent(idx) {
    const d = dependents[idx];
    setDepTitle(d.title); setDepCode(d.code); setDepName(d.name);
    setDepRelation(d.relation); setDepDob(d.dob ? d.dob.split('T')[0] : '');
    setDepGender(d.gender); setDepStatus(d.status === 'active');
    setEditingDepIdx(idx);
  }

  function handleRemoveDependent(idx) {
    setDependents((prev) => prev.filter((_, i) => i !== idx));
    if (editingDepIdx === idx) clearDepForm();
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!companyId) return toast.error('Company is required');
    if (!empCode.trim()) return toast.error('Employee code is required');
    if (!name.trim()) return toast.error('Name is required');

    const payload = {
      companyId: Number(companyId),
      empCode: empCode.trim().toUpperCase(),
      title,
      name: name.trim(),
      dob: dob || null,
      compCardNo: compCardNo || null,
      billCompanyId: billCompanyId ? Number(billCompanyId) : null,
      gender,
      insuranceExpOn: insuranceExpOn || null,
      entitlement,
      status: status ? 'active' : 'inactive',
      dependents: dependents.map(({ id: _id, employeeId: _eid, ...d }) => d),
      subDeptRates: entitlement === 'specific'
        ? subDeptRows.filter((r) => r.enabled).map(({ subDeptId, enabled, rate, status: s }) => ({ subDeptId, enabled, rate: Number(rate), status: s }))
        : [],
      admissionRates: entitlement === 'specific'
        ? admissionRows.filter((r) => r.enabled).map(({ billHeadId, enabled, rate, status: s }) => ({ billHeadId, enabled, rate: Number(rate), status: s }))
        : [],
      roomEntitlements: entitlement === 'specific'
        ? roomRows.filter((r) => r.enabled).map(({ roomCategoryId, enabled }) => ({ roomCategoryId, enabled }))
        : [],
    };

    setSaving(true);
    try {
      if (isEdit) {
        await updatePanelEmployee(Number(id), payload);
        toast.success('Panel Employee updated');
      } else {
        await createPanelEmployee(payload);
        toast.success('Panel Employee created');
      }
      navigate('/clinic/panels/employees');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="pe-page">
      <ClinicMenuBar />
      <p className="pe-loading">Loading...</p>
    </div>
  );

  return (
    <div className="pe-page">
      <ClinicMenuBar />
      <div className="pe-body">

        {/* Title bar */}
        <div className="pe-titlebar">
          <span className="pe-title">Panel Employees</span>
          <button className="pe-back-btn" onClick={() => navigate('/clinic/panels/employees')}>
            <ChevronLeft size={14} /> Back
          </button>
        </div>

        {/* Main form card */}
        <div className="pe-form-card">

          {/* Row 1: Company + Emp Code */}
          <div className="pe-form-row">
            <div className="pe-field pe-field--label">
              <span className="pe-label">Company</span>
            </div>
            <div className="pe-field pe-field--company">
              <SearchableSelect
                options={panelCompanies}
                value={companyId}
                onChange={val => setCompanyId(val)}
                placeholder="— Select Company —"
                getLabel={c => `${c.code} — ${c.name}`}
                getKey={c => c.id}
              />
            </div>
            <div className="pe-field pe-field--label" style={{ marginLeft: '1.5rem' }}>
              <span className="pe-label">Panel Emp. #</span>
            </div>
            <div className="pe-field pe-field--empcode">
              <input
                className="pe-input"
                placeholder="Emp Code"
                value={empCode}
                onChange={(e) => setEmpCode(e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: Name + Status */}
          <div className="pe-form-row">
            <div className="pe-field pe-field--label">
              <span className="pe-label">Name</span>
            </div>
            <div className="pe-field pe-field--title">
              <select className="pe-input" value={title} onChange={(e) => setTitle(e.target.value)}>
                {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="pe-field pe-field--name">
              <input className="pe-input" placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="pe-field pe-field--status-check">
              <span className="pe-label">Status</span>
              <label className="pe-check">
                <input type="checkbox" checked={status} onChange={(e) => setStatus(e.target.checked)} />
                Active
              </label>
            </div>
          </div>

          {/* Row 3: DOB + Gender + Insurance Exp */}
          <div className="pe-form-row">
            <div className="pe-field pe-field--label">
              <span className="pe-label">Employee DOB</span>
            </div>
            <div className="pe-field pe-field--date">
              <input type="date" className="pe-input" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="pe-field pe-field--gender">
              <label className="pe-radio">
                <input type="radio" name="gender" value="male" checked={gender === 'male'} onChange={() => setGender('male')} /> Male
              </label>
              <label className="pe-radio">
                <input type="radio" name="gender" value="female" checked={gender === 'female'} onChange={() => setGender('female')} /> Female
              </label>
            </div>
            <div className="pe-field pe-field--label" style={{ marginLeft: '1rem' }}>
              <span className="pe-label">Insurance Exp. on</span>
            </div>
            <div className="pe-field pe-field--date">
              <input type="date" className="pe-input" value={insuranceExpOn} onChange={(e) => setInsuranceExpOn(e.target.value)} />
            </div>
          </div>

          {/* Row 4: Comp Card # + Bill Company + Entitlement */}
          <div className="pe-form-row">
            <div className="pe-field pe-field--label">
              <span className="pe-label">Comp. card #</span>
            </div>
            <div className="pe-field pe-field--cardno">
              <input className="pe-input" placeholder="Card No." value={compCardNo} onChange={(e) => setCompCardNo(e.target.value)} />
            </div>
            <div className="pe-field pe-field--label" style={{ marginLeft: '1rem' }}>
              <span className="pe-label">Bill Company</span>
            </div>
            <div className="pe-field pe-field--billcompany">
              <SearchableSelect
                options={panelCompanies}
                value={billCompanyId}
                onChange={val => setBillCompanyId(val)}
                placeholder="— None —"
                getLabel={c => `${c.code} — ${c.name}`}
                getKey={c => c.id}
              />
            </div>
            <div className="pe-field pe-field--entitlement">
              <label className="pe-radio">
                <input type="radio" name="entitlement" value="general" checked={entitlement === 'general'} onChange={() => setEntitlement('general')} />
                General Entitlement
              </label>
              <label className="pe-radio">
                <input type="radio" name="entitlement" value="specific" checked={entitlement === 'specific'} onChange={() => setEntitlement('specific')} />
                Specific Entitlement
              </label>
            </div>
          </div>
        </div>

        {/* Specific Entitlement Tabs */}
        {entitlement === 'specific' && (
          <div className="pe-tabs-section">
            <div className="pe-tab-strip">
              {[
                { key: 'subdept', label: 'Rates of Sub Departments' },
                { key: 'admission', label: 'Rates of Admission Heads' },
                { key: 'room', label: 'Room Entitlement' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  className={`pe-tab-btn ${activeTab === tab.key ? 'pe-tab-btn--active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="pe-tab-content">
              <div className="pe-tab-table-wrap">

                {/* Tab 1: Sub Department Rates */}
                {activeTab === 'subdept' && (
                  <table className="pe-tab-table">
                    <thead>
                      <tr>
                        <th className="pe-th-check"></th>
                        <th>Department</th>
                        <th>Sub Department</th>
                        <th>Rates</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subDeptRows.map((row, idx) => (
                        <tr key={row.subDeptId}>
                          <td className="pe-td-check">
                            <input type="checkbox" checked={row.enabled} onChange={() => toggleSubDept(idx)} />
                          </td>
                          <td className="pe-td-dept">{row.deptName}</td>
                          <td>{row.subDeptName}</td>
                          <td>
                            <input
                              type="number"
                              className="pe-rate-input"
                              value={row.rate}
                              onChange={(e) => setSubDeptRate(idx, e.target.value)}
                              min={0}
                            />
                          </td>
                          <td>
                            <select className="pe-status-select" value={row.status} onChange={(e) => setSubDeptStatus(idx, e.target.value)}>
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                      {subDeptRows.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>No sub departments found</td></tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* Tab 2: Admission Head Rates */}
                {activeTab === 'admission' && (
                  <table className="pe-tab-table">
                    <thead>
                      <tr>
                        <th className="pe-th-check"></th>
                        <th>Head Code</th>
                        <th>Description</th>
                        <th>Rates</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admissionRows.map((row, idx) => (
                        <tr key={row.billHeadId}>
                          <td className="pe-td-check">
                            <input type="checkbox" checked={row.enabled} onChange={() => toggleAdmission(idx)} />
                          </td>
                          <td className="pe-td-code">{row.headCode}</td>
                          <td>{row.description}</td>
                          <td>
                            <input
                              type="number"
                              className="pe-rate-input"
                              value={row.rate}
                              onChange={(e) => setAdmissionRate(idx, e.target.value)}
                              min={0}
                            />
                          </td>
                          <td>
                            <select className="pe-status-select" value={row.status} onChange={(e) => setAdmissionStatus(idx, e.target.value)}>
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                      {admissionRows.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>No bill heads found</td></tr>
                      )}
                    </tbody>
                  </table>
                )}

                {/* Tab 3: Room Entitlement */}
                {activeTab === 'room' && (
                  <table className="pe-tab-table">
                    <thead>
                      <tr>
                        <th className="pe-th-check"></th>
                        <th>Code</th>
                        <th>Room Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roomRows.map((row, idx) => (
                        <tr key={row.roomCategoryId}>
                          <td className="pe-td-check">
                            <input type="checkbox" checked={row.enabled} onChange={() => toggleRoom(idx)} />
                          </td>
                          <td className="pe-td-code">{row.code}</td>
                          <td>{row.name}</td>
                        </tr>
                      ))}
                      {roomRows.length === 0 && (
                        <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>No room categories found</td></tr>
                      )}
                    </tbody>
                  </table>
                )}

              </div>
            </div>
          </div>
        )}

        {/* Dependents Section */}
        <div className="pe-dependents-card">
          <div className="pe-dep-title">Dependents</div>

          <div className="pe-dep-form">
            {/* Dep row 1: Code + Name + Status */}
            <div className="pe-form-row">
              <div className="pe-field pe-field--label">
                <span className="pe-label">Depend. code</span>
              </div>
              <div className="pe-field pe-field--depcode">
                <input className="pe-input" placeholder="Code" value={depCode} onChange={(e) => setDepCode(e.target.value)} />
              </div>
              <div className="pe-field pe-field--status-check" style={{ marginLeft: '1.5rem' }}>
                <span className="pe-label">Status</span>
                <label className="pe-check">
                  <input type="checkbox" checked={depStatus} onChange={(e) => setDepStatus(e.target.checked)} />
                  Active
                </label>
              </div>
            </div>

            {/* Dep row 2: Name + Gender */}
            <div className="pe-form-row">
              <div className="pe-field pe-field--label">
                <span className="pe-label">Depend. Name</span>
              </div>
              <div className="pe-field pe-field--title">
                <select className="pe-input" value={depTitle} onChange={(e) => setDepTitle(e.target.value)}>
                  {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="pe-field pe-field--name">
                <input className="pe-input" placeholder="Dependent Name" value={depName} onChange={(e) => setDepName(e.target.value)} />
              </div>
              <div className="pe-field pe-field--gender">
                <label className="pe-radio">
                  <input type="radio" name="depGender" value="male" checked={depGender === 'male'} onChange={() => setDepGender('male')} /> Male
                </label>
                <label className="pe-radio">
                  <input type="radio" name="depGender" value="female" checked={depGender === 'female'} onChange={() => setDepGender('female')} /> Female
                </label>
              </div>
            </div>

            {/* Dep row 3: Relation + DOB */}
            <div className="pe-form-row">
              <div className="pe-field pe-field--label">
                <span className="pe-label">Relation</span>
              </div>
              <div className="pe-field pe-field--relation">
                <select className="pe-input" value={depRelation} onChange={(e) => setDepRelation(e.target.value)}>
                  <option value="">— Select Relation —</option>
                  {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="pe-field pe-field--label" style={{ marginLeft: '1rem' }}>
                <span className="pe-label">DOB</span>
              </div>
              <div className="pe-field pe-field--date">
                <input type="date" className="pe-input" value={depDob} onChange={(e) => setDepDob(e.target.value)} />
              </div>
              <div className="pe-dep-actions">
                <button className="pe-dep-btn pe-dep-btn--add" onClick={handleAddDependent}>
                  {editingDepIdx !== null ? 'Update' : 'Add'}
                </button>
                {editingDepIdx !== null && (
                  <button className="pe-dep-btn pe-dep-btn--cancel" onClick={clearDepForm}>Cancel</button>
                )}
              </div>
            </div>
          </div>

          {/* Dependents table */}
          <div className="pe-dep-table-wrap">
            <table className="pe-dep-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Relation</th>
                  <th>DOB</th>
                  <th>Sex</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dependents.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '0.75rem', color: '#94a3b8', fontSize: '0.8rem' }}>No dependents added</td></tr>
                ) : (
                  dependents.map((d, idx) => (
                    <tr key={idx} style={{ cursor: 'pointer' }} onClick={() => handleEditDependent(idx)}>
                      <td><strong>{d.code}</strong></td>
                      <td>{d.title} {d.name}</td>
                      <td>{d.relation}</td>
                      <td>{d.dob ? new Date(d.dob).toLocaleDateString('en-GB') : '—'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{d.gender}</td>
                      <td>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: 20,
                          background: d.status === 'active' ? '#dcfce7' : '#fee2e2',
                          color: d.status === 'active' ? '#16a34a' : '#dc2626',
                        }}>{d.status}</span>
                      </td>
                      <td>
                        <button
                          className="pe-dep-remove"
                          onClick={(e) => { e.stopPropagation(); handleRemoveDependent(idx); }}
                          title="Remove"
                        >×</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="pe-footer">
          <span className="pe-footer__info">
            {isEdit ? 'Editing Panel Employee' : 'New Panel Employee'}
          </span>
          <button className="pe-save-btn" onClick={handleSave} disabled={saving}>
            <Save size={14} />
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Save'}
          </button>
        </div>

      </div>
    </div>
  );
}
