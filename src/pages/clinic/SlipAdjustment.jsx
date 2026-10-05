import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Save, Copy, RotateCcw, DoorOpen, FileText, Printer, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { genderForPatientType } from './opdValidation';
import './SlipAdjustment.scss';

const API = 'http://localhost:5001/api/clinic';

const PATIENT_TYPES = ['MAST', 'MR', 'MRS', 'MISS', 'MS', 'BABY', 'BABY OF', 'INFANT'];

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${day}-${month}-${year} ${time}`;
}

function fmt2(n) { return Number(n || 0).toFixed(2); }

const EMPTY_FORM = {
  serialNo: '', patientType: 'MAST', patientName: '', age: '', ageMonths: '0', ageDays: '0',
  gender: 'male', phoneNo: '', referredBy: '', antenatalNo: '',
};

export default function SlipAdjustment() {
  const navigate = useNavigate();

  // Search — full list, no date restriction (same as Slip Refund)
  const [searchTerm, setSearchTerm] = useState('');
  const [searching,  setSearching]  = useState(false);
  const [searched,   setSearched]   = useState(false);
  const [results,    setResults]    = useState([]);

  // Selected slip
  const [visit,   setVisit]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState(EMPTY_FORM);

  // Amount & Doctor — independent from the personal-info Edit/Save toggle
  // above, since Department/Sub Department stay locked regardless; only
  // these two cells become click-to-edit (Doctor opens a dropdown).
  const [editingAmountId, setEditingAmountId] = useState(null);
  const [amountValue,     setAmountValue]     = useState('');
  const [savingAmount,    setSavingAmount]    = useState(false);

  const [editingDoctorId, setEditingDoctorId] = useState(null);
  const [doctorValue,     setDoctorValue]     = useState('');
  const [savingDoctor,    setSavingDoctor]    = useState(false);
  const [doctors,         setDoctors]         = useState([]);

  useEffect(() => {
    fetch(`${API}/doctors?minimal=true`)
      .then(r => r.json())
      .then(j => setDoctors((j.data || []).filter(d => d.status === 'active')))
      .catch(() => {});
  }, []);

  async function handleSearch() {
    const term = searchTerm.trim();
    setSearching(true);
    try {
      const res  = await fetch(`${API}/opd/adjustment/search?q=${encodeURIComponent(term)}`);
      const json = await res.json();
      const rows = json.data || [];
      // An exact Serial # match (not just a name that happens to be unique)
      // skips straight to the edit screen — no need to pick it from a table
      // of one.
      const exact = term && rows.find((r) => String(r.serialNo) === term);
      if (exact) {
        await handleSelect(exact);
        return;
      }
      setResults(rows);
      setSearched(true);
    } catch {
      toast.error('Search fail hui');
    } finally {
      setSearching(false);
    }
  }

  async function handleSelect(row) {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/opd/adjustment/${row.source}/${row.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Slip load nahi hui');
      setVisit(json.data);
    } catch (e) {
      toast.error(e.message || 'Error loading slip');
    } finally {
      setLoading(false);
    }
  }

  function startEdit() {
    setForm({
      serialNo:    visit.serialNo || '',
      patientType: visit.patientType || 'MAST',
      patientName: visit.patientName || '',
      age:         visit.age ?? '',
      ageMonths:   String(visit.ageMonths ?? 0),
      ageDays:     String(visit.ageDays ?? 0),
      gender:      visit.gender || 'male',
      phoneNo:     visit.phoneNo || '',
      referredBy:  visit.referredBy || '',
      antenatalNo: visit.antenatalNo || '',
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setForm(EMPTY_FORM);
  }

  function resetToSearch() {
    setVisit(null);
    setEditing(false);
    setForm(EMPTY_FORM);
    setSearchTerm('');
    setSearched(false);
    setResults([]);
  }

  async function handleSave() {
    if (!form.serialNo.trim()) return toast.error('Serial # khali nahi ho sakta');
    if (!form.patientName.trim()) return toast.error('Patient Name khali nahi ho sakta');

    setSaving(true);
    try {
      const res = await fetch(`${API}/opd/adjustment/${visit.source}/${visit.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Update nahi ho saka');
      toast.success('Slip update ho gayi');
      setVisit({ ...visit, ...json.data });
      setEditing(false);
    } catch (e) {
      toast.error(e.message || 'Error updating slip');
    } finally {
      setSaving(false);
    }
  }

  function startEditAmount(row) {
    setEditingAmountId(row.id);
    setAmountValue(String(row.amount ?? 0));
  }

  async function handleSaveAmount(row) {
    const amt = Number(amountValue);
    if (!Number.isFinite(amt) || amt < 0) { toast.error('Valid amount daalein'); return; }
    if (amt === Number(row.amount)) { setEditingAmountId(null); return; }

    setSavingAmount(true);
    try {
      const res = await fetch(`${API}/opd/adjustment/${visit.source}/${visit.id}/doctor-amount`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ doctorRowId: row.id, amount: amt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Amount update nahi ho saka');
      // Total Amount/Received shift by the same delta server-side — mirror
      // that here so the summary below updates without a full reload.
      setVisit((v) => ({
        ...v,
        totalAmount: json.data.totalAmount,
        receive:     json.data.receive,
        doctors: v.doctors.map((d) => (d.id === row.id ? { ...d, amount: json.data.amount } : d)),
      }));
      toast.success('Amount update ho gaya');
      setEditingAmountId(null);
    } catch (e) {
      toast.error(e.message || 'Error updating amount');
    } finally {
      setSavingAmount(false);
    }
  }

  function startEditDoctor(row) {
    setEditingDoctorId(row.id);
    setDoctorValue('');
  }

  async function handleSaveDoctor(row, doctorId) {
    if (!doctorId) { setEditingDoctorId(null); return; }

    setSavingDoctor(true);
    try {
      const res = await fetch(`${API}/opd/adjustment/${visit.source}/${visit.id}/doctor`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ doctorRowId: row.id, doctorId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Doctor update nahi ho saka');
      setVisit((v) => ({
        ...v,
        doctors: v.doctors.map((d) => (d.id === row.id ? { ...d, doctor: json.data.doctor } : d)),
      }));
      toast.success('Doctor update ho gaya');
      setEditingDoctorId(null);
    } catch (e) {
      toast.error(e.message || 'Error updating doctor');
    } finally {
      setSavingDoctor(false);
    }
  }

  return (
    <div className="sadj-page">
      <ClinicMenuBar />

      <div className="sadj-toolbar">
        <div className="sadj-toolbar-icons">
          <span className="sadj-tbtn sadj-tbtn--disabled"><Save size={16} /></span>
          <span className="sadj-tbtn sadj-tbtn--disabled"><Copy size={16} /></span>
          <span className="sadj-tbtn sadj-tbtn--disabled"><RotateCcw size={16} /></span>
          <button className="sadj-tbtn sadj-tbtn--exit" onClick={() => navigate(-1)} title="Exit">
            <DoorOpen size={16} />
          </button>
          <span className="sadj-tbtn sadj-tbtn--disabled"><FileText size={16} /></span>
          <span className="sadj-tbtn sadj-tbtn--disabled"><Printer size={16} /></span>
        </div>
        <span className="sadj-toolbar-title">Slip Adjustment</span>
      </div>

      <div className="sadj-content">
        {!visit && (
          <>
            <div className="sadj-search-row">
              <label>Serial #</label>
              <div className="sadj-search-box">
                <input
                  autoFocus
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Serial # ya patient name likh kar search karein"
                />
                <button onClick={handleSearch} disabled={searching} title="Search">
                  <Search size={15} />
                </button>
              </div>
            </div>

            {searched && (
              <table className="sadj-search-tbl">
                <thead>
                  <tr>
                    <th>Serial #</th>
                    <th>Patient</th>
                    <th>Department</th>
                    <th>Source</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(s => (
                    <tr key={`${s.source}_${s.id}`} onClick={() => handleSelect(s)}>
                      <td>{s.serialNo}</td>
                      <td>{s.patientName}</td>
                      <td>{s.department}</td>
                      <td>
                        <span className={`sadj-src-badge sadj-src-badge--${s.source}`}>
                          {s.source === 'opd' ? 'New System' : 'Patients List'}
                        </span>
                      </td>
                      <td>{fmtDateTime(s.createdAt)}</td>
                    </tr>
                  ))}
                  {!results.length && (
                    <tr>
                      <td colSpan={5} className="sadj-td-empty">Koi match nahi mila</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </>
        )}

        {loading && <div className="sadj-loading">Loading…</div>}

        {!loading && visit && (
          <div className="sadj-form-card">
            <div className="sadj-form-row">
              <label className="sadj-label sadj-label--serial">Serial #</label>
              {editing ? (
                <input
                  className="sadj-input sadj-input--serial sadj-edit-input"
                  value={form.serialNo}
                  onChange={e => setForm(f => ({ ...f, serialNo: e.target.value }))}
                />
              ) : (
                <input className="sadj-input sadj-input--serial" value={visit.serialNo} readOnly />
              )}
              <span className={`sadj-src-badge sadj-src-badge--${visit.source}`}>
                {visit.source === 'opd' ? 'New System' : 'Patients List'}
              </span>
              <span className="sadj-dept-badge">{(visit.department || '').toUpperCase()}</span>
            </div>

            <div className="sadj-separator" />

            {!editing ? (
              <>
                <div className="sadj-form-row">
                  <label className="sadj-label">Date &amp; Time</label>
                  <span className="sadj-value">{fmtDateTime(visit.createdAt)}</span>
                  <label className="sadj-label sadj-label--inline">Patient Name</label>
                  <span className="sadj-value">{visit.patientType} {visit.patientName}</span>
                </div>

                {visit.source === 'opd' && (
                  <>
                    <div className="sadj-form-row">
                      <label className="sadj-label">Age</label>
                      <span className="sadj-value">{visit.age ?? '—'}</span>
                      <label className="sadj-label sadj-label--inline">Gender</label>
                      <span className="sadj-value sadj-value--cap">{visit.gender}</span>
                    </div>
                    <div className="sadj-form-row">
                      <label className="sadj-label">Phone #</label>
                      <span className="sadj-value">{visit.phoneNo || '—'}</span>
                      <label className="sadj-label sadj-label--inline">Refered By</label>
                      <span className="sadj-value">{visit.referredBy || '—'}</span>
                    </div>
                    <div className="sadj-form-row">
                      <label className="sadj-label">Antenatal #</label>
                      <span className="sadj-value">{visit.antenatalNo || '—'}</span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="sadj-form-row">
                  <label className="sadj-label">Patient Name</label>
                  <div className="sadj-name-edit">
                    {visit.source === 'opd' && (
                      <select className="sadj-select sadj-select--type" value={form.patientType} onChange={e => {
                        const v = e.target.value;
                        const g = genderForPatientType(v);
                        setForm(f => ({ ...f, patientType: v, ...(g ? { gender: g } : {}) }));
                      }}>
                        {PATIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                    <input className="sadj-edit-input" value={form.patientName} onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))} />
                  </div>
                </div>

                {visit.source === 'opd' && (
                  <>
                    <div className="sadj-form-row">
                      <label className="sadj-label">Age</label>
                      <input className="sadj-edit-input sadj-edit-input--sm" value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} />
                      <label className="sadj-label sadj-label--inline">Gender</label>
                      <select className="sadj-select" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                    <div className="sadj-form-row">
                      <label className="sadj-label">Phone #</label>
                      <input className="sadj-edit-input" value={form.phoneNo} onChange={e => setForm(f => ({ ...f, phoneNo: e.target.value }))} />
                      <label className="sadj-label sadj-label--inline">Refered By</label>
                      <input className="sadj-edit-input" value={form.referredBy} onChange={e => setForm(f => ({ ...f, referredBy: e.target.value }))} />
                    </div>
                    <div className="sadj-form-row">
                      <label className="sadj-label">Antenatal #</label>
                      <input className="sadj-edit-input" value={form.antenatalNo} onChange={e => setForm(f => ({ ...f, antenatalNo: e.target.value }))} />
                    </div>
                  </>
                )}
              </>
            )}

            <div className="sadj-separator" />

            <div className="sadj-readonly-note">Department aur Sub Department yahan edit nahi ho sakte — Amount aur Doctor click karke edit ho sakte hain.</div>

            <table className="sadj-doc-tbl">
              <thead>
                <tr>
                  <th>Sub Dep.</th>
                  <th>Sub Department</th>
                  <th className="sadj-td-r">Amount</th>
                  <th>Doctor</th>
                  <th>Doctor</th>
                </tr>
              </thead>
              <tbody>
                {(visit.doctors || []).map(d => (
                  <tr key={d.id}>
                    <td>{d.subDept?.code}</td>
                    <td>{d.subDept?.name}</td>
                    <td className="sadj-td-r sadj-td-amount">
                      {editingAmountId === d.id ? (
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="0.01"
                          className="sadj-amount-input"
                          value={amountValue}
                          disabled={savingAmount}
                          onChange={e => setAmountValue(e.target.value)}
                          onFocus={e => e.target.select()}
                          onBlur={() => handleSaveAmount(d)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); handleSaveAmount(d); }
                            if (e.key === 'Escape') setEditingAmountId(null);
                          }}
                        />
                      ) : (
                        <span className="sadj-amount-display" title="Click to edit" onClick={() => startEditAmount(d)}>
                          {fmt2(d.amount)}
                        </span>
                      )}
                    </td>
                    {editingDoctorId === d.id ? (
                      <td colSpan={2} className="sadj-td-doctor">
                        <select
                          autoFocus
                          className="sadj-doctor-select"
                          value={doctorValue}
                          disabled={savingDoctor}
                          onChange={e => { setDoctorValue(e.target.value); handleSaveDoctor(d, e.target.value); }}
                          onBlur={() => setEditingDoctorId(null)}
                          onKeyDown={e => { if (e.key === 'Escape') setEditingDoctorId(null); }}
                        >
                          <option value="">— Select Doctor —</option>
                          {doctors.map(doc => (
                            <option key={doc.id} value={doc.id}>{doc.code} — {doc.name}</option>
                          ))}
                        </select>
                      </td>
                    ) : (
                      <>
                        <td>{d.doctor?.code}</td>
                        <td className="sadj-td-doctor">
                          <span className="sadj-amount-display" title="Click to change doctor" onClick={() => startEditDoctor(d)}>
                            {d.doctor?.name}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="sadj-totals-row">
              {/* Legacy (source='pv') slips have no separate Total Amount
                  field of their own — Amount here IS received, so Balance
                  is always 0 for them (see updateVisitDoctorAmount). */}
              <span>Total Amount: <strong>{fmt2(visit.totalAmount ?? visit.receive)}</strong></span>
              <span>Received: <strong>{fmt2(visit.receive)}</strong></span>
              <span>Balance: <strong>{fmt2(Number(visit.totalAmount ?? visit.receive ?? 0) - Number(visit.receive || 0))}</strong></span>
            </div>
          </div>
        )}

        {!loading && visit && (
          <div className="sadj-footer">
            {!editing ? (
              <>
                <button className="sadj-edit-btn" onClick={startEdit}>
                  <Pencil size={13} /> Edit
                </button>
                <button className="sadj-close-btn" onClick={resetToSearch}>Close</button>
              </>
            ) : (
              <>
                <button className="sadj-save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button className="sadj-close-btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
