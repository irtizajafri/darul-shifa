import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Printer, Search, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../../store/useAuthStore';
import './VoucherReprint.scss';

const API = 'http://localhost:5001/api/accounts';

const todayStr    = () => new Date().toISOString().slice(0, 10);
const firstOfYear = () => `${new Date().getFullYear()}-01-01`;

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

const modeLabel = (m) =>
  m === 'cheque' ? 'Cheque' : m === 'online' ? 'Online Transfer' : m === 'system' ? 'System (Auto Day Close)' : 'Cash';

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

const fmt2 = (n) =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Single voucher card ───────────────────────────────────────────────────────
function VoucherCard({ v, isExpense, entityType, pageNum, totalPages, printBy }) {
  const total = Number(v.totalAmount);
  const title = isExpense ? 'EXPENSE VOUCHER' : 'INCOME VOUCHER';

  return (
    <div className="vr-print-page">

      {/* ── Header ── */}
      <div className="vr-vc-header">
        <div className="vr-vc-title-area">
          <div className="vr-vc-title">{title}</div>
        </div>
        <div className="vr-vc-meta-area">
          <div className="vr-vc-printby">PRINT BY: {printBy}</div>
          <div className="vr-vc-vdate">VOUCHER DATE: {fmtDateLong(v.createdAt || v.voucherDate)}</div>
          <div className="vr-vc-page">Page: {pageNum} of {totalPages}</div>
        </div>
      </div>

      <div className="vr-vc-divider" />

      {/* ── Voucher info row ── */}
      <div className="vr-vc-info">
        <div className="vr-vc-info-item">
          <span className="vr-vc-info-label">VOUCHER #:</span>
          <span className="vr-vc-info-val">{v.voucherNo}</span>
        </div>
        <div className="vr-vc-info-item">
          <span className="vr-vc-info-label">METHOD:</span>
          <span className="vr-vc-info-val">{modeLabel(v.mode)}</span>
        </div>
      </div>

      {/* ── Entries table ── */}
      {isExpense ? (
        <table className="vr-table">
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '7%'  }} />
            <col style={{ width: '5%'  }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>GL</th>
              <th>ACCOUNT</th>
              <th>PAYEE</th>
              <th>PARTICULARS</th>
              <th>CHQ DT</th>
              <th>CHQ #</th>
              <th className="vr-td-r">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {(v.entries || []).map((e) => (
              <tr key={e.id}>
                <td>
                  <div className="vr-cell-top">{e.mainGlName || '—'}</div>
                  <div className="vr-cell-sub">{e.subGlName  || '—'}</div>
                </td>
                <td>
                  <div className="vr-cell-top">{e.mainAccountName || e.accountName || '—'}</div>
                  <div className="vr-cell-sub">{e.subAccountName  || '—'}</div>
                </td>
                <td>{e.payeeName || '—'}</td>
                <td>{e.particulars || '—'}</td>
                <td>{e.chequeDate ? fmtDate(e.chequeDate) : '—'}</td>
                <td>{e.chequeNo   || '—'}</td>
                <td className="vr-td-r">{fmt2(e.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="vr-tfoot-words">{amountInWords(total)}</td>
              <td className="vr-tfoot-label">TOTAL</td>
              <td className="vr-td-r vr-tfoot-amt">{fmt2(total)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <table className="vr-table">
          <thead>
            <tr>
              <th>INCOME CATEGORY</th>
              <th>PARTICULARS</th>
              <th className="vr-td-r">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {(v.entries || []).map((e) => (
              <tr key={e.id}>
                <td>{e.incomeCategoryName || '—'}</td>
                <td>{e.particulars        || '—'}</td>
                <td className="vr-td-r">{fmt2(e.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="vr-tfoot-words">{amountInWords(total)}</td>
              <td className="vr-tfoot-label">TOTAL</td>
              <td className="vr-td-r vr-tfoot-amt">{fmt2(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* ── Signatures ── */}
      <div className="vr-sigs">
        <div className="vr-sig">Accountant</div>
        <div className="vr-sig">Administrator</div>
        <div className="vr-sig">Receiver's Signature</div>
      </div>
    </div>
  );
}

// ── Print styles (injected into print window) ─────────────────────────────────
const PRINT_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:11px; color:#000; background:#fff; }
  .vr-print-page { page-break-after:always; padding:16px 20px; margin:6px; }
  .vr-print-page:last-child { page-break-after:avoid; }
  .vr-vc-header { display:flex; align-items:flex-start; justify-content:space-between; padding-bottom:8px; margin-bottom:8px; }
  .vr-vc-title-area { flex:1; }
  .vr-vc-title { font-size:15px; font-weight:900; letter-spacing:0.05em; text-transform:uppercase; }
  .vr-vc-meta-area { text-align:right; font-size:9px; line-height:1.7; }
  .vr-vc-printby { font-weight:700; }
  .vr-vc-divider { border-top:1px solid #bbb; margin:4px 0 7px; }
  .vr-vc-info { display:flex; gap:20px; margin-bottom:8px; font-size:10px; }
  .vr-vc-info-label { font-weight:700; margin-right:4px; }
  table { width:100%; border-collapse:collapse; margin-bottom:4px; }
  th { padding:5px 6px; font-size:10px; text-align:left; font-weight:700; text-transform:uppercase; }
  td { padding:4px 6px; font-size:10px; text-align:left; }
  tfoot td { background:#f9f9f9; font-weight:700; }
  .vr-td-r { text-align:right !important; }
  .vr-cell-top { font-size:10px; }
  .vr-cell-sub { font-size:9px; color:#555; margin-top:1px; }
  .vr-tfoot-words { font-size:9px; font-style:italic; color:#555; font-weight:400; vertical-align:middle; }
  .vr-tfoot-label { text-align:right; font-size:9px; text-transform:uppercase; color:#555; padding-right:8px !important; }
  .vr-tfoot-amt { font-size:11px; font-weight:800; }
  .vr-sigs { display:flex; justify-content:space-between; margin-top:22px; padding-top:6px; }
  .vr-sig { text-align:center; font-size:9px; border-top:1.5px solid #000; padding-top:4px; width:120px; font-weight:600; }
`;

// ── Page ──────────────────────────────────────────────────────────────────────
export default function VoucherReprint() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const cardRefs = useRef(new Map());
  const { user } = useAuthStore();
  const printBy  = user?.name || 'System';

  const [voucherType, setVoucherType] = useState('expense');
  const [voucherFrom, setVoucherFrom] = useState('');
  const [voucherTo,   setVoucherTo]   = useState('');
  const [dateFrom,    setDateFrom]    = useState(firstOfYear());
  const [dateTo,      setDateTo]      = useState(todayStr());
  const [vouchers,    setVouchers]    = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [searched,    setSearched]    = useState(false);

  const isExpense = voucherType === 'expense';

  const handleSearch = async () => {
    setLoading(true);
    setSearched(false);
    try {
      const params = new URLSearchParams({
        type: voucherType,
        entityType,
        ...(voucherFrom && { voucherFrom }),
        ...(voucherTo   && { voucherTo }),
        ...(dateFrom    && { dateFrom }),
        ...(dateTo      && { dateTo }),
      });
      const r = await fetch(`${API}/voucher-reprint?${params}`);
      const j = await r.json();
      setVouchers(Array.isArray(j?.data) ? j.data : []);
    } catch {
      setVouchers([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const printHTML = (content) => {
    const win = window.open('', '_blank');
    if (!win) { toast.error('Print popup was blocked by the browser'); return; }
    win.document.write(
      `<!DOCTYPE html><html><head><title>Voucher Reprint</title><style>${PRINT_CSS}</style></head><body>${content}</body></html>`
    );
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.onafterprint = () => win.close();
    }, 400);
  };

  const handlePrint = () => {
    const content = vouchers.map((v) => cardRefs.current.get(v.id)?.outerHTML || '').join('');
    printHTML(content);
  };

  const handlePrintOne = (voucherId) => {
    const content = cardRefs.current.get(voucherId)?.outerHTML;
    if (content) printHTML(content);
  };

  const handleEdit = (v) => {
    const formPath = isExpense
      ? `/accounts/${entityType}/transactions/voucher-expense/form`
      : `/accounts/${entityType}/transactions/voucher-income/form`;
    navigate(formPath, { state: { mode: v.mode, bankId: v.bankId, editVoucher: v } });
  };

  return (
    <div className="vr-page">

      {/* Breadcrumb */}
      <div className="vr-breadcrumb">
        <button className="vr-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </button>
        <ChevronRight size={13} className="vr-bc-sep" />
        <span>Reports</span>
        <ChevronRight size={13} className="vr-bc-sep" />
        <span className="vr-bc-active">Voucher Reprint</span>
      </div>

      {/* Filter card */}
      <div className="vr-filter-card">
        <div className="vr-filter-title">Select Voucher Reprint</div>

        <div className="vr-filter-row">
          <div className="vr-filter-label">Voucher #</div>
          <div className="vr-filter-fields">
            <div className="vr-range-group">
              <span className="vr-range-tag">From</span>
              <input className="vr-input" placeholder="e.g. VE-20260629-001"
                value={voucherFrom} onChange={(e) => setVoucherFrom(e.target.value)} />
              <Search size={14} className="vr-input-icon" />
            </div>
            <div className="vr-range-group">
              <span className="vr-range-tag">To</span>
              <input className="vr-input" placeholder="e.g. VE-20260629-999"
                value={voucherTo} onChange={(e) => setVoucherTo(e.target.value)} />
              <Search size={14} className="vr-input-icon" />
            </div>
          </div>
        </div>

        <div className="vr-filter-row">
          <div className="vr-filter-label">Voucher Date</div>
          <div className="vr-filter-fields">
            <div className="vr-range-group">
              <span className="vr-range-tag">From</span>
              <input type="date" className="vr-input" value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="vr-range-group">
              <span className="vr-range-tag">To</span>
              <input type="date" className="vr-input" value={dateTo}
                onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="vr-radio-row">
          <label className="vr-radio-label">
            <input type="radio" value="expense"
              checked={voucherType === 'expense'} onChange={() => setVoucherType('expense')} />
            Expense Voucher
          </label>
          <label className="vr-radio-label">
            <input type="radio" value="income"
              checked={voucherType === 'income'} onChange={() => setVoucherType('income')} />
            Income Voucher
          </label>
        </div>

        <div className="vr-filter-actions">
          <button className="vr-btn-search" onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching…' : 'Voucher Reprint'}
          </button>
          {vouchers?.length > 0 && (
            <button className="vr-btn-print" onClick={handlePrint}>
              <Printer size={15} /> Print All
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="vr-results">
          {vouchers.length === 0 ? (
            <div className="vr-no-data">No vouchers found for the selected filters.</div>
          ) : (
            <>
              <div className="vr-results-count">
                {vouchers.length} voucher{vouchers.length > 1 ? 's' : ''} found
              </div>
              {vouchers.map((v, idx) => {
                const canEdit = isExpense || v.source !== 'auto';
                return (
                  <div key={v.id} className="vr-card-block">
                    <div className="vr-card-actions">
                      {canEdit ? (
                        <button className="vr-action-btn" onClick={() => handleEdit(v)} title="Edit this voucher">
                          <Pencil size={13} /> Edit
                        </button>
                      ) : (
                        <span className="vr-action-locked" title="Auto-generated (Day Close) vouchers can't be edited">
                          Auto — locked
                        </span>
                      )}
                      <button className="vr-action-btn vr-action-btn--print" onClick={() => handlePrintOne(v.id)} title="Print this voucher">
                        <Printer size={13} /> Print
                      </button>
                    </div>
                    <div ref={(el) => cardRefs.current.set(v.id, el)}>
                      <VoucherCard
                        v={v}
                        isExpense={isExpense}
                        entityType={entityType}
                        pageNum={idx + 1}
                        totalPages={vouchers.length}
                        printBy={printBy}
                      />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
