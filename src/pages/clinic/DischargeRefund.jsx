import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, DoorOpen, Save, Copy, RotateCcw, FileText, Printer, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import { useAuthStore } from '../../store/useAuthStore';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';
import './Admission.scss';
import './AdmissionAdjustment.scss';
import './DischargeRefund.scss';

// Laboratory/Radiology(X-Ray)/Ultra Sound — a doctor's fee % is uniform
// across every test they do there, so the Sub-Department auto-resolves with
// no picker AND no display (which one it landed on is arbitrary/first-match,
// not a meaningful choice, so showing it would just be confusing). Const Fee
// keeps its Sub-Department visible since which consultant/specialty it was
// genuinely matters there.
// Matched by department NAME, not id — the numeric ClinicDepartment id is
// per-database (auto-increment order differs across dev/server installs), so
// hardcoding ids here would silently break on any other deployment.
const NO_SUBDEPT_PICKER_DEPT_NAMES = ['LABORATORY', 'RADIOLOGY', 'ULTRA SOUND, ECHO & COLOR DOPPLER'];
const isNoPickerDept = (name) => !!name && NO_SUBDEPT_PICKER_DEPT_NAMES.includes(String(name).trim().toUpperCase());

// Rows snapshot-imported from that admission's Provisional Bill (once, the
// first time this page opens it) are tagged so the table can show where each
// line came from — plain "manual" rows (added on this page itself) get no tag.
const SOURCE_LABELS = {
  provisional: 'Bill Head',
  ward: 'Ward',
  diagnostic: 'Diagnostic',
  pharmacy: 'Pharmacy',
  'surgery-expense': 'Voucher Expense',
  'hospital-share': 'Auto',
};

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  const time  = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day}-${month}-${year} ${time}`;
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${dt.toLocaleString('en-GB', { month: 'short' })}-${dt.getFullYear()}`;
}
function fmt2(n) { return Number(n || 0).toFixed(2); }

// Mirrors the backend's calcFeeSplit — used only for the live preview while
// filling the Add Row form; the server recomputes authoritatively on save.
function calcFeeSplitPreview(amount, paymentType, normalFees) {
  const fee = paymentType === 'percent' ? (amount * (Number(normalFees) || 0)) / 100 : (Number(normalFees) || 0);
  return { doctorFee: fee, hospitalShare: amount - fee };
}

function numToWords(n) {
  if (n === 0) return 'zero';
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function cvt(num) {
    if (num === 0) return '';
    if (num < 20) return ones[num] + ' ';
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? '-' + ones[num % 10] : '') + ' ';
    if (num < 1000) return ones[Math.floor(num / 100)] + ' hundred ' + cvt(num % 100);
    if (num < 100000) return cvt(Math.floor(num / 1000)) + 'thousand ' + cvt(num % 1000);
    return cvt(Math.floor(num / 100000)) + 'lakh ' + cvt(num % 100000);
  }
  return cvt(Math.abs(Math.floor(n))).trim();
}

// `@page` is a document-level rule shared across the whole bundled app — inject
// an override right before printing (same technique as Admission/Provisional
// Bill) so this page's print isn't silently overridden by another page's rule.
function printDischargeBill() {
  const styleId = 'dr-page-size-override';
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = '@page { size: A4 portrait !important; margin: 30mm 10mm !important; }';

  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000);

  window.print();
}

// ── Admission Lookup Modal — only admissions already 'discharge'd (patient
// leaves via the Discharge Certificate now, not here — see below) ─────────────
function AdmissionLookupModal({ onSelect, onClose, searchAdmissions }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    searchAdmissions('')
      .then((data) => setRows(data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [searchAdmissions]);

  function handleQueryChange(val) {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      searchAdmissions(val)
        .then((data) => setRows(data || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 300);
  }

  return (
    <div className="aa-overlay">
      <div className="aa-modal">
        <div className="aa-modal-hdr">
          <span>Select Discharged Patient</span>
          <button className="aa-modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="aa-modal-search">
          <Search size={13} className="aa-modal-search-icon" />
          <input
            autoFocus
            className="aa-modal-search-input"
            placeholder="Search Admission # or Patient Name…"
            value={q}
            onChange={e => handleQueryChange(e.target.value)}
          />
        </div>
        <div className="aa-modal-body">
          {loading ? (
            <div className="aa-modal-loading">Loading…</div>
          ) : (
            <table className="aa-modal-tbl">
              <thead>
                <tr>
                  <th>Admission #</th>
                  <th>Patient</th>
                  <th>Admission Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} onClick={() => onSelect(r)}>
                    <td>{r.admissionNo}</td>
                    <td>{r.patientName}</td>
                    <td>{fmtDateTime(r.createdAt)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={3} className="aa-td-empty">Koi discharged patient nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Print Template ─────────────────────────────────────────────────────────────
function DischargeBillPrintTemplate({ detail, isDuplicate, printedBy }) {
  if (!detail) return null;
  const { admission, roomCategory, bed, billItems, paymentHistory, amountReceived, billAmount, discountAmount, balance, refund } = detail;

  const now = admission.createdAt ? new Date(admission.createdAt) : new Date();
  const dateStr = `${fmtDate(now)} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  const words = balance > 0 ? numToWords(Math.floor(balance)) : (refund > 0 ? numToWords(Math.floor(refund)) : 'zero');

  return (
    <div className="dr-print">
      <div className="dr-print-logo-box">
        <img src={RECEIPT_LOGO_DATA_URI} alt="Darul Shifa" className="dr-print-logo" />
      </div>

      <div className="dr-print-title-row">
        <span className="dr-print-title">DISCHARGE AND REFUND BILL</span>
        {isDuplicate && <span className="dr-print-duplicate">Duplicate</span>}
      </div>

      <table className="dr-print-hdr-tbl">
        <tbody>
          <tr>
            <td className="l">Patient:</td>
            <td className="v">{admission.patientTitle} {admission.patientName}</td>
            <td className="l">Admission #:</td>
            <td className="v">{admission.admissionNo}</td>
            <td className="l">Date:</td>
            <td className="v">{dateStr}</td>
          </tr>
          <tr>
            <td className="l">S/o.</td>
            <td className="v">{admission.responsibleParty || '—'}</td>
            <td className="l">Category:</td>
            <td className="v">{roomCategory?.name || '—'}</td>
            <td className="l">Room#:</td>
            <td className="v">{bed?.name || '—'}</td>
          </tr>
        </tbody>
      </table>

      <div className="dr-print-section-hdr">Payment History</div>
      <table className="dr-print-pay-tbl">
        <thead><tr><th>Date &amp; Time</th><th>Slip#</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {paymentHistory.map((p, i) => (
            <tr key={i}><td>{fmtDateTime(p.date)}</td><td>{p.slipNo}</td><td className="r">{fmt2(p.amount)}</td></tr>
          ))}
          <tr className="dr-print-grand"><td colSpan={2}>Grand Total:</td><td className="r">{fmt2(amountReceived)}</td></tr>
        </tbody>
      </table>

      <div className="dr-print-section-hdr">Discharge Bill</div>
      <table className="dr-print-items-tbl">
        <thead><tr><th>Heads</th><th>Dr./Staff</th><th className="r">Amount</th></tr></thead>
        <tbody>
          {billItems.map((i) => (
            <tr key={i.id}>
              <td>{i.billHead?.description || i.billHead?.headCode || i.description || '—'}</td>
              <td>{i.doctor?.name || '—'}</td>
              <td className="r">{fmt2(i.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="dr-print-summary-tbl">
        <tbody>
          <tr><td className="l">Bill Amount:</td><td className="r">{fmt2(billAmount)}</td></tr>
          <tr><td className="l">Discount:</td><td className="r">{fmt2(discountAmount)}</td></tr>
          <tr><td className="l">Received Amount:</td><td className="r">{fmt2(amountReceived)}</td></tr>
          <tr><td className="l">Refund Amount:</td><td className="r">{fmt2(refund)}</td></tr>
          <tr className="dr-print-balance-row">
            <td className="l"><strong>Balance Amount:</strong></td>
            <td className="r"><strong>{fmt2(balance)}</strong></td>
          </tr>
        </tbody>
      </table>

      <div className="dr-print-words">
        {balance > 0 ? 'Balance' : 'Refund'} Amount: RS. {words.toUpperCase()} ONLY.
      </div>

      <div className="dr-print-sig">
        <span className="dr-print-sig-name">{printedBy || ''}</span>
        <span className="dr-print-sig-lbl">Prepared By</span>
      </div>
    </div>
  );
}

export default function DischargeRefund() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const printedBy = user?.name || user?.username || user?.email || '';

  const {
    billHeads, fetchBillHeads,
    doctors, fetchDoctors,
    fetchDoctorSubDeptsForDepartment,
    searchAdmissionsForDischargeRefund,
    // Reused (any-status) search for Reprint specifically — a closed file's
    // Final Bill must still be reprintable, unlike the normal admission
    // lookup below which deliberately only shows 'discharge' status (once
    // closed, there's nothing left to add/edit there).
    searchAdmissionsForProvisionalBill,
    fetchDischargeBillDetail,
    addDischargeBillItem,
    updateDischargeBillItem,
    deleteDischargeBillItem,
    finalizeDischarge,
  } = useClinicStore();

  const [detail, setDetail] = useState(null);
  const [admissionId, setAdmissionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLookup, setShowLookup] = useState(true);
  const [isDuplicate, setIsDuplicate] = useState(false);

  const [discount, setDiscount] = useState('0');
  const [saving, setSaving] = useState(false);

  const [row, setRow] = useState({ billHeadId: '', doctorId: '', subDeptId: '', amount: '' });
  const [addingRow, setAddingRow] = useState(false);

  // Const Fee/Laboratory/Ultrasound/X-Ray heads (Bill Head has a
  // refDepartmentId) split Amount between doctor and hospital — once both a
  // matching head and a doctor are picked, that doctor's own sub-departments
  // within that head's department load here so the right Normal Fees rate
  // can be used.
  const [subDeptOptions, setSubDeptOptions] = useState([]);
  const [loadingSubDepts, setLoadingSubDepts] = useState(false);

  // Click-to-edit Amount — works on every row (manually added or
  // snapshot-imported from Provisional Bill alike), same pattern as
  // Provisional Bill's Ward History rate edit.
  const [amountEdit, setAmountEdit] = useState(null); // { itemId, value } | null
  const [savingAmount, setSavingAmount] = useState(false);

  const [reprintReady, setReprintReady] = useState(false);

  useEffect(() => {
    fetchBillHeads();
    fetchDoctors();
  }, [fetchBillHeads, fetchDoctors]);

  const loadDetail = useCallback(async (id) => {
    setLoading(true);
    try {
      const d = await fetchDischargeBillDetail(id);
      setDetail(d);
      setAdmissionId(d.admission.id);
      setDiscount(String(d.discountAmount || 0));
      return d;
    } catch (e) {
      toast.error(e.message || 'Discharge bill load nahi hui');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchDischargeBillDetail]);

  async function handleSelect(row_) {
    setShowLookup(false);
    await loadDetail(row_.id);
  }

  // Reprint (Report > Reprint > Final Bill): ?admissionNo=...&autoprint=1 —
  // same pattern as Provisional Bill / Discharge Certificate's reprint entry.
  useEffect(() => {
    const admissionNo = searchParams.get('admissionNo');
    const autoprint = searchParams.get('autoprint');
    if (!admissionNo) return;
    (async () => {
      try {
        const rows = await searchAdmissionsForProvisionalBill(admissionNo);
        const match = rows.find(r => r.admissionNo === admissionNo) || rows[0];
        if (!match) { toast.error('Is Admission # ka koi record nahi mila'); return; }
        setShowLookup(false);
        const d = await loadDetail(match.id);
        if (autoprint && d) { setIsDuplicate(true); setReprintReady(true); }
      } catch {
        toast.error('Final Bill reprint lookup failed');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!reprintReady) return;
    const t = setTimeout(() => { printDischargeBill(); setReprintReady(false); }, 300);
    return () => clearTimeout(t);
  }, [reprintReady]);

  function resetToLookup() {
    setAdmissionId(null);
    setDetail(null);
    setDiscount('0');
    setAmountEdit(null);
    setShowLookup(true);
  }

  const finalHeads = billHeads.filter(h => h.type === 'final' || h.type === 'both');
  const selectedHead = finalHeads.find(h => String(h.id) === String(row.billHeadId));
  const isSplitHead = !!selectedHead?.refDepartmentId;
  const skipSubDeptPicker = isSplitHead && isNoPickerDept(selectedHead.refDepartment?.name);
  const selectedSubDept = subDeptOptions.find(s => String(s.subDeptId) === String(row.subDeptId));
  const previewSplit = selectedSubDept
    ? calcFeeSplitPreview(Number(row.amount) || 0, selectedSubDept.paymentType, selectedSubDept.normalFees)
    : null;

  // Doctor changes (or the head itself changes away from a split head) —
  // Sub-Department is only ever meaningful for the current doctor+head pair.
  useEffect(() => {
    setRow(r => ({ ...r, subDeptId: '' }));
    setSubDeptOptions([]);
    if (!isSplitHead || !row.doctorId) return;
    setLoadingSubDepts(true);
    fetchDoctorSubDeptsForDepartment(row.doctorId, selectedHead.refDepartmentId)
      .then(rows => {
        setSubDeptOptions(rows || []);
        // Auto-pick the first match when there's no real choice to make
        // (Lab/X-Ray/Ultrasound — same rate on every entry) or when there's
        // only one match anyway (the common Const Fee case).
        if (rows?.length && (skipSubDeptPicker || rows.length === 1)) {
          setRow(r => ({ ...r, subDeptId: String(rows[0].subDeptId) }));
        }
      })
      .catch(() => setSubDeptOptions([]))
      .finally(() => setLoadingSubDepts(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.doctorId, row.billHeadId]);

  async function handleAddRow() {
    if (!row.billHeadId) return toast.error('Heads select karo');
    if (isSplitHead && (!row.doctorId || !row.subDeptId)) {
      return toast.error(`${selectedHead.description} ke liye Doctor aur Sub-Department dono select karo`);
    }
    const amt = Number(row.amount) || 0;
    if (amt <= 0) return toast.error('Amount 0 se zyada honi chahiye');
    setAddingRow(true);
    try {
      await addDischargeBillItem(admissionId, row);
      setRow({ billHeadId: '', doctorId: row.doctorId, subDeptId: '', amount: '' });
      await loadDetail(admissionId);
    } catch (e) {
      toast.error(e.message || 'Row add nahi hui');
    } finally {
      setAddingRow(false);
    }
  }

  async function handleDeleteRow(itemId) {
    try {
      await deleteDischargeBillItem(itemId);
      await loadDetail(admissionId);
    } catch (e) {
      toast.error(e.message || 'Row delete nahi hui');
    }
  }

  async function handleSaveAmount() {
    if (!amountEdit) return;
    const amt = Number(amountEdit.value);
    if (!Number.isFinite(amt) || amt < 0) { toast.error('Amount valid number honi chahiye'); return; }
    setSavingAmount(true);
    try {
      await updateDischargeBillItem(amountEdit.itemId, { amount: amt });
      setAmountEdit(null);
      await loadDetail(admissionId);
    } catch (e) {
      toast.error(e.message || 'Amount save nahi hui');
    } finally {
      setSavingAmount(false);
    }
  }

  async function handleFinalize() {
    // Balance must be fully cleared before the file can be closed (backend
    // also re-checks this — this is just so staff get an immediate, specific
    // message instead of clicking a plain-disabled button).
    if (liveBalance > 0) {
      toast.error(`Balance Amount Rs. ${fmt2(liveBalance)} baaki hai — pehle clear karo`);
      return;
    }
    setSaving(true);
    try {
      await finalizeDischarge(admissionId, { discountAmount: Number(discount) || 0, changedBy: printedBy });
      toast.success('File close ho gayi');
      resetToLookup();
    } catch (e) {
      toast.error(e.message || 'Finalize nahi ho saka');
    } finally {
      setSaving(false);
    }
  }

  const netAmount = detail ? Math.max(0, detail.billAmount - (Number(discount) || 0)) : 0;
  const liveBalance = detail ? Math.max(0, netAmount - detail.amountReceived) : 0;
  const liveRefund = detail ? Math.max(0, detail.amountReceived - netAmount) : 0;

  return (
    <>
      {showLookup && (
        <AdmissionLookupModal
          onSelect={handleSelect}
          onClose={() => navigate(-1)}
          searchAdmissions={searchAdmissionsForDischargeRefund}
        />
      )}

      <div className="adm-page">
        <ClinicMenuBar />

        <div className="aa-toolbar">
          <div className="aa-toolbar-icons">
            <span className="aa-tbtn aa-tbtn--disabled"><Save size={16} /></span>
            <span className="aa-tbtn aa-tbtn--disabled"><Copy size={16} /></span>
            <span className="aa-tbtn aa-tbtn--disabled"><RotateCcw size={16} /></span>
            <button className="aa-tbtn aa-tbtn--exit" onClick={() => navigate(-1)} title="Exit">
              <DoorOpen size={16} />
            </button>
            <span className="aa-tbtn aa-tbtn--disabled"><FileText size={16} /></span>
            <button className="aa-tbtn" onClick={() => { setIsDuplicate(true); printDischargeBill(); }} disabled={!detail} title="Print">
              <Printer size={16} />
            </button>
          </div>
          <span className="aa-toolbar-title">Discharge and Refund</span>
        </div>

        {loading && <div className="aa-loading">Loading…</div>}

        {!loading && detail && (
          <div className="dr-body">
            <div className="dr-card">
              <div className="dr-hdr-row">
                <label className="dr-hdr-lbl">Admission #</label>
                <div className="dr-hdr-value">{detail.admission.admissionNo}</div>
                <button className="dr-lookup-btn" onClick={() => setShowLookup(true)} title="Search admissions">
                  <Search size={13} />
                </button>
                <span className="dr-inline-patient">{detail.admission.patientTitle} {detail.admission.patientName}</span>
                <span className="dr-status-badge">Discharged</span>
              </div>

              <div className="dr-info-row">
                <div><label>Name</label><span>{detail.admission.patientTitle} {detail.admission.patientName}</span></div>
                <div><label>S/o, W/o, D/o</label><span>{detail.admission.responsibleParty || '—'}</span></div>
                <div><label>Room #</label><span>{detail.bed?.name || '—'}</span></div>
                {detail.admission.patientCategory === 'panel' && (
                  <div><label>Company</label><span>{detail.company ? `${detail.company.code} — ${detail.company.name}` : '—'}</span></div>
                )}
              </div>

              <div className="dr-separator" />

              <table className="dr-table">
                <thead>
                  <tr><th>Date &amp; Time</th><th>Receipt #</th><th className="r">Amount</th></tr>
                </thead>
                <tbody>
                  {detail.paymentHistory.map((p, i) => (
                    <tr key={i}><td>{fmtDateTime(p.date)}</td><td>{p.slipNo}</td><td className="r">{fmt2(p.amount)}</td></tr>
                  ))}
                  {!detail.paymentHistory.length && (
                    <tr><td colSpan={3} className="dr-empty">Koi payment nahi mili</td></tr>
                  )}
                </tbody>
              </table>

              <div className="dr-summary-row">
                <span>Discount <input className="dr-discount-input" value={discount} onChange={e => setDiscount(e.target.value)} /></span>
                <span>Amount Received <b>{fmt2(detail.amountReceived)}</b></span>
                <span>Refund <b>{fmt2(liveRefund)}</b></span>
                <span>Balance <b>{fmt2(liveBalance)}</b></span>
              </div>

              <div className="dr-separator" />

              <div className="dr-section-title">Discharge Bill</div>

              <div className="dr-add-form">
                <div className="dr-form-row">
                  <div className="dr-fg dr-fg--full">
                    <label>Heads</label>
                    <SearchableSelect
                      options={finalHeads}
                      value={row.billHeadId}
                      onChange={val => setRow(r => ({ ...r, billHeadId: val }))}
                      placeholder="— Select —"
                      getLabel={h => `${h.headCode} — ${h.description}`}
                      getKey={h => h.id}
                    />
                  </div>
                  <div className="dr-fg dr-fg--sm">
                    <label>Amount</label>
                    <input value={row.amount} onChange={e => setRow(r => ({ ...r, amount: e.target.value }))} />
                  </div>
                  <button className="dr-add-btn" onClick={handleAddRow} disabled={addingRow}>
                    <Plus size={14} /> Add
                  </button>
                </div>
                <div className="dr-form-row">
                  <div className="dr-fg dr-fg--full">
                    <label>Dr./Staff{isSplitHead ? ' *' : ''}</label>
                    <SearchableSelect
                      options={doctors.filter(d => d.status === 'active')}
                      value={row.doctorId}
                      onChange={val => setRow(r => ({ ...r, doctorId: val }))}
                      placeholder="— Select —"
                      getLabel={d => `${d.code} — ${d.name}`}
                      getKey={d => d.id}
                    />
                  </div>
                  {/* Laboratory/Ultrasound/X-Ray never show a picker at all — the
                      doctor's rate is the same across every test there, so it
                      just resolves silently in the background (see the effect
                      above). Const Fee keeps the picker since different
                      consultants/specialties genuinely have different rates —
                      it only appears when there's more than one match, same
                      auto-skip as the Surgery/Anesthesia payee selector. */}
                  {isSplitHead && !skipSubDeptPicker && row.doctorId && loadingSubDepts && (
                    <div className="dr-fg dr-fg--full"><label>Sub-Department *</label><span className="dr-subdept-note">Loading…</span></div>
                  )}
                  {isSplitHead && row.doctorId && !loadingSubDepts && subDeptOptions.length === 0 && (
                    <div className="dr-fg dr-fg--full">
                      <label>Sub-Department *</label>
                      <span className="dr-subdept-note dr-subdept-note--warn">
                        Is doctor ki {selectedHead?.description} ke liye koi fees set nahi hai
                      </span>
                    </div>
                  )}
                  {isSplitHead && !skipSubDeptPicker && !loadingSubDepts && subDeptOptions.length === 1 && (
                    <div className="dr-fg dr-fg--full">
                      <label>Sub-Department</label>
                      <span className="dr-subdept-note">{subDeptOptions[0].subDeptName} (auto)</span>
                    </div>
                  )}
                  {isSplitHead && !skipSubDeptPicker && !loadingSubDepts && subDeptOptions.length > 1 && (
                    <div className="dr-fg dr-fg--full">
                      <label>Sub-Department *</label>
                      <select
                        value={row.subDeptId}
                        onChange={e => setRow(r => ({ ...r, subDeptId: e.target.value }))}
                      >
                        <option value="">— Select —</option>
                        {subDeptOptions.map(s => (
                          <option key={s.subDeptId} value={s.subDeptId}>{s.subDeptCode} — {s.subDeptName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {isSplitHead && previewSplit && (
                  <div className="dr-split-preview">
                    Doctor Fee <b>{fmt2(previewSplit.doctorFee)}</b>
                    <span className="dr-split-sep">+</span>
                    Hospital Share <b>{fmt2(previewSplit.hospitalShare)}</b>
                  </div>
                )}
              </div>

              <table className="dr-table">
                <thead>
                  <tr>
                    <th>Heads / Description</th>
                    <th>Source</th>
                    <th className="r">Qty</th>
                    <th className="r">Rate</th>
                    <th className="r">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {detail.billItems.map(i => {
                    const isEditing = amountEdit?.itemId === i.id;
                    return (
                      <tr key={i.id}>
                        {/* Amount here is already just the doctor's fee (see backend) —
                            its matching Hospital Share isn't repeated per-row, it only
                            shows once, combined, in the single "Hospital Share" row below. */}
                        <td>{i.billHead?.description || i.billHead?.headCode || i.description || '—'}</td>
                        <td>
                          {i.doctor?.name || SOURCE_LABELS[i.source] || ''}
                          {/* Lab/X-Ray/Ultrasound auto-pick whichever test happened to be
                              first — not a meaningful choice, so it stays hidden. Const Fee's
                              Sub-Department (which consultant/specialty) is worth showing. */}
                          {i.subDept?.name && !isNoPickerDept(i.billHead?.refDepartment?.name) && (
                            <div className="dr-td-sub-line">{i.subDept.name}</div>
                          )}
                        </td>
                        <td className="r">{i.qty}</td>
                        <td className="r">{fmt2(i.rate)}</td>
                        <td className="r dr-amount-cell">
                          {i.readOnly ? (
                            fmt2(i.amount)
                          ) : isEditing ? (
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              step="0.01"
                              className="dr-amount-input"
                              value={amountEdit.value}
                              disabled={savingAmount}
                              onChange={(e) => setAmountEdit((s) => ({ ...s, value: e.target.value }))}
                              onBlur={handleSaveAmount}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handleSaveAmount(); }
                                if (e.key === 'Escape') setAmountEdit(null);
                              }}
                            />
                          ) : (
                            <span
                              className="dr-amount-display"
                              title="Click to edit amount"
                              onClick={() => setAmountEdit({ itemId: i.id, value: String(i.amount) })}
                            >
                              {fmt2(i.amount)}
                            </span>
                          )}
                        </td>
                        <td>
                          {!i.readOnly && (
                            <button className="dr-del" onClick={() => handleDeleteRow(i.id)} title="Delete">✕</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!detail.billItems.length && (
                    <tr><td colSpan={6} className="dr-empty">Koi row add nahi hui</td></tr>
                  )}
                </tbody>
              </table>

              <div className="dr-bill-amount">Bill Amount <span>{fmt2(detail.billAmount)}</span></div>
            </div>

            <div className="dr-footer">
              <button
                className="dr-finalize-btn"
                onClick={handleFinalize}
                disabled={saving || liveBalance > 0}
                title={liveBalance > 0 ? `Balance Amount Rs. ${fmt2(liveBalance)} baaki hai` : ''}
              >
                {saving ? 'Saving…' : 'Close File'}
              </button>
              <button className="dr-close-btn" onClick={resetToLookup} disabled={saving}>Select Another Admission</button>
            </div>
          </div>
        )}
      </div>

      <div className="dr-print-area">
        {/* discountAmount/balance/refund overridden with the live (currently
            typed, not-yet-saved) figures — detail's own values only get
            updated once Close File actually runs, so printing beforehand
            must not show stale/zeroed-out numbers. */}
        <DischargeBillPrintTemplate
          detail={detail ? { ...detail, discountAmount: Number(discount) || 0, balance: liveBalance, refund: liveRefund } : detail}
          isDuplicate={isDuplicate}
          printedBy={printedBy}
        />
      </div>
    </>
  );
}
