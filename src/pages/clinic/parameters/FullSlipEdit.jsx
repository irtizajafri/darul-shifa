import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';
import { Search, Trash2, Plus, Printer, AlertTriangle, History } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import { useAuthStore } from '../../../store/useAuthStore';
import { buildReceiptHtml } from '../receiptUtils';
import { buildEmergencyReceiptHtml } from '../emergencyReceiptUtils';
import './FullSlipEdit.scss';

// Clinic > Transactions > Full Slip Edit — superadmin only (route is wrapped in
// SuperAdminRoute). Edits an entire General OPD / Emergency slip. Risky
// situations (doctor fee paid, day closed, cash handed over, admission/panel
// bill, cancelled) are shown as warnings, never blocked; totals follow the
// same rules as the OPD screens and are re-computed by the backend on save.

const API = 'http://localhost:5001/api/clinic';
const FULL_EDIT_DEPTS = ['general opd', 'emergency'];

const PAYMENT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'jazzcash', label: 'JazzCash' },
  { value: 'online', label: 'Online' },
  { value: 'cc', label: 'Credit Card' },
  { value: 'complementary', label: 'Complementary' },
  { value: 'panel', label: 'Panel' },
];
const PATIENT_TYPES = ['MAST', 'MR', 'MRS', 'MS', 'BABY', 'BABY OF'];
const fmt = (n) => Number(n || 0).toLocaleString('en', { maximumFractionDigits: 2 });
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

async function api(path, opts) {
  const res = await fetch(`${API}${path}`, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.message || `Request failed (${res.status})`);
  return json.data;
}

export default function FullSlipEdit() {
  const { user } = useAuthStore();
  const editedBy = user?.name || user?.username || user?.email || 'Super Admin';

  // search
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null);

  // loaded slip
  const [loading, setLoading] = useState(false);
  const [original, setOriginal] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [ccConfig, setCcConfig] = useState({ percentage: 0, minAmount: 0 });
  const [catalog, setCatalog] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);

  // editable state
  const [form, setForm] = useState(null);
  const [rows, setRows] = useState([]);
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState('amount');
  const [receive, setReceive] = useState('');
  const [addPick, setAddPick] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  async function handleSearch(e) {
    e?.preventDefault();
    const term = q.trim();
    if (!term) return toast.error('Slip #, MR # ya patient ka naam likhein');
    setSearching(true);
    try {
      const data = await api(`/opd/adjustment/search?q=${encodeURIComponent(term)}`);
      const list = (Array.isArray(data) ? data : []).filter(
        (r) => r.source === 'opd' && FULL_EDIT_DEPTS.includes(String(r.department || '').trim().toLowerCase()),
      );
      setResults(list);
      if (list.length === 1) loadSlip(list[0].id);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function loadSlip(id) {
    setLoading(true);
    try {
      const data = await api(`/opd/full-edit/${id}`);
      const v = data.visit;
      setOriginal(v);
      setWarnings(data.warnings || []);
      setCcConfig(data.ccConfig || { percentage: 0, minAmount: 0 });
      setForm({
        serialNo: v.serialNo || '', mrNo: v.mrNo ?? '', patientType: v.patientType || 'MAST',
        patientName: v.patientName || '', age: v.age ?? '', ageMonths: v.ageMonths ?? 0, ageDays: v.ageDays ?? 0,
        gender: v.gender || 'male', phoneNo: v.phoneNo || '', referredBy: v.referredBy || '',
        visitType: v.visitType || 'opd', admitNo: v.admitNo || '', adjustPayment: Boolean(v.adjustPayment),
        paymentType: v.paymentType || 'cash',
      });
      setRows(v.doctors.map((d) => ({
        key: `r${d.id}`, id: d.id, doctorId: d.doctorId, subDeptId: d.subDeptId,
        doctorName: d.doctor?.name, subDeptName: d.subDept?.name,
        adminEnabled: d.doctor?.administrativeExpenseEnabled, adminRate: d.doctor?.administrativeExpenseRate,
        amount: String(d.amount ?? 0), quantity: d.quantity || 1, isPaid: d.isPaid,
      })));
      setDiscount(String(v.discount || ''));
      setDiscountType('amount');
      setReceive(String(v.receive ?? ''));
      setAddPick('');
      setSavedOnce(false);
      setResults(null);
      const [cat, hist] = await Promise.all([
        api(`/opd/available-doctors?onCall=true&departmentName=${encodeURIComponent(v.department)}`).catch(() => []),
        api(`/opd/full-edit/${id}/logs`).catch(() => []),
      ]);
      setCatalog(Array.isArray(cat) ? cat : []);
      setLogs(Array.isArray(hist) ? hist : []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function addRow(catalogId) {
    const item = catalog.find((c) => String(c.id) === String(catalogId));
    if (!item) return;
    setRows((rs) => [...rs, {
      key: `n${Date.now()}`, id: null, doctorId: item.doctorId, subDeptId: item.subDeptId,
      doctorName: item.doctor?.name, subDeptName: item.subDept?.name,
      adminEnabled: item.doctor?.administrativeExpenseEnabled, adminRate: item.doctor?.administrativeExpenseRate,
      amount: String(item.normalCharges ?? 0), quantity: 1, isPaid: false,
    }]);
    setAddPick('');
  }

  function removeRow(row) {
    if (row.isPaid) {
      toast.error('Is line ki doctor fee voucher se pay ho chuki hai — yeh line hataayi nahi ja sakti (amount badal sakte hain)');
      return;
    }
    setRows((rs) => rs.filter((r) => r.key !== row.key));
  }

  // Preview of the same totals the backend will store.
  const totals = useMemo(() => {
    if (!form) return null;
    const isComplementary = form.paymentType === 'complementary';
    const gross = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const rawDisc = discountType === 'percent' ? Math.round((gross * (Number(discount) || 0)) / 100) : (Number(discount) || 0);
    const disc = isComplementary ? 0 : Math.min(Math.max(0, rawDisc), gross);
    const net = isComplementary ? 0 : Math.max(0, gross - disc);
    const adminByDoctor = new Map(rows.filter((r) => r.adminEnabled).map((r) => [r.doctorId, Number(r.adminRate) || 0]));
    const admin = isComplementary ? 0 : [...adminByDoctor.values()].reduce((s, x) => s + x, 0);
    const isCc = form.paymentType === 'cc';
    // keep the slip's own CC snapshot if it was already a CC slip
    const pct = isCc && !isComplementary ? (original?.paymentType === 'cc' ? Number(original.ccPercentage) : ccConfig.percentage) : 0;
    const min = isCc && !isComplementary ? (original?.paymentType === 'cc' ? Number(original.ccMinAmount) : ccConfig.minAmount) : 0;
    const cc = pct > 0 && net >= min ? Math.round((net * pct) / 100) : 0;
    const total = net + cc + admin;
    const rec = Number(receive) || 0;
    return { gross, disc, net, admin, cc, pct, min, total, refund: Math.max(0, rec - total), balance: Math.max(0, total - rec) };
  }, [form, rows, discount, discountType, receive, original, ccConfig]);

  async function handleSave() {
    if (!form.patientName.trim()) return toast.error('Patient name zaroori hai');
    if (!form.serialNo.trim()) return toast.error('Slip # zaroori hai');
    if (!rows.length) return toast.error('Kam az kam ek test/doctor zaroori hai');
    const bad = rows.find((r) => !(Number(r.amount) >= 0) || r.amount === '');
    if (bad) return toast.error(`${bad.subDeptName}: amount sahi likhein`);

    const changeLine = `Total ${fmt(original.totalAmount)} → ${fmt(totals.total)},  Received ${fmt(original.receive)} → ${fmt(receive)}`;
    const ok = await confirmDialog({
      title: warnings.length ? 'Warnings ke saath save karein?' : 'Slip save karein?',
      message: [...warnings.map((w) => `• ${w.message}`), '', changeLine].join('\n').trim(),
      confirmLabel: 'Save',
      danger: warnings.length > 0,
    });
    if (!ok) return;

    setSaving(true);
    try {
      const data = await api(`/opd/full-edit/${original.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          discount: totals.disc,
          receive: Number(receive) || 0,
          ccPercentage: totals.pct,
          ccMinAmount: totals.min,
          editedBy,
          doctors: rows.map((r) => ({ id: r.id, doctorId: r.doctorId, subDeptId: r.subDeptId, amount: Number(r.amount) || 0, quantity: r.quantity })),
        }),
      });
      toast.success('Slip update ho gayi');
      await loadSlip(data.visit.id);
      setSavedOnce(true);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePrint() {
    try {
      const { visit, tokenNo, isDuplicate } = await api(`/opd/reprint/${encodeURIComponent(original.serialNo)}`);
      const dept = String(visit.department || '').trim().toLowerCase();
      let html;
      if (dept === 'emergency') {
        html = buildEmergencyReceiptHtml({ visit, isDuplicate, printedBy: editedBy });
      } else {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, visit.serialNo, { format: 'CODE128', width: 2, height: 48, displayValue: true, fontSize: 11, margin: 4 });
        html = buildReceiptHtml({ visit, tokenNo, isDuplicate, barcodeDataUrl: canvas.toDataURL('image/png'), printedBy: editedBy });
      }
      const w = window.open('', '_blank', dept === 'emergency' ? 'width=740,height=900' : 'width=420,height=680');
      if (!w) return toast.error('Popup blocked — please allow popups for this site');
      w.document.write(html);
      w.document.close();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Catalog items not already on the slip (same doctor+test pair).
  const addOptions = useMemo(() => {
    const taken = new Set(rows.map((r) => `${r.doctorId}:${r.subDeptId}`));
    return catalog.filter((c) => !taken.has(`${c.doctorId}:${c.subDeptId}`));
  }, [catalog, rows]);

  useEffect(() => { setShowLogs(false); }, [original?.id]);

  const isPanel = form?.paymentType === 'panel';

  return (
    <div className="fse-page">
      <ClinicMenuBar />
      <div className="fse-body">
        <div className="fse-head">
          <div>
            <h1 className="fse-title">Full Slip Edit</h1>
            <p className="fse-sub">General OPD aur Emergency slips — sirf Super Admin. Har save ki history rakhi jati hai.</p>
          </div>
        </div>

        <form className="fse-search" onSubmit={handleSearch}>
          <Search size={16} className="fse-search__icon" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Slip #, MR # ya patient ka naam…" />
          <button type="submit" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
        </form>

        {results && (
          <div className="fse-card">
            {results.length === 0 ? (
              <p className="fse-empty">Koi General OPD / Emergency slip nahi mili.</p>
            ) : (
              <div className="table-wrap">
                <table className="fse-table">
                  <thead><tr><th>Slip #</th><th>Patient</th><th>Department</th><th>Date</th><th className="r">Received</th><th /></tr></thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id}>
                        <td>{r.serialNo}</td><td>{r.patientName}</td><td>{r.department}</td><td>{fmtDateTime(r.createdAt)}</td>
                        <td className="r">{fmt(r.receive)}</td>
                        <td className="r"><button type="button" className="fse-btn fse-btn--sm" onClick={() => loadSlip(r.id)}>Edit</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {loading && <p className="fse-empty">Loading…</p>}

        {form && original && !loading && (
          <>
            <div className="fse-card fse-meta">
              <span><b>{original.department}</b> · Slip {original.serialNo}</span>
              <span>Bani: {fmtDateTime(original.createdAt)} · {original.createdByName || '-'}</span>
              {original.adjustedAt && <span className="fse-chip">Pehle bhi adjust hui: {fmtDateTime(original.adjustedAt)}</span>}
              {String(original.status).toLowerCase().startsWith('cancel') && <span className="fse-chip fse-chip--red">Cancelled</span>}
            </div>

            {warnings.length > 0 && (
              <div className="fse-warn" role="alert">
                <div className="fse-warn__title"><AlertTriangle size={16} /> Dhyan dein — save ho sakti hai, lekin:</div>
                <ul>{warnings.map((w) => <li key={w.code}>{w.message}</li>)}</ul>
              </div>
            )}

            <div className="fse-card">
              <h2 className="fse-h2">Patient</h2>
              <div className="fse-grid">
                <label>Slip #<input value={form.serialNo} onChange={setF('serialNo')} /></label>
                <label>MR #<input value={form.mrNo} onChange={setF('mrNo')} inputMode="numeric" /></label>
                <label>Title
                  <select value={form.patientType} onChange={setF('patientType')}>
                    {[...new Set([form.patientType, ...PATIENT_TYPES])].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="fse-span2">Patient Name<input value={form.patientName} onChange={setF('patientName')} /></label>
                <label>Gender
                  <select value={form.gender} onChange={setF('gender')}>
                    <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                </label>
                <label>Age (Years)<input type="number" min="0" value={form.age} onChange={setF('age')} /></label>
                <label>Months<input type="number" min="0" max="11" value={form.ageMonths} onChange={setF('ageMonths')} /></label>
                <label>Days<input type="number" min="0" max="31" value={form.ageDays} onChange={setF('ageDays')} /></label>
                <label>Phone<input value={form.phoneNo} onChange={setF('phoneNo')} /></label>
                <label>Referred By<input value={form.referredBy} onChange={setF('referredBy')} /></label>
                {original.department === 'General OPD' && (
                  <label>Visit Type
                    <select value={form.visitType} onChange={setF('visitType')}>
                      <option value="opd">OPD</option><option value="procedure">Procedure</option><option value="vaccination">Vaccination</option>
                    </select>
                  </label>
                )}
                <label>Admission #<input value={form.admitNo} onChange={setF('admitNo')} placeholder="(khali = admission nahi)" /></label>
                <label className="fse-check">
                  <input type="checkbox" checked={form.adjustPayment} disabled={!form.admitNo} onChange={(e) => setForm((f) => ({ ...f, adjustPayment: e.target.checked }))} />
                  Adjust Payment (admission bill)
                </label>
              </div>
              {(original.panelCompanyName || original.employeeName) && (
                <p className="fse-note">
                  {original.panelCompanyName && <>Panel: <b>{original.panelCompanyName}</b>{original.panelEmployeeName ? ` / ${original.panelEmployeeName}` : ''}. </>}
                  {original.employeeName && <>Staff: <b>{original.employeeName}</b>. </>}
                  Panel/Staff link yahan se nahi badla jata.
                </p>
              )}
            </div>

            <div className="fse-card">
              <h2 className="fse-h2">Tests / Doctors</h2>
              <div className="table-wrap">
                <table className="fse-table">
                  <thead><tr><th>Test / Service</th><th>Doctor</th><th className="r">Qty</th><th className="r">Amount</th><th /></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key}>
                        <td>{r.subDeptName}{r.isPaid && <span className="fse-chip fse-chip--amber">Fee paid</span>}{!r.id && <span className="fse-chip">Nayi</span>}</td>
                        <td>{r.doctorName}{r.adminEnabled ? <span className="fse-muted"> (+admin {fmt(r.adminRate)})</span> : null}</td>
                        <td className="r">
                          <input className="fse-num" type="number" min="1" value={r.quantity}
                            onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))} />
                        </td>
                        <td className="r">
                          <input className="fse-num" type="number" min="0" step="0.01" value={r.amount}
                            onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, amount: e.target.value } : x)))} />
                        </td>
                        <td className="r">
                          <button type="button" className="fse-icon-btn" onClick={() => removeRow(r)} aria-label={`Remove ${r.subDeptName}`} title={r.isPaid ? 'Fee paid — hataayi nahi ja sakti' : 'Remove'} disabled={r.isPaid}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="fse-add">
                <Plus size={16} />
                <SearchableSelect
                  options={addOptions}
                  value={addPick}
                  onChange={(v) => addRow(v)}
                  getKey={(c) => c.id}
                  getLabel={(c) => `${c.subDept?.name || ''} — ${c.doctor?.name || ''} (${fmt(c.normalCharges)})`}
                  placeholder={`${original.department} ka test / doctor add karein…`}
                  emptyText="Koi test nahi mila"
                />
              </div>
              <p className="fse-note">Amount line ka poora total hai (quantity samet), jaise slip banate waqt hota hai.</p>
            </div>

            <div className="fse-card">
              <h2 className="fse-h2">Payment</h2>
              <div className="fse-grid">
                <label>Payment Type
                  <select value={form.paymentType} onChange={setF('paymentType')} disabled={isPanel && original.paymentType === 'panel'}>
                    {PAYMENT_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </label>
                <label>Discount
                  <div className="fse-inline">
                    <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                    <div className="fse-toggle">
                      <button type="button" className={discountType === 'amount' ? 'on' : ''} onClick={() => setDiscountType('amount')}>PKR</button>
                      <button type="button" className={discountType === 'percent' ? 'on' : ''} onClick={() => setDiscountType('percent')}>%</button>
                    </div>
                  </div>
                </label>
                <label>Received<input type="number" min="0" value={receive} onChange={(e) => setReceive(e.target.value)} /></label>
              </div>

              <div className="fse-totals">
                <div><span>Tests total</span><b>{fmt(totals.gross)}</b></div>
                <div><span>Discount</span><b>− {fmt(totals.disc)}</b></div>
                {totals.admin > 0 && <div><span>Administrative Expense</span><b>+ {fmt(totals.admin)}</b></div>}
                {totals.cc > 0 && <div><span>Credit Card ({totals.pct}%)</span><b>+ {fmt(totals.cc)}</b></div>}
                <div className="fse-totals__grand"><span>Slip Total</span><b>{fmt(totals.total)}</b><em>pehle {fmt(original.totalAmount)}</em></div>
                <div><span>Received</span><b>{fmt(receive)}</b><em>pehle {fmt(original.receive)}</em></div>
                {totals.refund > 0 && <div><span>Refund</span><b>{fmt(totals.refund)}</b></div>}
                {totals.balance > 0 && <div><span>Balance</span><b>{fmt(totals.balance)}</b></div>}
              </div>
            </div>

            <div className="fse-actions">
              <button type="button" className="fse-btn fse-btn--ghost" onClick={() => setShowLogs((s) => !s)}>
                <History size={15} /> History ({logs.length})
              </button>
              <button type="button" className="fse-btn fse-btn--ghost" onClick={handlePrint}>
                <Printer size={15} /> {savedOnce ? 'Nayi slip print karein' : 'Print'}
              </button>
              <button type="button" className="fse-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Slip'}
              </button>
            </div>

            {showLogs && (
              <div className="fse-card">
                <h2 className="fse-h2">Edit History</h2>
                {logs.length === 0 ? <p className="fse-empty">Is slip ki koi edit history nahi.</p> : (
                  <div className="table-wrap">
                    <table className="fse-table">
                      <thead><tr><th>Kab</th><th>Kis ne</th><th className="r">Total</th><th className="r">Received</th><th>Tests</th></tr></thead>
                      <tbody>
                        {logs.map((l) => (
                          <tr key={l.id}>
                            <td>{fmtDateTime(l.editedAt)}</td>
                            <td>{l.editedBy || '-'}</td>
                            <td className="r">{fmt(l.before?.totalAmount)} → {fmt(l.after?.totalAmount)}</td>
                            <td className="r">{fmt(l.before?.receive)} → {fmt(l.after?.receive)}</td>
                            <td>{(l.after?.doctors || []).map((d) => d.subDept).join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
