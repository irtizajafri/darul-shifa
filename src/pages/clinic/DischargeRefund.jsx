import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, DoorOpen, Printer, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import { useAuthStore } from '../../store/useAuthStore';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { buildDischargeBillPrintHtml } from './dischargeBillPrintUtils';
import './Admission.scss';
import './AdmissionAdjustment.scss';
import { relationParts } from './relationText';
import './DischargeRefund.scss';
import { openPrintWindow } from '../../utils/printRelay';
import { useShallow } from 'zustand/react/shallow';
import useModalKeys from '../../hooks/useModalKeys';

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Close File asks which date the file closes on — today, or any custom
// date (past or future). That date becomes the file's Closing Date.
function CloseDateModal({ onConfirm, onCancel }) {
  const today = localToday();
  const [mode, setMode] = useState('today');
  const [date, setDate] = useState(today);
  const confirm = () => {
    const picked = mode === 'today' ? today : date;
    if (!picked) { toast.error('Closing Date select karein'); return; }
    onConfirm(picked);
  };
  useModalKeys({ active: true, onEsc: onCancel });
  const fmtDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="aa-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="aa-modal dr-close-date-modal">
        <div className="aa-modal-hdr">
          <span>File kis date pe close karni hai?</span>
          <button className="aa-modal-close" onClick={onCancel}><X size={14} /></button>
        </div>
        <div className="dr-close-date-body">
          <label className="dr-close-date-opt">
            <input type="radio" name="closeDateMode" checked={mode === 'today'} onChange={() => setMode('today')} autoFocus />
            Current Date <span className="dr-close-date-hint">({fmtDay(today)})</span>
          </label>
          <label className="dr-close-date-opt">
            <input type="radio" name="closeDateMode" checked={mode === 'custom'} onChange={() => setMode('custom')} />
            Custom Date
          </label>
          {mode === 'custom' && (
            <input
              type="date"
              className="dr-close-date-input"
              value={date}
              onChange={e => setDate(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirm(); }}
              autoFocus
            />
          )}
        </div>
        <div className="dr-close-date-actions">
          <button className="dr-finalize-btn" onClick={confirm}>Close File</button>
          <button className="dr-close-btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

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
  slip: 'Slip',
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
function fmt2(n) { return Number(n || 0).toFixed(2); }
function fmtDay(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
}

// Slip rows (Lab / Radiology / Ultrasound / Blood Bank — one per test) print
// their department once as a header, where its first slip sits, with every
// test underneath as its own editable line (owner, 2026-10-26).
function groupSlipRows(items) {
  const out = [];
  const headers = new Map();
  items.forEach((i) => {
    if (i.source !== 'slip') { out.push({ kind: 'item', item: i }); return; }
    const dept = i.slip?.department || 'Slip';
    let h = headers.get(dept);
    if (!h) { h = { kind: 'slip-header', key: `slip-h-${dept}`, dept, lines: [] }; headers.set(dept, h); out.push(h); }
    h.lines.push({ kind: 'item', item: i, slipLine: i.slip ? `Slip ${i.slip.serialNo} · ${fmtDay(i.slip.date)}` : 'Slip' });
  });
  return out.flatMap((r) => (r.kind === 'slip-header' ? [r, ...r.lines] : [r]));
}

// Mirrors the backend's calcFeeSplit — used only for the live preview while
// filling the Add Row form; the server recomputes authoritatively on save.
function calcFeeSplitPreview(amount, paymentType, normalFees) {
  const fee = paymentType === 'percent' ? (amount * (Number(normalFees) || 0)) / 100 : (Number(normalFees) || 0);
  return { doctorFee: fee, hospitalShare: amount - fee };
}

// ── Admission Lookup Modal — only admissions already 'discharge'd (patient
// leaves via the Discharge Certificate now, not here — see below) ─────────────
// opd (Panels → Transaction → Distribution OPD): closed OPD Bills instead.
function AdmissionLookupModal({ onSelect, onClose, searchAdmissions, category, opd = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    searchAdmissions('', category)
      .then((data) => setRows(data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [searchAdmissions, category]);

  function handleQueryChange(val) {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      searchAdmissions(val, category)
        .then((data) => setRows(data || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 300);
  }

  return (
    <div className="aa-overlay">
      <div className="aa-modal">
        <div className="aa-modal-hdr">
          <span>{opd ? 'Select OPD Bill — closed OPD Bills' : `Select Discharged Patient — ${category === 'panel' ? 'Panel' : 'Cash'}`}</span>
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
                  <th>{opd ? 'Slip #' : 'Admission #'}</th>
                  <th>Patient</th>
                  <th>{opd ? 'OPD Bill Date' : 'Admission Date'}</th>
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
                  <tr><td colSpan={3} className="aa-td-empty">{opd ? 'Koi closed OPD Bill nahi mila' : 'Koi discharged patient nahi mila'}</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// One screen, two doors (owner, 2026-10-27): Billing → Discharge and Refund
// is Cash files only, Panels → Transaction → Distribution (`panel`) is Panel
// files only — same rule as Provisional Bill. A file of the other kind is
// refused with a message pointing to the right menu. The print stays the
// Itemised Medical Bill either way.
const wrongDischargeDoorMessage = (isPanelFile, panel) => {
  if (isPanelFile && !panel) return 'Yeh panel file hai — Panels → Transaction → Distribution se kholein';
  if (!isPanelFile && panel) return 'Yeh panel file nahi — Billing → Discharge and Refund se kholein';
  return null;
};

// `opd` — Panels → Transaction → Distribution OPD (owner, 2026-10-27): the
// same screen for a closed OPD Bill (see getPanelOpdDistDetail).
export default function DischargeRefund({ panel = false, opd = false }) {
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
    searchPanelOpdDistributions, fetchPanelOpdDistDetail, addPanelOpdDistItem, updatePanelOpdDistItem, deletePanelOpdDistItem, finalizePanelOpdDist,
  } = useClinicStore(useShallow((s) => ({ searchPanelOpdDistributions: s.searchPanelOpdDistributions, fetchPanelOpdDistDetail: s.fetchPanelOpdDistDetail, addPanelOpdDistItem: s.addPanelOpdDistItem, updatePanelOpdDistItem: s.updatePanelOpdDistItem, deletePanelOpdDistItem: s.deletePanelOpdDistItem, finalizePanelOpdDist: s.finalizePanelOpdDist, billHeads: s.billHeads, fetchBillHeads: s.fetchBillHeads, doctors: s.doctors, fetchDoctors: s.fetchDoctors, fetchDoctorSubDeptsForDepartment: s.fetchDoctorSubDeptsForDepartment, searchAdmissionsForDischargeRefund: s.searchAdmissionsForDischargeRefund, searchAdmissionsForProvisionalBill: s.searchAdmissionsForProvisionalBill, fetchDischargeBillDetail: s.fetchDischargeBillDetail, addDischargeBillItem: s.addDischargeBillItem, updateDischargeBillItem: s.updateDischargeBillItem, deleteDischargeBillItem: s.deleteDischargeBillItem, finalizeDischarge: s.finalizeDischarge })));

  // Same calls on an admission's Discharge Bill or an OPD Bill's Distribution.
  const api = opd ? {
    search: searchPanelOpdDistributions,
    fetchDetail: fetchPanelOpdDistDetail,
    addItem: addPanelOpdDistItem,
    updateItem: updatePanelOpdDistItem,
    deleteItem: deletePanelOpdDistItem,
    finalize: finalizePanelOpdDist,
  } : {
    search: searchAdmissionsForDischargeRefund,
    fetchDetail: fetchDischargeBillDetail,
    addItem: addDischargeBillItem,
    updateItem: updateDischargeBillItem,
    deleteItem: deleteDischargeBillItem,
    finalize: finalizeDischarge,
  };
  const fetchDetail = api.fetchDetail;

  const [detail, setDetail] = useState(null);
  const [admissionId, setAdmissionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLookup, setShowLookup] = useState(true);

  const [discount, setDiscount] = useState('0');
  // Panel file only — "Goes to Other Income" writes the remaining balance
  // off (shown as minus) so Balance reaches 0 and the file can close.
  const [otherIncome, setOtherIncome] = useState(false);
  const [saving, setSaving] = useState(false);
  const [askCloseDate, setAskCloseDate] = useState(false);

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
      const d = await fetchDetail(id);
      const wrongDoor = opd ? null : wrongDischargeDoorMessage(d.admission.patientCategory === 'panel', panel);
      if (wrongDoor) { toast.error(wrongDoor); return null; }
      setDetail(d);
      setAdmissionId(d.admission.id);
      setDiscount(String(d.discountAmount || 0));
      setOtherIncome((d.otherIncomeAmount || 0) > 0);
      return d;
    } catch (e) {
      toast.error(e.message || 'Discharge bill load nahi hui');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchDetail, panel, opd]);

  async function handleSelect(row_) {
    setShowLookup(false);
    const d = await loadDetail(row_.id);
    if (!d) setShowLookup(true);
  }

  // Reprint (Report > Reprint > Final Bill): ?admissionNo=...&autoprint=1 —
  // same pattern as Provisional Bill / Discharge Certificate's reprint entry.
  useEffect(() => {
    const admissionNo = searchParams.get('admissionNo');
    const autoprint = searchParams.get('autoprint');
    if (!admissionNo || opd) return;
    (async () => {
      try {
        const rows = await searchAdmissionsForProvisionalBill(admissionNo);
        const match = rows.find(r => r.admissionNo === admissionNo) || rows[0];
        if (!match) { toast.error('Is Admission # ka koi record nahi mila'); return; }
        setShowLookup(false);
        const d = await loadDetail(match.id);
        if (autoprint && d) { setReprintReady(true); }
      } catch {
        toast.error('Final Bill reprint lookup failed');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Popup-based print (never window.print() on the main window — see
  // dischargeBillPrintUtils for why that used to freeze the whole app).
  // discountAmount/balance/refund overridden with the live (currently typed,
  // not-yet-saved) figures — detail's own values only get updated once Close
  // File actually runs, so printing beforehand must not show stale/zeroed-out
  // numbers.
  // closingDate (Close File only): the file is closed right now by this user,
  // so Closed On / Last updated By come from here, not the pre-close detail.
  // A file never closed yet shows the user printing it as Created By too.
  function printDischargeBillPopup(dup, w = openPrintWindow('width=900,height=1000'), closingDate = null) {
    const now = new Date().toISOString();
    const log = detail?.billLog || {};
    const billLog = {
      closedOn: closingDate ? `${closingDate}T12:00:00` : log.closedOn,
      createdBy: log.createdBy || printedBy,
      createdAt: log.createdAt || now,
      updatedBy: closingDate ? printedBy : (log.updatedBy || printedBy),
      updatedAt: closingDate ? now : (log.updatedAt || now),
    };
    const liveDetail = detail ? { ...detail, billLog, discountAmount: Number(discount) || 0, otherIncomeAmount: liveOtherIncome, balance: liveBalance, refund: liveRefund } : detail;
    w.document.write(buildDischargeBillPrintHtml({ detail: liveDetail, isDuplicate: dup }));
    w.document.close();
  }

  useEffect(() => {
    if (!reprintReady) return;
    const t = setTimeout(() => { printDischargeBillPopup(true); setReprintReady(false); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reprintReady]);

  function resetToLookup() {
    setAdmissionId(null);
    setDetail(null);
    setDiscount('0');
    setOtherIncome(false);
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
      await api.addItem(admissionId, row);
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
      await api.deleteItem(itemId);
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
      await api.updateItem(amountEdit.itemId, { amount: amt });
      setAmountEdit(null);
      await loadDetail(admissionId);
    } catch (e) {
      toast.error(e.message || 'Amount save nahi hui');
    } finally {
      setSavingAmount(false);
    }
  }

  function handleCloseFileClick() {
    // Balance must be fully cleared before the file can be closed (backend
    // also re-checks this — this is just so staff get an immediate, specific
    // message instead of clicking a plain-disabled button).
    if (liveBalance > 0) {
      toast.error(isPanel
        ? `Balance Rs. ${fmt2(liveBalance)} baaki hai — "Goes to Other Income" tick karein`
        : `Balance Amount Rs. ${fmt2(liveBalance)} baaki hai — pehle clear karo`);
      return;
    }
    setAskCloseDate(true);
  }

  async function handleFinalize(closingDate) {
    setAskCloseDate(false);
    setSaving(true);
    // Closing prints the Final Bill (owner, 2026-10-22 — the screen resets
    // after close, so there was no way to print it but Reprint). The window
    // opens on the click, before the request, so the browser doesn't block it.
    const printWin = openPrintWindow('width=900,height=1000');
    try {
      await api.finalize(admissionId, { discountAmount: Number(discount) || 0, otherIncome: isPanel && otherIncome, changedBy: printedBy, closingDate });
      toast.success(`File close ho gayi — Closing Date ${closingDate.split('-').reverse().join('-')}`);
      printDischargeBillPopup(false, printWin, closingDate);
      resetToLookup();
    } catch (e) {
      printWin.close();
      toast.error(e.message || 'Finalize nahi ho saka');
    } finally {
      setSaving(false);
    }
  }

  const isPanel = detail?.admission.patientCategory === 'panel';
  const netAmount = detail ? Math.max(0, Math.round(detail.billAmount) - (Number(discount) || 0)) : 0;
  const outstanding = detail ? Math.max(0, netAmount - detail.amountReceived) : 0;
  const liveOtherIncome = isPanel && otherIncome ? outstanding : 0;
  const liveBalance = outstanding - liveOtherIncome;
  const liveRefund = detail ? Math.max(0, detail.amountReceived - netAmount) : 0;

  return (
    <>
      {showLookup && (
        <AdmissionLookupModal
          onSelect={handleSelect}
          onClose={() => navigate(-1)}
          searchAdmissions={api.search}
          category={panel ? 'panel' : 'cash'}
          opd={opd}
        />
      )}

      <div className="adm-page">
        <ClinicMenuBar />

        <div className="aa-toolbar">
          <div className="aa-toolbar-icons">
            <button className="aa-tbtn aa-tbtn--exit" onClick={() => navigate(-1)} title="Exit">
              <DoorOpen size={16} />
            </button>
            <button className="aa-tbtn" onClick={() => printDischargeBillPopup(true)} disabled={!detail} title="Print">
              <Printer size={16} />
            </button>
          </div>
          <span className="aa-toolbar-title">{opd ? 'Distribution OPD' : panel ? 'Distribution' : 'Discharge and Refund'}</span>
        </div>

        {loading && <div className="aa-loading">Loading…</div>}

        {!loading && detail && (
          <div className="dr-body">
            <div className="dr-card">
              <div className="dr-hdr-row">
                <label className="dr-hdr-lbl">{opd ? 'Slip #' : 'Admission #'}</label>
                <div className="dr-hdr-value">{detail.admission.admissionNo}</div>
                <button className="dr-lookup-btn" onClick={() => setShowLookup(true)} title={opd ? 'Search OPD Bills' : 'Search admissions'}>
                  <Search size={13} />
                </button>
                <span className="dr-inline-patient">{detail.admission.patientTitle} {detail.admission.patientName}</span>
                <span className="dr-status-badge">{opd ? 'OPD Bill Closed' : 'Discharged'}</span>
              </div>

              <div className="dr-info-row">
                <div><label>Name</label><span>{detail.admission.patientTitle} {detail.admission.patientName}</span></div>
                <div><label>Relation</label><span>{`${relationParts(detail.admission).label} ${relationParts(detail.admission).name || '—'}`}</span></div>
                {opd
                  ? <div><label>OPD Bill Closed</label><span>{fmtDateTime(detail.dischargeDate)}</span></div>
                  : <div><label>Room #</label><span>{detail.bed?.name || '—'}</span></div>}
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
                {isPanel && (
                  <label className="dr-other-income">
                    <input type="checkbox" checked={otherIncome} onChange={e => setOtherIncome(e.target.checked)} />
                    Goes to Other Income
                    {otherIncome && <b>-{fmt2(liveOtherIncome)}</b>}
                  </label>
                )}
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
                  {groupSlipRows(detail.billItems).map(row => {
                    if (row.kind === 'slip-header') {
                      return (
                        <tr key={row.key} className="dr-slip-head">
                          <td colSpan={6}>{row.dept}</td>
                        </tr>
                      );
                    }
                    const i = row.item;
                    const isEditing = amountEdit?.itemId === i.id;
                    return (
                      <tr key={i.id} className={row.slipLine ? 'dr-slip-line' : undefined}>
                        {/* Amount here is already just the doctor's fee (see backend) —
                            its matching Hospital Share isn't repeated per-row, it only
                            shows once, combined, in the single "Hospital Share" row below. */}
                        <td>{i.billHead?.description || i.billHead?.headCode || i.description || '—'}</td>
                        <td>
                          {row.slipLine || i.doctor?.name || SOURCE_LABELS[i.source] || ''}
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

              <div className="dr-bill-amount">Bill Amount <span>{fmt2(Math.round(detail.billAmount))}</span></div>
            </div>

            <div className="dr-footer">
              <button
                className="dr-finalize-btn"
                onClick={handleCloseFileClick}
                disabled={saving || liveBalance > 0}
                title={liveBalance > 0 ? `Balance Amount Rs. ${fmt2(liveBalance)} baaki hai${isPanel ? ' — "Goes to Other Income" tick karein' : ''}` : ''}
              >
                {saving ? 'Saving…' : 'Close File'}
              </button>
              <button className="dr-close-btn" onClick={resetToLookup} disabled={saving}>{opd ? 'Select Another OPD Bill' : 'Select Another Admission'}</button>
            </div>
          </div>
        )}
      </div>

      {askCloseDate && (
        <CloseDateModal onConfirm={handleFinalize} onCancel={() => setAskCloseDate(false)} />
      )}
    </>
  );
}
