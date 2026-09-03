import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChevronRight, Printer, Pencil } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import { useAuthStore } from '../../../store/useAuthStore';
import toast from 'react-hot-toast';
import { handleEnterAsTab } from '../../../utils/keyboardNav';
import './VoucherExpenseForm.scss';

const API = 'http://localhost:5001/api/accounts';
const UTIL_API = 'http://localhost:5001/api/utilities';
const CLINIC_API = 'http://localhost:5001/api/clinic';

const todayStr = () => new Date().toISOString().slice(0, 10);

// Matches a "Utility provider" payee entry's free-text name (k-electric,
// ssgc, ptcl) to the Utilities Bill module's utility bucket — same matching
// used in Accounts > List Attachments.
function matchUtility(entryName) {
  const n = entryName.toLowerCase();
  if (n.includes('electric') || n.includes('wapda') || n.includes('kesc') || n.includes('lesco')) return 'electricity';
  if (n.includes('gas') || n.includes('ssgc') || n.includes('sngpl') || n.includes('sui')) return 'gas';
  if (n.includes('ptcl')) return 'ptcl';
  return null;
}

// ── Print helpers ─────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtDateLong = (d) => {
  const dt  = new Date(d);
  const tz  = { timeZone: 'Asia/Karachi' };
  const day  = dt.toLocaleString('en-US', { ...tz, day:     '2-digit' });
  const mon  = dt.toLocaleString('en-US', { ...tz, month:   'short'   });
  const year = dt.toLocaleString('en-US', { ...tz, year:    'numeric' });
  const wday = dt.toLocaleString('en-US', { ...tz, weekday: 'long'    });
  const time = dt.toLocaleString('en-US', { ...tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${day}-${mon}-${year} ${wday} ${time}`;
};

const fmt2 = (n) =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function amountInWords(amount) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
    'Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function chunk(n) {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' ';
    return ones[Math.floor(n / 100)] + ' Hundred ' + chunk(n % 100);
  }
  const n = Math.round(Number(amount));
  if (n === 0) return 'Rupees Zero Only';
  const millions  = Math.floor(n / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const remainder = n % 1000;
  let r = '';
  if (millions)  r += chunk(millions).trim()  + ' Million ';
  if (thousands) r += chunk(thousands).trim() + ' Thousand ';
  if (remainder) r += chunk(remainder).trim();
  return 'Rupees ' + r.trim() + ' Only';
}

const VOUCHER_PRINT_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:11px; color:#000; background:#fff; }
  .vr-print-page { page-break-after:always; padding:24px 28px; }
  .vr-print-page:last-child { page-break-after:avoid; }
  .vr-title-box { text-align:center; border:2px solid #000; padding:9px 10px; margin-bottom:10px; }
  .vr-title { font-size:17px; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; }
  .vr-meta { display:grid; grid-template-columns:1fr 1fr; font-size:10.5px; border-bottom:2px solid #000; padding-bottom:6px; margin-bottom:0; }
  .vr-meta-row { display:flex; align-items:baseline; margin-bottom:2px; }
  .vr-meta-label { font-weight:700; white-space:nowrap; min-width:90px; }
  .vr-meta-val { margin-left:4px; }
  table { width:100%; border-collapse:collapse; margin-bottom:0; }
  th { padding:5px 7px; font-size:10.5px; text-align:left; font-weight:700; text-transform:uppercase; border-top:2.5px solid #000; border-bottom:2.5px solid #000; }
  td { padding:7px 7px; font-size:10.5px; text-align:left; }
  .vr-td-r { text-align:right !important; }
  .vr-cell-top { font-size:10.5px; font-weight:700; }
  .vr-cell-sub { font-size:10px; margin-top:2px; }
  tfoot td { border-top:2.5px solid #000; border-bottom:2.5px solid #000; font-weight:700; padding:5px 7px; }
  .vr-tfoot-words { font-size:10px; font-weight:700; text-transform:uppercase; vertical-align:middle; }
  .vr-tfoot-label { text-align:right; font-size:10.5px; font-weight:700; text-transform:uppercase; padding-right:6px !important; }
  .vr-tfoot-amt { font-size:11px; font-weight:900; }
  .vr-sigs { display:flex; justify-content:space-between; margin-top:50px; }
  .vr-sig { text-align:center; font-size:10px; border-top:1.5px solid #000; padding-top:5px; width:140px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; }
`;

function printExpenseVoucher({ voucherNo, voucherDate, mode, entries, printBy }) {
  const total   = entries.reduce((s, e) => s + Number(e.amount), 0);
  const modeStr = mode === 'cheque' ? 'Cheque' : mode === 'online' ? 'Online Transfer' : 'Cash';

  const rowsHTML = entries.map((e) => `
    <tr>
      <td>
        <div class="vr-cell-top">${e.mainGlName || '—'}</div>
        <div class="vr-cell-sub">${e.subGlName  || '—'}</div>
      </td>
      <td>
        <div class="vr-cell-top">${e.mainAccountName || e.accountName || '—'}</div>
        <div class="vr-cell-sub">${e.subAccountName  || '—'}</div>
      </td>
      <td>${e.particulars || '—'}</td>
      <td>${e.chequeDate ? fmtDate(e.chequeDate) : '—'}</td>
      <td>${e.chequeNo || '—'}</td>
      <td class="vr-td-r">${fmt2(e.amount)}</td>
    </tr>
  `).join('');

  const html = `
    <div class="vr-print-page">
      <div class="vr-title-box">
        <div class="vr-title">EXPENSE VOUCHER</div>
      </div>
      <div class="vr-meta">
        <div>
          <div class="vr-meta-row">
            <span class="vr-meta-label">VOUCHER#</span>
            <span class="vr-meta-val">${voucherNo}</span>
          </div>
          <div class="vr-meta-row">
            <span class="vr-meta-label">METHOD</span>
            <span class="vr-meta-val">${modeStr}</span>
          </div>
        </div>
        <div>
          <div class="vr-meta-row">
            <span class="vr-meta-label">DATE &amp; TIME:</span>
            <span class="vr-meta-val">${fmtDateLong(voucherDate)}</span>
          </div>
          <div class="vr-meta-row">
            <span class="vr-meta-label">GENERATED BY:</span>
            <span class="vr-meta-val">${printBy}</span>
          </div>
        </div>
      </div>
      <table>
        <colgroup>
          <col style="width:13%" />
          <col style="width:16%" />
          <col style="width:48%" />
          <col style="width:6%"  />
          <col style="width:4%"  />
          <col style="width:13%" />
        </colgroup>
        <thead>
          <tr>
            <th>GL</th>
            <th>ACCOUNT</th>
            <th>PARTICULAR</th>
            <th>CHEQ DT</th>
            <th>CHQ #</th>
            <th class="vr-td-r">AMOUNT</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="vr-tfoot-words">${amountInWords(total)}</td>
            <td class="vr-tfoot-label">TOTAL</td>
            <td class="vr-td-r vr-tfoot-amt">${fmt2(total)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="vr-sigs">
        <div class="vr-sig">ACCOUNTANT</div>
        <div class="vr-sig">C.E.O.</div>
        <div class="vr-sig">RECIVER'S SIG</div>
      </div>
    </div>
  `;

  const win = window.open('', '_blank');
  if (!win) throw new Error('Popup blocked');
  win.document.write(
    `<!DOCTYPE html><html><head><title>Expense Voucher</title><style>${VOUCHER_PRINT_CSS}</style></head><body>${html}</body></html>`
  );
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.onafterprint = () => win.close();
  }, 400);
}

function printDraftSlip({ entries, mode, date, printBy }) {
  const total   = entries.reduce((s, e) => s + Number(e.amount), 0);
  const modeStr = mode === 'cheque' ? 'Cheque' : mode === 'online' ? 'Online Transfer' : 'Cash';

  const rowsHTML = entries.map((e) => `
    <tr>
      <td>
        <div class="vr-cell-top">${e.mainGlName || '—'}</div>
        <div class="vr-cell-sub">${e.subGlName  || '—'}</div>
      </td>
      <td>
        <div class="vr-cell-top">${e.mainAccountName || e.accountName || '—'}</div>
        <div class="vr-cell-sub">${e.subAccountName  || '—'}</div>
      </td>
      <td>${e.particulars || '—'}</td>
      <td>${e.chequeDate ? fmtDate(e.chequeDate) : '—'}</td>
      <td>${e.chequeNo || '—'}</td>
      <td class="vr-td-r">${fmt2(e.amount)}</td>
    </tr>
  `).join('');

  const html = `
    <div class="vr-print-page">
      <div class="vr-title-box">
        <div class="vr-title">EXPENSE VOUCHER</div>
      </div>
      <div class="vr-meta">
        <div>
          <div class="vr-meta-row">
            <span class="vr-meta-label">METHOD</span>
            <span class="vr-meta-val">${modeStr}</span>
          </div>
        </div>
        <div>
          <div class="vr-meta-row">
            <span class="vr-meta-label">DATE &amp; TIME:</span>
            <span class="vr-meta-val">${fmtDateLong(date)}</span>
          </div>
          <div class="vr-meta-row">
            <span class="vr-meta-label">GENERATED BY:</span>
            <span class="vr-meta-val">${printBy}</span>
          </div>
        </div>
      </div>
      <table>
        <colgroup>
          <col style="width:13%" />
          <col style="width:16%" />
          <col style="width:48%" />
          <col style="width:6%"  />
          <col style="width:4%"  />
          <col style="width:13%" />
        </colgroup>
        <thead>
          <tr>
            <th>GL</th>
            <th>ACCOUNT</th>
            <th>PARTICULAR</th>
            <th>CHEQ DT</th>
            <th>CHQ #</th>
            <th class="vr-td-r">AMOUNT</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="vr-tfoot-words">${amountInWords(total)}</td>
            <td class="vr-tfoot-label">TOTAL</td>
            <td class="vr-td-r vr-tfoot-amt">${fmt2(total)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="vr-sigs">
        <div class="vr-sig">ACCOUNTANT</div>
        <div class="vr-sig">C.E.O.</div>
        <div class="vr-sig">RECIVER'S SIG</div>
      </div>
    </div>
  `;

  const win = window.open('', '_blank');
  if (!win) throw new Error('Popup blocked');
  win.document.write(
    `<!DOCTYPE html><html><head><title>Expense Voucher</title><style>${VOUCHER_PRINT_CSS}</style></head><body>${html}</body></html>`
  );
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 400);
}

const SLIP_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:11px; color:#000; background:#fff; padding:28px 32px; }
  .slip-table { width:100%; border-collapse:collapse; margin-bottom:32px; }
  .slip-table th { font-size:11px; font-weight:700; text-transform:uppercase; border-bottom:2px solid #000; padding:5px 6px; text-align:left; }
  .slip-table td { font-size:11px; padding:8px 6px; vertical-align:top; border-bottom:1px solid #ccc; }
  .slip-amt { text-align:right !important; white-space:nowrap; font-weight:700; }
  .slip-date { white-space:nowrap; }
  .slip-sigs { display:flex; justify-content:space-between; margin-top:48px; }
  .slip-sig { text-align:center; }
  .slip-sig-line { border-top:1.5px solid #000; padding-top:5px; min-width:160px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; margin-top:40px; }
`;

function printEntrySlip({ entry, voucherDate, printBy }) {
  const payDate = new Date(voucherDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit', year: '2-digit' });
  const html = `
    <table class="slip-table">
      <thead>
        <tr>
          <th style="width:120px">PayDate</th>
          <th>Particulars</th>
          <th style="width:110px;text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="slip-date">${payDate}</td>
          <td>${entry.particulars || entry.payeeName || '—'}</td>
          <td class="slip-amt">${Number(entry.amount).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>
    <div class="slip-sigs">
      <div class="slip-sig"><div class="slip-sig-line">${printBy || 'Paid By'}</div><div style="font-size:9px;margin-top:3px;color:#555">Paid By</div></div>
      <div class="slip-sig"><div class="slip-sig-line">${entry.payeeName || 'Received By'}</div><div style="font-size:9px;margin-top:3px;color:#555">Received By</div></div>
    </div>
  `;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Payment Slip</title><style>${SLIP_CSS}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 400);
}

const emptyEntry = () => ({
  mainGlId: '', subGlId: '', mainAccountId: '', subAccountId: '',
  accountCode: '', accountName: '',
  payeeName: '', amount: '',
  chequeNo: '', chequeDate: todayStr(), chequeType: 'bearer',
  particulars: '',
  visitIds: [],
  grnIds: [],
  consultantFeeItemIds: [],
  salaryEmpCode: '', salaryMonth: '', salaryYear: '',
  admissionNo: '',
});

export default function VoucherExpenseForm() {
  const { entityType } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { mainGLs, fetchMainGLs } = useAccountsStore();
  const { user } = useAuthStore();

  const editingVoucher = state?.editVoucher || null;
  const isEditMode = Boolean(editingVoucher);

  const mode   = state?.mode   || 'cash';
  const bankId = state?.bankId || null;
  const isCheque = mode === 'cheque';
  const isBank   = mode !== 'cash';

  const [date, setDate]       = useState(() => editingVoucher ? editingVoucher.voucherDate.slice(0, 10) : todayStr());
  const [entry, setEntry]     = useState(emptyEntry());
  const [entries, setEntries] = useState(() => editingVoucher ? editingVoucher.entries.map((e) => ({ ...e, chequeDate: e.chequeDate ? e.chequeDate.slice(0, 10) : todayStr() })) : []);
  const [saving, setSaving]             = useState(false);
  const [savingDraft, setSavingDraft]   = useState(false);
  const [voucherNo, setVoucherNo]       = useState(editingVoucher?.voucherNo || '');
  const [savedVoucherNo, setSavedVoucherNo] = useState(null);

  const [subGLs, setSubGLs]             = useState([]);
  const [mainAccs, setMainAccs]         = useState([]);
  const [subAccs, setSubAccs]           = useState([]);
  const [isInventoryAcc, setIsInventoryAcc] = useState(false);
  // Inventory Sub Account dropdown's controlled value — a prefixed string
  // ("item-15" / "payee-39") since real inventory items and a linked Custom
  // Head's own entries are separate id spaces merged into one list (see
  // getInventoryItemsForHead); kept apart from entry.subAccountId, which
  // stays a plain Int (or null) since that's the real DB column's type.
  const [isSurgeryAcc, setIsSurgeryAcc] = useState(false);
  const [surgeryCategories, setSurgeryCategories] = useState([]); // [{id, name}] linked to the head
  const [surgeryCategoryId, setSurgeryCategoryId] = useState('');
  const [surgeryHeadIdForFetch, setSurgeryHeadIdForFetch] = useState(null);
  const [admissionQuery, setAdmissionQuery] = useState('');
  const [admissionResults, setAdmissionResults] = useState([]);
  const [admissionSearchOpen, setAdmissionSearchOpen] = useState(false);
  const admissionSearchTimer = useRef(null);
  // IPD Consultant Fee — payee list loads straight off the Main Account (no
  // Sub Account, no admission picker); the admission(s) instead get picked
  // per-payee from that doctor's own pending Final Bill Const Fee rows via
  // the modal below, same date-filtered-checklist UX as the existing
  // Patient-Visits "Consultant" modal, just sourced from Final Bill instead.
  const [isIpdConsultantAcc, setIsIpdConsultantAcc] = useState(false);
  const [pendingFeesModal, setPendingFeesModal] = useState(null); // { doctorName, doctorId, fees: [...] | null }
  const [pendingFeesLoading, setPendingFeesLoading] = useState(false);
  const [checkedFees, setCheckedFees] = useState({});
  const [pfDateFrom, setPfDateFrom] = useState('');
  const [pfDateTo, setPfDateTo] = useState('');
  const [linkedPayees, setLinkedPayees] = useState([]);
  const [linkedHeadName, setLinkedHeadName] = useState('');
  const [linkedHeadType, setLinkedHeadType] = useState('');
  const [payeeSearch, setPayeeSearch]   = useState('');
  const [salaryModal, setSalaryModal]   = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [grnModal, setGrnModal]         = useState(null);
  const [grnLoading, setGrnLoading]     = useState(false);
  const [checkedGrns, setCheckedGrns]   = useState({});
  const [consultantModal, setConsultantModal]   = useState(null);
  const [consultantLoading, setConsultantLoading] = useState(false);
  const [checkedVisits, setCheckedVisits]       = useState({});
  const [cvDateFrom, setCvDateFrom]             = useState('');
  const [cvDateTo, setCvDateTo]                 = useState('');
  const [utilBillModal, setUtilBillModal]       = useState(null);
  const [utilBillLoading, setUtilBillLoading]   = useState(false);
  const [checkedUtilBills, setCheckedUtilBills] = useState({});

  // ── Pending GRN queue (auto-popup) ──────────────────────────────────────
  // Every still-unpaid GRN under a "Vendors / Suppliers" or "Inventory" List
  // Attachment head, fetched once on load and re-offered after every entry
  // that gets added — a quick "clear the backlog" loop that sits alongside
  // the regular manual Sub Account → Payee flow above, not in place of it.
  const [pendingQueue, setPendingQueue]   = useState([]);
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [queueLoading, setQueueLoading]   = useState(false);

  const [bankAccounts, setBankAccounts]   = useState([]);
  const [selectedBankId, setSelectedBankId] = useState(bankId ? String(bankId) : '');
  const [cashSerial, setCashSerial] = useState(1); // fetched from backend on mount

  useEffect(() => { fetchMainGLs(entityType); }, [entityType]);

  // Fetch the pending GRN backlog once on load and auto-open the queue popup
  // if there's anything to clear — editing an already-saved voucher skips
  // this, it's only a quick-entry aid for building new ones.
  const fetchPendingQueue = async () => {
    setQueueLoading(true);
    try {
      const r = await fetch(`${API}/pending-grn-queue?entityType=${entityType}`);
      const j = await r.json();
      setPendingQueue(Array.isArray(j?.data) ? j.data : []);
    } catch {
      setPendingQueue([]);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    if (isEditMode) return;
    fetchPendingQueue();
  }, [entityType]);

  useEffect(() => {
    if (!isEditMode && pendingQueue.length > 0 && !queueLoading) setQueueModalOpen(true);
  }, [pendingQueue]);

  // A GRN already staged into the local `entries` list (added but not yet
  // saved) hasn't actually flipped isPaid on the backend, so it has to be
  // hidden client-side or the same row would offer itself again.
  const stagedGrnIds = new Set(entries.flatMap((e) => Array.isArray(e.grnIds) ? e.grnIds : []));
  const visibleQueue = pendingQueue.filter((q) => !stagedGrnIds.has(q.grnId));

  // Fills the whole chain the item's head is wired to (Main GL → Sub GL →
  // Main Account → Sub Account) plus payee/amount/GRN in one go. Does its
  // own fetches rather than calling handleMainGlChange &c. in sequence —
  // those read the cascading-select state (subGLs/mainAccs/subAccs) via
  // closures fixed at render time, which stay stale across awaits within
  // one call chain; using each fetch's own response directly avoids that.
  const fillFromQueueItem = async (item) => {
    setQueueModalOpen(false);
    const { chain } = item;
    setIsInventoryAcc(false);
    resetSurgeryState();

    const [subGlJ, mainAccJ, subAccJ, payeeJ] = await Promise.all([
      fetch(`${API}/sub-gl?entityType=${entityType}&mainGlId=${chain.mainGlId}`).then((r) => r.json()),
      fetch(`${API}/main-account?entityType=${entityType}&subGlId=${chain.subGlId}`).then((r) => r.json()),
      fetch(`${API}/sub-account?entityType=${entityType}&mainAccountId=${chain.mainAccountId}`).then((r) => r.json()),
      fetch(`${API}/payee-entries/by-sub-account?subAccountId=${chain.subAccountId}&entityType=${entityType}`).then((r) => r.json()),
    ]);
    const subGlList  = Array.isArray(subGlJ?.data) ? subGlJ.data : [];
    const mainAccList = Array.isArray(mainAccJ?.data) ? mainAccJ.data : [];
    const subAccList = Array.isArray(subAccJ?.data) ? subAccJ.data : [];
    setSubGLs(subGlList);
    setMainAccs(mainAccList);
    setSubAccs(subAccList);
    setLinkedPayees(payeeJ?.data?.entries || []);
    setLinkedHeadName(payeeJ?.data?.headName || '');
    setLinkedHeadType(payeeJ?.data?.type || '');
    setPayeeSearch(item.supplierName);

    const mainAcc = mainAccList.find((a) => String(a.id) === String(chain.mainAccountId));
    const subAcc  = subAccList.find((a) => String(a.id) === String(chain.subAccountId));

    setEntry((e) => ({
      ...e,
      mainGlId: String(chain.mainGlId),
      subGlId: String(chain.subGlId),
      mainAccountId: String(chain.mainAccountId),
      subAccountId: String(chain.subAccountId),
      accountCode: subAcc?.code || mainAcc?.code || '',
      accountName: subAcc?.name || mainAcc?.name || '',
      payeeName: item.supplierName,
      amount: String(item.amount),
      grnIds: [item.grnId],
    }));
  };

  // Fetch global next cash serial from backend on mount (cash mode only)
  useEffect(() => {
    if (mode !== 'cash' || isEditMode) return;
    fetch(`${API}/cash-serial/next?entityType=${entityType}`)
      .then((r) => r.json())
      .then((j) => { if (j?.data?.nextSerial) setCashSerial(j.data.nextSerial); })
      .catch(() => {}); // silent — fallback to 1
  }, [entityType, mode, isEditMode]);

  // ── Auto Narration ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!entry.payeeName) return;
    const mainGl  = mainGLs.find((g) => String(g.id) === String(entry.mainGlId));
    const subGl   = subGLs.find((g)  => String(g.id) === String(entry.subGlId));
    const mainAcc = mainAccs.find((a) => String(a.id) === String(entry.mainAccountId));
    const subAcc  = subAccs.find((a)  => String(a.id) === String(entry.subAccountId));
    if (!mainGl || !subGl || !mainAcc) return;
    const narration = entry.admissionNo
      ? `Amount paid to ${mainGl.name} ${entry.payeeName} in account of ${subGl.name} and ${mainAcc.name} for Admission #${entry.admissionNo}`
      : subAcc
        ? `Amount paid to ${mainGl.name} ${entry.payeeName} in account of ${subGl.name} and ${mainAcc.name} for ${subAcc.name} ${entry.payeeName}`
        : `Amount paid to ${mainGl.name} ${entry.payeeName} in account of ${subGl.name} and ${mainAcc.name} for ${entry.payeeName}`;
    setEntry((e) => ({ ...e, particulars: narration.trim() }));
  }, [entry.mainGlId, entry.subGlId, entry.mainAccountId, entry.subAccountId, entry.payeeName, entry.admissionNo]);

  useEffect(() => {
    if (!isBank) return;
    fetch(`${API}/bank-accounts?entityType=${entityType}`)
      .then((r) => r.json())
      .then((j) => setBankAccounts(Array.isArray(j?.data) ? j.data : []));
  }, [entityType, isBank]);

  const fetchNextVoucherNo = async (d) => {
    try {
      const r = await fetch(`${API}/next-voucher-no?type=expense&entityType=${entityType}&date=${d}`);
      const j = await r.json();
      if (j?.data?.voucherNo) setVoucherNo(j.data.voucherNo);
    } catch { /* ignore */ }
  };

  // Editing an existing voucher keeps its original number — never reassign it.
  useEffect(() => { if (!isEditMode) fetchNextVoucherNo(date); }, [date, entityType]);

  const handleBankSelect = (id) => {
    setSelectedBankId(id);
    setEntry((e) => ({ ...e, chequeNo: '' }));
  };

  useEffect(() => {
    if (!selectedBankId || !isBank) return;
    fetch(`${API}/cheque-serials/next?bankAccountId=${selectedBankId}`)
      .then((r) => r.json())
      .then((j) => { if (j?.data?.nextSerial) setEntry((e) => ({ ...e, chequeNo: j.data.nextSerial })); });
  }, [selectedBankId]);

  const resetSurgeryState = () => {
    setIsSurgeryAcc(false);
    setSurgeryCategories([]); setSurgeryCategoryId(''); setSurgeryHeadIdForFetch(null);
    setAdmissionQuery(''); setAdmissionResults([]); setAdmissionSearchOpen(false);
    setIsIpdConsultantAcc(false);
  };

  const handleMainGlChange = async (v) => {
    setEntry((e) => ({ ...e, mainGlId: v, subGlId: '', mainAccountId: '', subAccountId: '', accountCode: '', accountName: '', payeeName: '', admissionNo: '' }));
    setSubGLs([]); setMainAccs([]); setSubAccs([]); setIsInventoryAcc(false); resetSurgeryState();
    if (!v) return;
    const r = await fetch(`${API}/sub-gl?entityType=${entityType}&mainGlId=${v}`);
    const j = await r.json();
    setSubGLs(Array.isArray(j?.data) ? j.data : []);
  };

  const handleSubGlChange = async (v) => {
    setEntry((e) => ({ ...e, subGlId: v, mainAccountId: '', subAccountId: '', accountCode: '', accountName: '', payeeName: '', admissionNo: '' }));
    setMainAccs([]); setSubAccs([]); setIsInventoryAcc(false); resetSurgeryState();
    if (!v) return;
    const r = await fetch(`${API}/main-account?entityType=${entityType}&subGlId=${v}`);
    const j = await r.json();
    setMainAccs(Array.isArray(j?.data) ? j.data : []);
  };

  const handleMainAccChange = async (v) => {
    setSubAccs([]);
    setIsInventoryAcc(false);
    resetSurgeryState();
    if (!v) { setEntry((e) => ({ ...e, mainAccountId: '', subAccountId: '', accountCode: '', accountName: '', payeeName: '', admissionNo: '' })); return; }
    const acc = mainAccs.find((a) => String(a.id) === v);
    setEntry((e) => ({ ...e, mainAccountId: v, subAccountId: '', accountCode: acc?.code || '', accountName: acc?.name || '', payeeName: '', admissionNo: '' }));

    // Check if this main account has an inventory head linked
    try {
      const invR = await fetch(`${API}/linked/inventory-head-for-main-account?mainAccountId=${v}`);
      const invJ = await invR.json();
      const invHead = invJ?.data;

      if (invHead?.id) {
        // Sub Account stays real inventory items only. Any Custom Heads
        // linked to this Inventory Head (see getInventoryItemsForHead) feed
        // the separate Payee picker instead — same UI every other linked
        // head type already uses — not mixed into the Sub Account list.
        setIsInventoryAcc(true);
        const iR = await fetch(`${API}/linked/inventory-items-for-head?headId=${invHead.id}`);
        const iJ = await iR.json();
        const merged = Array.isArray(iJ?.data) ? iJ.data : [];
        setSubAccs(merged.filter((m) => m.kind === 'item'));
        const payeeRows = merged.filter((m) => m.kind === 'payee');
        setLinkedPayees(payeeRows);
        setLinkedHeadName(payeeRows.length ? invHead.name : '');
        setLinkedHeadType(payeeRows.length ? 'inventory-custom' : '');
        return;
      }
    } catch { /* inventory check failed — fall through to regular sub accounts */ }

    // Check if this main account has a Surgery/Anesthesia head linked — Sub
    // Account becomes an admission-number picker; the payee list only loads
    // once the user picks WHICH role (Surgeon/Anaesthetic/etc) this specific
    // payment is for, so Surgery payments never show Anesthesia doctors and
    // vice versa even though both roles share the same head/Sub GL.
    try {
      const surgR = await fetch(`${API}/linked/surgery-head-for-main-account?mainAccountId=${v}`);
      const surgJ = await surgR.json();
      const surgHead = surgJ?.data;

      if (surgHead?.id) {
        setIsSurgeryAcc(true);
        setSurgeryHeadIdForFetch(surgHead.id);
        setLinkedHeadName(surgHead.name);
        setLinkedHeadType('surgery');
        const cats = (surgHead.staffCategoryLinks || []).map((l) => l.staffCategory);
        setSurgeryCategories(cats);
        // Show recent admissions immediately so the picker isn't empty
        fetch(`${CLINIC_API}/admission/adjustment/search?q=`)
          .then((r) => r.json())
          .then((j) => setAdmissionResults(Array.isArray(j?.data) ? j.data : []))
          .catch(() => {});
        // Only one role linked — no need to make the user pick, load it directly
        if (cats.length === 1) {
          setSurgeryCategoryId(String(cats[0].id));
          const pR = await fetch(`${API}/linked/surgery-payees?headId=${surgHead.id}&staffCategoryId=${cats[0].id}`);
          const pJ = await pR.json();
          setLinkedPayees(Array.isArray(pJ?.data) ? pJ.data : []);
        }
        return;
      }
    } catch { /* surgery check failed — fall through to regular sub accounts */ }

    // Check if this main account has an IPD Consultant Fee head linked
    try {
      const ipdR = await fetch(`${API}/linked/ipd-consultant-head-for-main-account?mainAccountId=${v}`);
      const ipdJ = await ipdR.json();
      const ipdHead = ipdJ?.data;

      if (ipdHead?.id) {
        setIsIpdConsultantAcc(true);
        setLinkedHeadName(ipdHead.name);
        setLinkedHeadType('ipd-consultant');
        const pR = await fetch(`${API}/linked/surgery-payees?headId=${ipdHead.id}`);
        const pJ = await pR.json();
        setLinkedPayees(Array.isArray(pJ?.data) ? pJ.data : []);
        return;
      }
    } catch { /* ipd-consultant check failed — fall through to regular sub accounts */ }

    // Load regular sub accounts
    try {
      const r = await fetch(`${API}/sub-account?entityType=${entityType}&mainAccountId=${v}`);
      const j = await r.json();
      setSubAccs(Array.isArray(j?.data) ? j.data : []);
    } catch { setSubAccs([]); }
  };

  const handleSurgeryCategorySelect = async (catId) => {
    setSurgeryCategoryId(String(catId));
    setEntry((f) => ({ ...f, payeeName: '' }));
    setPayeeSearch('');
    if (!surgeryHeadIdForFetch) return;
    const pR = await fetch(`${API}/linked/surgery-payees?headId=${surgeryHeadIdForFetch}&staffCategoryId=${catId}`);
    const pJ = await pR.json();
    setLinkedPayees(Array.isArray(pJ?.data) ? pJ.data : []);
  };

  const handleAdmissionQueryChange = (val) => {
    setAdmissionQuery(val);
    setAdmissionSearchOpen(true);
    clearTimeout(admissionSearchTimer.current);
    admissionSearchTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`${CLINIC_API}/admission/adjustment/search?q=${encodeURIComponent(val)}`);
        const j = await r.json();
        setAdmissionResults(Array.isArray(j?.data) ? j.data : []);
      } catch { setAdmissionResults([]); }
    }, 300);
  };

  const handleAdmissionSelect = (row) => {
    setEntry((e) => ({ ...e, admissionNo: row.admissionNo, accountName: mainAccs.find((a) => String(a.id) === String(e.mainAccountId))?.name || e.accountName }));
    setAdmissionQuery(`${row.admissionNo} — ${row.patientName}`);
    setAdmissionSearchOpen(false);
  };

  const handleSubAccChange = async (v) => {
    if (isInventoryAcc) {
      // subAccs here is real inventory items only (see handleMainAccChange)
      // — picking one just fills Account Name/Code. Payee stays whatever's
      // already loaded from this head's linked Custom Heads (if any),
      // untouched by which item gets picked.
      const sub = subAccs.find((s) => String(s.id) === v);
      setEntry((e) => ({
        ...e,
        subAccountId: v,
        accountCode: sub?.code || e.accountCode,
        accountName: sub?.name || e.accountName,
      }));
      return;
    }

    setLinkedPayees([]);
    setLinkedHeadName('');
    setLinkedHeadType('');
    setPayeeSearch('');

    const sub = subAccs.find((s) => String(s.id) === v);
    setEntry((e) => ({
      ...e,
      subAccountId: v,
      accountCode: sub?.code || e.accountCode,
      accountName: sub?.name || e.accountName,
      payeeName: '',
    }));
    if (!v) return;
    const r = await fetch(`${API}/payee-entries/by-sub-account?subAccountId=${v}&entityType=${entityType}`);
    const j = await r.json();
    if (j?.data) {
      setLinkedPayees(j.data.entries || []);
      setLinkedHeadName(j.data.headName || '');
      setLinkedHeadType(j.data.type || '');
    }
  };

  // Entries already added to the table have no inline-edit — this loads one
  // back into the draft form (and repopulates its GL→SubGL→MainAccount cascade
  // so the selects show it correctly) and removes it from the list; the user
  // corrects it and hits Confirm to re-add, same as adding any other entry.
  const handleEditEntry = async (idx) => {
    const e = entries[idx];
    setEntries((es) => es.filter((_, i) => i !== idx));
    setEntry({ ...e });
    setSubGLs([]); setMainAccs([]); setSubAccs([]); setIsInventoryAcc(false);
    resetSurgeryState();
    setAdmissionQuery(e.admissionNo || '');
    setLinkedPayees([]); setLinkedHeadName(''); setLinkedHeadType(''); setPayeeSearch('');

    if (e.mainGlId) {
      const r1 = await fetch(`${API}/sub-gl?entityType=${entityType}&mainGlId=${e.mainGlId}`);
      const j1 = await r1.json();
      setSubGLs(Array.isArray(j1?.data) ? j1.data : []);
    }
    if (e.subGlId) {
      const r2 = await fetch(`${API}/main-account?entityType=${entityType}&subGlId=${e.subGlId}`);
      const j2 = await r2.json();
      setMainAccs(Array.isArray(j2?.data) ? j2.data : []);
    }
    if (e.mainAccountId) {
      const invR = await fetch(`${API}/linked/inventory-head-for-main-account?mainAccountId=${e.mainAccountId}`);
      const invJ = await invR.json();
      const invHead = invJ?.data;
      if (invHead?.id) {
        setIsInventoryAcc(true);
        const iR = await fetch(`${API}/linked/inventory-items-for-head?headId=${invHead.id}`);
        const iJ = await iR.json();
        const merged = Array.isArray(iJ?.data) ? iJ.data : [];
        setSubAccs(merged.filter((m) => m.kind === 'item'));
        const payeeRows = merged.filter((m) => m.kind === 'payee');
        setLinkedPayees(payeeRows);
        setLinkedHeadName(payeeRows.length ? invHead.name : '');
        setLinkedHeadType(payeeRows.length ? 'inventory-custom' : '');
        return;
      }

      const surgR = await fetch(`${API}/linked/surgery-head-for-main-account?mainAccountId=${e.mainAccountId}`);
      const surgJ = await surgR.json();
      const surgHead = surgJ?.data;
      if (surgHead?.id) {
        setIsSurgeryAcc(true);
        setSurgeryHeadIdForFetch(surgHead.id);
        setLinkedHeadName(surgHead.name);
        setLinkedHeadType('surgery');
        const cats = (surgHead.staffCategoryLinks || []).map((l) => l.staffCategory);
        setSurgeryCategories(cats);
        // Figure out which role this saved payee belongs to so the category
        // selector re-opens already on the right choice instead of blank.
        const pAllR = await fetch(`${API}/linked/surgery-payees?headId=${surgHead.id}`);
        const pAllJ = await pAllR.json();
        const allPayees = Array.isArray(pAllJ?.data) ? pAllJ.data : [];
        const matched = allPayees.find((p) => p.name === e.payeeName);
        const matchedCat = matched ? cats.find((c) => c.name === matched.categoryName) : null;
        if (matchedCat) {
          setSurgeryCategoryId(String(matchedCat.id));
          setLinkedPayees(allPayees.filter((p) => p.categoryName === matchedCat.name));
        } else if (cats.length === 1) {
          setSurgeryCategoryId(String(cats[0].id));
          setLinkedPayees(allPayees);
        }
        return;
      }

      const ipdR = await fetch(`${API}/linked/ipd-consultant-head-for-main-account?mainAccountId=${e.mainAccountId}`);
      const ipdJ = await ipdR.json();
      const ipdHead = ipdJ?.data;
      if (ipdHead?.id) {
        setIsIpdConsultantAcc(true);
        setLinkedHeadName(ipdHead.name);
        setLinkedHeadType('ipd-consultant');
        const pR = await fetch(`${API}/linked/surgery-payees?headId=${ipdHead.id}`);
        const pJ = await pR.json();
        setLinkedPayees(Array.isArray(pJ?.data) ? pJ.data : []);
        return;
      }

      const r3 = await fetch(`${API}/sub-account?entityType=${entityType}&mainAccountId=${e.mainAccountId}`);
      const j3 = await r3.json();
      setSubAccs(Array.isArray(j3?.data) ? j3.data : []);
    }
  };

  const prevMonthInfo = () => {
    const now = new Date();
    const m = now.getMonth();
    const month = String(m === 0 ? 12 : m).padStart(2, '0');
    const year  = String(m === 0 ? now.getFullYear() - 1 : now.getFullYear());
    const monthName = new Date(Number(year), Number(month) - 1, 1)
      .toLocaleString('default', { month: 'long' });
    return { month, year, monthName };
  };

  const openSalaryModal = async (payee) => {
    setEntry((f) => ({ ...f, payeeName: payee.name }));
    setPayeeSearch(payee.name);
    const { month, year, monthName } = prevMonthInfo();
    setSalaryModal({ empName: payee.name, empCode: payee.code, month, year, monthName, rows: null, savedAt: null });
    setModalLoading(true);
    try {
      const r = await fetch(
        `http://localhost:5001/api/payslip-snapshot?empCode=${encodeURIComponent(payee.code)}&month=${month}&year=${year}`
      );
      const j = await r.json();
      setSalaryModal((prev) => ({ ...prev, rows: j?.data?.rows || null, netSalary: j?.data?.netSalary ?? null, savedAt: j?.data?.savedAt || null }));
    } catch {
      setSalaryModal((prev) => ({ ...prev, rows: null }));
    } finally {
      setModalLoading(false);
    }
  };

  const openGrnModal = async (payee) => {
    setEntry((f) => ({ ...f, payeeName: payee.name }));
    setPayeeSearch(payee.name);
    setCheckedGrns({});
    setGrnModal({ supplierName: payee.name, grns: null });
    setGrnLoading(true);
    try {
      const r = await fetch(`${API}/supplier-grns?supplierId=${payee.id}&entityType=${entityType}`);
      const j = await r.json();
      setGrnModal((prev) => ({ ...prev, grns: j?.data || [] }));
    } catch {
      setGrnModal((prev) => ({ ...prev, grns: [] }));
    } finally {
      setGrnLoading(false);
    }
  };

  const grnCheckedTotal = grnModal?.grns
    ? grnModal.grns.filter((g) => checkedGrns[g.id]).reduce((s, g) => s + Number(g.totalAmount), 0)
    : 0;

  const openConsultantModal = async (payee) => {
    setEntry((f) => ({ ...f, payeeName: payee.name }));
    setPayeeSearch(payee.name);
    setCheckedVisits({});
    setConsultantModal({ doctorName: payee.name, visits: null });
    setConsultantLoading(true);
    try {
      const q = new URLSearchParams({ doctorName: payee.name });
      if (cvDateFrom) q.set('dateFrom', cvDateFrom);
      if (cvDateTo)   q.set('dateTo',   cvDateTo);
      const r = await fetch(`${API}/consultant-visits?${q}`);
      const j = await r.json();
      setConsultantModal((prev) => ({ ...prev, visits: j?.data || [] }));
    } catch {
      setConsultantModal((prev) => ({ ...prev, visits: [] }));
    } finally {
      setConsultantLoading(false);
    }
  };

  const fetchConsultantVisits = async () => {
    if (!consultantModal) return;
    setConsultantLoading(true);
    try {
      const q = new URLSearchParams({ doctorName: consultantModal.doctorName });
      if (cvDateFrom) q.set('dateFrom', cvDateFrom);
      if (cvDateTo)   q.set('dateTo',   cvDateTo);
      const r = await fetch(`${API}/consultant-visits?${q}`);
      const j = await r.json();
      setConsultantModal((prev) => ({ ...prev, visits: j?.data || [] }));
      setCheckedVisits({});
    } catch {
      setConsultantModal((prev) => ({ ...prev, visits: [] }));
    } finally {
      setConsultantLoading(false);
    }
  };

  const cvCheckedTotal = consultantModal?.visits
    ? consultantModal.visits.filter((v) => checkedVisits[v.id]).reduce((s, v) => s + Number(v.payableAmount ?? v.received ?? 0), 0)
    : 0;

  // IPD Consultant Fee — same date-filtered-checklist UX as the Patient
  // Visits consultant modal above, sourced from that doctor's own unpaid
  // Final Bill Const Fee rows instead (see getPendingConsultantFees).
  const openPendingFeesModal = async (payee) => {
    setEntry((f) => ({ ...f, payeeName: payee.name }));
    setPayeeSearch(payee.name);
    setCheckedFees({});
    setPendingFeesModal({ doctorName: payee.name, doctorId: payee.id, fees: null });
    setPendingFeesLoading(true);
    try {
      const q = new URLSearchParams({ doctorId: payee.id });
      if (pfDateFrom) q.set('fromDate', pfDateFrom);
      if (pfDateTo)   q.set('toDate', pfDateTo);
      const r = await fetch(`${API}/linked/pending-consultant-fees?${q}`);
      const j = await r.json();
      setPendingFeesModal((prev) => ({ ...prev, fees: j?.data || [] }));
    } catch {
      setPendingFeesModal((prev) => ({ ...prev, fees: [] }));
    } finally {
      setPendingFeesLoading(false);
    }
  };

  const fetchPendingFees = async () => {
    if (!pendingFeesModal) return;
    setPendingFeesLoading(true);
    try {
      const q = new URLSearchParams({ doctorId: pendingFeesModal.doctorId });
      if (pfDateFrom) q.set('fromDate', pfDateFrom);
      if (pfDateTo)   q.set('toDate', pfDateTo);
      const r = await fetch(`${API}/linked/pending-consultant-fees?${q}`);
      const j = await r.json();
      setPendingFeesModal((prev) => ({ ...prev, fees: j?.data || [] }));
      setCheckedFees({});
    } catch {
      setPendingFeesModal((prev) => ({ ...prev, fees: [] }));
    } finally {
      setPendingFeesLoading(false);
    }
  };

  const pfCheckedTotal = pendingFeesModal?.fees
    ? pendingFeesModal.fees.filter((f) => checkedFees[f.id]).reduce((s, f) => s + Number(f.amount || 0), 0)
    : 0;

  // Utility provider payee (k-electric / ssgc / ptcl) — show that category's
  // meters/lines as a checklist so an unpaid Actual Bill's amount can be
  // pulled straight into the voucher entry, per meter (803, 804, 805 ...).
  const openUtilBillModal = async (payee) => {
    setEntry((f) => ({ ...f, payeeName: payee.name }));
    setPayeeSearch(payee.name);
    setCheckedUtilBills({});
    const utilKey = matchUtility(payee.name);
    setUtilBillModal({ providerName: payee.name, utility: utilKey, meters: null });
    setUtilBillLoading(true);
    try {
      const r = await fetch(`${UTIL_API}/last-bill-summary`);
      const j = await r.json();
      const meters = (Array.isArray(j?.data) ? j.data : []).filter((m) => m.utility === utilKey && m.lastBill);
      setUtilBillModal((prev) => ({ ...prev, meters }));
    } catch {
      setUtilBillModal((prev) => ({ ...prev, meters: [] }));
    } finally {
      setUtilBillLoading(false);
    }
  };

  const utilBillCheckedTotal = utilBillModal?.meters
    ? utilBillModal.meters.filter((m) => checkedUtilBills[m.meterId]).reduce((s, m) => s + Number(m.lastBill.amount), 0)
    : 0;

  const upd = (field) => (ev) => setEntry((e) => ({ ...e, [field]: ev.target.value }));

  // Save all confirmed table entries as drafts (not the current form entry).
  // Flow: fill form → Confirm → table mein aaya → Save as Draft → sab drafts save
  const handleSaveDraft = async (withPrint = false) => {
    if (entries.length === 0) { toast.error('Pehle entry Confirm karo'); return; }
    const snapshot = [...entries]; // capture before clearing
    setSavingDraft(true);
    try {
      for (const e of snapshot) {
        const r = await fetch(`${API}/expense-drafts?entityType=${entityType}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode, bankId: selectedBankId || null,
            mainGlId:      e.mainGlId,      mainGlName:    e.mainGlName    || '',
            subGlId:       e.subGlId,       subGlName:     e.subGlName     || '',
            mainAccountId: e.mainAccountId, accountCode:   e.accountCode   || '',
            accountName:   e.accountName   || '',
            subAccountId:  e.subAccountId  || null,
            subAccountName: e.subAccountName || null,
            payeeName:     e.payeeName     || null,
            amount:        e.amount,
            chequeNo:      e.chequeNo      || null,
            chequeDate:    e.chequeDate    || null,
            chequeType:    e.chequeType    || null,
            particulars:   e.particulars   || null,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.message || 'Failed to save draft');
      }
      toast.success(`${snapshot.length} entr${snapshot.length > 1 ? 'ies' : 'y'} draft mein save — 8:00 AM pe post hogi`);
      setEntries([]);
      setEntry(emptyEntry());
      setSubGLs([]); setMainAccs([]); setSubAccs([]);
      setLinkedPayees([]); setLinkedHeadName(''); setLinkedHeadType(''); setPayeeSearch('');
      if (withPrint) {
        try {
          printDraftSlip({ entries: snapshot, mode, date: date || new Date().toISOString().slice(0, 10), printBy: user?.name || 'Accountant' });
        } catch {
          toast.error('Draft save hua lekin print popup block ho gaya — browser popup allow karo');
        }
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleAddEntry = () => {
    if (!entry.mainGlId)      { toast.error('Select Main GL'); return; }
    if (!entry.subGlId)       { toast.error('Select Sub GL'); return; }
    if (!entry.mainAccountId) { toast.error('Select Main Account'); return; }
    if (isSurgeryAcc && !entry.admissionNo) { toast.error('Select an Admission'); return; }
    if (!entry.amount || Number(entry.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (isCheque && !entry.chequeNo.trim()) { toast.error('Enter cheque number'); return; }

    const serial = mode === 'cash'
      ? String(cashSerial).padStart(2, '0')
      : entry.chequeNo;

    const mainGl  = mainGLs.find((g) => String(g.id) === String(entry.mainGlId));
    const subGl   = subGLs.find((g)  => String(g.id) === String(entry.subGlId));
    const mainAcc = mainAccs.find((a) => String(a.id) === String(entry.mainAccountId));
    const subAcc  = subAccs.find((a)  => String(a.id) === String(entry.subAccountId));

    setEntries((es) => [...es, {
      ...entry,
      chequeNo: serial,
      mainGlName:      mainGl?.name  || '',
      subGlName:       subGl?.name   || '',
      mainAccountName: mainAcc?.name || entry.accountName || '',
      subAccountName:  subAcc?.name || (entry.admissionNo ? `Admission #${entry.admissionNo}` : '') || entry.payeeName || '',
    }]);
    if (mode === 'cash') setCashSerial((s) => s + 1);

    setEntry(emptyEntry());
    if (isBank && selectedBankId) {
      fetch(`${API}/cheque-serials/next?bankAccountId=${selectedBankId}`)
        .then((r) => r.json())
        .then((j) => { if (j?.data?.nextSerial) setEntry((e) => ({ ...e, chequeNo: j.data.nextSerial })); });
    }
    setSubGLs([]); setMainAccs([]); setSubAccs([]); setIsInventoryAcc(false);
    resetSurgeryState();
    setLinkedPayees([]); setLinkedHeadName(''); setLinkedHeadType(''); setPayeeSearch('');

    // Entry's in the list — if any pending GRNs are still uncovered, bring
    // the queue popup back so the next one can be picked straight away.
    const nowStaged = new Set([...stagedGrnIds, ...(entry.grnIds || [])]);
    if (pendingQueue.some((q) => !nowStaged.has(q.grnId))) setQueueModalOpen(true);
  };

  const total = entries.reduce((s, e) => s + Number(e.amount), 0);

  const handleConfirm = async () => {
    if (entries.length === 0) { toast.error('Add at least one entry'); return; }
    setSaving(true);
    try {
      const url    = isEditMode ? `${API}/voucher-expense/${editingVoucher.id}` : `${API}/voucher-expense`;
      const method = isEditMode ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, mode, bankId: selectedBankId ? Number(selectedBankId) : null, voucherDate: date, entries }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'Failed to save');
      const savedNo = json.data.voucherNo;
      setSavedVoucherNo(savedNo);
      toast.success(isEditMode ? `Voucher ${savedNo} updated` : `Voucher ${savedNo} saved`);
      // Printing is best-effort — a blocked popup must not look like the save
      // itself failed (the voucher is already saved server-side at this point).
      try {
        printExpenseVoucher({
          voucherNo:   savedNo,
          voucherDate: new Date().toISOString(),
          mode,
          entries,
          printBy: user?.name || 'System',
        });
      } catch {
        toast.error('Voucher saved, but the print popup was blocked — reprint it from Voucher Reprint.');
      }
      if (isEditMode) navigate(-1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const detailTitle = isCheque ? 'Cheque Details' : mode === 'online' ? 'Transfer Details' : 'Cash Details';

  return (
    <div className="ve-form" onKeyDown={handleEnterAsTab}>

      {/* ── Breadcrumb ── */}
      <div className="ve-form__breadcrumb">
        <button className="ve-form__back" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </button>
        <ChevronRight size={13} className="ve-form__bc-sep" />
        <span>Accounting</span>
        <ChevronRight size={13} className="ve-form__bc-sep" />
        <span>Transaction</span>
        <ChevronRight size={13} className="ve-form__bc-sep" />
        <span className="ve-form__bc-active">{isEditMode ? `Edit Voucher (${editingVoucher.voucherNo})` : 'Voucher Entry (Expense)'}</span>
      </div>

      {/* ── Section 1: Voucher Details ── */}
      <div className="ve-form__section">
        <div className="ve-form__section-head">Voucher Details</div>
        <div className="ve-form__section-body">
          <div className="ve-form__row-3">
            <div className="ve-form__field">
              <label>Voucher Type</label>
              <input value={isBank ? 'BANK' : 'CASH'} readOnly className="ve-form__readonly" />
            </div>
            <div className="ve-form__field">
              <label>Voucher Number</label>
              <input value={savedVoucherNo || voucherNo || '…'} readOnly className={`ve-form__readonly${savedVoucherNo ? ' ve-form__readonly--saved' : ''}`} />
            </div>
            <div className="ve-form__field">
              <label>Voucher Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Account Allocation ── */}
      <div className="ve-form__section">
        <div className="ve-form__section-head">Account Allocation</div>
        <div className="ve-form__alloc-list">
          <div className="ve-form__alloc-row">
            <span className="ve-form__alloc-label">Main GL</span>
            <span className="ve-form__alloc-sep">:</span>
            <select
              className="ve-form__alloc-input"
              value={entry.mainGlId}
              onChange={(e) => handleMainGlChange(e.target.value)}
            >
              <option value="">— Select Main GL —</option>
              {mainGLs.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
            </select>
          </div>

          <div className="ve-form__alloc-row">
            <span className="ve-form__alloc-label">SUB GL</span>
            <span className="ve-form__alloc-sep">:</span>
            <select
              className="ve-form__alloc-input"
              value={entry.subGlId}
              onChange={(e) => handleSubGlChange(e.target.value)}
              disabled={!entry.mainGlId}
            >
              <option value="">— Select SUB GL —</option>
              {subGLs.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
            </select>
          </div>

          <div className="ve-form__alloc-row">
            <span className="ve-form__alloc-label">Main Account</span>
            <span className="ve-form__alloc-sep">:</span>
            <select
              className="ve-form__alloc-input"
              value={entry.mainAccountId}
              onChange={(e) => handleMainAccChange(e.target.value)}
              disabled={!entry.subGlId}
            >
              <option value="">— Select Main Account —</option>
              {mainAccs.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>

          <div className="ve-form__alloc-row">
            <span className="ve-form__alloc-label">SUB Account</span>
            <span className="ve-form__alloc-sep">:</span>
            {isIpdConsultantAcc ? (
              <input className="ve-form__alloc-input" value="— Payee mein consultant select karein, admission wahin se milega —" readOnly disabled />
            ) : isSurgeryAcc ? (
              <div className="ve-form__payee-picker" style={{ flex: 1 }}>
                <input
                  className="ve-form__alloc-input"
                  placeholder="Search Admission # or Patient Name… (recent first)"
                  value={admissionQuery}
                  onChange={(e) => handleAdmissionQueryChange(e.target.value)}
                  onFocus={() => setAdmissionSearchOpen(true)}
                  onBlur={() => setTimeout(() => setAdmissionSearchOpen(false), 150)}
                />
                {admissionSearchOpen && (
                  <div className="ve-form__payee-list">
                    {admissionResults.length === 0 ? (
                      <div className="ve-form__payee-item" style={{ cursor: 'default', color: '#94a3b8' }}>No admissions found</div>
                    ) : admissionResults.slice(0, 8).map((r) => (
                      <div key={r.id} className="ve-form__payee-item" onMouseDown={() => handleAdmissionSelect(r)}>
                        <span className="ve-form__payee-code">{r.admissionNo}</span>
                        <span>{r.patientName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <select
                className="ve-form__alloc-input"
                value={entry.subAccountId}
                onChange={(e) => handleSubAccChange(e.target.value)}
                disabled={!entry.mainAccountId}
              >
                <option value="">None</option>
                {subAccs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code ? `${a.code} — ` : ''}{a.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 3: Cheque Details + Particulars ── */}
      <div className="ve-form__dual-panels">

        {/* Left: payment details */}
        <div className="ve-form__section ve-form__section--grow">
          <div className="ve-form__section-head">{detailTitle}</div>
          <div className="ve-form__section-body">

            {/* Bank selection (online / cheque) */}
            {isBank && (
              <div className="ve-form__field" style={{ marginBottom: '0.85rem' }}>
                <label>Bank Account</label>
                <select value={selectedBankId} onChange={(e) => handleBankSelect(e.target.value)}>
                  <option value="">— Select Bank —</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.bankName} — {b.accountNumber}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Cash serial display */}
            {!isBank && (
              <div className="ve-form__field" style={{ marginBottom: '0.85rem' }}>
                <label>Cash Serial #</label>
                <input value={String(cashSerial).padStart(2, '0')} readOnly className="ve-form__readonly" />
              </div>
            )}

            {/* Payee + Amount */}
            <div className="ve-form__row-2">
              <div className="ve-form__field">
                <label>
                  Payee
                  {linkedHeadName && <span className="ve-form__head-tag">{linkedHeadName}</span>}
                  {!isSurgeryAcc && !entry.subAccountId && subAccs.length > 0 && !linkedPayees.length && (
                    <span className="ve-form__optional"> (select Sub Account first)</span>
                  )}
                </label>
                {isSurgeryAcc && surgeryCategories.length > 1 && (
                  <div className="ve-form__surg-type">
                    {surgeryCategories.map((c) => (
                      <label key={c.id} className={`ve-form__surg-type-opt ${String(surgeryCategoryId) === String(c.id) ? 'active' : ''}`}>
                        <input
                          type="radio"
                          name="surgery-type"
                          checked={String(surgeryCategoryId) === String(c.id)}
                          onChange={() => handleSurgeryCategorySelect(c.id)}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                )}
                {isSurgeryAcc && !surgeryCategoryId ? (
                  <p className="ve-form__optional">Payee dekhne ke liye upar role (Surgeon/Anaesthetic) select karein</p>
                ) : linkedPayees.length > 0 ? (
                  <div className="ve-form__payee-picker">
                    <input
                      className="ve-form__payee-search"
                      placeholder="Search by name or code…"
                      value={payeeSearch}
                      onChange={(e) => { setPayeeSearch(e.target.value); setEntry((f) => ({ ...f, payeeName: '' })); }}
                    />
                    {(payeeSearch || !entry.payeeName) && (
                      <div className="ve-form__payee-list">
                        {linkedPayees
                          .filter((p) => {
                            const q = payeeSearch.toLowerCase();
                            return p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
                          })
                          .slice(0, 8)
                          .map((p) => (
                            <div
                              key={p.id}
                              className={`ve-form__payee-item ${entry.payeeName === p.name ? 'active' : ''}`}
                              onClick={() => {
                                if (linkedHeadType === 'employee') openSalaryModal(p);
                                else if (linkedHeadType === 'vendor') openGrnModal(p);
                                else if (linkedHeadType === 'doctor') openConsultantModal(p);
                                else if (linkedHeadType === 'ipd-consultant') openPendingFeesModal(p);
                                else if (linkedHeadType === 'manual' && linkedHeadName.toLowerCase().includes('utility') && matchUtility(p.name)) openUtilBillModal(p);
                                else { setEntry((f) => ({ ...f, payeeName: p.name })); setPayeeSearch(p.name); }
                              }}
                            >
                              {p.code && <span className="ve-form__payee-code">{p.code}</span>}
                              <span>{p.name}{p.categoryName ? ` (${p.categoryName})` : ''}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    value={entry.payeeName}
                    onChange={upd('payeeName')}
                    placeholder={entry.subAccountId ? 'No list linked — type manually' : 'Select Sub Account first'}
                    disabled={!entry.subAccountId}
                  />
                )}
              </div>

              <div className="ve-form__field">
                <label>Amount</label>
                <input
                  type="number" min="0" step="0.01"
                  value={entry.amount}
                  onChange={upd('amount')}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Cheque / Transfer fields */}
            {isBank && (
              <div className="ve-form__row-3">
                <div className="ve-form__field">
                  <label>{isCheque ? 'Cheque #' : 'Reference #'}</label>
                  <input value={entry.chequeNo} onChange={upd('chequeNo')} placeholder={isCheque ? 'e.g. 26848' : 'Transfer ref'} />
                </div>
                <div className="ve-form__field">
                  <label>{isCheque ? 'Cheque Date' : 'Transfer Date'}</label>
                  <input type="date" value={entry.chequeDate} onChange={upd('chequeDate')} />
                </div>
                {isCheque && (
                  <div className="ve-form__field">
                    <label>Cheque Type</label>
                    <select value={entry.chequeType} onChange={upd('chequeType')}>
                      <option value="bearer">Bearer</option>
                      <option value="order">Order</option>
                    </select>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Right: Particulars */}
        <div className="ve-form__section ve-form__section--particulars">
          <div className="ve-form__section-head">Particulars</div>
          <textarea
            className="ve-form__particulars-area"
            value={entry.particulars}
            onChange={upd('particulars')}
            placeholder="Enter description..."
          />
        </div>

      </div>

      {/* ── Action Row ── */}
      <div className="ve-form__action-row">
        {savedVoucherNo ? (
          <div className="ve-form__saved-strip">
            <span className="ve-form__saved-no">✓ Voucher <strong>{savedVoucherNo}</strong> saved</span>
            <button className="ve-form__submit-btn" onClick={() => navigate(`/accounts/${entityType}/transactions`)}>
              Done
            </button>
            <button className="ve-form__add-btn" onClick={() => { setSavedVoucherNo(null); setEntries([]); setEntry(emptyEntry()); fetchPendingQueue(); }}>
              New Voucher
            </button>
          </div>
        ) : (
          <>
            <button
              className="ve-form__submit-btn"
              onClick={handleConfirm}
              disabled={saving || entries.length === 0}
            >
              {saving ? 'Saving…' : isEditMode ? 'Update & Print' : 'Save & Print'}
            </button>
            <button className="ve-form__add-btn" data-enter-submit onClick={handleAddEntry}>
              <Plus size={15} /> Confirm
            </button>
            <button
              className="ve-form__draft-btn ve-form__draft-btn--print"
              onClick={() => handleSaveDraft(true)}
              disabled={savingDraft}
              title="Save as draft aur print bhi karo"
            >
              {savingDraft ? 'Saving…' : '🖨️ Save as Draft & Print'}
            </button>
          </>
        )}
      </div>

      {/* ── Entries Table ── */}
      {entries.length > 0 && (
        <div className="ve-form__table-wrap">
          <table className="ve-form__table">
            <thead>
              <tr>
                <th>Account Code</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Particulars</th>
                <th>{mode === 'cash' ? 'Cash Serial' : isCheque ? 'Cheque #' : 'Ref #'}</th>
                {isCheque && <th>Cheque Type</th>}
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td className="ve-form__td-code">{e.accountCode}</td>
                  <td>{e.accountName}</td>
                  <td className="ve-form__td-amount">{Number(e.amount).toLocaleString()}</td>
                  <td>{e.particulars || '—'}</td>
                  <td>{e.chequeNo || '—'}</td>
                  {isCheque && <td className="ve-form__td-cap">{e.chequeType}</td>}
                  <td><span className="ve-form__status-badge">Confirm</span></td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      className="ve-form__del-btn"
                      title="Edit"
                      onClick={() => handleEditEntry(i)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="ve-form__del-btn"
                      title="Print Slip"
                      onClick={() => printEntrySlip({ entry: e, voucherDate: date, printBy: user?.name || 'Accountant' })}
                    >
                      <Printer size={14} />
                    </button>
                    <button
                      className="ve-form__del-btn"
                      title="Remove"
                      onClick={() => setEntries((es) => es.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="ve-form__total-label">TOTAL</td>
                <td className="ve-form__total-amount">{total.toLocaleString()}</td>
                <td colSpan={isCheque ? 5 : 4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Pending GRN Queue Modal (auto-popup) ── */}
      {queueModalOpen && (
        <div className="ve-sal-modal__backdrop" onClick={() => setQueueModalOpen(false)}>
          <div className="ve-grn-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ve-sal-modal__header">
              <div>
                <div className="ve-sal-modal__title">Pending Payments</div>
                <div className="ve-sal-modal__sub">
                  {visibleQueue.length} unpaid Vendor/Supplier &amp; Inventory GRN{visibleQueue.length === 1 ? '' : 's'} — most recent first
                </div>
              </div>
              <button className="ve-sal-modal__close" onClick={() => setQueueModalOpen(false)}>✕</button>
            </div>

            {queueLoading ? (
              <div className="ve-sal-modal__loading">Loading…</div>
            ) : !visibleQueue.length ? (
              <div className="ve-sal-modal__no-data">Sab pending GRNs is voucher mein add ho chuke hain.</div>
            ) : (
              <div className="ve-grn-modal__table-wrap">
                <table className="ve-grn-modal__table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>GRN #</th>
                      <th>Item</th>
                      <th>Supplier</th>
                      <th>Head</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleQueue.map((q) => (
                      <tr key={q.id} onClick={() => fillFromQueueItem(q)}>
                        <td>{new Date(q.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="ve-grn-modal__code">{q.code}</td>
                        <td>{q.itemName}</td>
                        <td>{q.supplierName}</td>
                        <td>{q.headName}</td>
                        <td className="ve-grn-modal__amount">PKR {Number(q.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="ve-grn-modal__footer">
              <span className="ve-sal-modal__sub">Row pe click karke form fill karo, phir neeche Confirm karke agla pending item mil jayega.</span>
              <div className="ve-grn-modal__actions">
                <button className="ve-sal-modal__cancel" onClick={() => setQueueModalOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GRN Modal ── */}
      {grnModal && (
        <div className="ve-sal-modal__backdrop" onClick={() => setGrnModal(null)}>
          <div className="ve-grn-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ve-sal-modal__header">
              <div>
                <div className="ve-sal-modal__title">GRN Transactions</div>
                <div className="ve-sal-modal__sub">{grnModal.supplierName}</div>
              </div>
              <button className="ve-sal-modal__close" onClick={() => setGrnModal(null)}>✕</button>
            </div>

            {grnLoading ? (
              <div className="ve-sal-modal__loading">Loading transactions…</div>
            ) : !grnModal.grns?.length ? (
              <div className="ve-sal-modal__no-data">No GRN transactions found for this supplier.</div>
            ) : (
              <>
                <div className="ve-grn-modal__table-wrap">
                  <table className="ve-grn-modal__table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              const all = {};
                              if (e.target.checked) grnModal.grns.forEach((g) => { all[g.id] = true; });
                              setCheckedGrns(all);
                            }}
                            checked={grnModal.grns.length > 0 && grnModal.grns.every((g) => checkedGrns[g.id])}
                          />
                        </th>
                        <th>GRN #</th>
                        <th>Item</th>
                        <th>Date</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grnModal.grns.map((g) => (
                        <tr
                          key={g.id}
                          className={checkedGrns[g.id] ? 've-grn-modal__row--checked' : ''}
                          onClick={() => setCheckedGrns((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
                        >
                          <td><input type="checkbox" checked={!!checkedGrns[g.id]} onChange={() => {}} /></td>
                          <td className="ve-grn-modal__code">{g.code}</td>
                          <td>{g.item?.name || '—'}</td>
                          <td>{new Date(g.receivedDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td className="ve-grn-modal__amount">PKR {Number(g.totalAmount).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ve-grn-modal__footer">
                  <div className="ve-grn-modal__total">
                    <span>Selected Total</span>
                    <span className="ve-grn-modal__total-val">PKR {grnCheckedTotal.toLocaleString()}</span>
                  </div>
                  <div className="ve-grn-modal__actions">
                    <button className="ve-sal-modal__cancel" onClick={() => setGrnModal(null)}>Cancel</button>
                    <button
                      className="ve-sal-modal__verify"
                      disabled={grnCheckedTotal === 0}
                      onClick={() => {
                        const ids = (grnModal.grns || []).filter((g) => checkedGrns[g.id]).map((g) => g.id);
                        setEntry((f) => ({ ...f, amount: String(Math.round(grnCheckedTotal)), grnIds: ids }));
                        setGrnModal(null);
                      }}
                    >
                      Fill Amount
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Utility Bill Modal ── */}
      {utilBillModal && (
        <div className="ve-sal-modal__backdrop" onClick={() => setUtilBillModal(null)}>
          <div className="ve-grn-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ve-sal-modal__header">
              <div>
                <div className="ve-sal-modal__title">Actual Bills</div>
                <div className="ve-sal-modal__sub">{utilBillModal.providerName}</div>
              </div>
              <button className="ve-sal-modal__close" onClick={() => setUtilBillModal(null)}>✕</button>
            </div>

            {utilBillLoading ? (
              <div className="ve-sal-modal__loading">Loading bills…</div>
            ) : !utilBillModal.meters?.length ? (
              <div className="ve-sal-modal__no-data">Utilities Bill module mein koi actual bill posted nahi mila.</div>
            ) : (
              <>
                <div className="ve-grn-modal__table-wrap">
                  <table className="ve-grn-modal__table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              const all = {};
                              if (e.target.checked) utilBillModal.meters.forEach((m) => { all[m.meterId] = true; });
                              setCheckedUtilBills(all);
                            }}
                            checked={utilBillModal.meters.length > 0 && utilBillModal.meters.every((m) => checkedUtilBills[m.meterId])}
                          />
                        </th>
                        <th>Meter</th>
                        <th>Period</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utilBillModal.meters.map((m) => (
                        <tr
                          key={m.meterId}
                          className={checkedUtilBills[m.meterId] ? 've-grn-modal__row--checked' : ''}
                          onClick={() => setCheckedUtilBills((prev) => ({ ...prev, [m.meterId]: !prev[m.meterId] }))}
                        >
                          <td><input type="checkbox" checked={!!checkedUtilBills[m.meterId]} onChange={() => {}} /></td>
                          <td className="ve-grn-modal__code">{m.meterNo}</td>
                          <td>
                            {new Date(m.lastBill.fromDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' })}
                            {' – '}
                            {new Date(m.lastBill.toDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="ve-grn-modal__amount">PKR {Number(m.lastBill.amount).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ve-grn-modal__footer">
                  <div className="ve-grn-modal__total">
                    <span>Selected Total</span>
                    <span className="ve-grn-modal__total-val">PKR {utilBillCheckedTotal.toLocaleString()}</span>
                  </div>
                  <div className="ve-grn-modal__actions">
                    <button className="ve-sal-modal__cancel" onClick={() => setUtilBillModal(null)}>Cancel</button>
                    <button
                      className="ve-sal-modal__verify"
                      disabled={utilBillCheckedTotal === 0}
                      onClick={() => {
                        setEntry((f) => ({ ...f, amount: String(Math.round(utilBillCheckedTotal)) }));
                        setUtilBillModal(null);
                      }}
                    >
                      Fill Amount
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Consultant Visits Modal ── */}
      {consultantModal && (
        <div className="ve-sal-modal__backdrop" onClick={() => setConsultantModal(null)}>
          <div className="ve-grn-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="ve-sal-modal__header">
              <div>
                <div className="ve-sal-modal__title">Patient Visits</div>
                <div className="ve-sal-modal__sub">{consultantModal.doctorName}</div>
              </div>
              <button className="ve-sal-modal__close" onClick={() => setConsultantModal(null)}>✕</button>
            </div>

            {/* Date filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Date</span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>From</span>
              <input type="date" value={cvDateFrom} onChange={(e) => setCvDateFrom(e.target.value)}
                style={{ padding: '0.28rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem' }} />
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>To</span>
              <input type="date" value={cvDateTo} onChange={(e) => setCvDateTo(e.target.value)}
                style={{ padding: '0.28rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem' }} />
              <button onClick={fetchConsultantVisits} disabled={consultantLoading}
                style={{ padding: '0.28rem 0.75rem', background: '#334155', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' }}>
                {consultantLoading ? 'Loading…' : 'Search'}
              </button>
            </div>

            {consultantLoading ? (
              <div className="ve-sal-modal__loading">Loading visits…</div>
            ) : !consultantModal.visits?.length ? (
              <div className="ve-sal-modal__no-data">No patient visits found.</div>
            ) : (
              <>
                <div className="ve-grn-modal__table-wrap">
                  <table className="ve-grn-modal__table">
                    <thead>
                      <tr>
                        <th>
                          <input type="checkbox"
                            onChange={(e) => {
                              const all = {};
                              if (e.target.checked) consultantModal.visits.forEach((v) => { all[v.id] = true; });
                              setCheckedVisits(all);
                            }}
                            checked={consultantModal.visits.length > 0 && consultantModal.visits.every((v) => checkedVisits[v.id])}
                          />
                        </th>
                        <th>S.No</th>
                        <th>Date</th>
                        <th>Patient Name</th>
                        <th>Sub Dept</th>
                        <th>Type</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consultantModal.visits.map((v) => (
                        <tr key={v.id}
                          className={checkedVisits[v.id] ? 've-grn-modal__row--checked' : ''}
                          onClick={() => setCheckedVisits((prev) => ({ ...prev, [v.id]: !prev[v.id] }))}
                        >
                          <td><input type="checkbox" checked={!!checkedVisits[v.id]} onChange={() => {}} /></td>
                          <td className="ve-grn-modal__code">{v.serialNo || '—'}</td>
                          <td>{v.visitDate ? new Date(v.visitDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td>{v.patientName}</td>
                          <td>{v.subDepartment || '—'}</td>
                          <td>{v.paymentType || '—'}</td>
                          <td className="ve-grn-modal__amount">
                            PKR {Number(v.payableAmount ?? v.received ?? 0).toLocaleString()}
                            {v.hasRate && Number(v.payableAmount) !== Number(v.received) && (
                              <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 400 }}>
                                {v.ratePercent ? `${v.ratePercent}% of ` : 'of '}PKR {Number(v.received || 0).toLocaleString()}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ve-grn-modal__footer">
                  <div className="ve-grn-modal__total">
                    <span>Selected Total</span>
                    <span className="ve-grn-modal__total-val">PKR {cvCheckedTotal.toLocaleString()}</span>
                  </div>
                  <div className="ve-grn-modal__actions">
                    <button className="ve-sal-modal__cancel" onClick={() => setConsultantModal(null)}>Cancel</button>
                    <button className="ve-sal-modal__verify"
                      disabled={cvCheckedTotal === 0}
                      onClick={() => {
                        const ids = Object.keys(checkedVisits).filter((k) => checkedVisits[k]).map(Number);
                        setEntry((f) => ({ ...f, amount: String(Math.round(cvCheckedTotal)), visitIds: ids }));
                        setConsultantModal(null);
                      }}
                    >
                      Fill Amount
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── IPD Consultant Fee Modal — pending Final Bill Const Fee rows,
          date-filterable, multi-select summed into Amount ── */}
      {pendingFeesModal && (
        <div className="ve-sal-modal__backdrop" onClick={() => setPendingFeesModal(null)}>
          <div className="ve-grn-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="ve-sal-modal__header">
              <div>
                <div className="ve-sal-modal__title">Pending Consultant Fees</div>
                <div className="ve-sal-modal__sub">{pendingFeesModal.doctorName}</div>
              </div>
              <button className="ve-sal-modal__close" onClick={() => setPendingFeesModal(null)}>✕</button>
            </div>

            {/* Date filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Date</span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>From</span>
              <input type="date" value={pfDateFrom} onChange={(e) => setPfDateFrom(e.target.value)}
                style={{ padding: '0.28rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem' }} />
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>To</span>
              <input type="date" value={pfDateTo} onChange={(e) => setPfDateTo(e.target.value)}
                style={{ padding: '0.28rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.78rem' }} />
              <button onClick={fetchPendingFees} disabled={pendingFeesLoading}
                style={{ padding: '0.28rem 0.75rem', background: '#334155', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' }}>
                {pendingFeesLoading ? 'Loading…' : 'Search'}
              </button>
            </div>

            {pendingFeesLoading ? (
              <div className="ve-sal-modal__loading">Loading fees…</div>
            ) : !pendingFeesModal.fees?.length ? (
              <div className="ve-sal-modal__no-data">Is doctor ki koi pending Consultant Fee nahi mili.</div>
            ) : (
              <>
                <div className="ve-grn-modal__table-wrap">
                  <table className="ve-grn-modal__table">
                    <thead>
                      <tr>
                        <th>
                          <input type="checkbox"
                            onChange={(e) => {
                              const all = {};
                              if (e.target.checked) pendingFeesModal.fees.forEach((f) => { all[f.id] = true; });
                              setCheckedFees(all);
                            }}
                            checked={pendingFeesModal.fees.length > 0 && pendingFeesModal.fees.every((f) => checkedFees[f.id])}
                          />
                        </th>
                        <th>Admission #</th>
                        <th>Date</th>
                        <th>Patient Name</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingFeesModal.fees.map((f) => (
                        <tr key={f.id}
                          className={checkedFees[f.id] ? 've-grn-modal__row--checked' : ''}
                          onClick={() => setCheckedFees((prev) => ({ ...prev, [f.id]: !prev[f.id] }))}
                        >
                          <td><input type="checkbox" checked={!!checkedFees[f.id]} onChange={() => {}} /></td>
                          <td className="ve-grn-modal__code">{f.admissionNo || '—'}</td>
                          <td>{f.date ? new Date(f.date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td>{f.patientName}</td>
                          <td className="ve-grn-modal__amount">PKR {Number(f.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ve-grn-modal__footer">
                  <div className="ve-grn-modal__total">
                    <span>Selected Total</span>
                    <span className="ve-grn-modal__total-val">PKR {pfCheckedTotal.toLocaleString()}</span>
                  </div>
                  <div className="ve-grn-modal__actions">
                    <button className="ve-sal-modal__cancel" onClick={() => setPendingFeesModal(null)}>Cancel</button>
                    <button className="ve-sal-modal__verify"
                      disabled={pfCheckedTotal === 0}
                      onClick={() => {
                        const ids = Object.keys(checkedFees).filter((k) => checkedFees[k]).map(Number);
                        setEntry((f) => ({ ...f, amount: String(pfCheckedTotal), consultantFeeItemIds: ids }));
                        setPendingFeesModal(null);
                      }}
                    >
                      Fill Amount
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Salary Modal ── */}
      {salaryModal && (
        <div className="ve-sal-modal__backdrop" onClick={() => setSalaryModal(null)}>
          <div className="ve-sal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ve-sal-modal__header">
              <div>
                <div className="ve-sal-modal__title">Salary Verification</div>
                <div className="ve-sal-modal__sub">{salaryModal.empName} · {salaryModal.empCode}</div>
              </div>
              <button className="ve-sal-modal__close" onClick={() => setSalaryModal(null)}>✕</button>
            </div>

            <div className="ve-sal-modal__month-badge">
              {salaryModal.monthName} {salaryModal.year}
            </div>

            {modalLoading ? (
              <div className="ve-sal-modal__loading">Loading payslip…</div>
            ) : salaryModal.rows ? (
              <>
                {salaryModal.savedAt && (
                  <div className="ve-sal-modal__saved-at">
                    Saved: {new Date(salaryModal.savedAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}
                <div className="ve-sal-modal__rows">
                  <div className="ve-sal-modal__row ve-sal-modal__row--net">
                    <span>Net Payable</span>
                    <span>PKR {(salaryModal.netSalary ?? 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="ve-sal-modal__footer">
                  <button className="ve-sal-modal__cancel" onClick={() => setSalaryModal(null)}>Cancel</button>
                  <button
                    className="ve-sal-modal__verify"
                    onClick={() => {
                      setEntry((f) => ({ ...f, amount: String(Math.round(salaryModal.netSalary ?? 0)), salaryEmpCode: salaryModal.empCode, salaryMonth: salaryModal.month, salaryYear: salaryModal.year }));
                      setSalaryModal(null);
                    }}
                  >
                    Verify &amp; Fill Amount
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="ve-sal-modal__no-data">
                  No payslip snapshot found for {salaryModal.monthName} {salaryModal.year}.<br />
                  Please save the payslip from Reports first, or enter amount manually.
                </div>
                <div className="ve-sal-modal__footer">
                  <button className="ve-sal-modal__cancel" onClick={() => setSalaryModal(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
