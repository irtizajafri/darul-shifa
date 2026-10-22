import { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { Search, X, Plus } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import { useClinicStore } from '../../../store/useClinicStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { printElementInPopup } from '../../../utils/printPopup';
import { openPrintWindow } from '../../../utils/printRelay';
import '../AdmissionAdjustment.scss'; // .aa-* lookup-modal classes
import './PanelBilling.scss';
import { useShallow } from 'zustand/react/shallow';

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
// 21-Jun-2026 — Medicine Bill's "Discharge date" (no time — was showing
// 00:00 on every row, which just read as noise, not real information).
function fmtDdMonYyyy(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${pad2(dt.getDate())}-${dt.toLocaleString('en-GB', { month: 'short' })}-${dt.getFullYear()}`;
}
// Jun-19-2026 — Medicine Bill's per-row "Medicine Date" (no time, same reason).
function fmtMonDdYyyy(d) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.toLocaleString('en-GB', { month: 'short' })}-${pad2(dt.getDate())}-${dt.getFullYear()}`;
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

// ── Keyboard (Panels > Billing + its popups) ─────────────────────────────────
// Enter / ↓ = next field, ↑ = previous (same idea as utils/keyboardNav, but
// skipping tabIndex -1 helpers like "+ New Medicine" / "+" so a second Enter
// never opens them by accident; the last field's Enter fires the container's
// [data-enter-submit] button). A key a
// control already handled (dropdown list, SearchableSelect, inline cell) is
// left alone. Inside a detail popup's table: Enter walks the row's boxes only
// (never lands on the ✕ delete button), ↑ / ↓ go to the same column on the
// next / previous line. Date boxes keep their own ↑ / ↓ (change the date).
function billingKeyNav(e) {
  if (e.defaultPrevented) return;
  if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.nativeEvent?.isComposing) return;
  const t = e.target;
  const isArrow = e.key === 'ArrowDown' || e.key === 'ArrowUp';
  if (isArrow && t.type === 'date') return;
  const body = t.tagName === 'INPUT' ? t.closest('.pnb-modal--detail tbody') : null;
  if (body && (isArrow || e.key === 'Enter')) {
    e.preventDefault();
    const focusIt = (el) => { el.focus(); if (el.type !== 'checkbox' && el.type !== 'date') el.select?.(); };
    if (isArrow) {
      const td = t.closest('td');
      const col = [...td.parentElement.children].indexOf(td);
      let row = td.parentElement;
      while ((row = e.key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling)) {
        const next = row.children[col]?.querySelector('input:not([disabled])');
        if (next) { focusIt(next); return; }
      }
      return;
    }
    const boxes = [...body.querySelectorAll('input:not([disabled]):not([type="checkbox"])')];
    const next = boxes[boxes.indexOf(t) + 1];
    if (next) focusIt(next); else t.blur();
    return;
  }
  stepBillingFocus(e);
}

const BILLING_FOCUSABLE = 'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), '
  + 'textarea:not([disabled]), button:not([disabled]), [tabindex]';
function stepBillingFocus(e) {
  const isEnter = e.key === 'Enter';
  const isArrow = e.key === 'ArrowDown' || e.key === 'ArrowUp';
  if (!isEnter && !isArrow) return;
  const t = e.target;
  if (isEnter && (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.tagName === 'A')) return;
  if (isArrow && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
  const list = [...e.currentTarget.querySelectorAll(BILLING_FOCUSABLE)]
    .filter((el) => el.getAttribute('tabindex') !== '-1' && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const idx = list.indexOf(t);
  if (idx === -1) return;
  e.preventDefault();
  const next = list[idx + (e.key === 'ArrowUp' ? -1 : 1)];
  if (next) {
    next.focus();
    if ((next.tagName === 'INPUT' && next.type !== 'checkbox' && next.type !== 'date') || next.tagName === 'TEXTAREA') next.select?.();
    return;
  }
  if (e.key !== 'ArrowUp') {
    const submitBtn = e.currentTarget.querySelector('[data-enter-submit]');
    if (submitBtn && !submitBtn.disabled) submitBtn.click();
  }
}

// ↑ / ↓ highlight an open search list's options, Enter picks the highlighted
// one (nothing highlighted → Enter just moves on with what was typed).
function useComboKeys(count, isOpen, onPick) {
  // highlight starts over whenever the list changes or opens/closes
  const listKey = `${count}|${isOpen}`;
  const [state, setState] = useState({ listKey, hi: -1 });
  const hi = state.listKey === listKey ? state.hi : -1;
  const setHi = (fn) => setState((s) => ({ listKey, hi: fn(s.listKey === listKey ? s.hi : -1) }));
  function onKeyDown(e) {
    if (!isOpen || !count) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => Math.min(i + 1, count - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); onPick(hi); }
  }
  return { hi, onKeyDown };
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  const day   = String(dt.getDate()).padStart(2, '0');
  const month = dt.toLocaleString('en-GB', { month: 'short' });
  const year  = dt.getFullYear();
  return `${day}-${month}-${year}`;
}

// Bill Date is typed freely (no calendar) — read what was typed as a date
// and show it in the same dd-Mon-yyyy format as DOD. Accepts 01032026,
// 010326, 01/03/2026, 1-3-26, 01 Mar 2026…; anything else stays as typed.
const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseTypedDate(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  let d, m, y;
  const digits = t.match(/^(\d{2})(\d{2})(\d{4}|\d{2})$/);
  if (digits) [, d, m, y] = digits;
  else {
    const parts = t.split(/[\s/.-]+/).filter(Boolean);
    if (parts.length !== 3) return null;
    [d, m, y] = parts;
    if (!/^\d+$/.test(m)) {
      const idx = MONTHS_SHORT.indexOf(m.slice(0, 3).toLowerCase());
      if (idx < 0) return null;
      m = String(idx + 1);
    }
  }
  if (![d, m, y].every((v) => /^\d+$/.test(v))) return null;
  const year = y.length === 2 ? 2000 + Number(y) : Number(y);
  const dt = new Date(year, Number(m) - 1, Number(d));
  return dt.getFullYear() === year && dt.getMonth() === Number(m) - 1 && dt.getDate() === Number(d) ? dt : null;
}
function formatBillDate(text) {
  const dt = parseTypedDate(text);
  return dt ? fmtDate(dt) : String(text || '').trim();
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

// Covering Page's "Bill No." — the Billing header's own Sno sequence (same
// number as the "Sno" field/preview on the main Billing screen) followed by
// Admit Date's month and 4-digit year, no separators — e.g. Sno 09 + May
// 2026 admit date → "09052026".
function billNo(admission) {
  if (!admission.snoSeq || !admission.admitDate) return '—';
  const dt = new Date(admission.admitDate);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${admission.snoSeq}${mm}${dt.getFullYear()}`;
}

// The "Ultrasound" head (legacy Sno 24) is diagnostic-sourced but keeps the
// short legacy label — its real diagnosticRows department is the longer
// "Ultra Sound, Echo & Color Doppler" name, so translate here rather than
// filtering/matching on a name that'll never match.
const DIAG_DEPT_ALIASES = { Ultrasound: 'Ultra Sound, Echo & Color Doppler' };

// Medicine/Laboratory/Radiology/Ultrasound rows are always-visible totals —
// their real line items (which medicine, which test) live in
// pharmacyRows/diagnosticRows and used to only surface via the double-click
// detail modal. Now also shown inline, indented right under the parent row,
// so they're visible without a click; the modal stays for actually editing/
// overriding/deleting/adding entries.
function subItemsFor(row, data) {
  if (row.kind === 'pharmacy') {
    return data.pharmacyRows.map((p) => ({ id: p.id, label: p.medicine, rate: p.rate, qty: p.qty, amount: p.amount }));
  }
  if (row.kind === 'diagnostic') {
    const dept = DIAG_DEPT_ALIASES[row.description] || row.description;
    return data.diagnosticRows
      .filter((d) => d.department === dept)
      .map((d) => ({ id: d.id, label: d.particulars || dept, rate: d.rate, qty: d.qty, amount: d.amount }));
  }
  return [];
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

// All three reports wired up here (Billing Covering Page, Medicine Bill,
// Diagnostic Bill) print on pre-printed hospital letterhead — top margin left
// generous (same value as DischargeRefund.jsx's Final Bill print) so content
// starts below the letterhead artwork instead of overlapping it. Covering
// Page needs extra room beyond that (its letterhead sits lower) — 50px more
// (~13mm) than the other two.
//
// Printed from a popup window (utils/printPopup.js), never window.print() on
// the main window, which could freeze the whole app behind a modal print
// dialog on Windows. The `.pnbr-print-area` is display:none on screen and
// positioned absolutely by this page's print CSS (it was overlaid on the
// live page); inside the popup it is the whole document, so render it
// statically instead.
const PRINT_TOP_MARGIN = { covering: '48mm', medicine: '35mm', diagnostic: '35mm' };
const PRINT_TITLES = { covering: 'Billing Covering Page', medicine: 'Pharmacy Bill', diagnostic: 'Diagnostic Bill' };
function printPanelReport(printHostEl, reportType, targetWindow) {
  const topMargin = PRINT_TOP_MARGIN[reportType] || '35mm';
  printElementInPopup(printHostEl, {
    title: PRINT_TITLES[reportType] || 'Panel Billing',
    page: 'A4 portrait',
    margin: `${topMargin} 10mm`,
    targetWindow,
    extraCss: '.pnbr-print-area { display: block !important; position: static !important; }',
  });
}

// After Save (Yes or No) the three reports print together from ONE
// print-relay window (one print dialog — three separate windows meant three
// print dialogs at once), in this order, each starting on a new page with
// its own letterhead margin. A single document can carry different page
// margins through CSS named pages (`page: <name>` + `@page <name>`), so
// every page of each report — continuation pages too — keeps exactly the
// margin it had when printed on its own.
const SAVE_REPORTS = ['covering', 'medicine', 'diagnostic'];
const PRINT_WINDOW_FEATURES = 'width=900,height=800';
function printAllPanelReports(printHostEl, targetWindow) {
  const namedPages = SAVE_REPORTS.map((type) => `
    @page pnb-${type} { margin: ${PRINT_TOP_MARGIN[type] || '35mm'} 10mm; }
    [data-report="${type}"] { page: pnb-${type}; }`).join('');
  printElementInPopup(printHostEl, {
    title: 'Panel Billing Reports',
    page: 'A4 portrait',
    margin: '35mm 10mm',
    targetWindow,
    extraCss: `.pnbr-print-area { display: block !important; position: static !important; }
    ${namedPages}
    [data-report] + [data-report] { break-before: page; page-break-before: always; }`,
  });
}

// ── Panel Admission/OPD Lookup Modal — patientCategory/paymentType 'panel'
// only. Same modal for both Billing modes (see `mode` prop) — just the
// number-column label/placeholder/date-column label swap.
function PanelAdmissionLookupModal({ mode = 'admission', onSelect, onClose, searchPanelAdmissions }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const timer = useRef(null);
  const numberLabel = mode === 'opd' ? 'Slip #' : 'Admission #';
  const dateLabel = mode === 'opd' ? 'Visit Date' : 'Admission Date';

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
            placeholder={`Search ${numberLabel} or Patient Name…`}
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
                <tr><th>{numberLabel}</th><th>Patient</th><th>Status</th><th>{dateLabel}</th></tr>
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
    fetchPanelOpdVisitBilling, searchPanelOpdVisits, updatePanelOpdBillingItem,
    updatePanelOpdBillingHeader, addPanelOpdBillingItem, deletePanelOpdBillingItem,
    addPanelOpdBillingItemsBulk,
    subDepartments, fetchSubDepartments, searchPanelBillHeads,
    doctors, fetchDoctors, diseases, fetchDiseases, surgeryTypes, fetchSurgeryTypes,
    roomCategories, fetchRoomCategories,
    fetchMedicineList, createMedicine,
    finalizeDischarge,
    panelCompanies, fetchPanelCompanies, panelEmployees, fetchPanelEmployees, setPanelBillingParty,
  } = useClinicStore(useShallow((s) => ({ fetchPanelAdmissionBilling: s.fetchPanelAdmissionBilling, searchPanelAdmissions: s.searchPanelAdmissions, updatePanelBillingItem: s.updatePanelBillingItem, updatePanelBillingHeader: s.updatePanelBillingHeader, overrideLiveDetailItem: s.overrideLiveDetailItem, excludeLiveDetailItem: s.excludeLiveDetailItem, addPanelBillingItem: s.addPanelBillingItem, deletePanelBillingItem: s.deletePanelBillingItem, addPanelBillingItemsBulk: s.addPanelBillingItemsBulk, fetchPanelOpdVisitBilling: s.fetchPanelOpdVisitBilling, searchPanelOpdVisits: s.searchPanelOpdVisits, updatePanelOpdBillingItem: s.updatePanelOpdBillingItem, updatePanelOpdBillingHeader: s.updatePanelOpdBillingHeader, addPanelOpdBillingItem: s.addPanelOpdBillingItem, deletePanelOpdBillingItem: s.deletePanelOpdBillingItem, addPanelOpdBillingItemsBulk: s.addPanelOpdBillingItemsBulk, subDepartments: s.subDepartments, fetchSubDepartments: s.fetchSubDepartments, searchPanelBillHeads: s.searchPanelBillHeads, doctors: s.doctors, fetchDoctors: s.fetchDoctors, diseases: s.diseases, fetchDiseases: s.fetchDiseases, surgeryTypes: s.surgeryTypes, fetchSurgeryTypes: s.fetchSurgeryTypes, roomCategories: s.roomCategories, fetchRoomCategories: s.fetchRoomCategories, fetchMedicineList: s.fetchMedicineList, createMedicine: s.createMedicine, finalizeDischarge: s.finalizeDischarge, panelCompanies: s.panelCompanies, fetchPanelCompanies: s.fetchPanelCompanies, panelEmployees: s.panelEmployees, fetchPanelEmployees: s.fetchPanelEmployees, setPanelBillingParty: s.setPanelBillingParty })));
  const { user } = useAuthStore();
  // Same "Billing" screen, toggled between Admission # (IPD) and Slip #
  // (panel OPD visits — Consultant/Ultrasound/etc.) lookup. Which one is
  // currently loaded is also readable off data.admission.sourceType once a
  // record is loaded (see isOpd below) — lookupMode only matters before/while
  // choosing what to look up next.
  const [lookupMode, setLookupMode] = useState('admission'); // 'admission' | 'opd'
  const [admitNo, setAdmitNo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState(null); // 'pharmacy' | 'diagnostic' | null
  const [diagnosticDept, setDiagnosticDept] = useState(null); // which of Laboratory/Radiology/Ultra Sound… was double-clicked
  const [showLookup, setShowLookup] = useState(false);
  const [copying, setCopying] = useState(false);
  const [editCell, setEditCell] = useState(null); // { itemId, field: 'rate'|'qty', value } | null
  const [savingCell, setSavingCell] = useState(false);

  const isOpd = data?.admission.sourceType === 'opd';

  // Once the real Admission File is closed (see handleConfirmCloseFile below)
  // this Billing snapshot goes read-only — data stays visible/printable, but
  // nothing can be added/edited/deleted anymore. OPD Billing never locks —
  // a panel OPD visit has no "Close File" lifecycle to mirror.
  const readOnly = !isOpd && data?.admission.status === 'closed';
  // Admission: Medicine / Lab / Radiology / Ultrasound are added from their
  // own row's detail popup (see HeadAddRow) — the top bar keeps Panel Head
  // (and packages) only. OPD slips keep the full top bar.
  const topCustomTypes = isOpd ? CUSTOM_TYPES : CUSTOM_TYPES.filter((t) => t.key === 'panelhead');
  // Bumped after an add from inside a detail popup — remounts the popup so
  // its list picks up the new row.
  const [popupNonce, setPopupNonce] = useState(0);
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
  // Blank until touched — the visible field still shows Admit Date as a
  // sensible starting point (see the date input's value below), but this
  // stays '' so we can tell "never touched" apart from "explicitly picked
  // the same date as Admit Date" when deciding what to send on Add.
  // A picked date stays put after Add (owner, 2026-10-21 — several lines of
  // the same day go in one after another); it's tied to the admission it
  // was picked on, so opening another file starts again from its Admit Date.
  const [customDatePick, setCustomDatePick] = useState({ admissionId: null, date: '' });
  const customDate = customDatePick.admissionId === data?.admission?.id ? customDatePick.date : '';
  const setCustomDate = (date) => setCustomDatePick({ admissionId: data?.admission?.id ?? null, date });
  const [addingCustom, setAddingCustom] = useState(false);
  const customSearchTimer = useRef(null);
  const [showAddMedicine, setShowAddMedicine] = useState(false); // quick-add straight into the Medicine List

  // Medicine Package checklist — set when a 'package' Panel Head is picked,
  // instead of filling the manual-add form.
  const [packagePicker, setPackagePicker] = useState(null); // { description, items: [{...packageItem, checked}] } | null
  const [confirmingPackage, setConfirmingPackage] = useState(false);

  // Consultant / Diagnosis — search-as-you-type combos (same .pnb-combo UI
  // as the manual-add Item field above). Diagnosis also accepts arbitrary
  // free text, not just list picks; Consultant does too, for the same
  // "don't block on an incomplete parameter list" reason. Kept in sync with
  // the loaded admission's saved value via the effect below.
  const [consultantQuery, setConsultantQuery] = useState('');
  const [showConsultantOptions, setShowConsultantOptions] = useState(false);
  const [diagnosisQuery, setDiagnosisQuery] = useState('');
  const [showDiagnosisOptions, setShowDiagnosisOptions] = useState(false);
  useEffect(() => {
    setConsultantQuery(data?.admission.consultantName || '');
    setDiagnosisQuery(data?.admission.diagnosis || '');
  }, [data?.admission.id]);

  useEffect(() => { fetchSubDepartments(); }, [fetchSubDepartments]);
  useEffect(() => { fetchPanelCompanies(); fetchPanelEmployees(); }, [fetchPanelCompanies, fetchPanelEmployees]);

  // Company / Employee by hand — saved on the admission / slip itself (see
  // setPanelBillingParty), then the bill reloads so the header shows it.
  const partyEmployees = useMemo(() => {
    const compId = data?.company?.id;
    const list = compId ? panelEmployees.filter((e) => e.companyId === compId || e.billCompanyId === compId) : panelEmployees;
    // the saved employee stays pickable even if listed under another company
    if (data?.employee && !list.some((e) => e.id === data.employee.id)) {
      const cur = panelEmployees.find((e) => e.id === data.employee.id);
      if (cur) return [cur, ...list];
    }
    return list;
  }, [panelEmployees, data?.company?.id, data?.employee]);

  // "+ Nayi" — a company / employee not in the list, typed in by hand: it is
  // created in Panel Companies / Panel Employees, then set on this file.
  const [newParty, setNewParty] = useState(null); // 'company' | 'employee' | null
  async function handleNewPartySaved(kind, created) {
    await (kind === 'company' ? fetchPanelCompanies() : fetchPanelEmployees());
    setNewParty(null);
    await handlePartyChange(kind, created.id);
  }

  async function handlePartyChange(field, value) {
    if (!data) return;
    const next = {
      panelCompanyId: field === 'company' ? (value || null) : (data.company?.id || null),
      panelEmployeeId: field === 'employee' ? (value || null) : (field === 'company' ? null : (data.employee?.id || null)),
    };
    try {
      await setPanelBillingParty(isOpd ? 'opd' : 'admission', data.admission.id, next);
      await reload();
      toast.success(field === 'company' ? 'Company save ho gayi' : 'Employee save ho gaya', { id: 'pnb-party' });
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
    }
  }
  useEffect(() => {
    if (!data) return;
    if (!isOpd && customType !== 'panelhead') { setCustomType('panelhead'); setCustomQuery(''); setCustomOptions([]); }
  }, [data?.admission.id, isOpd]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fetchDoctors(); fetchDiseases(); fetchSurgeryTypes(); fetchRoomCategories(); }, [fetchDoctors, fetchDiseases, fetchSurgeryTypes, fetchRoomCategories]);

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

  // Search-filtered views of the two lists above, for the combo dropdowns.
  const filteredConsultantOptions = useMemo(() => {
    const q = consultantQuery.trim().toLowerCase();
    return q ? consultantOptions.filter((n) => n.toLowerCase().includes(q)) : consultantOptions;
  }, [consultantOptions, consultantQuery]);
  const filteredDiagnosisOptions = useMemo(() => {
    const q = diagnosisQuery.trim().toLowerCase();
    return q ? diagnosisOptions.filter((n) => n.toLowerCase().includes(q)) : diagnosisOptions;
  }, [diagnosisOptions, diagnosisQuery]);

  // Keyboard ↑ / ↓ / Enter on the three search lists (see useComboKeys)
  const consultantKeys = useComboKeys(filteredConsultantOptions.length, showConsultantOptions, (i) => { const n = filteredConsultantOptions[i]; setConsultantQuery(n); pickConsultant(n); });
  const diagnosisKeys = useComboKeys(filteredDiagnosisOptions.length, showDiagnosisOptions, (i) => { const n = filteredDiagnosisOptions[i]; setDiagnosisQuery(n); pickDiagnosis(n); });
  const customKeys = useComboKeys(customOptions.length, showCustomOptions, (i) => pickCustomOption(customOptions[i]));

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
      const bulkAdd = isOpd ? addPanelOpdBillingItemsBulk : addPanelBillingItemsBulk;
      const rows = await bulkAdd(
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
    const date = customDate || toInputDate(data.admission.admitDate) || undefined;
    setAddingCustom(true);
    try {
      const addFn = isOpd ? addPanelOpdBillingItem : addPanelBillingItem;
      const row = await addFn(data.admission.id, { description, qty, rate, mergeInto, dosage, date });
      if (mergeInto) {
        // Grouped adds fold into their head row (and feed that head's detail
        // popup) server-side — reload so the grid shows the recomputed
        // total instead of this raw itemized row.
        await reload();
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

  // Add from inside a head's detail popup (Admission) — same row the top bar
  // used to create (folds into that head via mergeInto), then the popup is
  // remounted on the reloaded data so the new line shows in its list.
  async function handleAddFromPopup(typeKey, { description, qty, rate, dosage, date }) {
    const mergeInto = CUSTOM_TYPES.find((t) => t.key === typeKey)?.mergeInto;
    await addPanelBillingItem(data.admission.id, { description, qty, rate, mergeInto, dosage, date });
    await reload();
    setPopupNonce((n) => n + 1);
    toast.success(`${description} add ho gaya`);
  }

  async function handleDeleteCustom(row) {
    try {
      const delFn = isOpd ? deletePanelOpdBillingItem : deletePanelBillingItem;
      await delFn(row.id);
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
      const bulkAdd = isOpd ? addPanelOpdBillingItemsBulk : addPanelBillingItemsBulk;
      const rows = await bulkAdd(data.admission.id, items);
      setPopup(null);
      if (items.some((it) => it.mergeInto)) {
        // Grouped adds fold into their head row server-side — reload so the
        // grid shows the recomputed total instead of these raw itemized rows.
        await reload();
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
    const updateFn = isOpd ? updatePanelOpdBillingItem : updatePanelBillingItem;
    await updateFn(realId, patch);
    // Main grid's aggregate total needs the fresh amount — the popup itself
    // keeps its own already-updated local row state, so this can run in the
    // background without disturbing what's on screen.
    reload();
  }

  // Editing a *live* Provisional Bill entry — the real Provisional Bill is
  // never touched. This creates a Billing-only override in its place (see
  // overrideLiveDetailItem) that replaces it in both display and totals;
  // saving the same live entry again from here on just edits that override.
  // Admission-only — an OPD visit has no live rows at all (every OPD
  // pharmacyRows/diagnosticRows entry is already `manual-` prefixed, so this
  // is never actually called in OPD mode).
  async function handleOverrideDetailRow(liveId, mergeInto, originalAmount, description, patch) {
    await overrideLiveDetailItem(data.admission.id, { liveId, mergeInto, description, originalAmount, ...patch });
    reload();
  }

  // Delete a row from inside the Pharmacy/Diagnostic detail popup — a manual
  // add (key "manual-<id>") is a real snapshot row, so this just deletes it
  // outright; a live Provisional Bill entry (Admission mode only — OPD has
  // none) has no row of its own here to delete, so it's excluded instead
  // (see excludeLiveDetailItem) — same "Provisional Bill stays untouched"
  // principle as editing one.
  async function handleDeleteDetailRow(key, mergeInto, originalAmount) {
    if (String(key).startsWith('manual-')) {
      const delFn = isOpd ? deletePanelOpdBillingItem : deletePanelBillingItem;
      await delFn(key.replace('manual-', ''));
    } else {
      await excludeLiveDetailItem(data.admission.id, { liveId: key, mergeInto, originalAmount });
    }
    reload();
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

  async function loadBySlipNo(no) {
    setLoading(true);
    try {
      const res = await fetchPanelOpdVisitBilling(no);
      setData(res);
      setAdmitNo(res.admission.admissionNo); // same field holds the Slip # in OPD mode
    } catch (e) {
      setData(null);
      toast.error(e.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  // Re-fetch whichever record is currently loaded, in whichever mode it's
  // actually in — every mutation handler above uses this instead of calling
  // loadByAdmitNo directly, so it stays correct after a mode-agnostic reload.
  async function reload() {
    if (!data) return;
    if (data.admission.sourceType === 'opd') await loadBySlipNo(data.admission.admissionNo);
    else await loadByAdmitNo(data.admission.admissionNo);
  }

  function openReports() {
    setReportAdmitNo(data?.admission.admissionNo || admitNo || '');
    setReportType('covering');
    setShowReports(true);
  }

  const printAreaRef = useRef(null);

  async function handleGenerateReport() {
    const no = reportAdmitNo.trim();
    if (!no) return toast.error('Admission # daalo');
    const type = REPORT_TYPES.find((t) => t.key === reportType);
    if (!type?.ready) return toast.error('Yeh report abhi available nahi hai');
    // Print window opened on the click, before the await (popup blockers).
    const w = openPrintWindow(PRINT_WINDOW_FEATURES);
    setReportLoading(true);
    try {
      const res = await fetchPanelAdmissionBilling(no);
      setPrintData({ type: reportType, data: res });
      setShowReports(false);
      setTimeout(() => printPanelReport(printAreaRef.current, reportType, w), 300);
    } catch (e) {
      w.close();
      toast.error(e.message || 'Report load nahi hui');
    } finally {
      setReportLoading(false);
    }
  }

  function lookup() {
    const no = admitNo.trim();
    if (!no) return toast.error(lookupMode === 'opd' ? 'Slip # daalo' : 'Admission # daalo');
    if (lookupMode === 'opd') loadBySlipNo(no);
    else loadByAdmitNo(no);
  }

  function handleSelectFromModal(row) {
    setShowLookup(false);
    if (lookupMode === 'opd') loadBySlipNo(row.admissionNo);
    else loadByAdmitNo(row.admissionNo);
  }

  function handleCancel() {
    setAdmitNo('');
    setData(null);
    setPopup(null);
  }

  // Switching Admission #/Slip # mode mid-lookup would otherwise leave a
  // stale record from the other mode on screen — clear it.
  function switchLookupMode(mode) {
    if (mode === lookupMode) return;
    setLookupMode(mode);
    handleCancel();
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

  // After Save (No, or Yes once the file closes) the three reports print by
  // themselves from ONE print-relay window, opened right on the click
  // (before any await, so popup blockers allow it) and filled once the bill
  // to print is ready. If the browser blocks it anyway, openPrintWindow shows
  // its own "allow popups" toast; the Reports dialog can print them again.
  function printAllReports(bill, w) {
    setPrintData({ type: 'all', data: bill });
    setTimeout(() => printAllPanelReports(printAreaRef.current?.querySelector('[data-report-all]'), w), 300);
  }

  function handleDeclineCloseFile() {
    const w = openPrintWindow(PRINT_WINDOW_FEATURES);
    setShowCloseConfirm(false);
    toast.success('Billing save ho gayi');
    printAllReports(data, w);
  }

  async function handleConfirmCloseFile() {
    const w = openPrintWindow(PRINT_WINDOW_FEATURES);
    setClosingFile(true);
    try {
      const changedBy = user?.name || user?.username || user?.email || '';
      await finalizeDischarge(data.admission.id, { discountAmount: 0, changedBy });
      toast.success('File close ho gayi — Billing ab read-only hai');
      setShowCloseConfirm(false);
      const fresh = await fetchPanelAdmissionBilling(data.admission.admissionNo);
      setData(fresh);
      printAllReports(fresh, w);
    } catch (e) {
      w.close();
      toast.error(e.message || 'File close nahi ho saki');
    } finally {
      setClosingFile(false);
    }
  }

  function rowDoubleClick(row) {
    if (row.kind === 'pharmacy') setPopup('pharmacy');
    else if (row.kind === 'diagnostic') {
      setDiagnosticDept(DIAG_DEPT_ALIASES[row.description] || row.description);
      setPopup('diagnostic');
    }
  }

  function startEdit(row, field, e) {
    e.stopPropagation(); // don't also trigger the row's double-click detail popup
    if (readOnly) return;
    const raw = field === 'remarks' ? (row.remarks || '') : String(row[field] ?? 0);
    setEditCell({ itemId: row.id, field, value: raw });
  }

  async function handleSaveCell() {
    if (!editCell) return;
    const updateItemFn = isOpd ? updatePanelOpdBillingItem : updatePanelBillingItem;
    if (editCell.field === 'remarks') {
      setSavingCell(true);
      try {
        const updated = await updateItemFn(editCell.itemId, { remarks: editCell.value });
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
    const editedField = editCell.field;
    const payload = editedField === 'rate' ? { qty: row.qty, rate: val } : { qty: val, rate: row.rate };
    setSavingCell(true);
    try {
      const updated = await updateItemFn(editCell.itemId, payload);
      setData((d) => ({
        ...d,
        rows: d.rows.map((r) => (r.id === updated.id ? { ...r, qty: updated.qty, rate: updated.rate, amount: updated.amount } : r)),
        billingAmount: d.rows.reduce((s, r) => s + Number((r.id === updated.id ? updated.amount : r.amount) || 0), 0),
      }));
      // Rate ke baad seedha Qty edit mode mein chala jaye — Qty ke baad wapis
      // Rate pe nahi (sirf ek direction, jaisa maanga gaya tha), warna infinite
      // loop ka khatra hota.
      if (editedField === 'rate') {
        setEditCell({ itemId: updated.id, field: 'qty', value: String(updated.qty ?? 0) });
      } else {
        setEditCell(null);
      }
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
    } finally {
      setSavingCell(false);
    }
  }

  async function handleHeaderDateChange(field, value) {
    try {
      const updateHeaderFn = isOpd ? updatePanelOpdBillingHeader : updatePanelBillingHeader;
      const updated = await updateHeaderFn(data.admission.id, { [field]: value || null });
      setData((d) => {
        const admitDate = field === 'admitDate' ? updated.admitDate : d.admission.admitDate;
        const dischargeDate = field === 'dischargeDate' ? updated.dischargeDate : d.admission.dischargeDate;
        // calendar dates, not hours (19→20 = 1 day, 19→21 = 2) — same as the server
        const dayNo = (v) => { const x = new Date(v); return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / 86400000; };
        const days = Math.max(1, dayNo(dischargeDate || new Date()) - dayNo(admitDate));
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
      const updateHeaderFn = isOpd ? updatePanelOpdBillingHeader : updatePanelBillingHeader;
      await updateHeaderFn(data.admission.id, { [field]: value });
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
      const updateHeaderFn = isOpd ? updatePanelOpdBillingHeader : updatePanelBillingHeader;
      await updateHeaderFn(data.admission.id, { [field]: value });
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
    }
  }

  // Selecting/typing a Consultant also stamps their name onto the "a)
  // Consultant Fee" row's Remarks — best-effort: the header's Consultant
  // field itself already saved either way, so a failure here (or that row
  // not existing at all, e.g. OPD mode) is silently skipped, never surfaced
  // as an error to the user.
  async function updateConsultantFeeRemarks(consultantName) {
    const feeRow = data?.rows.find((r) => r.description === 'a) Consultant Fee');
    if (!feeRow) return;
    try {
      const updateItemFn = isOpd ? updatePanelOpdBillingItem : updatePanelBillingItem;
      const updated = await updateItemFn(feeRow.id, { remarks: consultantName || null });
      setData((d) => ({ ...d, rows: d.rows.map((r) => (r.id === updated.id ? { ...r, remarks: updated.remarks } : r)) }));
    } catch {
      // best-effort, see comment above
    }
  }

  function saveConsultant(value) {
    const name = value.trim();
    setConsultantQuery(name);
    if (name === (data.admission.consultantName || '')) return;
    handleHeaderSelectChange('consultantName', name);
    updateConsultantFeeRemarks(name);
  }
  function pickConsultant(name) {
    setShowConsultantOptions(false);
    saveConsultant(name);
  }

  function saveDiagnosis(value) {
    const text = value.trim();
    setDiagnosisQuery(text);
    if (text === (data.admission.diagnosis || '')) return;
    handleHeaderSelectChange('diagnosis', text);
  }
  function pickDiagnosis(name) {
    setShowDiagnosisOptions(false);
    saveDiagnosis(name);
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
      const updateHeaderFn = isOpd ? updatePanelOpdBillingHeader : updatePanelBillingHeader;
      const updated = await updateHeaderFn(data.admission.id, { snoSeq: value.trim() || null });
      setData((d) => ({
        ...d,
        admission: { ...d.admission, snoSeq: updated.snoSeq, serialNo: formatBillingSno(updated.snoSeq, d.admission.admitDate) || d.admission.serialNo },
      }));
    } catch (e) {
      toast.error(e.message || 'Sno save nahi hua');
    }
  }

  return (
    <div className="pnb-page" onKeyDown={billingKeyNav}>
      <ClinicMenuBar />

      {showLookup && (
        <PanelAdmissionLookupModal
          mode={lookupMode}
          onSelect={handleSelectFromModal}
          onClose={() => setShowLookup(false)}
          searchPanelAdmissions={lookupMode === 'opd' ? searchPanelOpdVisits : searchPanelAdmissions}
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
              <div className="pnb-mode-toggle">
                <button type="button" className={`pnb-mode-btn ${lookupMode === 'admission' ? 'pnb-mode-btn--active' : ''}`}
                  onClick={() => switchLookupMode('admission')}>Admission #</button>
                <button type="button" className={`pnb-mode-btn ${lookupMode === 'opd' ? 'pnb-mode-btn--active' : ''}`}
                  onClick={() => switchLookupMode('opd')}>Slip #</button>
              </div>
              <div className="pnb-lookup">
                <input
                  value={admitNo}
                  onChange={(e) => setAdmitNo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookup()}
                  placeholder={lookupMode === 'opd' ? 'e.g. 2840123' : 'e.g. 174628'}
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
              <label>{isOpd ? 'Visit Date' : 'Admit Date'}</label>
              {data ? (
                <input type="date" className="pnb-date-input" value={toInputDate(data.admission.admitDate)}
                  onChange={(e) => handleHeaderDateChange('admitDate', e.target.value)} disabled={readOnly} />
              ) : <div className="pnb-val">—</div>}
            </div>
            <div className="pnb-hg">
              <label>{isOpd ? 'Billing Date' : 'Discharge Date'}</label>
              {data ? (
                <input type="date" className="pnb-date-input" value={toInputDate(data.admission.dischargeDate)}
                  onChange={(e) => handleHeaderDateChange('dischargeDate', e.target.value)} disabled={readOnly} />
              ) : <div className="pnb-val">—</div>}
            </div>
            <div className="pnb-hg"><label>Days</label><div className="pnb-val">{data?.admission.days ?? '—'}</div></div>

            <div className="pnb-hg pnb-hg--party">
              <label>Company</label>
              {data && !readOnly ? (
                <div className="pnb-party-row">
                  <SearchableSelect
                    options={panelCompanies}
                    value={data.company?.id ?? ''}
                    onChange={(v) => handlePartyChange('company', v)}
                    getKey={(c) => c.id}
                    getLabel={(c) => `${c.code} — ${c.name}`}
                    placeholder="Company code / naam…"
                    size="sm"
                    enterAdvances
                  />
                  <button type="button" className="pnb-party-new" tabIndex={-1} title="List mein nahi? Nayi company likhein" onClick={() => setNewParty('company')}><Plus size={13} /></button>
                </div>
              ) : (
                <div className="pnb-val pnb-val--blue">{data?.company ? `${data.company.code} — ${data.company.name}` : '—'}</div>
              )}
            </div>
            <div className="pnb-hg pnb-hg--party">
              <label>Employee</label>
              {data && !readOnly ? (
                <div className="pnb-party-row">
                  <SearchableSelect
                    options={partyEmployees}
                    value={data.employee?.id ?? ''}
                    onChange={(v) => handlePartyChange('employee', v)}
                    getKey={(e) => e.id}
                    getLabel={(e) => `${e.empCode} — ${e.name}`}
                    placeholder="Employee code / naam…"
                    size="sm"
                    enterAdvances
                  />
                  <button type="button" className="pnb-party-new" tabIndex={-1} title="List mein nahi? Naya employee likhein"
                    onClick={() => (data.company ? setNewParty('employee') : toast.error('Pehle Company chunein'))}><Plus size={13} /></button>
                </div>
              ) : (
                <div className="pnb-val">{data?.employee ? `${data.employee.empCode} — ${data.employee.name}` : '—'}</div>
              )}
            </div>
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
                <div className="pnb-combo">
                  <input
                    className="pnb-date-input"
                    value={consultantQuery}
                    onChange={(e) => { setConsultantQuery(e.target.value); setShowConsultantOptions(true); }}
                    onFocus={() => setShowConsultantOptions(true)}
                    onBlur={(e) => setTimeout(() => { setShowConsultantOptions(false); saveConsultant(e.target.value); }, 150)}
                    onKeyDown={consultantKeys.onKeyDown}
                    placeholder="Naam type karo ya list se select karo…"
                    disabled={readOnly}
                  />
                  {showConsultantOptions && filteredConsultantOptions.length > 0 && (
                    <div className="pnb-combo-list">
                      {filteredConsultantOptions.map((name, i) => (
                        <div key={name} className={`pnb-combo-opt${i === consultantKeys.hi ? ' pnb-combo-opt--active' : ''}`} onMouseDown={() => pickConsultant(name)}>{name}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : <div className="pnb-val">—</div>}
            </div>
            <div className="pnb-hg pnb-hg--wide">
              <label>Diagnosis</label>
              {data ? (
                <div className="pnb-combo">
                  <input
                    className="pnb-date-input"
                    style={{ width: '100%' }}
                    value={diagnosisQuery}
                    onChange={(e) => { setDiagnosisQuery(e.target.value); setShowDiagnosisOptions(true); }}
                    onFocus={() => setShowDiagnosisOptions(true)}
                    onBlur={(e) => setTimeout(() => { setShowDiagnosisOptions(false); saveDiagnosis(e.target.value); }, 150)}
                    onKeyDown={diagnosisKeys.onKeyDown}
                    placeholder="Naam type karo ya list se select karo…"
                    disabled={readOnly}
                  />
                  {showDiagnosisOptions && filteredDiagnosisOptions.length > 0 && (
                    <div className="pnb-combo-list">
                      {filteredDiagnosisOptions.map((name, i) => (
                        <div key={name} className={`pnb-combo-opt${i === diagnosisKeys.hi ? ' pnb-combo-opt--active' : ''}`} onMouseDown={() => pickDiagnosis(name)}>{name}</div>
                      ))}
                    </div>
                  )}
                </div>
              ) : <div className="pnb-val">—</div>}
            </div>
            <div className="pnb-hg">
              <label>Entitled For</label>
              {data ? (
                <SearchableSelect
                  options={roomCategories}
                  value={data.admission.entitledFor || ''}
                  onChange={(v) => handleHeaderSelectChange('entitledFor', v)}
                  getKey={(rc) => rc.name}
                  getLabel={(rc) => rc.name}
                  placeholder="— Select —"
                  disabled={readOnly}
                  size="sm"
                  style={{ minWidth: 160 }}
                  enterAdvances
                />
              ) : <div className="pnb-val">—</div>}
            </div>
            {/* Covering Page "Date:" — typed freely, printed exactly as typed
                (no calendar); blank prints today's date. Admission only. */}
            {!isOpd && (
              <div className="pnb-hg">
                <label>Bill Date</label>
                {data ? (
                  <input className="pnb-date-input" type="text" value={data.admission.billDate || ''}
                    onChange={(e) => handleHeaderTextInput('billDate', e.target.value)}
                    onBlur={(e) => {
                      // Saved in DOD's format (01032026 → 01-Mar-2026).
                      const v = formatBillDate(e.target.value);
                      handleHeaderTextInput('billDate', v);
                      handleHeaderTextBlur('billDate', v);
                    }}
                    placeholder={fmtDate(new Date())} disabled={readOnly} style={{ width: 120 }} />
                ) : <div className="pnb-val">—</div>}
              </div>
            )}
          </div>

          {/* ── Manual add: Medicine / Laboratory / Ultrasound / Radiology ── */}
          {data && !readOnly && (
            <div className="pnb-add-row">
              <div className="pnb-fg pnb-fg--type">
                <label>Type</label>
                <select
                  value={customType}
                  onChange={(e) => { setCustomType(e.target.value); setCustomQuery(''); setCustomOptions([]); }}
                >
                  {topCustomTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
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
                    onKeyDown={customKeys.onKeyDown}
                    placeholder="Naam type karo ya list se select karo…"
                  />
                  {showCustomOptions && customOptions.length > 0 && (
                    <div className="pnb-combo-list">
                      {customOptions.map((opt, i) => (
                        <div key={opt.id} className={`pnb-combo-opt${i === customKeys.hi ? ' pnb-combo-opt--active' : ''}`} onMouseDown={() => pickCustomOption(opt)}>
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
              <div className="pnb-fg pnb-fg--sm">
                <label>Date</label>
                <input
                  type="date"
                  className="pnb-date-input"
                  value={customDate || toInputDate(data.admission.admitDate)}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={toInputDate(data.admission.admitDate) || undefined}
                  max={toInputDate(data.admission.dischargeDate) || undefined}
                />
              </div>
              <button className="pnb-add-btn" onClick={handleAddCustom} disabled={addingCustom}>
                <Plus size={14} /> Add
              </button>
            </div>
          )}

          {/* ── Grid ── */}
          <div className="pnb-tab-body">
            <div className="table-wrap">
            <table className="pnb-table">
              <thead>
                <tr><th>Description</th><th className="r">Rate</th><th className="r">Qty</th><th className="r">Amount</th><th>Remarks</th><th></th></tr>
              </thead>
              <tbody>
                {!data ? (
                  <tr><td colSpan={6} className="pnb-empty">{lookupMode === 'opd' ? 'Slip # lookup karo — Panel OPD visit ka data yahan aayega.' : 'Admission # lookup karo — Panel patient ka Provisional Bill data yahan aayega.'}</td></tr>
                ) : data.rows.map((r) => {
                  const clickable = r.kind === 'pharmacy' || r.kind === 'diagnostic';
                  const subItems = clickable ? subItemsFor(r, data) : [];
                  return (
                    <Fragment key={r.id}>
                      <tr className={clickable ? 'pnb-clickable' : ''} onDoubleClick={() => rowDoubleClick(r)}>
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
                        <td>{(isOpd || r.kind === 'custom') && !readOnly && <button className="pnb-del" onClick={() => handleDeleteCustom(r)} title="Delete">✕</button>}</td>
                      </tr>
                      {/* Read-only breakdown — always visible now, no click
                          needed; double-click the parent row above still
                          opens the modal for actually editing this data. */}
                      {subItems.map((si) => (
                        <tr key={`sub-${r.id}-${si.id}`} className="pnb-subrow">
                          <td className="pnb-subrow-desc">{si.label}</td>
                          <td className="r">{fmt(si.rate)}</td>
                          <td className="r">{si.qty || 0}</td>
                          <td className="r">{fmt(si.amount)}</td>
                          <td></td>
                          <td></td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="pnb-footer">
            {/* Reports (Billing Covering Page / Diagnostic Bill / Medicine Bill)
                are Admission-only prints — not offered for a Slip # record. */}
            {!isOpd && <button className="pnb-btn" onClick={openReports}>Reports</button>}
            {/* "Close File" has no OPD equivalent (see readOnly/isOpd above) —
                OPD mode has nothing to Save either, every edit already
                autosaves, so just Cancel + the live total remain. */}
            {!isOpd && (
              readOnly ? (
                <span className="pnb-closed-badge" title="Is admission ki file close ho chuki hai — Billing ab sirf dekhne/print ke liye hai">File Closed</span>
              ) : (
                <button className="pnb-btn pnb-btn--save" onClick={handleSaveClick} disabled={!data}>Save</button>
              )
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

      <div ref={printAreaRef}>
        {printData?.type === 'covering' && <BillingCoveringPagePrintTemplate data={printData.data} />}
        {printData?.type === 'diagnostic' && <DiagnosticBillPrintTemplate data={printData.data} />}
        {printData?.type === 'medicine' && <MedicineBillPrintTemplate data={printData.data} />}
        {printData?.type === 'all' && (
          <div data-report-all="">
            <div data-report="covering"><BillingCoveringPagePrintTemplate data={printData.data} /></div>
            <div data-report="medicine"><MedicineBillPrintTemplate data={printData.data} /></div>
            <div data-report="diagnostic"><DiagnosticBillPrintTemplate data={printData.data} /></div>
          </div>
        )}
      </div>

      {popup === 'pharmacy' && data && (
        <PharmacyDetailModal
          key={`ph-${popupNonce}`}
          rows={data.pharmacyRows}
          addRow={!isOpd && !readOnly ? (
            <HeadAddRow
              typeKey="medicine"
              subDepartments={subDepartments}
              fetchMedicineList={fetchMedicineList}
              createMedicine={createMedicine}
              minDate={toInputDate(data.admission.admitDate)}
              maxDate={toInputDate(data.admission.dischargeDate)}
              initialDate={customDate}
              onDateChange={setCustomDate}
              onAdd={(payload) => handleAddFromPopup('medicine', payload)}
            />
          ) : null}
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
          key={`dg-${diagnosticDept}-${popupNonce}`}
          title={diagnosticDept}
          addRow={!isOpd && !readOnly && CUSTOM_TYPES.some((t) => t.mergeInto === diagnosticDept) ? (
            <HeadAddRow
              typeKey={CUSTOM_TYPES.find((t) => t.mergeInto === diagnosticDept).key}
              subDepartments={subDepartments}
              fetchMedicineList={fetchMedicineList}
              createMedicine={createMedicine}
              minDate={toInputDate(data.admission.admitDate)}
              maxDate={toInputDate(data.admission.dischargeDate)}
              initialDate={customDate}
              onDateChange={setCustomDate}
              onAdd={(payload) => handleAddFromPopup(CUSTOM_TYPES.find((t) => t.mergeInto === diagnosticDept).key, payload)}
            />
          ) : null}
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

      {newParty && data && (
        <NewPartyModal
          kind={newParty}
          company={data.company}
          onClose={() => setNewParty(null)}
          onSaved={(created) => handleNewPartySaved(newParty, created)}
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
// Add a Medicine / Laboratory / Radiology / Ultrasound line from inside that
// head's own detail popup (Admission Billing) — the same fields the top bar
// had for these: item from the Medicine List (with "New Medicine") or that
// department's tests, Dose (medicine), Qty, Rate, Date (kept within Admit /
// Discharge). onAdd saves it, the parent reloads and remounts the popup.
// initialDate / onDateChange: the date last picked on this billing (shared
// with the top add bar) — the popup remounts after every add, so the row
// would otherwise jump back to Admit Date (owner, 2026-10-21).
function HeadAddRow({ typeKey, subDepartments, fetchMedicineList, createMedicine, minDate, maxDate, onAdd, initialDate, onDateChange }) {
  const type = CUSTOM_TYPES.find((t) => t.key === typeKey);
  const isMedicine = typeKey === 'medicine';
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [showOptions, setShowOptions] = useState(false);
  const [dose, setDose] = useState('');
  const [qty, setQty] = useState('1');
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(initialDate || minDate || '');
  const [adding, setAdding] = useState(false);
  const [showNewMed, setShowNewMed] = useState(false);
  const timer = useRef(null);

  function search(val) {
    setQuery(val);
    setShowOptions(true);
    clearTimeout(timer.current);
    if (type.source === 'subdept') {
      const q = val.trim().toLowerCase();
      setOptions(subDepartments
        .filter((sd) => sd.department?.name === type.deptName && (!q || sd.name.toLowerCase().includes(q)))
        .slice(0, 30)
        .map((sd) => ({ id: sd.id, name: sd.name, code: sd.code })));
      return;
    }
    timer.current = setTimeout(() => {
      fetchMedicineList({ search: val, status: 'active' })
        .then((meds) => setOptions((meds || []).map((m) => ({ id: m.id, name: m.name, code: m.code, retailPrice: m.retailPrice }))))
        .catch(() => setOptions([]));
    }, 300);
  }

  function pick(opt) {
    setShowOptions(false);
    setQuery(opt.name);
    if (isMedicine && opt.retailPrice != null) setRate(String(opt.retailPrice));
  }
  const comboKeys = useComboKeys(options.length, showOptions, (i) => pick(options[i]));

  async function handleNewMedicine(payload) {
    const med = await createMedicine(payload);
    toast.success('Medicine List mein add ho gayi');
    setQuery(med.name);
    setRate(med.retailPrice ? String(med.retailPrice) : '');
    setShowNewMed(false);
  }

  async function handleAdd() {
    const description = query.trim();
    if (!description) return toast.error('Item ka naam likho ya list se select karo');
    const q = Number(qty);
    const r = Number(rate);
    if (!Number.isFinite(q) || q <= 0) return toast.error('Qty valid honi chahiye');
    if (!Number.isFinite(r) || r < 0) return toast.error('Rate valid honi chahiye');
    setAdding(true);
    try {
      await onAdd({ description, qty: q, rate: r, dosage: isMedicine ? dose.trim() || undefined : undefined, date: date || minDate || undefined });
    } catch (e) {
      toast.error(e.message || 'Add nahi hua');
      setAdding(false);
    }
  }

  return (
    <div className="pnb-add-row pnb-add-row--popup" onKeyDown={billingKeyNav}>
      <div className="pnb-fg pnb-fg--search">
        <label>{isMedicine ? 'Medicine' : `${type.label} Test`}</label>
        <div className="pnb-combo">
          <input
            value={query}
            onChange={(e) => search(e.target.value)}
            onFocus={() => search(query)}
            onBlur={() => setTimeout(() => setShowOptions(false), 150)}
            onKeyDown={comboKeys.onKeyDown}
            placeholder="Naam type karo ya list se select karo…"
          />
          {showOptions && options.length > 0 && (
            <div className="pnb-combo-list">
              {options.map((opt, i) => (
                <div key={opt.id} className={`pnb-combo-opt${i === comboKeys.hi ? ' pnb-combo-opt--active' : ''}`} onMouseDown={() => pick(opt)}>
                  {opt.name}{opt.code ? <span className="pnb-combo-code"> ({opt.code})</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {isMedicine && (
        <div className="pnb-fg">
          <label>&nbsp;</label>
          <button type="button" className="pnb-new-med-btn" tabIndex={-1} onClick={() => setShowNewMed(true)}>
            <Plus size={13} /> New Medicine
          </button>
        </div>
      )}
      {isMedicine && (
        <div className="pnb-fg pnb-fg--sm">
          <label>Dose</label>
          <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 1 tab" />
        </div>
      )}
      <div className="pnb-fg pnb-fg--sm">
        <label>Qty</label>
        <input value={qty} onChange={(e) => setQty(e.target.value)} />
      </div>
      <div className="pnb-fg pnb-fg--sm">
        <label>Rate</label>
        <input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="apni rate" />
      </div>
      <div className="pnb-fg pnb-fg--sm">
        <label>Date</label>
        <input type="date" className="pnb-date-input" value={date} onChange={(e) => { setDate(e.target.value); onDateChange?.(e.target.value); }}
          min={minDate || undefined} max={maxDate || undefined} />
      </div>
      <button className="pnb-add-btn" onClick={handleAdd} disabled={adding} data-enter-submit tabIndex={-1}>
        <Plus size={14} /> {adding ? 'Adding…' : 'Add'}
      </button>
      {showNewMed && createPortal(
        <QuickAddMedicineModal onClose={() => setShowNewMed(false)} onCreate={handleNewMedicine} />,
        document.body,
      )}
    </div>
  );
}

// "+ Nayi" Company / Employee — typed in by hand when it isn't in the list.
// Created in Panel Companies / Panel Employees (employee under the file's
// company), then the parent sets it on this file. Enter walks Code → Name
// → Save.
function NewPartyModal({ kind, company, onClose, onSaved }) {
  const { createPanelCompany, createPanelEmployee } = useClinicStore(useShallow((s) => ({ createPanelCompany: s.createPanelCompany, createPanelEmployee: s.createPanelEmployee })));
  const isCompany = kind === 'company';
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!code.trim()) return toast.error('Code likhein');
    if (!name.trim()) return toast.error('Naam likhein');
    setSaving(true);
    try {
      const created = isCompany
        ? await createPanelCompany({ code: code.trim().toUpperCase(), name: name.trim(), status: 'active' })
        : await createPanelEmployee({ companyId: company.id, empCode: code.trim(), name: name.trim() });
      toast.success(isCompany ? 'Nayi company ban gayi' : 'Naya employee ban gaya');
      await onSaved(created);
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
      setSaving(false);
    }
  }

  return (
    <div className="pnb-modal-overlay" onMouseDown={onClose}>
      <div className="pnb-modal pnb-modal--sm" onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); else billingKeyNav(e); }}>
        <div className="pnb-modal-head">
          <span>{isCompany ? 'Nayi Panel Company' : `Naya Employee — ${company?.code || ''}`}</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pnb-modal-body pnb-party-form">
          <div className="pnb-fg">
            <label>{isCompany ? 'Company Code' : 'Employee Code'}</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} autoFocus placeholder={isCompany ? 'e.g. ABC' : 'e.g. 36-Z'} />
          </div>
          <div className="pnb-fg">
            <label>Naam</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isCompany ? 'Company ka naam' : 'Employee ka naam'} />
          </div>
          <button className="pnb-add-btn" onClick={handleSave} disabled={saving} data-enter-submit tabIndex={-1}>
            {saving ? 'Saving…' : 'Save & Lagayein'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
          onFocus={(e) => e.target.select()}
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
// Pharmacy / Diagnostic detail popups — shared row behaviour:
//  • Auto-save: a row saves itself the moment its Date changes, or when Qty /
//    Rate / Dose loses focus (Enter too) — no Save button; nothing is lost on
//    closing the popup. Same save path the old button used: a manual entry
//    updates directly, a live Provisional Bill entry becomes / edits its
//    Billing-only override.
//  • Select all, and Delete Selected (one confirm for the lot).
// `fields` — which values make up a save (Medicine also has dosage).
function useDetailRows({ selections, setSelections, mergeInto, nameOf, fields, onSaveRow, onOverrideRow, onDeleteRow }) {
  const [savingKey, setSavingKey] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const pick = (r) => Object.fromEntries(fields.map((f) => [f, f === 'qty' || f === 'rate' ? Number(r[f]) || 0 : (r[f] ?? '')]));
  const same = (a, b) => fields.every((f) => String(a[f]) === String(b[f]));

  async function autoSave(row) {
    if (row.locked) return;
    const patch = pick(row);
    if (row.saved && same(patch, row.saved)) return;
    if (patch.qty < 0 || patch.rate < 0) return toast.error('Qty / Rate minus nahi ho sakti');
    setSavingKey(row.key);
    try {
      if (row.isManual) await onSaveRow(row.key, patch);
      else await onOverrideRow(row.key, mergeInto, row.originalAmount, nameOf(row), patch);
      setSelections((s) => s.map((r) => (r.key === row.key ? { ...r, saved: patch } : r)));
      toast.success('Save ho gaya', { id: 'pnb-autosave', duration: 1200 });
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
    } finally {
      setSavingKey(null);
    }
  }

  const selectable = selections.filter((r) => !r.locked);
  const allChecked = selectable.length > 0 && selectable.every((r) => r.checked);
  function toggleAll() {
    const next = !allChecked;
    setSelections((s) => s.map((r) => (r.locked ? r : { ...r, checked: next })));
  }

  async function deleteSelected() {
    const targets = selections.filter((r) => r.checked && !r.locked);
    if (!targets.length) return toast.error('Kam az kam ek row select karo');
    if (!(await confirmDialog({ title: 'Delete from bill', message: `${targets.length} line(s) bill se delete karni hain?`, confirmLabel: 'Delete', danger: true }))) return;
    setDeleting(true);
    let done = 0;
    try {
      for (const row of targets) {
        await onDeleteRow(row.key, mergeInto, row.originalAmount);
        done += 1;
        setSelections((s) => s.filter((r) => r.key !== row.key));
      }
      toast.success(`${done} line(s) delete ho gayin`);
    } catch (e) {
      toast.error(`${done} delete hui, phir: ${e.message || 'Delete nahi hua'}`);
    } finally {
      setDeleting(false);
    }
  }

  return { savingKey, autoSave, allChecked, toggleAll, deleteSelected, deleting, hasSelectable: selectable.length > 0 };
}

function PharmacyDetailModal({ rows, onClose, onConfirmAdd, onSaveRow, onOverrideRow, onDeleteRow, confirming, readOnly, addRow }) {
  const [selections, setSelections] = useState(() =>
    rows.map((r) => ({
      key: r.id, isManual: String(r.id).startsWith('manual-'), originalAmount: r.amount,
      // OPD slip's Inventory lines — view only (fixed via MRN / GIN, see getPanelOpdVisitBilling)
      locked: !!r.locked,
      medicine: r.medicine, dosage: r.dosage || '', qty: r.qty, rate: r.rate, date: toInputDate(r.date), checked: false,
      saved: { date: toInputDate(r.date), qty: Number(r.qty) || 0, rate: Number(r.rate) || 0, dosage: r.dosage || '' },
    }))
  );
  const [deletingKey, setDeletingKey] = useState(null);
  const { savingKey, autoSave, allChecked, toggleAll, deleteSelected, deleting, hasSelectable } = useDetailRows({
    selections, setSelections, mergeInto: 'Medicine', nameOf: (r) => r.medicine,
    fields: ['date', 'qty', 'rate', 'dosage'], onSaveRow, onOverrideRow, onDeleteRow,
  });
  const [bulkDate, setBulkDate] = useState('');
  const [bulkApplying, setBulkApplying] = useState(false);

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

  // Change the Date on every checked row at once, already-added entries
  // included — same save path each row's own "Save" button uses (Billing-
  // only override for a live entry, direct update for a manual one), just
  // looped over the whole selection instead of one row at a time.
  async function handleBulkDate() {
    if (!bulkDate) return toast.error('Date select karo');
    const targets = checked;
    if (!targets.length) return toast.error('Kam az kam ek row select karo');
    setBulkApplying(true);
    try {
      for (const row of targets) {
        const patch = { date: bulkDate, qty: Number(row.qty) || 0, rate: Number(row.rate) || 0, dosage: row.dosage };
        if (row.isManual) await onSaveRow(row.key, patch);
        else await onOverrideRow(row.key, 'Medicine', row.originalAmount, row.medicine, patch);
      }
      setSelections((s) => s.map((r) => (r.checked ? { ...r, date: bulkDate } : r)));
      toast.success(`${targets.length} row ki date update ho gayi`);
    } catch (e) {
      toast.error(e.message || 'Bulk date update nahi hui');
    } finally {
      setBulkApplying(false);
    }
  }

  // Remove an already-added entry — a manual add gets actually deleted; a
  // live Provisional Bill entry instead gets excluded from this Billing
  // screen only (the real Provisional Bill stays untouched) — see
  // onDeleteRow/excludeLiveDetailItem.
  async function handleDeleteOne(key) {
    const row = selections.find((s) => s.key === key);
    if (!(await confirmDialog({ title: 'Delete from bill', message: `"${row.medicine}" ko bill se delete karna hai?`, confirmLabel: 'Delete', danger: true }))) return;
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
      <div className="pnb-modal pnb-modal--detail" onMouseDown={(e) => e.stopPropagation()} onKeyDown={billingKeyNav}>
        <div className="pnb-modal-head">
          <span>Pharmacy Bill</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pnb-modal-body">
          {addRow}
          {!readOnly && (
            <div className="pnb-bulk-date-row">
              <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} disabled={bulkApplying} />
              <button className="pnb-btn" onClick={handleBulkDate} disabled={bulkApplying || !checked.length}>
                {bulkApplying ? 'Applying…' : `Apply Date to Selected (${checked.length})`}
              </button>
              <button className="pnb-btn pnb-btn--danger" onClick={deleteSelected} disabled={deleting || !checked.length}>
                {deleting ? 'Deleting…' : `Delete Selected (${checked.length})`}
              </button>
            </div>
          )}
          <table className="pnb-table">
            <thead>
              <tr><th><input type="checkbox" checked={allChecked} onChange={toggleAll} disabled={readOnly || !hasSelectable} title="Sab select karein" /></th><th>Date</th><th>Medicine</th><th>Dose</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th><th></th></tr>
            </thead>
            <tbody>
              {selections.length === 0 ? (
                <tr><td colSpan={8} className="pnb-empty">Koi record nahi mila</td></tr>
              ) : selections.map((r) => (
                <tr key={r.key} className={r.checked ? 'pnb-pkg-row-selected' : ''}>
                  <td><input type="checkbox" checked={r.checked} onChange={() => toggle(r.key)} disabled={readOnly || r.locked} /></td>
                  <td>
                    <input type="date" className="pnb-mini-input" value={r.date}
                      onChange={(e) => { updateField(r.key, 'date', e.target.value); autoSave({ ...r, date: e.target.value }); }} disabled={readOnly || r.locked} />
                  </td>
                  <td>{r.medicine}{r.locked && <span className="pnb-locked-tag" title="Inventory GIN se — MRN se theek karein"> (Store)</span>}</td>
                  <td>
                    <input className="pnb-mini-input" value={r.dosage} placeholder="e.g. 1 tab"
                      onChange={(e) => updateField(r.key, 'dosage', e.target.value)} onBlur={() => autoSave(r)} disabled={readOnly || r.locked} />
                  </td>
                  <td className="r">
                    <input type="number" min="0" className="pnb-mini-input pnb-mini-input--num" value={r.qty}
                      onChange={(e) => updateField(r.key, 'qty', e.target.value)} onBlur={() => autoSave(r)} disabled={readOnly || r.locked} />
                  </td>
                  <td className="r">
                    <input type="number" min="0" step="0.01" className="pnb-mini-input pnb-mini-input--num" value={r.rate}
                      onChange={(e) => updateField(r.key, 'rate', e.target.value)} onBlur={() => autoSave(r)} disabled={readOnly || r.locked} />
                  </td>
                  <td className="r">{fmt((Number(r.qty) || 0) * (Number(r.rate) || 0))}</td>
                  <td>
                    {!readOnly && !r.locked && (
                      <div className="pnb-row-actions">
                        {savingKey === r.key && <span className="pnb-autosave-dot" title="Save ho raha hai">…</span>}
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
function DiagnosticDetailModal({ title, rows, onClose, onConfirmAdd, onSaveRow, onOverrideRow, onDeleteRow, confirming, readOnly, addRow }) {
  const [selections, setSelections] = useState(() =>
    rows.map((r) => ({
      key: r.id, isManual: String(r.id).startsWith('manual-'), originalAmount: r.amount, particulars: r.particulars || r.department,
      qty: r.qty ?? 1, rate: r.rate ?? r.amount, date: toInputDate(r.date), checked: false,
      saved: { date: toInputDate(r.date), qty: Number(r.qty ?? 1) || 0, rate: Number(r.rate ?? r.amount) || 0 },
    }))
  );
  const [deletingKey, setDeletingKey] = useState(null);
  const { savingKey, autoSave, allChecked, toggleAll, deleteSelected, deleting, hasSelectable } = useDetailRows({
    selections, setSelections, mergeInto: title, nameOf: (r) => r.particulars,
    fields: ['date', 'qty', 'rate'], onSaveRow, onOverrideRow, onDeleteRow,
  });
  const [bulkDate, setBulkDate] = useState('');
  const [bulkApplying, setBulkApplying] = useState(false);

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

  // Change the Date on every checked row at once — same save path each
  // row's own "Save" button uses, looped over the whole selection.
  async function handleBulkDate() {
    if (!bulkDate) return toast.error('Date select karo');
    const targets = checked;
    if (!targets.length) return toast.error('Kam az kam ek row select karo');
    setBulkApplying(true);
    try {
      for (const row of targets) {
        const patch = { date: bulkDate, qty: Number(row.qty) || 0, rate: Number(row.rate) || 0 };
        if (row.isManual) await onSaveRow(row.key, patch);
        else await onOverrideRow(row.key, title, row.originalAmount, row.particulars, patch);
      }
      setSelections((s) => s.map((r) => (r.checked ? { ...r, date: bulkDate } : r)));
      toast.success(`${targets.length} row ki date update ho gayi`);
    } catch (e) {
      toast.error(e.message || 'Bulk date update nahi hui');
    } finally {
      setBulkApplying(false);
    }
  }

  // Remove an already-added entry — a manual add gets actually deleted; a
  // live Provisional Bill entry instead gets excluded from this Billing
  // screen only (the real Provisional Bill stays untouched) — see
  // onDeleteRow/excludeLiveDetailItem.
  async function handleDeleteOne(key) {
    const row = selections.find((s) => s.key === key);
    if (!(await confirmDialog({ title: 'Delete from bill', message: `"${row.particulars}" ko bill se delete karna hai?`, confirmLabel: 'Delete', danger: true }))) return;
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
      <div className="pnb-modal pnb-modal--detail" onMouseDown={(e) => e.stopPropagation()} onKeyDown={billingKeyNav}>
        <div className="pnb-modal-head">
          <span>{title}</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="pnb-modal-body">
          {addRow}
          {!readOnly && (
            <div className="pnb-bulk-date-row">
              <input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} disabled={bulkApplying} />
              <button className="pnb-btn" onClick={handleBulkDate} disabled={bulkApplying || !checked.length}>
                {bulkApplying ? 'Applying…' : `Apply Date to Selected (${checked.length})`}
              </button>
              <button className="pnb-btn pnb-btn--danger" onClick={deleteSelected} disabled={deleting || !checked.length}>
                {deleting ? 'Deleting…' : `Delete Selected (${checked.length})`}
              </button>
            </div>
          )}
          <table className="pnb-table">
            <thead>
              <tr><th><input type="checkbox" checked={allChecked} onChange={toggleAll} disabled={readOnly || !hasSelectable} title="Sab select karein" /></th><th>Date</th><th>Particulars</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th><th></th></tr>
            </thead>
            <tbody>
              {selections.length === 0 ? (
                <tr><td colSpan={7} className="pnb-empty">Koi record nahi mila</td></tr>
              ) : selections.map((r) => (
                <tr key={r.key} className={r.checked ? 'pnb-pkg-row-selected' : ''}>
                  <td><input type="checkbox" checked={r.checked} onChange={() => toggle(r.key)} disabled={readOnly} /></td>
                  <td>
                    <input type="date" className="pnb-mini-input" value={r.date}
                      onChange={(e) => { updateField(r.key, 'date', e.target.value); autoSave({ ...r, date: e.target.value }); }} disabled={readOnly} />
                  </td>
                  <td>{r.particulars}</td>
                  <td className="r">
                    <input type="number" min="0" className="pnb-mini-input pnb-mini-input--num" value={r.qty}
                      onChange={(e) => updateField(r.key, 'qty', e.target.value)} onBlur={() => autoSave(r)} disabled={readOnly} />
                  </td>
                  <td className="r">
                    <input type="number" min="0" step="0.01" className="pnb-mini-input pnb-mini-input--num" value={r.rate}
                      onChange={(e) => updateField(r.key, 'rate', e.target.value)} onBlur={() => autoSave(r)} disabled={readOnly} />
                  </td>
                  <td className="r">{fmt((Number(r.qty) || 0) * (Number(r.rate) || 0))}</td>
                  <td>
                    {!readOnly && (
                      <div className="pnb-row-actions">
                        {savingKey === r.key && <span className="pnb-autosave-dot" title="Save ho raha hai">…</span>}
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
// "W/o ABBAS ALI" — or just the name for Self (patient is the employee).
function relationText(admission) {
  const name = admission.relationName || '';
  if (!name) return '—';
  return admission.relationType && admission.relationType !== 'Self' ? `${admission.relationType} ${name}` : name;
}

function BillingCoveringPagePrintTemplate({ data }) {
  if (!data) return null;
  const { admission, company } = data;
  const rows = data.rows.filter((r) => Number(r.amount) !== 0);
  const total = data.billingAmount;

  return (
    <div className="pnbr-print-area">
      <div className="pnbr-cov">
        {/* One bordered box for the ENTIRE report — personal-info grid
            (left column To/CMO/address + patient info, right column Bill
            No/Admit info, one vertical rule down the middle, a horizontal
            rule between every row), the items list and the total, all
            inside the same outer frame. */}
        <div className="pnbr-cov-box">
          <table className="pnbr-cov-main">
            <tbody>
              <tr>
                <td className="pnbr-cov-colL">
                  {/* Exactly 7 rows, 1-for-1 with the right column below, so
                      every horizontal rule lines up across the whole box. */}
                  <table>
                    <tbody>
                      <tr className="pnbr-cov-noline"><td className="l" colSpan={2}>To:</td></tr>
                      <tr className="pnbr-cov-noline"><td className="l" colSpan={2}>C.M.O</td></tr>
                      <tr><td className="l pnbr-cov-org" colSpan={2}>{company?.name || '—'}</td></tr>
                      <tr><td className="l">Patients Name:</td><td className="v">{admission.patientName}</td></tr>
                      <tr><td className="l">D.O.A</td><td className="v">{fmtDate(admission.admitDate)}</td></tr>
                      <tr><td className="l">Diagnosis:</td><td className="v">{admission.diagnosis || '—'}</td></tr>
                      {/* Blank — keeps the rules level with the right column's 7 rows. */}
                      <tr><td className="l">&nbsp;</td><td className="v" /></tr>
                    </tbody>
                  </table>
                </td>
                <td className="pnbr-cov-colR">
                  <table>
                    <tbody>
                      <tr><td className="l">Bill No:</td><td className="v">{billNo(admission)}</td></tr>
                      <tr><td className="l">Date:</td><td className="v">{admission.billDate ? formatBillDate(admission.billDate) : fmtDate(new Date())}</td></tr>
                      <tr><td className="l">Admit No:</td><td className="v">P-{admission.admissionNo}</td></tr>
                      {/* Relation sits level with Patients Name (owner, 2026-10-21); DOD below it. */}
                      <tr><td className="l">Relation:</td><td className="v">{relationText(admission)}</td></tr>
                      <tr><td className="l">DOD</td><td className="v">{fmtDate(admission.dischargeDate)}</td></tr>
                      <tr><td className="l">Consultant:</td><td className="v">{admission.consultantName || '—'}</td></tr>
                      <tr><td className="l">Entitled For:</td><td className="v">{admission.entitledFor || '—'}</td></tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <table className="pnbr-cov-items">
            <thead>
              <tr><th>#</th><th>Description</th><th>Remarks</th><th className="r">Detail</th><th className="r">Amount</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.description}</td>
                  <td>{r.remarks || ''}</td>
                  <td className="r">{(r.kind === 'ward' || r.kind === 'item' || r.kind === 'custom') ? `${fmt(r.rate)} X ${r.qty}` : ''}</td>
                  <td className="r">{fmt(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pnbr-cov-total-row">
            <div className="pnbr-cov-words">{numToWords(Math.floor(total))} and only</div>
            <div className="pnbr-cov-total">TOTAL : <span>{fmt(total)}</span></div>
          </div>
        </div>

        {/* Outside the box (owner, 2026-10-21) — the box ends at the Total. */}
        <div className="pnbr-cov-sign">
          <div className="pnbr-cov-sign-line" />
          <div className="pnbr-cov-sign-label">Signature</div>
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
  Object.values(byDept).forEach((rows) => rows.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)));
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

// ── Medicine Bill (print) — mirrors the legacy pharmacy store bill
// printout, headed just "PHARMACY BILL" (owner, 2026-10-21): every Pharmacy row (Hospital Store sales invoices
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
        <div className="pnbr-med-title">PHARMACY BILL</div>
        <table className="pnbr-med-hdr">
          <tbody>
            <tr>
              <td className="l">Admission #</td><td className="v">{admission.admissionNo}</td>
              <td className="l">Patient Name</td><td className="v">{admission.patientName}</td>
            </tr>
            <tr>
              <td className="l">Admission date</td><td className="v">{fmtDdMmYyyyNum(admission.admitDate)}</td>
              <td className="l">Discharge date</td><td className="v">{admission.dischargeDate ? fmtDdMonYyyy(admission.dischargeDate) : '—'}</td>
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
                <td>{fmtMonDdYyyy(r.date)}</td>
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
