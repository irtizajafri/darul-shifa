import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, DoorOpen, Save, Copy, RotateCcw, FileText, Printer, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useClinicStore } from '../../store/useClinicStore';
import { useAuthStore } from '../../store/useAuthStore';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import { RECEIPT_LOGO_DATA_URI } from './receiptLogo';
import './Admission.scss';
import './AdmissionAdjustment.scss';
import './DischargeRefund.scss';

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
              <td>{i.billHead?.description || i.billHead?.headCode || '—'}</td>
              <td>{i.doctor?.name || '—'}</td>
              <td className="r">{fmt2(i.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="dr-print-summary-tbl">
        <tbody>
          <tr><td className="l">Bill Amount:</td><td className="r">{fmt2(billAmount)}</td></tr>
          {discountAmount > 0 && <tr><td className="l">Discount:</td><td className="r">{fmt2(discountAmount)}</td></tr>}
          <tr><td className="l">Received Amount:</td><td className="r">{fmt2(amountReceived)}</td></tr>
          <tr className="dr-print-balance-row">
            <td className="l"><strong>{balance > 0 ? 'Balance Amount:' : 'Refund Amount:'}</strong></td>
            <td className="r"><strong>{fmt2(balance > 0 ? balance : refund)}</strong></td>
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
  const { user } = useAuthStore();
  const printedBy = user?.name || user?.username || user?.email || '';

  const {
    billHeads, fetchBillHeads,
    doctors, fetchDoctors,
    searchAdmissionsForAdjustment,
    fetchDischargeBillDetail,
    addDischargeBillItem,
    deleteDischargeBillItem,
    finalizeDischarge,
  } = useClinicStore();

  const [detail, setDetail] = useState(null);
  const [admissionId, setAdmissionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLookup, setShowLookup] = useState(true);
  const [isDuplicate, setIsDuplicate] = useState(false);

  const [closedFiles, setClosedFiles] = useState(false);
  const [discount, setDiscount] = useState('0');
  const [saving, setSaving] = useState(false);

  const [row, setRow] = useState({ billHeadId: '', doctorId: '', amount: '' });
  const [addingRow, setAddingRow] = useState(false);

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

  function resetToLookup() {
    setAdmissionId(null);
    setDetail(null);
    setClosedFiles(false);
    setDiscount('0');
    setShowLookup(true);
  }

  const finalHeads = billHeads.filter(h => h.type === 'final' || h.type === 'both');

  async function handleAddRow() {
    if (!row.billHeadId) return toast.error('Heads select karo');
    const amt = Number(row.amount) || 0;
    if (amt <= 0) return toast.error('Amount 0 se zyada honi chahiye');
    setAddingRow(true);
    try {
      await addDischargeBillItem(admissionId, row);
      setRow({ billHeadId: '', doctorId: row.doctorId, amount: '' });
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

  async function handleFinalize() {
    setSaving(true);
    try {
      await finalizeDischarge(admissionId, { discountAmount: Number(discount) || 0, closedFiles, changedBy: printedBy });
      toast.success(closedFiles ? 'File close ho gayi' : 'Patient discharge ho gaya');
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
          searchAdmissionsForAdjustment={searchAdmissionsForAdjustment}
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
                <label className="dr-chk-lbl dr-chk-lbl--right">
                  <input type="checkbox" checked={closedFiles} onChange={e => setClosedFiles(e.target.checked)} />
                  Closed Files
                </label>
              </div>

              <div className="dr-info-row">
                <div><label>Name</label><span>{detail.admission.patientTitle} {detail.admission.patientName}</span></div>
                <div><label>S/o, W/o, D/o</label><span>{detail.admission.responsibleParty || '—'}</span></div>
                <div><label>Room #</label><span>{detail.bed?.name || '—'}</span></div>
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
                <span>{liveBalance > 0 ? 'Balance' : 'Refund'} <b>{fmt2(liveBalance > 0 ? liveBalance : liveRefund)}</b></span>
                <span>Discount <input className="dr-discount-input" value={discount} onChange={e => setDiscount(e.target.value)} /></span>
                <span>Amount Received <b>{fmt2(detail.amountReceived)}</b></span>
              </div>

              <div className="dr-separator" />

              <div className="dr-section-title">Discharge Bill</div>

              <div className="dr-add-form">
                <div className="dr-form-row">
                  <div className="dr-fg dr-fg--full">
                    <label>Heads</label>
                    <select value={row.billHeadId} onChange={e => setRow(r => ({ ...r, billHeadId: e.target.value }))}>
                      <option value="">— Select —</option>
                      {finalHeads.map(h => <option key={h.id} value={h.id}>{h.headCode} — {h.description}</option>)}
                    </select>
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
                    <label>Dr./Staff</label>
                    <select value={row.doctorId} onChange={e => setRow(r => ({ ...r, doctorId: e.target.value }))}>
                      <option value="">— Select —</option>
                      {doctors.filter(d => d.status === 'active').map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <table className="dr-table">
                <thead>
                  <tr><th>Heads</th><th>Details</th><th className="r">Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {detail.billItems.map(i => (
                    <tr key={i.id}>
                      <td>{i.billHead?.description || i.billHead?.headCode || '—'}</td>
                      <td>{i.doctor?.name || ''}</td>
                      <td className="r">{fmt2(i.amount)}</td>
                      <td><button className="dr-del" onClick={() => handleDeleteRow(i.id)}>✕</button></td>
                    </tr>
                  ))}
                  {!detail.billItems.length && (
                    <tr><td colSpan={4} className="dr-empty">Koi row add nahi hui</td></tr>
                  )}
                </tbody>
              </table>

              <div className="dr-bill-amount">Bill Amount <span>{fmt2(detail.billAmount)}</span></div>
            </div>

            <div className="dr-footer">
              <button className="dr-finalize-btn" onClick={handleFinalize} disabled={saving}>
                {saving ? 'Saving…' : (closedFiles ? 'Close File' : 'Discharge Patient')}
              </button>
              <button className="dr-close-btn" onClick={resetToLookup} disabled={saving}>Select Another Admission</button>
            </div>
          </div>
        )}
      </div>

      <div className="dr-print-area">
        <DischargeBillPrintTemplate detail={detail} isDuplicate={isDuplicate} printedBy={printedBy} />
      </div>
    </>
  );
}
