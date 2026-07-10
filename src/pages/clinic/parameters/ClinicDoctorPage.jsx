import { useEffect, useState, useRef } from 'react';
import { Plus, Pencil, Trash2, Search, PlusCircle, X, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import PageHeader from '../../../components/shared/PageHeader';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { useClinicStore } from '../../../store/useClinicStore';
import './ClinicParameterPage.scss';
import './ClinicDoctorPage.scss';

const API = 'http://localhost:5001/api/clinic';

// Parse Excel in "Sr# | Test Name | Rate (Rs.)" format
// Row 0 may be a department title (e.g. "ULTRA SOUND") or directly headers
function parseRatesExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (raw.length < 2) return resolve({ deptTitle: '', rows: [] });

        // Detect if row 0 is a title or headers
        // Headers contain "Sr" or "Test" or "Rate"
        const row0Str = raw[0].map((c) => String(c).toLowerCase()).join(' ');
        const isHeader0 = row0Str.includes('sr') || row0Str.includes('test') || row0Str.includes('rate');
        const headerRowIdx = isHeader0 ? 0 : 1;
        const deptTitle = !isHeader0 ? String(raw[0][0] || '').trim() : '';
        const dataStart = headerRowIdx + 1;

        // Find columns: Sr#, Test Name, Rate (Rs.)
        const headers = raw[headerRowIdx].map((h) => String(h).toLowerCase().replace(/[\s()#.]/g, ''));
        const srIdx   = headers.findIndex((h) => h.startsWith('sr') || h === 'no');
        const nameIdx = headers.findIndex((h) => h.includes('test') || h.includes('name'));
        const rateIdx = headers.findIndex((h) => h.includes('rate') || h.includes('rs') || h.includes('fee'));

        const rows = [];
        for (let i = dataStart; i < raw.length; i++) {
          const r = raw[i];
          const testName = String(nameIdx >= 0 ? r[nameIdx] : r[1] || '').trim();
          if (!testName) continue;
          const normalFees = rateIdx >= 0 ? Number(r[rateIdx]) || 0 : 0;
          rows.push({ testName, normalFees });
        }
        resolve({ deptTitle, rows });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY_FORM = {
  code: '', name: '', speciality: '', qualification: '',
  staffCategoryId: '', status: 'active', consultantDays: [],
};

const EMPTY_SUBDEPT = {
  departmentId: '', subDeptId: '', consultantDays: [], fromTime: '', toTime: '',
  normalCharges: '', oddCharges: '',
  paymentType: 'amount', normalFees: '', oddFees: '',
  onCall: false,
};

export default function ClinicDoctorPage() {
  const {
    doctors, departments, subDepartments, staffCategories, loading,
    fetchDoctors, fetchDepartments, fetchSubDepartments, fetchStaffCategories,
    createDoctor, updateDoctor, deleteDoctor,
  } = useClinicStore();

  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activeTab, setActiveTab] = useState('main');
  const [form, setForm] = useState(EMPTY_FORM);
  const [subDeptRows, setSubDeptRows] = useState([]);
  const [subDeptForm, setSubDeptForm] = useState(EMPTY_SUBDEPT);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [bulkRate, setBulkRate] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);

  // Upload Excel states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDoctorId, setUploadDoctorId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadRows, setUploadRows] = useState([]);
  const [uploadDeptTitle, setUploadDeptTitle] = useState('');
  const [uploadParsing, setUploadParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadFileRef = useRef(null);

  useEffect(() => {
    fetchDoctors();
    fetchDepartments();
    fetchSubDepartments();
    fetchStaffCategories();
  }, [fetchDoctors, fetchDepartments, fetchSubDepartments, fetchStaffCategories]);

  const filtered = doctors.filter((d) =>
    d.name.toLowerCase().includes(query.toLowerCase()) ||
    d.code.toLowerCase().includes(query.toLowerCase())
  );

  // Sub-depts filtered by selected department
  const availableSubDepts = subDepartments.filter(
    (sd) => String(sd.departmentId) === String(subDeptForm.departmentId)
  );

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSubDeptRows([]);
    setSubDeptForm(EMPTY_SUBDEPT);
    setActiveTab('main');
    setShowModal(true);
  }

  function openEdit(doc) {
    setEditing(doc);
    setForm({
      code: doc.code,
      name: doc.name,
      speciality: doc.speciality || '',
      qualification: doc.qualification || '',
      staffCategoryId: doc.staffCategoryId ? String(doc.staffCategoryId) : '',
      status: doc.status,
      consultantDays: doc.consultantDays || [],
    });
    setSubDeptRows(
      (doc.subDepts || []).map((s) => ({
        id: s.id,
        departmentId: String(s.subDept.department.id),
        subDeptId: String(s.subDeptId),
        subDeptName: s.subDept.name,
        deptName: s.subDept.department.name,
        consultantDays: s.consultantDays || [],
        fromTime: s.fromTime || '',
        toTime: s.toTime || '',
        normalCharges: String(s.normalCharges),
        oddCharges: String(s.oddCharges),
        paymentType: s.paymentType,
        normalFees: String(s.normalFees),
        oddFees: String(s.oddFees),
        onCall: s.onCall,
      }))
    );
    setSubDeptForm(EMPTY_SUBDEPT);
    setActiveTab('main');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setSubDeptRows([]);
    setSubDeptForm(EMPTY_SUBDEPT);
  }

  function toggleDay(day) {
    setForm((f) => ({
      ...f,
      consultantDays: f.consultantDays.includes(day)
        ? f.consultantDays.filter((d) => d !== day)
        : [...f.consultantDays, day],
    }));
  }

  function addSubDeptRow() {
    if (!subDeptForm.subDeptId) return toast.error('Select a sub department');
    const subDept = subDepartments.find((s) => String(s.id) === String(subDeptForm.subDeptId));
    const dept = departments.find((d) => String(d.id) === String(subDeptForm.departmentId));
    const alreadyAdded = subDeptRows.some((r) => String(r.subDeptId) === String(subDeptForm.subDeptId));
    if (alreadyAdded) return toast.error('Sub department already added');
    setSubDeptRows((rows) => [
      ...rows,
      {
        ...subDeptForm,
        subDeptName: subDept?.name || '',
        deptName: dept?.name || '',
        consultantDays: subDeptForm.consultantDays || [],
      },
    ]);
    setSubDeptForm(EMPTY_SUBDEPT);
  }

  function removeSubDeptRow(idx) {
    setSubDeptRows((rows) => rows.filter((_, i) => i !== idx));
    setSelectedRows((s) => s.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i)));
  }

  const allSelected = subDeptRows.length > 0 && selectedRows.length === subDeptRows.length;

  function toggleSelectAll() {
    setSelectedRows(allSelected ? [] : subDeptRows.map((_, i) => i));
  }

  function toggleSelectRow(idx) {
    setSelectedRows((s) => s.includes(idx) ? s.filter((i) => i !== idx) : [...s, idx]);
  }

  function applyBulkRate() {
    if (!bulkRate && bulkRate !== 0) return toast.error('Rate daalo pehle');
    if (!selectedRows.length) return toast.error('Pehle sub-departments select karo');
    setSubDeptRows((rows) =>
      rows.map((r, i) =>
        selectedRows.includes(i)
          ? { ...r, paymentType: 'percent', normalFees: String(bulkRate), oddFees: String(bulkRate) }
          : r
      )
    );
    toast.success(`${selectedRows.length} sub-dept(s) pe ${bulkRate}% apply ho gaya`);
  }

  async function handleSave() {
    if (!form.code.trim()) return toast.error('Code is required');
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    const payload = {
      ...form,
      staffCategoryId: form.staffCategoryId || null,
      subDepts: subDeptRows.map((r) => ({
        subDeptId: r.subDeptId,
        consultantDays: r.consultantDays || [],
        fromTime: r.fromTime || null,
        toTime: r.toTime || null,
        normalCharges: parseFloat(r.normalCharges) || 0,
        oddCharges: parseFloat(r.oddCharges) || 0,
        paymentType: r.paymentType,
        normalFees: parseFloat(r.normalFees) || 0,
        oddFees: parseFloat(r.oddFees) || 0,
        onCall: r.onCall,
      })),
    };
    try {
      if (editing) {
        await updateDoctor(editing.id, payload);
        toast.success('Doctor updated');
      } else {
        await createDoctor(payload);
        toast.success('Doctor created');
      }
      closeModal();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Upload Excel handlers
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadParsing(true);
    try {
      const { deptTitle, rows } = await parseRatesExcel(file);
      setUploadRows(rows);
      setUploadDeptTitle(deptTitle);
      if (deptTitle) toast(`Department: ${deptTitle} — ${rows.length} tests found`);
      else toast.success(`${rows.length} rows parsed`);
    } catch {
      toast.error('Excel parse failed');
      setUploadRows([]);
    } finally {
      setUploadParsing(false);
    }
  }

  async function handleUploadSubmit() {
    if (!uploadDoctorId) return toast.error('Doctor select karo pehle');
    if (uploadRows.length === 0) return toast.error('Koi rows nahi mili Excel mein');
    setUploading(true);
    try {
      const res = await fetch(`${API}/doctors/${uploadDoctorId}/import-rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: uploadRows, deptTitle: uploadDeptTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      const r = data.data;
      toast.success(`${r.matched} import hue (${r.created} naye, ${r.updated} update)`);
      if (r.notFound?.length) toast(`${r.notFound.length} test names match nahi hue`, { icon: '⚠' });
      setShowUploadModal(false);
      setUploadDoctorId('');
      setUploadFile(null);
      setUploadRows([]);
      setUploadDeptTitle('');
      if (uploadFileRef.current) uploadFileRef.current.value = '';
      fetchDoctors();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  }

  function closeUploadModal() {
    setShowUploadModal(false);
    setUploadDoctorId('');
    setUploadFile(null);
    setUploadRows([]);
    setUploadDeptTitle('');
    if (uploadFileRef.current) uploadFileRef.current.value = '';
  }

  const uploadDoctor = doctors.find((d) => String(d.id) === uploadDoctorId); // eslint-disable-line no-unused-vars

  async function handleDelete(doc) {
    try {
      await deleteDoctor(doc.id);
      toast.success('Doctor deleted');
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
            { label: 'Doctors / Consultant' },
          ]}
          title="Doctors / Consultant"
          actionLabel="Add Doctor"
          actionIcon={Plus}
          onAction={openAdd}
        />

        <div className="cpp-toolbar">
          <div className="cpp-search">
            <Search className="cpp-search-icon" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="cpp-search-input"
            />
          </div>
          <div className="cpp-toolbar-right">
            <span className="cpp-count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
            <button className="cdp-upload-btn" onClick={() => setShowUploadModal(true)}>
              <Upload className="w-3.5 h-3.5" /> Upload Patient Visits Excel
            </button>
          </div>
        </div>

        <div className="cpp-table-wrap">
          {loading ? (
            <p className="cpp-empty">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="cpp-empty">No doctors found.</p>
          ) : (
            <table className="cpp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Speciality</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Days</th>
                  <th className="cpp-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, i) => (
                  <tr key={doc.id}>
                    <td className="cpp-num">{i + 1}</td>
                    <td className="font-mono text-xs">{doc.code}</td>
                    <td>{doc.name}</td>
                    <td className="text-slate-500">{doc.speciality || '—'}</td>
                    <td className="text-slate-500">{doc.staffCategory?.name || '—'}</td>
                    <td>
                      <span className={`cdp-badge ${doc.status === 'active' ? 'cdp-badge--active' : 'cdp-badge--inactive'}`}>
                        {doc.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-slate-500 text-xs">{[...new Set((doc.subDepts || []).flatMap(s => s.consultantDays || []))].join(', ') || '—'}</td>
                    <td className="cpp-actions">
                      <button className="cpp-btn-icon cpp-edit" onClick={() => openEdit(doc)} title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button className="cpp-btn-icon cpp-delete" onClick={() => setConfirmDelete(doc)} title="Delete">
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
      <Modal isOpen={showModal} onClose={closeModal} title={editing ? 'Edit Doctor' : 'Add Doctor'} size="xl">
        {/* Tabs */}
        <div className="cdp-tabs">
          <button
            className={`cdp-tab ${activeTab === 'main' ? 'cdp-tab--active' : ''}`}
            onClick={() => setActiveTab('main')}
          >
            Main Info
          </button>
          <button
            className={`cdp-tab ${activeTab === 'subdept' ? 'cdp-tab--active' : ''}`}
            onClick={() => setActiveTab('subdept')}
          >
            Sub Dept Info
            {subDeptRows.length > 0 && <span className="cdp-tab-badge">{subDeptRows.length}</span>}
          </button>
        </div>

        {/* Tab 1: Main Info */}
        {activeTab === 'main' && (
          <div className="cdp-tab-content">
            <div className="cdp-grid-2">
              <Input
                label="Doctor Code"
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. DR-001"
              />
              <Input
                label="Doctor Name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
              />
              <Input
                label="Speciality"
                value={form.speciality}
                onChange={(e) => setForm((f) => ({ ...f, speciality: e.target.value }))}
                placeholder="e.g. Cardiologist"
              />
              <Input
                label="Qualification"
                value={form.qualification}
                onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))}
                placeholder="e.g. MBBS, FCPS"
              />
            </div>

            <div className="cdp-grid-2 mt-4">
              <div className="cdp-field">
                <label className="cdp-label">Staff Category</label>
                <select
                  className="cdp-select"
                  value={form.staffCategoryId}
                  onChange={(e) => setForm((f) => ({ ...f, staffCategoryId: e.target.value }))}
                >
                  <option value="">— Select Category —</option>
                  {staffCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="cdp-field">
                <label className="cdp-label">Status</label>
                <div className="cdp-radio-group">
                  {['active', 'inactive'].map((s) => (
                    <label key={s} className="cdp-radio">
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={form.status === s}
                        onChange={() => setForm((f) => ({ ...f, status: s }))}
                      />
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Tab 2: Sub Dept Info */}
        {activeTab === 'subdept' && (
          <div className="cdp-tab-content">
            <div className="cdp-subdept-form">
              {/* Row 1: Department | Sub Department */}
              <div className="cdp-grid-2">
                <div className="cdp-field">
                  <label className="cdp-label">Department</label>
                  <select
                    className="cdp-select"
                    value={subDeptForm.departmentId}
                    onChange={(e) =>
                      setSubDeptForm((f) => ({ ...f, departmentId: e.target.value, subDeptId: '' }))
                    }
                  >
                    <option value="">— Select Dept —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="cdp-field">
                  <label className="cdp-label">Sub Department</label>
                  <select
                    className="cdp-select"
                    value={subDeptForm.subDeptId}
                    onChange={(e) => setSubDeptForm((f) => ({ ...f, subDeptId: e.target.value }))}
                    disabled={!subDeptForm.departmentId}
                  >
                    <option value="">— Select Sub Dept —</option>
                    {availableSubDepts.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Days */}
              <div className="cdp-field mt-3">
                <label className="cdp-label">Consultant Days</label>
                <div className="cdp-days">
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      className={`cdp-day-btn ${subDeptForm.consultantDays.includes(day) ? 'cdp-day-btn--on' : ''}`}
                      onClick={() => setSubDeptForm(f => ({
                        ...f,
                        consultantDays: f.consultantDays.includes(day)
                          ? f.consultantDays.filter(d => d !== day)
                          : [...f.consultantDays, day],
                      }))}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Normal Time From | Normal Time To */}
              <div className="cdp-grid-2 mt-3">
                <div className="cdp-field">
                  <label className="cdp-label">Normal Time From</label>
                  <input type="time" className="cdp-input" value={subDeptForm.fromTime}
                    onChange={(e) => setSubDeptForm((f) => ({ ...f, fromTime: e.target.value }))} />
                </div>
                <div className="cdp-field">
                  <label className="cdp-label">Normal Time To</label>
                  <input type="time" className="cdp-input" value={subDeptForm.toTime}
                    onChange={(e) => setSubDeptForm((f) => ({ ...f, toTime: e.target.value }))} />
                </div>
              </div>

              {/* Row 3: Normal Charges | Odd Charges */}
              <div className="cdp-grid-2 mt-3">
                <div className="cdp-field">
                  <label className="cdp-label">Normal Charges</label>
                  <input type="number" className="cdp-input" min="0" placeholder="0"
                    value={subDeptForm.normalCharges}
                    onChange={(e) => setSubDeptForm((f) => ({ ...f, normalCharges: e.target.value }))} />
                </div>
                <div className="cdp-field">
                  <label className="cdp-label">Odd Charges</label>
                  <input type="number" className="cdp-input" min="0" placeholder="0"
                    value={subDeptForm.oddCharges}
                    onChange={(e) => setSubDeptForm((f) => ({ ...f, oddCharges: e.target.value }))} />
                </div>
              </div>

              {/* Row 4: Consultant Payment Type */}
              <div className="cdp-field mt-3">
                <label className="cdp-label">Consultant Payment Type</label>
                <div className="cdp-radio-group">
                  <label className="cdp-radio">
                    <input type="radio" name="payType" value="percent"
                      checked={subDeptForm.paymentType === 'percent'}
                      onChange={() => setSubDeptForm((f) => ({ ...f, paymentType: 'percent' }))} />
                    Percent (%)
                  </label>
                  <label className="cdp-radio">
                    <input type="radio" name="payType" value="amount"
                      checked={subDeptForm.paymentType === 'amount'}
                      onChange={() => setSubDeptForm((f) => ({ ...f, paymentType: 'amount' }))} />
                    Amount
                  </label>
                </div>
              </div>

              {/* Row 5: Normal Fees | Odd Fees | On Call | Add to List */}
              <div className="cdp-grid-4 mt-3">
                <div className="cdp-field">
                  <label className="cdp-label">Normal Fees</label>
                  <input type="number" className="cdp-input" min="0" placeholder="0"
                    value={subDeptForm.normalFees}
                    onChange={(e) => setSubDeptForm((f) => ({ ...f, normalFees: e.target.value }))} />
                </div>
                <div className="cdp-field">
                  <label className="cdp-label">Odd Fees</label>
                  <input type="number" className="cdp-input" min="0" placeholder="0"
                    value={subDeptForm.oddFees}
                    onChange={(e) => setSubDeptForm((f) => ({ ...f, oddFees: e.target.value }))} />
                </div>
                <div className="cdp-field cdp-field--center">
                  <label className="cdp-label">On Call</label>
                  <input type="checkbox" className="cdp-checkbox" checked={subDeptForm.onCall}
                    onChange={(e) => setSubDeptForm((f) => ({ ...f, onCall: e.target.checked }))} />
                </div>
                <div className="cdp-field cdp-field--bottom">
                  <button type="button" className="cdp-add-row-btn" onClick={addSubDeptRow}>
                    <PlusCircle className="w-4 h-4" /> Add to List
                  </button>
                </div>
              </div>
            </div>

            {/* Sub dept rows table */}
            {subDeptRows.length > 0 && (
              <div className="cdp-subdept-table-wrap mt-4">

                {/* Bulk Rate Bar */}
                <div className="cdp-bulk-bar">
                  <label className="cdp-bulk-chk-label">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                    Select All ({subDeptRows.length})
                  </label>
                  <div className="cdp-bulk-rate-group">
                    <span className="cdp-bulk-lbl">Rate %</span>
                    <input
                      type="number" min="0" max="100" step="0.5"
                      className="cdp-bulk-input"
                      placeholder="e.g. 35"
                      value={bulkRate}
                      onChange={e => setBulkRate(e.target.value)}
                    />
                    <span className="cdp-bulk-pct">%</span>
                    <button type="button" className="cdp-bulk-apply-btn" onClick={applyBulkRate}
                      disabled={!selectedRows.length || bulkRate === ''}>
                      Apply to Selected ({selectedRows.length})
                    </button>
                  </div>
                </div>

                <table className="cdp-subdept-table">
                  <thead>
                    <tr>
                      <th style={{width:'32px'}}></th>
                      <th>Sub Dep.</th>
                      <th>Days</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Nor. Charges</th>
                      <th>Odd Charges</th>
                      <th>Pay Type</th>
                      <th>Nor. Fees</th>
                      <th>Odd Fees</th>
                      <th>On Call</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subDeptRows.map((row, idx) => (
                      <tr key={idx} className={selectedRows.includes(idx) ? 'cdp-row-selected' : ''}>
                        <td style={{textAlign:'center'}}>
                          <input type="checkbox"
                            checked={selectedRows.includes(idx)}
                            onChange={() => toggleSelectRow(idx)} />
                        </td>
                        <td>
                          <div className="text-xs font-medium">{row.subDeptName}</div>
                          <div className="text-xs text-slate-400">{row.deptName}</div>
                        </td>
                        <td className="text-xs">{(row.consultantDays || []).join(', ') || '—'}</td>
                        <td>{row.fromTime || '—'}</td>
                        <td>{row.toTime || '—'}</td>
                        <td>{row.normalCharges || 0}</td>
                        <td>{row.oddCharges || 0}</td>
                        <td className="capitalize">{row.paymentType === 'percent' ? '%' : 'Amt'}</td>
                        <td>
                          {row.paymentType === 'percent'
                            ? `${row.normalFees || 0}%`
                            : `${row.normalFees || 0}`}
                        </td>
                        <td>
                          {row.paymentType === 'percent'
                            ? `${row.oddFees || 0}%`
                            : `${row.oddFees || 0}`}
                        </td>
                        <td>{row.onCall ? '✓' : '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="cdp-remove-row"
                            onClick={() => removeSubDeptRow(idx)}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4 border-t pt-4">
          <Button label="Cancel" variant="secondary" onClick={closeModal} />
          <Button label={editing ? 'Update' : 'Save'} onClick={handleSave} loading={saving} />
        </div>
      </Modal>

      {/* Upload Excel Modal */}
      <Modal isOpen={showUploadModal} onClose={closeUploadModal} title="Import Sub-Dept Rates from Excel" size="lg">
        <div className="cdp-upload-modal">

          {/* Doctor selector */}
          <div className="cdp-field">
            <label className="cdp-label">Doctor / Consultant select karo *</label>
            <select
              className="cdp-select"
              value={uploadDoctorId}
              onChange={(e) => setUploadDoctorId(e.target.value)}
            >
              <option value="">— Doctor select karo —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* File picker */}
          <div className="cdp-field mt-3">
            <label className="cdp-label">Excel File (.xlsx / .xls)</label>
            <input
              ref={uploadFileRef}
              type="file"
              accept=".xlsx,.xls"
              className="cdp-upload-file-input"
              onChange={handleFileChange}
            />
          </div>

          {/* Parsing indicator */}
          {uploadParsing && <p className="cdp-upload-info">Parsing…</p>}

          {/* Parsed preview table */}
          {!uploadParsing && uploadRows.length > 0 && (
            <div className="cdp-upload-rates mt-3">
              <p className="cdp-upload-rates-title">
                Preview — {uploadRows.length} test{uploadRows.length !== 1 ? 's' : ''} found
              </p>
              <div className="cdp-upload-rates-table-wrap">
                <table className="cdp-upload-rates-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Test Name</th>
                      <th>Rate (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadRows.slice(0, 50).map((r, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{r.testName}</td>
                        <td className="cdp-upload-fees">{r.normalFees}</td>
                      </tr>
                    ))}
                    {uploadRows.length > 50 && (
                      <tr><td colSpan={3} style={{textAlign:'center', color:'#888', fontStyle:'italic'}}>
                        …aur {uploadRows.length - 50} rows
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!uploadParsing && uploadFile && uploadRows.length === 0 && (
            <div className="cdp-upload-preview cdp-upload-preview--warn">
              ⚠ Koi valid rows nahi mili — column headers check karo (Sr# | Test Name | Rate (Rs.))
            </div>
          )}

          {/* Format hint */}
          <div className="cdp-upload-hint">
            <strong>Expected format (ULTRA SOUND.xlsx jesa):</strong><br />
            Row 1: Department naam (e.g. ULTRA SOUND)<br />
            Row 2: Sr# &nbsp;|&nbsp; Test Name &nbsp;|&nbsp; Rate (Rs.)<br />
            Row 3+: 1 &nbsp;|&nbsp; BREAST BOTH &nbsp;|&nbsp; 1600
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 border-t pt-4">
          <Button label="Cancel" variant="secondary" onClick={closeUploadModal} />
          <Button
            label={uploading ? 'Uploading…' : `Import ${uploadRows.length > 0 ? uploadRows.length + ' tests' : ''}`}
            onClick={handleUploadSubmit}
            loading={uploading}
            disabled={!uploadDoctorId || uploadRows.length === 0 || uploading}
          />
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Doctor" size="sm">
        <p className="text-sm text-gray-600 mb-4">
          Delete <strong>{confirmDelete?.name}</strong>? This will also remove all sub department assignments.
        </p>
        <div className="flex justify-end gap-2">
          <Button label="Cancel" variant="secondary" onClick={() => setConfirmDelete(null)} />
          <Button label="Delete" variant="danger" onClick={() => handleDelete(confirmDelete)} />
        </div>
      </Modal>
    </div>
  );
}
