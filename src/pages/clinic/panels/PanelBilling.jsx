import { useState, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { Search, X, Plus } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import { useAuthStore } from '../../../store/useAuthStore';
import '../AdmissionAdjustment.scss'; // .aa-* lookup-modal classes
import './PanelBilling.scss';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
// Medicine Bill (legacy "PHARMACY/MEDICAL STORE BILL") prints Qty/Rate/Amount
// to 2 decimals, unlike every other report on this screen — its own helper.
const fmt2 = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad2 = (n) => String(n).padStart(2, '0');
// 19-06-2026 — Medicine Bill's own "Admission date" format, distinct from
// every other report's dd-Mon-yyyy.
function fmtDdMmYyyyNum(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${pad2(dt.getDate())}-${pad2(dt.getMonth() + 1)}-${dt.getFullYear()}`;
}
// 21-Jun-2026 00:00 — Medicine Bill's "Discharge date".
function fmtDdMonYyyyHm(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${pad2(dt.getDate())}-${dt.toLocaleString('en-GB', { month: 'short' })}-${dt.getFullYear()} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}
// Jun-19-2026 00:00 — Medicine Bill's per-row "Medicine Date".
function fmtMonDdYyyyHm(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.toLocaleString('en-GB', { month: 'short' })}-${pad2(dt.getDate())}-${dt.getFullYear()} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

// Manual-add types — same lists already used elsewhere in Clinic (Sub
// Department parameters for Lab/Ultrasound/Radiology test names, Inventory
// items for Medicine), each scoped to the matching department.
const CUSTOM_TYPES = [
  // mergeInto: adding one of these folds straight into that head's single
  // row (creating it if this admission never had one) instead of showing as
  // its own new line — matches the Laboratory/Radiology/Ultrasound split.
  // Medicine is sourced from the Medicine List (Panels > Reports > Medicine
  // List / Pharmacy Price List, ClinicMedicine) — same master list that page
  // manages, not Inventory.
  { key: 'medicine',   label: 'Medicine',   source: 'medicineList', mergeInto: 'Medicine' },
  { key: 'lab',        label: 'Laboratory', source: 'subdept', deptName: 'LABORATORY', mergeInto: 'Laboratory' },
  { key: 'ultrasound', label: 'Ultrasound', source: 'subdept', deptName: 'Ultra Sound, Echo & Color Doppler', mergeInto: 'Ultra Sound, Echo & Color Doppler' },
  { key: 'radiology',  label: 'Radiology',  source: 'subdept', deptName: 'RADIOLOGY', mergeInto: 'Radiology' },
  // Panels > Parameter > Bill Head — 'simple' heads behave like any other
  // manual add; picking a 'package' head (e.g. "Surgery") instead opens the
  // medicine checklist (see PackagePickerModal) and skips this form entirely.
  { key: 'panelhead',  label: 'Panel Head', source: 'panelhead' },
];

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  return `${day}-${month}-${year}`;
}

function fmtDateTime(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${fmtDate(d)} ${time}`;
}

// `<input type="date">` needs a plain YYYY-MM-DD value, not the full ISO string.
function toInputDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// Mirrors the backend's formatBillingSno — used for instant local feedback
// while typing, before the save-on-blur round trip confirms it.
function formatBillingSno(seq, admitDate) {
  if (!seq) return null;
  const dt = admitDate ? new Date(admitDate) : new Date();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yy = String(dt.getFullYear()).slice(-2);
  return `${seq}-${mm}-${yy}`;
}

function ddmmyyyy(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}${String(dt.getMonth() + 1).padStart(2, '0')}${dt.getFullYear()}`;
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

// Panels > Billing > Reports — matches the reference dialog exactly; only
// the first two are wired up so far, the rest are placeholders for later.
const REPORT_TYPES = [
  { key: 'covering',      label: 'Billing Covering Page',              ready: true },
  { key: 'medicine',      label: 'Medicine Bill',                      ready: true },
  { key: 'diagnostic',    label: 'Diagnostic Bill',                    ready: true },
  { key: 'companyWise',   label: 'Company Wise Consolidate Report',    ready: false },
  { key: 'dateWise',      label: 'Date Wise Detail Report',            ready: false },
  { key: 'patientType',   label: 'Patient Type Wise Consolidate Report', ready: false },
  { key: 'headWise',      label: 'Head Wise Report',                   ready: false },
];

// `@page` is a document-level rule shared across the whole bundled app (see
// ProvisionalBill.jsx for the same issue) — inject an override right before
// printing so this isn't silently overridden by whichever other page's
// `@page` rule happens to load last.
function printWithA4Override(styleId) {
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = '@page { size: A4 portrait !important; margin: 12mm !important; }';
  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000);
  window.print();
}

// ── Panel Admission Lookup Modal — patientCategory 'panel' only ────────────────
function PanelAdmissionLookupModal({ onSelect, onClose, searchPanelAdmissions }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    searchPanelAdmissions('')
      .then((data) => setRows(data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [searchPanelAdmissions]);

  function handleQueryChange(val) {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      searchPanelAdmissions(val)
        .then((data) => setRows(data || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 300);
  }

  return (
    <div className="aa-overlay">
      <div className="aa-modal">
        <div className="aa-modal-hdr">
          <span>Select Panel Patient</span>
          <button className="aa-modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="aa-modal-search">
          <Search size={13} className="aa-modal-search-icon" />
          <input
            autoFocus
            className="aa-modal-search-input"
            placeholder="Search Admission # or Patient Name…"
            value={q}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
        </div>
        <div className="aa-modal-body">
          {loading ? (
            <div className="aa-modal-loading">Loading…</div>
          ) : (
            <table className="aa-modal-tbl">
              <thead>
                <tr><th>Admission #</th><th>Patient</th><th>Status</th><th>Admission Date</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => onSelect(r)}>
                    <td>{r.admissionNo}</td>
                    <td>{r.patientName}</td>
                    <td>{r.status}</td>
                    <td>{fmtDateTime(r.createdAt)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr><td colSpan={4} className="aa-td-empty">Koi Panel patient nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// Panels > Transaction > Billing — seeded once from the live Provisional Bill
// (Ward History, Provisional Bill items, Diagnostic tab, Pharmacy tab) the
// first time this admission's Billing is opened; every Rate/Qty/Remarks edit
// after that lives in its own snapshot (ClinicPanelBillingItem) — the
// original Provisional Bill is never touched.
export default function PanelBilling() {
  const {
    fetchPanelAdmissionBilling, searchPanelAdmissions, updatePanelBillingItem,
    updatePanelBillingHeader, overrideLiveDetailItem, excludeLiveDetailItem,
    addPanelBillingItem, deletePanelBillingItem, addPanelBillingItemsBulk,
    subDepartments, fetchSubDepartments, searchPanelBillHeads,
    doctors, fetchDoctors, diseases, fetchDiseases, surgeryTypes, fetchSurgeryTypes,
    fetchMedicineList, createMedicine,
    finalizeDischarge,
  } = useClinicStore();
  const { user } = useAuthStore();
  const [admitNo, setAdmitNo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState(null); // 'pharmacy' | 'diagnostic' | null
  const [diagnosticDept, setDiagnosticDept] = useState(null); // which of Laboratory/Radiology/Ultra Sound… was double-clicked
  const [showLookup, setShowLookup] = useState(false);
  const [copying, setCopying] = useState(false);
  const [editCell, setEditCell] = useState(null); // { itemId, field: 'rate'|'qty', value } | null
  const [savingCell, setSavingCell] = useState(false);

  // Once the real Admission File is closed (see handleConfirmCloseFile below)
  // this Billing snapshot goes read-only — data stays visible/printable, but
  // nothing can be added/edited/deleted anymore.
  const readOnly = data?.admission.status === 'closed';
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closingFile, setClosingFile] = useState(false);

  // ── Reports dialog ─────────────────────────────────────────────────────────
  const [showReports, setShowReports] = useState(false);
  const [reportAdmitNo, setReportAdmitNo] = useState('');
  const [reportType, setReportType] = useState('covering');
  const [reportLoading, setReportLoading] = useState(false);
  const [printData, setPrintData] = useState(null); // { type, data } | null — feeds the hidden print template

  // ── Manual add: Medicine / Laboratory / Ultrasound / Radiology ────────────
  const [customType, setCustomType] = useState('medicine');
  const [customQuery, setCustomQuery] = useState('');
  const [customOptions, setCustomOptions] = useState([]);
  const [showCustomOptions, setShowCustomOptions] = useState(false);
  const [customQty, setCustomQty] = useState('1');
  const [customRate, setCustomRate] = useState('');
  const [customDose, setCustomDose] = useState(''); // Medicine only
  const [addingCustom, setAddingCustom] = useState(false);
  const customSearchTimer = useRef(null);
  const [showAddMedicine, setShowAddMedicine] = useState(false); // quick-add straight into the Medicine List

  // Medicine Package checklist — set when a 'package' Panel Head is picked,
  // instead of filling the manual-add form.
  const [packagePicker, setPackagePicker] = useState(null); // { description, items: [{...packageItem, checked}] } | null
  const [confirmingPackage, setConfirmingPackage] = useState(false);

  useEffect(() => { fetchSubDepartments(); }, [fetchSubDepartments]);
  useEffect(() => { fetchDoctors(); fetchDiseases(); fetchSurgeryTypes(); }, [fetchDoctors, fetchDiseases, fetchSurgeryTypes]);

  // Consultant dropdown — live Doctor list; the already-saved name is added
  // in too (even if it's since left the active list) so opening an old
  // admission never silently blanks what's already on record.
  const consultantOptions = useMemo(() => {
    const names = new Set(doctors.map((d) => d.name));
    if (data?.admission.consultantName) names.add(data.admission.consultantName);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [doctors, data?.admission.consultantName]);

  // Diagnosis dropdown — Diseases + Surgery Types mixed together, same
  // established pattern as Discharge Certificate's Diagnosis field (see
  // DiscountRefundAdmission.jsx).
  const diagnosisOptions = useMemo(() => {
    const names = new Set([...diseases.map((d) => d.name), ...surgeryTypes.map((s) => s.name)]);
    if (data?.admission.diagnosis) names.add(data.admission.diagnosis);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [diseases, surgeryTypes, data?.admission.diagnosis]);

  function handleCustomQueryChange(val) {
    setCustomQuery(val);
    setShowCustomOptions(true);
    const type = CUSTOM_TYPES.find((t) => t.key === customType);
    clearTimeout(customSearchTimer.current);
    if (type.source === 'subdept') {
      const q = val.trim().toLowerCase();
      setCustomOptions(
        subDepartments
          .filter((sd) => sd.department?.name === type.deptName && (!q || sd.name.toLowerCase().includes(q)))
          .slice(0, 30)
          .map((sd) => ({ id: sd.id, name: sd.name, code: sd.code }))
      );
      return;
    }
    if (type.source === 'panelhead') {
      customSearchTimer.current = setTimeout(() => {
        searchPanelBillHeads(val)
          .then((heads) => setCustomOptions(
            (heads || []).map((h) => ({ id: h.id, name: h.description, code: h.headCode, kind: h.kind, packageItems: h.packageItems }))
          ))
          .catch(() => setCustomOptions([]));
      }, 300);
      return;
    }
    // Medicine — Medicine List (Panels > Reports > Medicine List / Pharmacy
    // Price List) search, debounced.
    customSearchTimer.current = setTimeout(() => {
      fetchMedicineList({ search: val, status: 'active' })
        .then((meds) => setCustomOptions((meds || []).map((m) => ({ id: m.id, name: m.name, code: m.code, retailPrice: m.retailPrice }))))
        .catch(() => setCustomOptions([]));
    }, 300);
  }

  function pickCustomOption(opt) {
    setShowCustomOptions(false);
    if (customType === 'panelhead' && opt.kind === 'package') {
      setCustomQuery('');
      setPackagePicker({
        description: opt.name,
        items: opt.packageItems.map((it) => ({ ...it, checked: true })),
      });
      return;
    }
    setCustomQuery(opt.name);
    if (customType === 'medicine' && opt.retailPrice != null) setCustomRate(String(opt.retailPrice));
  }

  // Quick-add straight from the Medicine field — lands in the Medicine List
  // (ClinicMedicine, same table Panels > Reports > Medicine List manages),
  // then feeds right back into the Item field so it can be added to this
  // bill immediately, no need to leave this screen.
  async function handleCreateMedicine(payload) {
    const med = await createMedicine(payload);
    toast.success('Medicine List mein add ho gayi');
    setCustomType('medicine');
    setCustomQuery(med.name);
    setCustomRate(med.retailPrice ? String(med.retailPrice) : '');
    setShowAddMedicine(false);
  }

  function togglePackageItem(itemId) {
    setPackagePicker((p) => ({
      ...p,
      items: p.items.map((it) => (it.id === itemId ? { ...it, checked: !it.checked } : it)),
    }));
  }

  async function handleConfirmPackage() {
    const checked = packagePicker.items.filter((it) => it.checked);
    if (!checked.length) return toast.error('Kam az kam ek medicine select karo');
    setConfirmingPackage(true);
    try {
      const rows = await addPanelBillingItemsBulk(
        data.admission.id,
        checked.map((it) => ({ description: it.medicine, qty: 1, rate: it.rate }))
      );
      setData((d) => ({
        ...d,
        rows: [...d.rows, ...rows],
        billingAmount: d.billingAmount + rows.reduce((s, r) => s + Number(r.amount || 0), 0),
      }));
      setPackagePicker(null);
      toast.success(`${rows.length} medicine bill me add ho gayin`);
    } catch (e) {
      toast.error(e.message || 'Add nahi hua');
    } finally {
      setConfirmingPackage(false);
    }
  }

  async function handleAddCustom() {
    if (!data) return;
    const description = customQuery.trim();
    if (!description) return toast.error('Item ka naam likho ya list se select karo');
    const qty = Number(customQty);
    const rate = Number(customRate);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error('Qty valid honi chahiye');
    if (!Number.isFinite(rate) || rate < 0) return toast.error('Rate valid honi chahiye');
    const mergeInto = CUSTOM_TYPES.find((t) => t.key === customType)?.mergeInto;
    const dosage = customType === 'medicine' ? customDose.trim() || undefined : undefined;
    setAddingCustom(true);
    try {
      const row = await addPanelBillingItem(data.admission.id, { description, qty, rate, mergeInto, dosage });
      if (mergeInto) {
        // Grouped adds fold into their head row (and feed that head's detail
        // popup) server-side — reload so the grid shows the recomputed
        // total instead of this raw itemized row.
        await loadByAdmitNo(data.admission.admissionNo);
      } else {
        setData((d) => ({ ...d, rows: [...d.rows, row], billingAmount: d.billingAmount + row.amount }));
      }
      setCustomQuery('');
      setCustomQty('1');
      setCustomRate('');
      setCustomDose('');
    } catch (e) {
      toast.error(e.message || 'Add nahi hua');
    } finally {
      setAddingCustom(false);
    }
  }

  async function handleDeleteCustom(row) {
    try {
      await deletePanelBillingItem(row.id);
      setData((d) => ({
        ...d,
        rows: d.rows.filter((r) => r.id !== row.id),
        billingAmount: d.billingAmount - row.amount,
      }));
    } catch (e) {
      toast.error(e.message || 'Delete nahi hua');
    }
  }

  // Pharmacy Bill / Diagnostic Bill detail — check any number of rows
  // (Qty/Rate/Date all editable right there first), each checked one gets
  // repeated as its own row on the actual bill.
  async function handleConfirmDetailCopy(items) {
    if (!data) return;
    setCopying(true);
    try {
      const rows = await addPanelBillingItemsBulk(data.admission.id, items);
      setPopup(null);
      if (items.some((it) => it.mergeInto)) {
        // Grouped adds fold into their head row server-side — reload so the
        // grid shows the recomputed total instead of these raw itemized rows.
        await loadByAdmitNo(data.admission.admissionNo);
      } else {
        setData((d) => ({
          ...d,
          rows: [...d.rows, ...rows],
          billingAmount: d.billingAmount + rows.reduce((s, r) => s + Number(r.amount || 0), 0),
        }));
      }
      toast.success(`${rows.length} item bill me add ho gaye`);
    } catch (e) {
      toast.error(e.message || 'Add nahi hua');
    } finally {
      setCopying(false);
    }
  }

  // Directly correct an already-added manual Medicine/Lab/Radiology/
  // Ultrasound entry (Date/Dose/Qty/Rate) — no duplicate row, unlike the
  // checklist's "Add Selected". Only ever called for a "manual-<id>" row
  // (see PharmacyDetailModal/DiagnosticDetailModal).
  async function handleSaveDetailRow(key, patch) {
    const realId = key.replace('manual-', '');
    await updatePanelBillingItem(realId, patch);
    // Main grid's aggregate total needs the fresh amount — the popup itself
    // keeps its own already-updated local row state, so this can run in the
    // background without disturbing what's on screen.
    loadByAdmitNo(data.admission.admissionNo);
  }

  // Editing a *live* Provisional Bill entry — the real Provisional Bill is
  // never touched. This creates a Billing-only override in its place (see
  // overrideLiveDetailItem) that replaces it in both display and totals;
  // saving the same live entry again from here on just edits that override.
  async function handleOverrideDetailRow(liveId, mergeInto, originalAmount, description, patch) {
    await overrideLiveDetailItem(data.admission.id, { liveId, mergeInto, description, originalAmount, ...patch });
    loadByAdmitNo(data.admission.admissionNo);
  }

  // Delete a row from inside the Pharmacy/Diagnostic detail popup — a manual
  // add (key "manual-<id>") is a real ClinicPanelBillingItem, so this just
  // deletes it outright; a live Provisional Bill entry has no row of its own
  // here to delete, so it's excluded instead (see excludeLiveDetailItem) —
  // same "Provisional Bill stays untouched" principle as editing one.
  async function handleDeleteDetailRow(key, mergeInto, originalAmount) {
    if (String(key).startsWith('manual-')) {
      await deletePanelBillingItem(key.replace('manual-', ''));
    } else {
      await excludeLiveDetailItem(data.admission.id, { liveId: key, mergeInto, originalAmount });
    }
    loadByAdmitNo(data.admission.admissionNo);
  }

  async function loadByAdmitNo(no) {
    setLoading(true);
    try {
      const res = await fetchPanelAdmissionBilling(no);
      setData(res);
      setAdmitNo(res.admission.admissionNo);
    } catch (e) {
      setData(null);
      toast.error(e.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  function openReports() {
    setReportAdmitNo(data?.admission.admissionNo || admitNo || '');
    setReportType('covering');
    setShowReports(true);
  }

  async function handleGenerateReport() {
    const no = reportAdmitNo.trim();
    if (!no) return toast.error('Admission # daalo');
    const type = REPORT_TYPES.find((t) => t.key === reportType);
    if (!type?.ready) return toast.error('Yeh report abhi available nahi hai');
    setReportLoading(true);
    try {
      const res = await fetchPanelAdmissionBilling(no);
      setPrintData({ type: reportType, data: res });
      setShowReports(false);
      setTimeout(() => printWithA4Override(`pnbr-print-${reportType}`), 300);
    } catch (e) {
      toast.error(e.message || 'Report load nahi hui');
    } finally {
      setReportLoading(false);
    }
  }

  function lookup() {
    const no = admitNo.trim();
    if (!no) return toast.error('Admission # daalo');
    loadByAdmitNo(no);
  }

  function handleSelectFromModal(row) {
    setShowLookup(false);
    loadByAdmitNo(row.admissionNo);
  }

  function handleCancel() {
    setAdmitNo('');
    setData(null);
    setPopup(null);
  }

  // "Save" on the Billing footer — every edit already saves itself live, so
  // this button's real job is the Yes/No decision: Yes triggers the actual
  // Admission File Close (same finalizeDischarge used by Discharge & Refund
  // — requires the file to already be in 'discharge' status with its Balance
  // Amount fully cleared there), which then makes this Billing read-only for
  // good. No just dismisses the warning — nothing else needed since nothing
  // here was ever unsaved.
  function handleSaveClick() {
    if (!data || readOnly) return;
    setShowCloseConfirm(true);
  }

  function handleDeclineCloseFile() {
    setShowCloseConfirm(false);
    toast.success('Billing save ho gayi');
  }

  async function handleConfirmCloseFile() {
    setClosingFile(true);
    try {
      const changedBy = user?.name || user?.username || user?.email || '';
      await finalizeDischarge(data.admission.id, { discountAmount: 0, changedBy });
      toast.success('File close ho gayi — Billing ab read-only hai');
      setShowCloseConfirm(false);
      await loadByAdmitNo(data.admission.admissionNo);
    } catch (e) {
      toast.error(e.message || 'File close nahi ho saki');
    } finally {
      setClosingFile(false);
    }
  }

  function rowDoubleClick(row) {
    if (row.kind === 'pharmacy') setPopup('pharmacy');
    else if (row.kind === 'diagnostic') { setDiagnosticDept(row.description); setPopup('diagnostic'); }
  }

  function startEdit(row, field, e) {
    e.stopPropagation(); // don't also trigger the row's double-click detail popup
    if (readOnly) return;
    const raw = field === 'remarks' ? (row.remarks || '') : String(row[field] ?? 0);
    setEditCell({ itemId: row.id, field, value: raw });
  }

  async function handleSaveCell() {
    if (!editCell) return;
    if (editCell.field === 'remarks') {
      setSavingCell(true);
      try {
        const updated = await updatePanelBillingItem(editCell.itemId, { remarks: editCell.value });
        setData((d) => ({ ...d, rows: d.rows.map((r) => (r.id === updated.id ? { ...r, remarks: updated.remarks } : r)) }));
        setEditCell(null);
      } catch (e) {
        toast.error(e.message || 'Remarks save nahi hue');
      } finally {
        setSavingCell(false);
      }
      return;
    }
    const val = Number(editCell.value);
    if (!Number.isFinite(val) || val < 0) { toast.error('Valid number daalo'); return; }
    const row = data.rows.find((r) => r.id === editCell.itemId);
    const payload = editCell.field === 'rate' ? { qty: row.qty, rate: val } : { qty: val, rate: row.rate };
    setSavingCell(true);
    try {
      const updated = await updatePanelBillingItem(editCell.itemId, payload);
      setData((d) => ({
        ...d,
        rows: d.rows.map((r) => (r.id === updated.id ? { ...r, qty: updated.qty, rate: updated.rate, amount: updated.amount } : r)),
        billingAmount: d.rows.reduce((s, r) => s + Number((r.id === updated.id ? updated.amount : r.amount) || 0), 0),
      }));
      setEditCell(null);
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
    } finally {
      setSavingCell(false);
    }
  }

  async function handleHeaderDateChange(field, value) {
    try {
      const updated = await updatePanelBillingHeader(data.admission.id, { [field]: value || null });
      setData((d) => {
        const admitDate = field === 'admitDate' ? updated.admitDate : d.admission.admitDate;
        const dischargeDate = field === 'dischargeDate' ? updated.dischargeDate : d.admission.dischargeDate;
        const days = Math.max(1, Math.ceil(((dischargeDate ? new Date(dischargeDate) : new Date()) - new Date(admitDate)) / 86400000));
        const serialNo = field === 'admitDate' ? formatBillingSno(d.admission.snoSeq, admitDate) || d.admission.serialNo : d.admission.serialNo;
        return { ...d, admission: { ...d.admission, admitDate, dischargeDate, days, serialNo } };
      });
    } catch (e) {
      toast.error(e.message || 'Date save nahi hui');
    }
  }

  // Patient Name — typing updates locally; save only fires on blur.
  function handleHeaderTextInput(field, value) {
    setData((d) => ({ ...d, admission: { ...d.admission, [field]: value } }));
  }
  async function handleHeaderTextBlur(field, value) {
    try {
      await updatePanelBillingHeader(data.admission.id, { [field]: value });
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
    }
  }

  // Consultant / Diagnosis — both dropdowns now (Doctor list / Diseases +
  // Surgery Types), so a pick is already the final value — save right away,
  // no separate blur step needed.
  async function handleHeaderSelectChange(field, value) {
    setData((d) => ({ ...d, admission: { ...d.admission, [field]: value } }));
    try {
      await updatePanelBillingHeader(data.admission.id, { [field]: value });
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
    }
  }

  // Sno — user types just the 2-digit sequence, Month/Year come live from
  // Admit Date (see formatBillingSno). Digits only, max 2, save on blur.
  function handleSnoSeqInput(value) {
    if (value && !/^\d{0,2}$/.test(value)) return;
    setData((d) => ({
      ...d,
      admission: { ...d.admission, snoSeq: value, serialNo: formatBillingSno(value, d.admission.admitDate) || d.admission.serialNo },
    }));
  }
  async function handleSnoSeqBlur(value) {
    try {
      const updated = await updatePanelBillingHeader(data.admission.id, { snoSeq: value.trim() || null });
      setData((d) => ({
        ...d,
        admission: { ...d.admission, snoSeq: updated.snoSeq, serialNo: formatBillingSno(updated.snoSeq, d.admission.admitDate) || d.admission.serialNo },
      }));
    } catch (e) {
      toast.error(e.message || 'Sno save nahi hua');
    }
  }

  return (
    <div className="pnb-page">
      <ClinicMenuBar />

      {showLookup && (
        <PanelAdmissionLookupModal
          onSelect={handleSelectFromModal}
          onClose={() => setShowLookup(false)}
          searchPanelAdmissions={searchPanelAdmissions}
        />
      )}

      <div className="pnb-body">
        <div className="pnb-window">
          <div className="pnb-titlebar">
            <span>Transaction — Panel Billing</span>
            <span className="pnb-title-right">Panel Admission Billing</span>
          </div>

          {/* ── Header ── */}
          <div className="pnb-header">
            <div className="pnb-hg">
              <label>Admission #</label>
              <div className="pnb-lookup">
                <input
                  value={admitNo}
                  onChange={(e) => setAdmitNo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookup()}
                  placeholder="e.g. 174628"
                />
                <button onClick={() => setShowLookup(true)} disabled={loading}><Search size={14} /></button>
              </div>
            </div>
            <div className="pnb-hg">
              <label>Sno</label>
              {data ? (
                <div className="pnb-sno-group">
                  <input
                    className="pnb-sno-input"
                    value={data.admission.snoSeq || ''}
                    onChange={(e) => handleSnoSeqInput(e.target.value)}
                    onBlur={(e) => handleSnoSeqBlur(e.target.value)}
                    placeholder="01"
                    maxLength={2}
                    disabled={readOnly}
                  />
                  <span className="pnb-sno-preview">{data.admission.serialNo || '—'}</span>
                </div>
              ) : <div className="pnb-val">—</div>}
            </div>
            <div className="pnb-hg">
              <label>Admit Date</label>
              {data ? (
                <input type="date" className="pnb-date-input" value={toInputDate(data.admission.admitDate)}
                  onChange={(e) => handleHeaderDateChange('admitDate', e.target.value)} disabled={readOnly} />
              ) : <div className="pnb-val">—</div>}
            </div>
            <div className="pnb-hg">
              <label>Discharge Date</label>
              {data ? (
                <input type="date" className="pnb-date-input" value={toInputDate(data.admission.dischargeDate)}
                  onChange={(e) => handleHeaderDateChange('dischargeDate', e.target.value)} disabled={readOnly} />
              ) : <div className="pnb-val">—</div>}
            </div>
            <div className="pnb-hg"><label>Days</label><div className="pnb-val">{data?.admission.days ?? '—'}</div></div>

            <div className="pnb-hg"><label>Company</label><div className="pnb-val pnb-val--blue">{data?.company ? `${data.company.code} — ${data.company.name}` : '—'}</div></div>
            <div className="pnb-hg"><label>Employee</label><div className="pnb-val">{data?.employee ? `${data.employee.empCode} — ${data.employee.name}` : '—'}</div></div>
            <div className="pnb-hg">
              <label>Patient Name</label>
              {data ? (
                <input className="pnb-date-input" value={data.admission.patientName || ''}
                  onChange={(e) => handleHeaderTextInput('patientName', e.target.value)}
                  onBlur={(e) => handleHeaderTextBlur('patientName', e.target.value)}
                  placeholder="Patient naam" disabled={readOnly} />
              ) : <div className="pnb-val">—</div>}
            </div>
            <div className="pnb-hg">
              <label>Consultant</label>
              {data ? (
                <select className="pnb-date-input" value={data.admission.consultantName || ''}
                  onChange={(e) => handleHeaderSelectChange('consultantName', e.target.value)}
                  disabled={readOnly}>
                  <option value="">— Select —</option>
                  {consultantOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              ) : <div className="pnb-val">—</div>}
            </div>
            <div className="pnb-hg pnb-hg--wide">
              <label>Diagnosis</label>
              {data ? (
                <select className="pnb-date-input" value={data.admission.diagnosis || ''}
                  onChange={(e) => handleHeaderSelectChange('diagnosis', e.target.value)}
                  style={{ width: '100%' }} disabled={readOnly}>
                  <option value="">— Select —</option>
                  {diagnosisOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              ) : <div className="pnb-val">—</div>}
            </div>
          </div>

          {/* ── Manual add: Medicine / Laboratory / Ultrasound / Radiology ── */}
          {data && !readOnly && (
            <div className="pnb-add-row">
              <div className="pnb-fg pnb-fg--sm">
                <label>Type</label>
                <select
                  value={customType}
                  onChange={(e) => { setCustomType(e.target.value); setCustomQuery(''); setCustomOptions([]); }}
                >
                  {CUSTOM_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="pnb-fg pnb-fg--search">
                <label>Item</label>
                <div className="pnb-combo">
                  <input
                    value={customQuery}
                    onChange={(e) => handleCustomQueryChange(e.target.value)}
                    onFocus={() => handleCustomQueryChange(customQuery)}
                    onBlur={() => setTimeout(() => setShowCustomOptions(false), 150)}
                    placeholder="Naam type karo ya list se select karo…"
                  />
                  {showCustomOptions && customOptions.length > 0 && (
                    <div className="pnb-combo-list">
                      {customOptions.map((opt) => (
                        <div key={opt.id} className="pnb-combo-opt" onMouseDown={() => pickCustomOption(opt)}>
                          {opt.name}{opt.code ? <span className="pnb-combo-code"> ({opt.code})</span> : null}
                          {opt.kind === 'package' && <span className="pnb-combo-package"> — Medicine Package ({opt.packageItems.length})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {customType === 'medicine' && (
                <div className="pnb-fg">
                  <label>&nbsp;</label>
                  <button type="button" className="pnb-new-med-btn" onClick={() => setShowAddMedicine(true)}>
                    <Plus size={13} /> New Medicine
                  </button>
                </div>
              )}
              {customType === 'medicine' && (
                <div className="pnb-fg pnb-fg--sm">
                  <label>Dose</label>
                  <input value={customDose} onChange={(e) => setCustomDose(e.target.value)} placeholder="e.g. 1 tab" />
                </div>
              )}
              <div className="pnb-fg pnb-fg--sm">
                <label>Qty</label>
                <input value={customQty} onChange={(e) => setCustomQty(e.target.value)} />
              </div>
              <div className="pnb-fg pnb-fg--sm">
                <label>Rate</label>
                <input value={customRate} onChange={(e) => setCustomRate(e.target.value)} placeholder="apni rate" />
              </div>
              <button className="pnb-add-btn" onClick={handleAddCustom} disabled={addingCustom}>
                <Plus size={14} /> Add
              </button>
            </div>
          )}

          {/* ── Grid ── */}
          <div className="pnb-tab-body">
            <table className="pnb-table">
              <thead>
                <tr><th>Description</th><th className="r">Rate</th><th className="r">Qty</th><th className="r">Amount</th><th>Remarks</th><th></th></tr>
              </thead>
              <tbody>
                {!data ? (
                  <tr><td colSpan={6} className="pnb-empty">Admission # lookup karo — Panel patient ka Provisional Bill data yahan aayega.</td></tr>
                ) : data.rows.map((r) => {
                  const clickable = r.kind === 'pharmacy' || r.kind === 'diagnostic';
                  return (
                    <tr key={r.id} className={clickable ? 'pnb-clickable' : ''} onDoubleClick={() => rowDoubleClick(r)}>
                      <td>{r.description}{clickable && <span className="pnb-hint"> (double-click for detail)</span>}</td>
                      <EditableCell row={r} field="rate" editCell={editCell} savingCell={savingCell}
                        onStart={startEdit} onChange={(v) => setEditCell((s) => ({ ...s, value: v }))}
                        onSave={handleSaveCell} onCancel={() => setEditCell(null)} display={fmt(r.rate)} />
                      <EditableCell row={r} field="qty" editCell={editCell} savingCell={savingCell}
                        onStart={startEdit} onChange={(v) => setEditCell((s) => ({ ...s, value: v }))}
                        onSave={handleSaveCell} onCancel={() => setEditCell(null)} display={r.qty || 0} />
                      <td className="r">{fmt(r.amount)}</td>
                      <EditableCell row={r} field="remarks" type="text" editCell={editCell} savingCell={savingCell}
                        onStart={startEdit} onChange={(v) => setEditCell((s) => ({ ...s, value: v }))}
                        onSave={handleSaveCell} onCancel={() => setEditCell(null)} display={r.remarks || <span className="pnb-hint">add remarks</span>} />
                      <td>{r.kind === 'custom' && !readOnly && <button className="pnb-del" onClick={() => handleDeleteCustom(r)} title="Delete">✕</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Footer ── */}
          <div className="pnb-footer">
            <button className="pnb-btn" onClick={openReports}>Reports</button>
            {readOnly ? (
              <span className="pnb-closed-badge" title="Is admission ki file close ho chuki hai — Billing ab sirf dekhne/print ke liye hai">File Closed</span>
            ) : (
              <button className="pnb-btn pnb-btn--save" onClick={handleSaveClick} disabled={!data}>Save</button>
            )}
            <button className="pnb-btn" onClick={handleCancel}>Cancel</button>
            <div className="pnb-total">Billing Amt <span>{fmt(data?.billingAmount)}</span></div>
          </div>
        </div>
      </div>

      {showReports && (
        <ReportsModal
          admitNo={reportAdmitNo}
          onAdmitNoChange={setReportAdmitNo}
          reportType={reportType}
          onReportTypeChange={setReportType}
          onClose={() => setShowReports(false)}
          onGenerate={handleGenerateReport}
          loading={reportLoading}
        />
      )}

      {printData?.type === 'covering' && <BillingCoveringPagePrintTemplate data={printData.data} />}
      {printData?.type === 'diagnostic' && <DiagnosticBillPrintTemplate data={printData.data} />}
      {printData?.type === 'medicine' && <MedicineBillPrintTemplate data={printData.data} />}

      {popup === 'pharmacy' && data && (
        <PharmacyDetailModal
          rows={data.pharmacyRows}
          onClose={() => setPopup(null)}
          onConfirmAdd={handleConfirmDetailCopy}
          onSaveRow={handleSaveDetailRow}
          onOverrideRow={handleOverrideDetailRow}
          onDeleteRow={handleDeleteDetailRow}
          confirming={copying}
          readOnly={readOnly}
        />
      )}
      {popup === 'diagnostic' && data && (
        <DiagnosticDetailModal
          title={diagnosticDept}
          rows={data.diagnosticRows.filter((r) => r.department === diagnosticDept)}
          onClose={() => setPopup(null)}
          onConfirmAdd={handleConfirmDetailCopy}
          onSaveRow={handleSaveDetailRow}
          onOverrideRow={handleOverrideDetailRow}
          onDeleteRow={handleDeleteDetailRow}
          confirming={copying}
          readOnly={readOnly}
        />
      )}

      {showCloseConfirm && (
        <CloseFileConfirmModal
          onYes={handleConfirmCloseFile}
          onNo={handleDeclineCloseFile}
          onClose={() => setShowCloseConfirm(false)}
          loading={closingFile}
        />
      )}

      {packagePicker && (
        <PackagePickerModal
          picker={packagePicker}
          onToggle={togglePackageItem}
          onConfirm={handleConfirmPackage}
          onClose={() => setPackagePicker(null)}
          confirming={confirmingPackage}
        />
      )}

      {showAddMedicine && (
        <QuickAddMedicineModal
          onClose={() => setShowAddMedicine(false)}
          onCreate={handleCreateMedicine}
        />
      )}
    </div>
  );
}

// Quick-add a new Medicine straight into the Medicine List (Panels > Reports
// > Medicine List / Pharmacy Price List, ClinicMedicine) without leaving
// this screen — same fields/validation as that page's own Add form (code +
// name required, code must be unique).
function QuickAddMedicineModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ code: '', name: '', packSize: '', retailPrice: '', tradePrice: '' });
  const [saving, setSaving] = useState(false);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.code.trim()) return toast.error('Code zaroori hai');
    if (!form.name.trim()) return toast.error('Naam zaroori hai');
    setSaving(true);
    try {
      await onCreate({
        code: form.code.trim(),
        name: form.name.trim(),
        packSize: form.packSize.trim() || undefined,
        retailPrice: Number(form.retailPrice) || 0,
        tradePrice: Number(form.tradePrice) || 0,
      });
    } catch (e) {
      toast.error(e.message || 'Add nahi hui');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pnb-modal-overlay" onMouseDown={onClose}>
      <div className="pnb-modal pnb-modal--sm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pnb-modal-head">
          <span>New Medicine</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pnb-modal-body pnb-new-med-body">
          <label>Code *<input value={form.code} onChange={(e) => setField('code', e.target.value)} autoFocus /></label>
          <label>Name *<input value={form.name} onChange={(e) => setField('name', e.target.value)} /></label>
          <label>Pack Size<input value={form.packSize} onChange={(e) => setField('packSize', e.target.value)} placeholder="e.g. 10 tabs" /></label>
          <label>Retail Price<input type="number" min="0" step="0.01" value={form.retailPrice} onChange={(e) => setField('retailPrice', e.target.value)} /></label>
          <label>Trade Price<input type="number" min="0" step="0.01" value={form.tradePrice} onChange={(e) => setField('tradePrice', e.target.value)} /></label>
        </div>
        <div className="pnb-pkg-footer">
          <button className="pnb-btn" onClick={onClose}>Cancel</button>
          <button className="pnb-add-btn" onClick={handleSubmit} disabled={saving} style={{ marginLeft: 'auto' }}>
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Billing footer's "Save" — every field already auto-saves as you type, so
// this is purely the Yes/No fork: Yes closes the real Admission File
// (finalizeDischarge), No just dismisses the warning.
function CloseFileConfirmModal({ onYes, onNo, onClose, loading }) {
  return (
    <div className="pnb-modal-overlay" onMouseDown={onClose}>
      <div className="pnb-modal pnb-modal--sm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pnb-modal-head">
          <span>Save</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pnb-modal-body pnb-close-confirm-body">
          <p>Kya aap is file ko <b>close</b> karna chahte hain?</p>
          <p className="pnb-close-confirm-hint">
            Yes — real Admission File close ho jayegi (sirf tab kaamyaab hogi jab Balance Amount pehle se clear ho), Billing hamesha ke liye read-only ho jayegi.<br />
            No — bas save ho jayegi, aap update karte reh sakte hain.
          </p>
        </div>
        <div className="pnb-pkg-footer">
          <button className="pnb-btn" onClick={onNo} disabled={loading}>No</button>
          <button className="pnb-add-btn" onClick={onYes} disabled={loading} style={{ marginLeft: 'auto' }}>
            {loading ? 'Closing…' : 'Yes, Close File'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Medicine Package checklist — pick which of the package's medicines actually
// applied for this patient; each checked one becomes its own bill row.
function PackagePickerModal({ picker, onToggle, onConfirm, onClose, confirming }) {
  const checkedCount = picker.items.filter((it) => it.checked).length;
  const checkedTotal = picker.items.filter((it) => it.checked).reduce((s, it) => s + Number(it.rate || 0), 0);
  return (
    <div className="pnb-modal-overlay" onMouseDown={onClose}>
      <div className="pnb-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pnb-modal-head">
          <span>{picker.description} — Medicine Package</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pnb-modal-body">
          <div className="pnb-pkg-list">
            {picker.items.map((it) => (
              <label key={it.id} className="pnb-pkg-row">
                <input type="checkbox" checked={it.checked} onChange={() => onToggle(it.id)} />
                <span className="pnb-pkg-name">{it.medicine}</span>
                <span className="pnb-pkg-rate">Rs. {fmt(it.rate)}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="pnb-pkg-footer">
          <button className="pnb-btn" onClick={onClose}>Cancel</button>
          <div className="pnb-pkg-footer-total">{checkedCount} selected <span>{fmt(checkedTotal)}</span></div>
          <button className="pnb-add-btn" onClick={onConfirm} disabled={confirming}>Add Selected</button>
        </div>
      </div>
    </div>
  );
}

// Click-to-edit Rate/Qty cell — same interaction as Discharge Bill's inline
// Amount edit (click → input, blur/Enter saves, Escape cancels).
function EditableCell({ row, field, editCell, savingCell, onStart, onChange, onSave, onCancel, display, type = 'number' }) {
  const isEditing = editCell?.itemId === row.id && editCell?.field === field;
  return (
    <td className={type === 'number' ? 'r pnb-edit-cell' : 'pnb-edit-cell'}>
      {isEditing ? (
        <input
          autoFocus
          type={type}
          {...(type === 'number' ? { min: '0', step: '0.01' } : {})}
          className="pnb-edit-input"
          value={editCell.value}
          disabled={savingCell}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onSave(); }
            if (e.key === 'Escape') onCancel();
          }}
        />
      ) : (
        <span className="pnb-edit-display" title="Click to edit" onClick={(e) => onStart(row, field, e)}>
          {display}
        </span>
      )}
    </td>
  );
}

// Pharmacy Bill detail — check any number of medicines (Qty/Rate/Date all
// editable right here first), each checked one gets repeated as its own row
// on the actual bill below.
function PharmacyDetailModal({ rows, onClose, onConfirmAdd, onSaveRow, onOverrideRow, onDeleteRow, confirming, readOnly }) {
  const [selections, setSelections] = useState(() =>
    rows.map((r) => ({
      key: r.id, isManual: String(r.id).startsWith('manual-'), originalAmount: r.amount,
      medicine: r.medicine, dosage: r.dosage || '', qty: r.qty, rate: r.rate, date: toInputDate(r.date), checked: false,
    }))
  );
  const [savingKey, setSavingKey] = useState(null);
  const [deletingKey, setDeletingKey] = useState(null);

  function toggle(key) {
    setSelections((s) => s.map((r) => (r.key === key ? { ...r, checked: !r.checked } : r)));
  }
  function updateField(key, field, value) {
    setSelections((s) => s.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  const checked = selections.filter((r) => r.checked);
  const checkedTotal = checked.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0);

  function handleAdd() {
    if (!checked.length) return toast.error('Kam az kam ek medicine select karo');
    onConfirmAdd(checked.map((r) => ({
      description: r.medicine, dosage: r.dosage, qty: Number(r.qty) || 0, rate: Number(r.rate) || 0, date: r.date, mergeInto: 'Medicine',
    })));
  }

  // Correct an already-added entry in place — no duplicate, unlike checking
  // it and clicking "Add Selected". Manual entries update directly; a live
  // Provisional Bill entry instead becomes a Billing-only override here (the
  // real Provisional Bill stays untouched) — see onSaveRow/onOverrideRow.
  async function handleSaveOne(key) {
    const row = selections.find((s) => s.key === key);
    setSavingKey(key);
    try {
      const patch = { date: row.date, qty: Number(row.qty) || 0, rate: Number(row.rate) || 0, dosage: row.dosage };
      if (row.isManual) {
        await onSaveRow(key, patch);
      } else {
        await onOverrideRow(key, 'Medicine', row.originalAmount, row.medicine, patch);
      }
      toast.success('Update ho gaya');
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
    } finally {
      setSavingKey(null);
    }
  }

  // Remove an already-added entry — a manual add gets actually deleted; a
  // live Provisional Bill entry instead gets excluded from this Billing
  // screen only (the real Provisional Bill stays untouched) — see
  // onDeleteRow/excludeLiveDetailItem.
  async function handleDeleteOne(key) {
    const row = selections.find((s) => s.key === key);
    if (!window.confirm(`"${row.medicine}" ko bill se delete karna hai?`)) return;
    setDeletingKey(key);
    try {
      await onDeleteRow(key, 'Medicine', row.originalAmount);
      setSelections((s) => s.filter((r) => r.key !== key));
      toast.success('Delete ho gaya');
    } catch (e) {
      toast.error(e.message || 'Delete nahi hua');
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <div className="pnb-modal-overlay" onMouseDown={onClose}>
      <div className="pnb-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pnb-modal-head">
          <span>Pharmacy Bill</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pnb-modal-body">
          <table className="pnb-table">
            <thead>
              <tr><th></th><th>Date</th><th>Medicine</th><th>Dose</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th><th></th></tr>
            </thead>
            <tbody>
              {selections.length === 0 ? (
                <tr><td colSpan={8} className="pnb-empty">Koi record nahi mila</td></tr>
              ) : selections.map((r) => (
                <tr key={r.key} className={r.checked ? 'pnb-pkg-row-selected' : ''}>
                  <td><input type="checkbox" checked={r.checked} onChange={() => toggle(r.key)} disabled={readOnly} /></td>
                  <td>
                    <input type="date" className="pnb-mini-input" value={r.date}
                      onChange={(e) => updateField(r.key, 'date', e.target.value)} disabled={readOnly} />
                  </td>
                  <td>{r.medicine}</td>
                  <td>
                    <input className="pnb-mini-input" value={r.dosage} placeholder="e.g. 1 tab"
                      onChange={(e) => updateField(r.key, 'dosage', e.target.value)} disabled={readOnly} />
                  </td>
                  <td className="r">
                    <input type="number" min="0" className="pnb-mini-input pnb-mini-input--num" value={r.qty}
                      onChange={(e) => updateField(r.key, 'qty', e.target.value)} disabled={readOnly} />
                  </td>
                  <td className="r">
                    <input type="number" min="0" step="0.01" className="pnb-mini-input pnb-mini-input--num" value={r.rate}
                      onChange={(e) => updateField(r.key, 'rate', e.target.value)} disabled={readOnly} />
                  </td>
                  <td className="r">{fmt((Number(r.qty) || 0) * (Number(r.rate) || 0))}</td>
                  <td>
                    {!readOnly && (
                      <div className="pnb-row-actions">
                        <button className="pnb-save-row-btn" onClick={() => handleSaveOne(r.key)} disabled={savingKey === r.key || deletingKey === r.key}
                          title={r.isManual ? 'Update this entry' : 'Save as a Billing-only correction (Provisional Bill stays as-is)'}>
                          {savingKey === r.key ? '…' : 'Save'}
                        </button>
                        <button className="pnb-del-row-btn" onClick={() => handleDeleteOne(r.key)} disabled={savingKey === r.key || deletingKey === r.key}
                          title={r.isManual ? 'Delete this entry' : 'Delete from this bill (Provisional Bill stays as-is)'}>
                          {deletingKey === r.key ? '…' : '✕'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pnb-pkg-footer">
          <button className="pnb-btn" onClick={onClose}>Cancel</button>
          <div className="pnb-pkg-footer-total">{checked.length} selected <span>{fmt(checkedTotal)}</span></div>
          {!readOnly && <button className="pnb-add-btn" onClick={handleAdd} disabled={confirming}>Add Selected</button>}
        </div>
      </div>
    </div>
  );
}

// Diagnostic Bill detail (Laboratory + Radiology + Ultrasound, same as the
// Diagnostic tab in Provisional Bill) — same checklist pattern as Pharmacy:
// check any number of tests (Qty/Rate/Date all editable right here first,
// Rate defaults to the original Amount since these aren't naturally qty×rate
// like medicine), each checked one gets repeated as its own row on the
// actual bill below.
function DiagnosticDetailModal({ title, rows, onClose, onConfirmAdd, onSaveRow, onOverrideRow, onDeleteRow, confirming, readOnly }) {
  const [selections, setSelections] = useState(() =>
    rows.map((r) => ({
      key: r.id, isManual: String(r.id).startsWith('manual-'), originalAmount: r.amount, particulars: r.particulars || r.department,
      qty: r.qty ?? 1, rate: r.rate ?? r.amount, date: toInputDate(r.date), checked: false,
    }))
  );
  const [savingKey, setSavingKey] = useState(null);
  const [deletingKey, setDeletingKey] = useState(null);

  function toggle(key) {
    setSelections((s) => s.map((r) => (r.key === key ? { ...r, checked: !r.checked } : r)));
  }
  function updateField(key, field, value) {
    setSelections((s) => s.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  const checked = selections.filter((r) => r.checked);
  const checkedTotal = checked.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.rate) || 0), 0);

  function handleAdd() {
    if (!checked.length) return toast.error('Kam az kam ek test select karo');
    onConfirmAdd(checked.map((r) => ({ description: r.particulars, qty: Number(r.qty) || 0, rate: Number(r.rate) || 0, date: r.date, mergeInto: title })));
  }

  // Correct an already-added entry in place — no duplicate. Manual entries
  // update directly; a live Provisional Bill entry instead becomes a
  // Billing-only override (the real Provisional Bill stays untouched) —
  // see onSaveRow/onOverrideRow.
  async function handleSaveOne(key) {
    const row = selections.find((s) => s.key === key);
    setSavingKey(key);
    try {
      const patch = { date: row.date, qty: Number(row.qty) || 0, rate: Number(row.rate) || 0 };
      if (row.isManual) {
        await onSaveRow(key, patch);
      } else {
        await onOverrideRow(key, title, row.originalAmount, row.particulars, patch);
      }
      toast.success('Update ho gaya');
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
    } finally {
      setSavingKey(null);
    }
  }

  // Remove an already-added entry — a manual add gets actually deleted; a
  // live Provisional Bill entry instead gets excluded from this Billing
  // screen only (the real Provisional Bill stays untouched) — see
  // onDeleteRow/excludeLiveDetailItem.
  async function handleDeleteOne(key) {
    const row = selections.find((s) => s.key === key);
    if (!window.confirm(`"${row.particulars}" ko bill se delete karna hai?`)) return;
    setDeletingKey(key);
    try {
      await onDeleteRow(key, title, row.originalAmount);
      setSelections((s) => s.filter((r) => r.key !== key));
      toast.success('Delete ho gaya');
    } catch (e) {
      toast.error(e.message || 'Delete nahi hua');
    } finally {
      setDeletingKey(null);
    }
  }

  return (
    <div className="pnb-modal-overlay" onMouseDown={onClose}>
      <div className="pnb-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pnb-modal-head">
          <span>{title}</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pnb-modal-body">
          <table className="pnb-table">
            <thead>
              <tr><th></th><th>Date</th><th>Particulars</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th><th></th></tr>
            </thead>
            <tbody>
              {selections.length === 0 ? (
                <tr><td colSpan={7} className="pnb-empty">Koi record nahi mila</td></tr>
              ) : selections.map((r) => (
                <tr key={r.key} className={r.checked ? 'pnb-pkg-row-selected' : ''}>
                  <td><input type="checkbox" checked={r.checked} onChange={() => toggle(r.key)} disabled={readOnly} /></td>
                  <td>
                    <input type="date" className="pnb-mini-input" value={r.date}
                      onChange={(e) => updateField(r.key, 'date', e.target.value)} disabled={readOnly} />
                  </td>
                  <td>{r.particulars}</td>
                  <td className="r">
                    <input type="number" min="0" className="pnb-mini-input pnb-mini-input--num" value={r.qty}
                      onChange={(e) => updateField(r.key, 'qty', e.target.value)} disabled={readOnly} />
                  </td>
                  <td className="r">
                    <input type="number" min="0" step="0.01" className="pnb-mini-input pnb-mini-input--num" value={r.rate}
                      onChange={(e) => updateField(r.key, 'rate', e.target.value)} disabled={readOnly} />
                  </td>
                  <td className="r">{fmt((Number(r.qty) || 0) * (Number(r.rate) || 0))}</td>
                  <td>
                    {!readOnly && (
                      <div className="pnb-row-actions">
                        <button className="pnb-save-row-btn" onClick={() => handleSaveOne(r.key)} disabled={savingKey === r.key || deletingKey === r.key}
                          title={r.isManual ? 'Update this entry' : 'Save as a Billing-only correction (Provisional Bill stays as-is)'}>
                          {savingKey === r.key ? '…' : 'Save'}
                        </button>
                        <button className="pnb-del-row-btn" onClick={() => handleDeleteOne(r.key)} disabled={savingKey === r.key || deletingKey === r.key}
                          title={r.isManual ? 'Delete this entry' : 'Delete from this bill (Provisional Bill stays as-is)'}>
                          {deletingKey === r.key ? '…' : '✕'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pnb-pkg-footer">
          <button className="pnb-btn" onClick={onClose}>Cancel</button>
          <div className="pnb-pkg-footer-total">{checked.length} selected <span>{fmt(checkedTotal)}</span></div>
          {!readOnly && <button className="pnb-add-btn" onClick={handleAdd} disabled={confirming}>Add Selected</button>}
        </div>
      </div>
    </div>
  );
}

// Panels > Billing > Reports — matches the reference "Reports" dialog: pick
// an Admission #, pick a report, Ok prints it. Only Billing Covering Page and
// Diagnostic Bill are wired up so far — the rest are shown but disabled.
function ReportsModal({ admitNo, onAdmitNoChange, reportType, onReportTypeChange, onClose, onGenerate, loading }) {
  return (
    <div className="pnb-modal-overlay" onMouseDown={onClose}>
      <div className="pnb-modal pnb-reports-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pnb-modal-head">
          <span>Reports</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pnb-modal-body">
          <div className="pnb-reports-num-row">
            <label>Admission #</label>
            <input value={admitNo} onChange={(e) => onAdmitNoChange(e.target.value)} placeholder="e.g. 174628" />
          </div>
          <div className="pnb-reports-types">
            {REPORT_TYPES.map((t) => (
              <label key={t.key} className={`pnb-reports-opt ${!t.ready ? 'pnb-reports-opt--disabled' : ''} ${reportType === t.key ? 'pnb-reports-opt--active' : ''}`}>
                <input
                  type="radio"
                  name="reportType"
                  checked={reportType === t.key}
                  disabled={!t.ready}
                  onChange={() => onReportTypeChange(t.key)}
                />
                {t.label}
                {!t.ready && <span className="pnb-reports-soon">coming soon</span>}
              </label>
            ))}
          </div>
        </div>
        <div className="pnb-pkg-footer">
          <button className="pnb-btn" onClick={onClose}>Close</button>
          <button className="pnb-add-btn" onClick={onGenerate} disabled={loading} style={{ marginLeft: 'auto' }}>
            {loading ? 'Loading…' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Billing Covering Page (print) ───────────────────────────────────────────
// Rate×Qty only means something for ward/head-item rows — Medicine/
// Laboratory/Radiology/Ultrasound are blended totals, shown amount-only.
function BillingCoveringPagePrintTemplate({ data }) {
  if (!data) return null;
  const { admission, company, employee } = data;
  const rows = data.rows.filter((r) => Number(r.amount) !== 0);
  const total = data.billingAmount;

  return (
    <div className="pnbr-print-area">
      <div className="pnbr-cov">
        <table className="pnbr-cov-hdr">
          <tbody>
            <tr>
              <td className="pnbr-cov-left">
                <div>To.</div>
                <div>C.M.O</div>
                <div className="pnbr-cov-org">{company?.name || '—'}</div>
              </td>
              <td className="pnbr-cov-right">
                <table>
                  <tbody>
                    <tr><td className="l">Bill No.</td><td className="v">{ddmmyyyy(admission.admitDate)}</td></tr>
                    <tr><td className="l">Date:</td><td className="v">{fmtDate(new Date())}</td></tr>
                    <tr><td className="l">Admit No.</td><td className="v">P-{admission.admissionNo}</td></tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="pnbr-cov-info">
          <tbody>
            <tr>
              <td className="l">Patients Name:</td><td className="v">{admission.patientName}</td>
              <td className="l">Organization :</td><td className="v">{company?.name || '—'}</td>
            </tr>
            <tr>
              <td className="l">Emp.C.No</td><td className="v">{employee?.empCode || '—'}</td>
              <td className="l">DOD :</td><td className="v">{fmtDate(admission.dischargeDate)}</td>
            </tr>
            <tr>
              <td className="l">D.O.A</td><td className="v">{fmtDate(admission.admitDate)}</td>
              <td className="l">Consultant :</td><td className="v">{admission.consultantName || '—'}</td>
            </tr>
            <tr>
              <td className="l">No of Days:</td><td className="v">{admission.days}</td>
              <td className="l">Entitled for :</td><td className="v"></td>
            </tr>
            <tr>
              <td className="l">Diagnosis:</td><td className="v" colSpan={3}>{admission.diagnosis || '—'}</td>
            </tr>
          </tbody>
        </table>

        <table className="pnbr-cov-items">
          <thead>
            <tr><th>#</th><th>Description</th><th className="r">Detail</th><th className="r">Amount</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>{r.description}</td>
                <td className="r">{(r.kind === 'ward' || r.kind === 'item' || r.kind === 'custom') ? `${fmt(r.rate)} X ${r.qty}` : ''}</td>
                <td className="r">{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pnbr-cov-total-row">
          <div className="pnbr-cov-words">{numToWords(Math.floor(total))} and xx/100</div>
          <div className="pnbr-cov-total">TOTAL : <span>{fmt(total)}</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Diagnostic Bill (print) ─────────────────────────────────────────────────
function DiagnosticBillPrintTemplate({ data }) {
  if (!data) return null;
  const { admission } = data;
  const byDept = {};
  data.diagnosticRows.forEach((r) => { (byDept[r.department] ||= []).push(r); });
  const grandTotal = data.diagnosticRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="pnbr-print-area">
      <div className="pnbr-diag">
        <div className="pnbr-diag-title">DIAGNOSTIC BILL</div>
        <table className="pnbr-diag-hdr">
          <tbody>
            <tr>
              <td className="l">Admission #</td><td className="v">{admission.admissionNo}</td>
              <td className="l">Patient Name:</td><td className="v">{admission.patientName}</td>
            </tr>
            <tr>
              <td className="l">Admission date</td><td className="v">{fmtDate(admission.admitDate)}</td>
              <td className="l">Discharge date:</td><td className="v">{admission.dischargeDate ? fmtDate(admission.dischargeDate) : '—'}</td>
            </tr>
          </tbody>
        </table>

        {Object.entries(byDept).map(([dept, deptRows]) => {
          const subtotal = deptRows.reduce((s, r) => s + Number(r.amount || 0), 0);
          return (
            <div key={dept} className="pnbr-diag-block">
              <div className="pnbr-diag-dept-row">
                <span className="pnbr-diag-dept">{dept.toUpperCase()}</span>
                <span className="pnbr-diag-amount-label">Amount</span>
              </div>
              <table className="pnbr-diag-tbl">
                <tbody>
                  {deptRows.map((r) => (
                    <tr key={r.id}><td>{fmtDate(r.date)}</td><td>{r.particulars || dept}</td><td className="r">{fmt(r.amount)}</td></tr>
                  ))}
                  <tr className="pnbr-diag-subtotal"><td colSpan={2}>Departmental Total</td><td className="r">{fmt(subtotal)}</td></tr>
                </tbody>
              </table>
            </div>
          );
        })}

        <div className="pnbr-diag-grand">Grand Total <span>{fmt(grandTotal)}</span></div>
      </div>
    </div>
  );
}

// ── Medicine Bill (print) — mirrors the legacy "PHARMACY/MEDICAL STORE
// BILL" printout exactly: every Pharmacy row (Hospital Store sales invoices
// + Outside Store + manual Panel Billing adds — same data as the Pharmacy
// Bill detail popup), one flat chronological list, "code - name" where a
// code exists (only Hospital Store rows carry one, same as the legacy data).
function MedicineBillPrintTemplate({ data }) {
  if (!data) return null;
  const { admission } = data;
  const rows = [...data.pharmacyRows].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="pnbr-print-area">
      <div className="pnbr-med">
        <div className="pnbr-med-title">PHARMACY/MEDICAL STORE BILL</div>
        <table className="pnbr-med-hdr">
          <tbody>
            <tr>
              <td className="l">Admission #</td><td className="v">{admission.admissionNo}</td>
              <td className="l">Patient Name</td><td className="v">{admission.patientName}</td>
            </tr>
            <tr>
              <td className="l">Admission date</td><td className="v">{fmtDdMmYyyyNum(admission.admitDate)}</td>
              <td className="l">Discharge date</td><td className="v">{admission.dischargeDate ? fmtDdMonYyyyHm(admission.dischargeDate) : '—'}</td>
            </tr>
          </tbody>
        </table>

        <table className="pnbr-med-tbl">
          <thead>
            <tr><th>Medicine Date</th><th>Medicine</th><th>Dose</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="pnbr-med-empty">Koi medicine/store item nahi mila</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtMonDdYyyyHm(r.date)}</td>
                <td>{r.code ? `${r.code} - ${r.medicine}` : r.medicine}</td>
                <td>{r.dosage || ''}</td>
                <td className="r">{fmt2(r.qty)}</td>
                <td className="r">{fmt2(r.rate)}</td>
                <td className="r">{fmt2(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pnbr-med-total">Total <span>{fmt2(total)}</span></div>
      </div>
    </div>
  );
}
