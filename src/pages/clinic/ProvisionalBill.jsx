import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, DoorOpen, Save, Copy, RotateCcw, FileText, Printer, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import { useAuthStore } from '../../store/useAuthStore';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';
import './Admission.scss';
import './AdmissionAdjustment.scss';
import './ProvisionalBill.scss';

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

// `@page` is a document-level rule shared across the whole bundled app (see
// Admission.jsx / ConsultantOPD.jsx for the same issue) — inject an override
// right before printing so this page's print isn't silently overridden by
// whichever other page's `@page` rule happens to load last.
function printProvisionalBill() {
  const styleId = 'pb-page-size-override';
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = '@page { size: A5 portrait !important; margin: 8mm 7mm !important; }';

  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000);

  window.print();
}

// ── Admission Lookup Modal — active/admitted patients only ────────────────────
function AdmissionLookupModal({ onSelect, onClose, searchAdmissionsForAdjustment }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    searchAdmissionsForAdjustment('')
      .then((data) => setRows(data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [searchAdmissionsForAdjustment]);

  function handleQueryChange(val) {
    setQ(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      searchAdmissionsForAdjustment(val)
        .then((data) => setRows(data || []))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 300);
  }

  return (
    <div className="aa-overlay">
      <div className="aa-modal">
        <div className="aa-modal-hdr">
          <span>Select Admitted Patient</span>
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
                  <tr><td colSpan={3} className="aa-td-empty">Koi admit patient nahi mila</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Patient Info Modal ─────────────────────────────────────────────────────────
function PatientInfoModal({ detail, onClose }) {
  const { admission, bed, roomCategory, patientInfo } = detail;
  return (
    <div className="pb-overlay" onClick={onClose}>
      <div className="pb-info-modal" onClick={e => e.stopPropagation()}>
        <div className="pb-info-hdr">
          <span>Patient Information</span>
          <button className="pb-info-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pb-info-body">
          <div className="pb-info-row">
            <div><label>Name</label><span>{admission.patientName}</span></div>
            <div><label>S/o, W/o, D/o</label><span>{admission.responsibleParty || '—'}</span></div>
          </div>
          <div className="pb-info-row">
            <div><label>Room #</label><span>{bed?.name || '—'}</span></div>
            <div><label>Category</label><span>{roomCategory?.name || '—'}</span></div>
          </div>
          <table className="pb-info-tbl">
            <thead><tr><th>Date &amp; Time</th><th>Receipt #</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {patientInfo.paymentHistory.map((p, i) => (
                <tr key={i}><td>{fmtDateTime(p.date)}</td><td>{p.slipNo}</td><td className="r">{fmt2(p.amount)}</td></tr>
              ))}
              {!patientInfo.paymentHistory.length && (
                <tr><td colSpan={3} className="pb-info-empty">Koi payment nahi mila</td></tr>
              )}
            </tbody>
          </table>
          <div className="pb-info-total">Amount Received <span>{fmt2(patientInfo.amountReceived)}</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Balance Info Modal ─────────────────────────────────────────────────────────
function BalanceInfoModal({ detail, onClose }) {
  const { balanceInfo } = detail;
  return (
    <div className="pb-overlay" onClick={onClose}>
      <div className="pb-info-modal pb-info-modal--sm" onClick={e => e.stopPropagation()}>
        <div className="pb-info-hdr">
          <span>Balance Information</span>
          <button className="pb-info-close" onClick={onClose}><X size={15} /></button>
        </div>
        <div className="pb-info-body">
          <div className="pb-balance-row"><label>Bill Amount</label><span>{fmt2(balanceInfo.billAmount)}</span></div>
          {balanceInfo.discount > 0 && (
            <div className="pb-balance-row pb-balance-row--discount">
              <label>Discount{balanceInfo.discountPermissionBy ? ` (by ${balanceInfo.discountPermissionBy})` : ''}</label>
              <span>-{fmt2(balanceInfo.discount)}</span>
            </div>
          )}
          <div className="pb-balance-row"><label>Amount Received</label><span>{fmt2(balanceInfo.amountReceived)}</span></div>
          <div className="pb-balance-row pb-balance-row--em"><label>Balance</label><span>{fmt2(balanceInfo.balance)}</span></div>
          <div className="pb-balance-row pb-balance-row--em"><label>Refund</label><span>{fmt2(balanceInfo.refund)}</span></div>
        </div>
      </div>
    </div>
  );
}

// ── Print Template ─────────────────────────────────────────────────────────────
function ProvisionalBillPrintTemplate({ detail, isDuplicate, printedBy }) {
  if (!detail) return null;
  const { admission, roomCategory, bed, surgeryType, billItems, wardHistory, diagnosticRows, pharmacyRows, balanceInfo } = detail;

  const now = admission.createdAt ? new Date(admission.createdAt) : new Date();
  const dateStr = `${fmtDate(now)} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  const groups = {};
  // Ward History is computed/read-only (not a billItems row) — synthesized
  // into the same "Amount Distribution" grouping the existing bill format
  // already uses, exactly like Diagnostic/Pharmacy below, so the printed
  // layout itself never changes.
  (wardHistory || []).forEach((seg, idx) => {
    const label = seg.roomCategory?.name || 'Ward';
    if (!groups[label]) groups[label] = [];
    groups[label].push({
      id: `ward-${idx}`,
      billHead: { description: `Ward Stay${seg.transferredAt ? '' : ' (Current)'} — ${seg.days} day${seg.days !== 1 ? 's' : ''}` },
      qty: seg.days,
      rate: seg.rate,
      amount: seg.charges,
    });
  });
  billItems.forEach((item) => {
    const label = item.roomCategory?.name || 'Other';
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });
  // Print keeps only one summed line per diagnostic department (e.g. a single
  // "Laboratory" row for 4785) — the individual test/particular breakdown is
  // intentionally not shown on the printed bill, only in-app. These land in
  // the "Other" bucket (same as room-category-less bill items, e.g. NG TUBE)
  // rather than each getting its own box — a Laboratory-only box would repeat
  // "Laboratory" as both the box title and its single row's head, which reads
  // as a duplicate.
  const diagTotalsByDept = {};
  diagnosticRows.forEach((row) => {
    const dept = row.department || 'Diagnostic';
    diagTotalsByDept[dept] = (diagTotalsByDept[dept] || 0) + Number(row.amount || 0);
  });
  Object.entries(diagTotalsByDept).forEach(([dept, total]) => {
    if (!groups.Other) groups.Other = [];
    groups.Other.push({
      id: `diag-${dept}`,
      billHead: { description: dept },
      qty: 1,
      rate: total,
      amount: total,
    });
  });
  // Same for Pharmacy — one summed "Pharmacy" line, no medicine-by-medicine detail.
  if (pharmacyRows.length) {
    const pharmTotal = pharmacyRows.reduce((s, r) => s + Number(r.amount || 0), 0);
    if (!groups.Other) groups.Other = [];
    groups.Other.push({
      id: 'pharm-total',
      billHead: { description: 'Pharmacy' },
      qty: 1,
      rate: pharmTotal,
      amount: pharmTotal,
    });
  }

  const categoryLabel = { private: 'Private Patient', staff: 'Staff Patient', panel: 'Panel Patient', cc: 'CC Patient', complementary: 'Complementary Patient' }[admission.patientCategory] || 'Private Patient';
  const balanceWords = balanceInfo.balance > 0 ? numToWords(Math.floor(balanceInfo.balance)) : (balanceInfo.refund > 0 ? numToWords(Math.floor(balanceInfo.refund)) : 'zero');

  return (
    <div className="pb-print">
      <div className="pb-print-logo-box">
        <img src={RECEIPT_LOGO_DATA_URI} alt="Darul Shifa" className="pb-print-logo" />
      </div>

      <div className="pb-print-title-row">
        <span className="pb-print-title">MEDICAL BILL</span>
        {isDuplicate && <span className="pb-print-duplicate">Duplicate</span>}
      </div>

      <table className="pb-print-hdr-tbl">
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
            <td className="l">Surgery:</td>
            <td className="v">{admission.surgery ? (surgeryType?.name || 'Yes') : 'General Admission'}</td>
          </tr>
          <tr>
            <td className="l">Category:</td>
            <td className="v">{roomCategory?.name || '—'}</td>
            <td className="l">Room#:</td>
            <td className="v">{bed?.name || '—'}</td>
          </tr>
        </tbody>
      </table>

      <div className="pb-print-box">
        <div className="pb-print-box-hdr">Payment History</div>
        <table className="pb-print-pay-tbl">
          <thead><tr><th>Date &amp; Time</th><th>Slip#</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {detail.patientInfo.paymentHistory.map((p, i) => (
              <tr key={i}><td>{fmtDateTime(p.date)}</td><td>{p.slipNo}</td><td className="r">{fmt2(p.amount)}</td></tr>
            ))}
            <tr className="pb-print-grand"><td colSpan={2}>Grand Total:</td><td className="r">{fmt2(detail.patientInfo.amountReceived)}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="pb-print-box">
        <div className="pb-print-box-hdr">Amount Distribution</div>
        {Object.entries(groups).map(([label, items]) => {
          const subtotal = items.reduce((s, i) => s + Number(i.amount || 0), 0);
          return (
            <div key={label} className="pb-print-ward-block">
              <div className="pb-print-ward-name">{label}</div>
              <table className="pb-print-items-tbl">
                <thead><tr><th>Head</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>{(i.billHead?.description || i.billHead?.headCode || '—').toString().toUpperCase()}</td>
                      <td className="r">{i.qty}</td>
                      <td className="r">{fmt2(i.rate)}</td>
                      <td className="r">{fmt2(i.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="pb-print-subtotal"><td colSpan={3}>Total for This Ward:</td><td className="r">{fmt2(subtotal)}</td></tr>
                </tfoot>
              </table>
            </div>
          );
        })}
        {!Object.keys(groups).length && <div className="pb-print-no-items">Koi bill item nahi hai</div>}

        <table className="pb-print-summary-tbl">
          <tbody>
            <tr>
              <td className="l">{categoryLabel}</td>
              <td className="l">Bill Amount:</td>
              <td className="r">{fmt2(balanceInfo.billAmount)}</td>
            </tr>
            {balanceInfo.discount > 0 && (
              <tr>
                <td></td>
                <td className="l">Discount{balanceInfo.discountPermissionBy ? ` (${balanceInfo.discountPermissionBy})` : ''}:</td>
                <td className="r">-{fmt2(balanceInfo.discount)}</td>
              </tr>
            )}
            <tr>
              <td></td>
              <td className="l">Received Amount:</td>
              <td className="r">{fmt2(balanceInfo.amountReceived)}</td>
            </tr>
            <tr className="pb-print-balance-row">
              <td className="l"><strong>Admitted</strong></td>
              <td className="l"><strong>{balanceInfo.balance > 0 ? 'Balance Amount:' : 'Refund Amount:'}</strong></td>
              <td className="r"><strong>{fmt2(balanceInfo.balance > 0 ? balanceInfo.balance : balanceInfo.refund)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="pb-print-words">
        {balanceInfo.balance > 0 ? 'Balance' : 'Refund'} Amount: RS. {balanceWords.toUpperCase()} ONLY.
      </div>

      <div className="pb-print-sig">
        <span className="pb-print-sig-name">{printedBy || ''}</span>
        <span className="pb-print-sig-lbl">Prepared By</span>
      </div>
    </div>
  );
}

const PATIENT_TYPE_OPTIONS = ['In House', 'Discharge'];
const TABS = ['Provisional Bill', 'Diagnostic Bill', 'Pharmacy Bill'];

export default function ProvisionalBill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const printedBy = user?.name || user?.username || user?.email || '';

  const {
    roomCategories, fetchRoomCategories,
    billHeads, fetchBillHeads,
    surgeryTypes, fetchSurgeryTypes,
    dischargeTypes, fetchDischargeTypes,
    searchAdmissionsForAdjustment,
    fetchProvisionalBillDetail,
    addProvisionalBillItem,
    addProvisionalBillItemFromVisit,
    updateProvisionalBillItem,
    deleteProvisionalBillItem,
    updateProvisionalBillHeader,
    pharmacyStores, fetchPharmacyStores,
    addProvisionalPharmacyItem,
    deleteProvisionalPharmacyItem,
  } = useClinicStore();

  const [admissionId, setAdmissionId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLookup, setShowLookup] = useState(true);
  const [showPatientInfo, setShowPatientInfo] = useState(false);
  const [showBalanceInfo, setShowBalanceInfo] = useState(false);
  const [tab, setTab] = useState('Provisional Bill');
  const [reprintReady, setReprintReady] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);

  // ── Pending Slip Modal ────────────────────────────────────────────────────────
  const [slipModal, setSlipModal]       = useState(null); // { id, department, patientName, date, amount }
  const [slipAmount, setSlipAmount]     = useState('');
  const [addingSlip, setAddingSlip]     = useState(false);

  const [surgery, setSurgery] = useState(false);
  const [surgeryTypeId, setSurgeryTypeId] = useState('');
  const [dischargeTypeId, setDischargeTypeId] = useState('');
  const [savingHeader, setSavingHeader] = useState(false);

  const [row, setRow] = useState({ roomCategoryId: '', patientType: 'In House', billHeadId: '', qty: '1', rate: '', remarks: '' });
  const [addingRow, setAddingRow] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);

  const emptyPharmRow = { storeId: '', medDate: '', medicine: '', dosage: '', qty: '', unit: '', rate: '', remarks: '' };
  const [pharmRow, setPharmRow] = useState(emptyPharmRow);
  const [addingPharmRow, setAddingPharmRow] = useState(false);

  useEffect(() => {
    fetchRoomCategories();
    fetchBillHeads();
    fetchSurgeryTypes();
    fetchDischargeTypes();
    fetchPharmacyStores();
  }, [fetchRoomCategories, fetchBillHeads, fetchSurgeryTypes, fetchDischargeTypes, fetchPharmacyStores]);

  const loadDetail = useCallback(async (id, isFreshSelect) => {
    setLoading(true);
    try {
      const d = await fetchProvisionalBillDetail(id);
      setDetail(d);
      setAdmissionId(d.admission.id);
      setSurgery(!!d.admission.surgery);
      setSurgeryTypeId(d.admission.surgeryTypeId != null ? String(d.admission.surgeryTypeId) : '');
      setDischargeTypeId(d.admission.dischargeTypeId != null ? String(d.admission.dischargeTypeId) : '');
      // Ward defaults to whichever ward the patient is actually admitted to —
      // only on first selecting this patient, not on every refresh-after-add
      // (so a deliberately-changed Ward for a later row isn't clobbered).
      if (isFreshSelect) {
        setRow(r => ({ ...r, roomCategoryId: d.admission.roomCategoryId != null ? String(d.admission.roomCategoryId) : '' }));
      }
      return d;
    } catch (e) {
      toast.error(e.message || 'Provisional Bill load nahi hui');
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchProvisionalBillDetail]);

  async function handleSelect(rowSel) {
    setShowLookup(false);
    // Picking a (possibly different) admission is the one funnel every
    // "switch patient" path goes through (initial lookup, the inline search
    // icon, "Select Another Admission") — reset per-session state here so it
    // never leaks from whichever patient was open before:
    // - isDuplicate: otherwise this patient's very first print would
    //   wrongly carry the "Duplicate" watermark left over from printing the
    //   previous patient's bill.
    // - the Provisional Bill draft row: Ward/PatientType are already reset
    //   by loadDetail's isFreshSelect branch, but Head/Qty/Rate/Remarks
    //   aren't — leaving them would let a stale line item slip into the new
    //   patient's bill if "Add" is clicked before touching those fields.
    setIsDuplicate(false);
    setRow(r => ({ ...r, billHeadId: '', qty: '1', rate: '', remarks: '' }));
    setEditingItemId(null);
    setPharmRow(emptyPharmRow);
    await loadDetail(rowSel.id, true);
  }

  // Reprint (Report > Reprint > Provisional Bill): ?admissionNo=...&autoprint=1
  useEffect(() => {
    const admissionNo = searchParams.get('admissionNo');
    const autoprint = searchParams.get('autoprint');
    if (!admissionNo) return;
    (async () => {
      try {
        const rows = await searchAdmissionsForAdjustment(admissionNo);
        const match = rows.find(r => r.admissionNo === admissionNo) || rows[0];
        if (!match) { toast.error('Is Admission # ka koi record nahi mila'); return; }
        setShowLookup(false);
        const d = await loadDetail(match.id, true);
        if (autoprint && d) { setIsDuplicate(true); setReprintReady(true); }
      } catch {
        toast.error('Provisional Bill reprint lookup failed');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!reprintReady) return;
    const t = setTimeout(() => { printProvisionalBill(); setReprintReady(false); }, 300);
    return () => clearTimeout(t);
  }, [reprintReady]);

  function resetToLookup() {
    setAdmissionId(null);
    setDetail(null);
    setTab('Provisional Bill');
    setShowLookup(true);
  }

  async function handleSaveHeader() {
    setSavingHeader(true);
    try {
      await updateProvisionalBillHeader(admissionId, { surgery, surgeryTypeId, dischargeTypeId });
      toast.success('Updated');
      await loadDetail(admissionId);
    } catch (e) {
      toast.error(e.message || 'Update fail ho gaya');
    } finally {
      setSavingHeader(false);
    }
  }

  function handleWardOrHeadChange(field, value) {
    const next = { ...row, [field]: value };
    if (field === 'roomCategoryId' || field === 'billHeadId') {
      const wardId = field === 'roomCategoryId' ? value : row.roomCategoryId;
      const headId = field === 'billHeadId' ? value : row.billHeadId;
      const head = billHeads.find(h => String(h.id) === String(headId));
      const wardRate = head?.wardRates?.find(wr => String(wr.roomCategoryId) === String(wardId) && wr.enabled);
      if (wardRate) next.rate = String(wardRate.rate);
    }
    setRow(next);
  }

  async function handleAddRow() {
    if (!row.billHeadId) return toast.error('Heads select karo');
    setAddingRow(true);
    try {
      if (editingItemId) {
        await updateProvisionalBillItem(editingItemId, row);
        toast.success('Row updated');
        setEditingItemId(null);
      } else {
        await addProvisionalBillItem(admissionId, row);
      }
      setRow({ roomCategoryId: row.roomCategoryId, patientType: row.patientType, billHeadId: '', qty: '1', rate: '', remarks: '' });
      await loadDetail(admissionId);
    } catch (e) {
      toast.error(e.message || (editingItemId ? 'Row update nahi hui' : 'Row add nahi hui'));
    } finally {
      setAddingRow(false);
    }
  }

  // Reuses the same add-form (mirrors VoucherIncomeForm's edit-by-reload-
  // into-draft pattern) — clicking Edit loads the row's values back in and
  // "Add" switches to "Update" mode until saved or cancelled.
  function handleEditRow(item) {
    setEditingItemId(item.id);
    setRow({
      roomCategoryId: item.roomCategoryId != null ? String(item.roomCategoryId) : '',
      patientType: item.patientType || 'In House',
      billHeadId: item.billHeadId != null ? String(item.billHeadId) : '',
      qty: String(item.qty),
      rate: String(item.rate),
      remarks: item.remarks || '',
    });
  }

  function handleCancelEdit() {
    setEditingItemId(null);
    setRow(r => ({ ...r, billHeadId: '', qty: '1', rate: '', remarks: '' }));
  }

  function openSlipModal(slip) {
    setSlipModal(slip);
    setSlipAmount(String(slip.amount || ''));
  }

  async function handleAddFromModal() {
    if (!slipModal) return;
    const amt = parseFloat(slipAmount);
    if (isNaN(amt) || amt < 0) { toast.error('Valid amount enter karo'); return; }
    setAddingSlip(true);
    try {
      await addProvisionalBillItemFromVisit(admissionId, slipModal.id, amt);
      toast.success('Slip Provisional Bill mein add ho gayi');
      setSlipModal(null);
      await loadDetail(admissionId);
    } catch (e) {
      toast.error(e.message || 'Add nahi ho saka');
    } finally {
      setAddingSlip(false);
    }
  }

  async function handleDeleteRow(itemId) {
    try {
      await deleteProvisionalBillItem(itemId);
      await loadDetail(admissionId);
    } catch (e) {
      toast.error(e.message || 'Row delete nahi hui');
    }
  }

  async function handleAddPharmacyItem() {
    if (!pharmRow.medicine.trim()) return toast.error('Medicine naam zaroori hai');
    if (!pharmRow.medDate) return toast.error('Date select karo');
    setAddingPharmRow(true);
    try {
      await addProvisionalPharmacyItem(admissionId, pharmRow);
      setPharmRow(emptyPharmRow);
      await loadDetail(admissionId);
    } catch (e) {
      toast.error(e.message || 'Medicine add nahi hui');
    } finally {
      setAddingPharmRow(false);
    }
  }

  async function handleDeletePharmacyItem(itemId) {
    try {
      await deleteProvisionalPharmacyItem(itemId);
      await loadDetail(admissionId);
    } catch (e) {
      toast.error(e.message || 'Row delete nahi hui');
    }
  }

  const provisionalHeads = billHeads.filter(h => h.type === 'provisional' || h.type === 'both');
  const qty = Number(row.qty) || 1;
  const rate = Number(row.rate) || 0;
  const pharmQty = Number(pharmRow.qty) || 0;
  const pharmRate = Number(pharmRow.rate) || 0;
  const activePharmacyStores = pharmacyStores.filter(s => s.status === 'active');

  return (
    <>
      {showLookup && (
        <AdmissionLookupModal
          onSelect={handleSelect}
          onClose={() => navigate(-1)}
          searchAdmissionsForAdjustment={searchAdmissionsForAdjustment}
        />
      )}
      {showPatientInfo && detail && <PatientInfoModal detail={detail} onClose={() => setShowPatientInfo(false)} />}
      {showBalanceInfo && detail && <BalanceInfoModal detail={detail} onClose={() => setShowBalanceInfo(false)} />}

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
            <button className="aa-tbtn" onClick={() => { setIsDuplicate(true); printProvisionalBill(); }} disabled={!detail} title="Print">
              <Printer size={16} />
            </button>
          </div>
          <span className="aa-toolbar-title">Provisional Bill</span>
        </div>

        {loading && <div className="aa-loading">Loading…</div>}

        {!loading && detail && (
          <div className="pb-body">
            <div className="pb-card">
              <div className="pb-hdr-row">
                <label className="pb-hdr-lbl">Admission #</label>
                <div className="pb-hdr-value">{detail.admission.admissionNo}</div>
                <button className="pb-lookup-btn" onClick={() => setShowLookup(true)} title="Search admissions">
                  <Search size={13} />
                </button>
                <span className="pb-inline-patient">{detail.admission.patientTitle} {detail.admission.patientName}</span>
                <div className="pb-hdr-date">{fmtDate(detail.admission.createdAt)}</div>
              </div>

              <div className="pb-hdr-row">
                <label className="pb-hdr-lbl">Patient ID</label>
                <div className="pb-hdr-value">{detail.admission.mrNo != null ? String(detail.admission.mrNo).padStart(3, '0') : '—'}</div>
                <label className="pb-hdr-lbl">Consultant</label>
                <div className="pb-hdr-value">{detail.consultant?.name || '—'}</div>
                <label className="pb-hdr-lbl">Status</label>
                <span className={`pb-status-badge pb-status-badge--${detail.admission.status}`}>
                  {{ active: 'Admit', discharge: 'Discharge', closed: 'Closed', wipeout: 'Wipeout' }[detail.admission.status] || detail.admission.status}
                </span>
              </div>

              <div className="pb-hdr-row pb-hdr-row--surgery">
                <label className="pb-chk-lbl">
                  <input type="checkbox" checked={surgery} onChange={e => setSurgery(e.target.checked)} />
                  Surgery
                </label>
                {surgery && (
                  <select value={surgeryTypeId} onChange={e => setSurgeryTypeId(e.target.value)} className="pb-sel">
                    <option value="">— Select Surgery Type —</option>
                    {surgeryTypes.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                  </select>
                )}
                <div className="pb-surgery-date-box">
                  <label className="pb-hdr-lbl">Surgery Date</label>
                  <span className="pb-surgery-date">{surgery ? fmtDateTime(detail.admission.createdAt) : ''}</span>
                </div>
              </div>

              <div className="pb-hdr-row">
                <label className="pb-hdr-lbl">Discharge Type</label>
                <select value={dischargeTypeId} onChange={e => setDischargeTypeId(e.target.value)} className="pb-sel">
                  <option value="">— Select —</option>
                  {dischargeTypes.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                </select>
                <button className="pb-save-header-btn" onClick={handleSaveHeader} disabled={savingHeader}>
                  {savingHeader ? 'Saving…' : 'Save'}
                </button>
                <button className="pb-info-btn" onClick={() => setShowPatientInfo(true)}>
                  Patient Info. - Received: {fmt2(detail.patientInfo.amountReceived)}
                </button>
                <button className="pb-info-btn" onClick={() => setShowBalanceInfo(true)}>Balance Info.</button>
              </div>

              {detail.pendingSlips.length > 0 && (
                <div className="pb-pending-box">
                  <div className="pb-pending-title">Pending Slips — is patient ke naam par aur bhi slips mili hain (double-click to add)</div>
                  <table className="pb-pending-tbl">
                    <thead>
                      <tr><th>Department</th><th>Date</th><th className="r">Amount</th></tr>
                    </thead>
                    <tbody>
                      {detail.pendingSlips.map(s => (
                        <tr key={s.id} onDoubleClick={() => openSlipModal(s)} title="Double-click to add">
                          <td>{s.department}</td>
                          <td>{fmtDate(s.date)}</td>
                          <td className="r">{fmt2(s.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pb-tabs">
                {TABS.map(t => (
                  <button key={t} className={`pb-tab ${tab === t ? 'pb-tab--active' : ''}`} onClick={() => setTab(t)}>{t}</button>
                ))}
              </div>

              {tab === 'Provisional Bill' && (
                <>
                  <div className="pb-add-form">
                    <div className="pb-form-row">
                      <div className="pb-fg">
                        <label>Ward</label>
                        <select value={row.roomCategoryId} onChange={e => handleWardOrHeadChange('roomCategoryId', e.target.value)}>
                          <option value="">— Select Ward —</option>
                          {roomCategories.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                      <div className="pb-fg pb-fg--right">
                        <label>Patient Type</label>
                        <select value={row.patientType} onChange={e => setRow(r => ({ ...r, patientType: e.target.value }))}>
                          {PATIENT_TYPE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="pb-form-row">
                      <div className="pb-fg pb-fg--full">
                        <label>Heads</label>
                        <select value={row.billHeadId} onChange={e => handleWardOrHeadChange('billHeadId', e.target.value)}>
                          <option value="">— Select —</option>
                          {provisionalHeads.map(h => <option key={h.id} value={h.id}>{h.headCode} — {h.description}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="pb-form-row">
                      <div className="pb-fg pb-fg--sm">
                        <label>Quantity</label>
                        <input value={row.qty} onChange={e => setRow(r => ({ ...r, qty: e.target.value }))} />
                      </div>
                      <div className="pb-fg pb-fg--sm">
                        <label>Rate</label>
                        <input value={row.rate} onChange={e => setRow(r => ({ ...r, rate: e.target.value }))} />
                      </div>
                      <div className="pb-fg pb-fg--sm">
                        <label>Amount</label>
                        <input value={fmt2(qty * rate)} readOnly />
                      </div>
                    </div>

                    <div className="pb-form-row">
                      <div className="pb-fg pb-fg--full">
                        <label>Remarks</label>
                        <input value={row.remarks} onChange={e => setRow(r => ({ ...r, remarks: e.target.value }))} />
                      </div>
                      <button className="pb-add-btn" onClick={handleAddRow} disabled={addingRow}>
                        <Plus size={14} /> {editingItemId ? 'Update' : 'Add'}
                      </button>
                      {editingItemId && (
                        <button className="pb-cancel-btn" onClick={handleCancelEdit} type="button">Cancel</button>
                      )}
                    </div>
                  </div>

                  {detail.wardHistory?.length > 0 && (
                    <>
                      <div className="pb-subsection-title">Ward History</div>
                      <table className="pb-table pb-table--readonly">
                        <thead>
                          <tr><th>Ward</th><th>Bed</th><th>Entered</th><th>Transferred</th><th className="r">Days</th><th className="r">Rate</th><th className="r">Charges</th></tr>
                        </thead>
                        <tbody>
                          {detail.wardHistory.map((seg, i) => (
                            <tr key={i}>
                              <td>{seg.roomCategory?.name || '—'}</td>
                              <td>{seg.bed?.name || '—'}</td>
                              <td>{fmtDateTime(seg.enteredAt)}</td>
                              <td>{seg.transferredAt ? fmtDateTime(seg.transferredAt) : <em>Current</em>}</td>
                              <td className="r">{seg.days}</td>
                              <td className="r">{fmt2(seg.rate)}</td>
                              <td className="r">{fmt2(seg.charges)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr><td colSpan={6} className="pb-tf-label">Ward Total</td><td className="r">{fmt2(detail.wardAmount)}</td></tr>
                        </tfoot>
                      </table>
                    </>
                  )}

                  <div className="pb-subsection-title">Bill Heads</div>
                  <table className="pb-table">
                    <thead>
                      <tr><th>Ward Name</th><th>Heads</th><th className="r">Qty.</th><th className="r">Rate</th><th className="r">Amount</th><th>Remarks</th><th>PatType</th><th></th></tr>
                    </thead>
                    <tbody>
                      {detail.billItems.map(i => (
                        <tr key={i.id} className={editingItemId === i.id ? 'pb-row--editing' : ''}>
                          <td>{i.roomCategory?.name || '—'}</td>
                          <td>{i.billHead?.description || i.billHead?.headCode || '—'}</td>
                          <td className="r">{i.qty}</td>
                          <td className="r">{fmt2(i.rate)}</td>
                          <td className="r">{fmt2(i.amount)}</td>
                          <td>{i.remarks || ''}</td>
                          <td>{i.patientType || ''}</td>
                          <td className="pb-row-actions">
                            <button className="pb-edit" onClick={() => handleEditRow(i)} title="Edit">✎</button>
                            <button className="pb-del" onClick={() => handleDeleteRow(i.id)} title="Delete">✕</button>
                          </td>
                        </tr>
                      ))}
                      {!detail.billItems.length && (
                        <tr><td colSpan={8} className="pb-empty">Koi row add nahi hui</td></tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}

              {tab === 'Diagnostic Bill' && (
                <>
                  {detail.pendingDiagnosticSlips?.length > 0 && (
                    <div className="pb-pending-box">
                      <div className="pb-pending-title">Pending Diagnostic Slips — Radiology/Ultrasound/Echo/Doppler (double-click to add)</div>
                      <table className="pb-pending-tbl">
                        <thead>
                          <tr><th>Department</th><th>Date</th><th className="r">Amount</th></tr>
                        </thead>
                        <tbody>
                          {detail.pendingDiagnosticSlips.map(s => (
                            <tr key={s.id} onDoubleClick={() => openSlipModal(s)} title="Double-click to add">
                              <td>{s.department}</td>
                              <td>{fmtDate(s.date)}</td>
                              <td className="r">{fmt2(s.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <table className="pb-table">
                    <thead>
                      <tr><th>Date</th><th>ConCode</th><th>Lab/USound/XRay</th><th>Particulars</th><th className="r">Amount</th></tr>
                    </thead>
                    <tbody>
                      {detail.diagnosticRows.map(r => (
                        <tr key={r.id}>
                          <td>{fmtDate(r.date)}</td>
                          <td>{r.conCode || '—'}</td>
                          <td>{r.department}</td>
                          <td>{r.particulars || '—'}</td>
                          <td className="r">{fmt2(r.amount)}</td>
                        </tr>
                      ))}
                      {!detail.diagnosticRows.length && (
                        <tr><td colSpan={5} className="pb-empty">Koi diagnostic test admit no se link nahi hua</td></tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}

              {tab === 'Pharmacy Bill' && (
                <>
                  <div className="pb-pharmacy-auto-title">Hospital / In-House Store</div>
                  <table className="pb-table">
                    <thead>
                      <tr><th>Date</th><th>Medicine</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr>
                    </thead>
                    <tbody>
                      {detail.pharmacyRows.filter(r => r.source === 'hospital').map(r => (
                        <tr key={r.id}>
                          <td>{fmtDate(r.date)}</td>
                          <td>{r.medicine}</td>
                          <td className="r">{r.qty}</td>
                          <td className="r">{fmt2(r.rate)}</td>
                          <td className="r">{fmt2(r.amount)}</td>
                        </tr>
                      ))}
                      {!detail.pharmacyRows.some(r => r.source === 'hospital') && (
                        <tr><td colSpan={5} className="pb-empty">Is admission # ke against koi Sales Invoice nahi mili</td></tr>
                      )}
                    </tbody>
                  </table>

                  <div className="pb-pharmacy-manual-title">Outside Hospital Store</div>
                  <div className="pb-add-form">
                    <div className="pb-form-row">
                      <div className="pb-fg">
                        <label>Med. Date</label>
                        <input type="date" value={pharmRow.medDate} onChange={e => setPharmRow(r => ({ ...r, medDate: e.target.value }))} />
                      </div>
                      <div className="pb-fg pb-fg--right">
                        <label>Store</label>
                        <select value={pharmRow.storeId} onChange={e => setPharmRow(r => ({ ...r, storeId: e.target.value }))}>
                          <option value="">— Select Store —</option>
                          {activePharmacyStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="pb-form-row">
                      <div className="pb-fg pb-fg--full">
                        <label>Medicine</label>
                        <input value={pharmRow.medicine} onChange={e => setPharmRow(r => ({ ...r, medicine: e.target.value }))} />
                      </div>
                    </div>

                    <div className="pb-form-row">
                      <div className="pb-fg">
                        <label>Dosage</label>
                        <input value={pharmRow.dosage} onChange={e => setPharmRow(r => ({ ...r, dosage: e.target.value }))} />
                      </div>
                      <div className="pb-fg pb-fg--sm">
                        <label>Quantity</label>
                        <input value={pharmRow.qty} onChange={e => setPharmRow(r => ({ ...r, qty: e.target.value }))} />
                      </div>
                      <div className="pb-fg pb-fg--sm">
                        <label>Unit</label>
                        <input value={pharmRow.unit} onChange={e => setPharmRow(r => ({ ...r, unit: e.target.value }))} placeholder="e.g. strip" />
                      </div>
                    </div>

                    <div className="pb-form-row">
                      <div className="pb-fg pb-fg--sm">
                        <label>Rate</label>
                        <input value={pharmRow.rate} onChange={e => setPharmRow(r => ({ ...r, rate: e.target.value }))} />
                      </div>
                      <div className="pb-fg pb-fg--sm">
                        <label>Amount</label>
                        <input value={fmt2(pharmQty * pharmRate)} readOnly />
                      </div>
                      <div className="pb-fg pb-fg--full">
                        <label>Remarks</label>
                        <input value={pharmRow.remarks} onChange={e => setPharmRow(r => ({ ...r, remarks: e.target.value }))} />
                      </div>
                      <button className="pb-add-btn" onClick={handleAddPharmacyItem} disabled={addingPharmRow}>
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>

                  <table className="pb-table">
                    <thead>
                      <tr><th>Date</th><th>Store</th><th>Medicine</th><th>Dosage</th><th className="r">Quantity</th><th className="r">Rate</th><th className="r">Amount</th><th></th></tr>
                    </thead>
                    <tbody>
                      {detail.pharmacyRows.filter(r => r.source === 'outside').map(r => (
                        <tr key={r.id}>
                          <td>{fmtDate(r.date)}</td>
                          <td>{r.storeName || '—'}</td>
                          <td>{r.medicine}</td>
                          <td>{r.dosage || ''}</td>
                          <td className="r">{r.qty}{r.unit ? ` ${r.unit}` : ''}</td>
                          <td className="r">{fmt2(r.rate)}</td>
                          <td className="r">{fmt2(r.amount)}</td>
                          <td><button className="pb-del" onClick={() => handleDeletePharmacyItem(r.itemId)}>✕</button></td>
                        </tr>
                      ))}
                      {!detail.pharmacyRows.some(r => r.source === 'outside') && (
                        <tr><td colSpan={8} className="pb-empty">Koi outside-store medicine add nahi hui</td></tr>
                      )}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            {/* ── Pending Slip Modal ── */}
            {slipModal && (
              <div className="pb-slip-modal-backdrop" onClick={() => !addingSlip && setSlipModal(null)}>
                <div className="pb-slip-modal" onClick={e => e.stopPropagation()}>
                  <div className="pb-slip-modal__header">
                    <span className="pb-slip-modal__dept">{slipModal.department}</span>
                    <button className="pb-slip-modal__close" onClick={() => setSlipModal(null)} disabled={addingSlip}>✕</button>
                  </div>
                  <div className="pb-slip-modal__body">
                    <div className="pb-slip-modal__row">
                      <span className="pb-slip-modal__lbl">Patient</span>
                      <span className="pb-slip-modal__val">{slipModal.patientName || detail?.admission?.patientName || '—'}</span>
                    </div>
                    <div className="pb-slip-modal__row">
                      <span className="pb-slip-modal__lbl">Date</span>
                      <span className="pb-slip-modal__val">{fmtDate(slipModal.date)}</span>
                    </div>
                    <div className="pb-slip-modal__row pb-slip-modal__row--amt">
                      <label className="pb-slip-modal__lbl" htmlFor="slip-amt">Amount (PKR)</label>
                      <input
                        id="slip-amt"
                        className="pb-slip-modal__amt-input"
                        type="number"
                        min="0"
                        step="1"
                        value={slipAmount}
                        onChange={e => setSlipAmount(e.target.value)}
                        onFocus={e => e.target.select()}
                        autoFocus
                        disabled={addingSlip}
                      />
                    </div>
                  </div>
                  <div className="pb-slip-modal__footer">
                    <button className="pb-slip-modal__cancel" onClick={() => setSlipModal(null)} disabled={addingSlip}>Cancel</button>
                    <button className="pb-slip-modal__add" onClick={handleAddFromModal} disabled={addingSlip}>
                      {addingSlip ? 'Adding…' : 'Add to Bill'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="pb-footer">
              <div className="pb-footer-amt">Bill Amount <span>{fmt2(detail.balanceInfo.billAmount)}</span></div>
              {detail.balanceInfo.discount > 0 && (
                <div className="pb-footer-amt pb-footer-amt--discount">Discount <span>-{fmt2(detail.balanceInfo.discount)}</span></div>
              )}
              {detail.balanceInfo.refund > 0
                ? <div className="pb-footer-amt pb-footer-amt--refund">Refund <span>{fmt2(detail.balanceInfo.refund)}</span></div>
                : <div className="pb-footer-amt pb-footer-amt--balance">Balance <span>{fmt2(detail.balanceInfo.balance)}</span></div>}
              <button className="pb-close-btn" onClick={resetToLookup}>Select Another Admission</button>
            </div>
          </div>
        )}
      </div>

      <div className="pb-print-area">
        <ProvisionalBillPrintTemplate detail={detail} isDuplicate={isDuplicate} printedBy={printedBy} />
      </div>
    </>
  );
}
