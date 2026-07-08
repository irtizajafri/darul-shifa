import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './VoucherReprint.scss';

const ACCOUNTS_API  = 'http://localhost:5001/api/accounts';
const INVENTORY_API = 'http://localhost:5001/api/inventory';

// ── Fiscal year helpers ────────────────────────────────────────────────────────
function getFiscalStart(d = new Date()) {
  const m = d.getMonth(); // July = 6
  const y = d.getFullYear();
  return m >= 6 ? new Date(y, 6, 1) : new Date(y - 1, 6, 1);
}

function getFiscalEndYear(d = new Date()) {
  const m = d.getMonth();
  const y = d.getFullYear();
  return m >= 6 ? y + 1 : y;
}

const toDateStr = (d) => d.toISOString().slice(0, 10);
const todayStr  = () => toDateStr(new Date());

// ── Formatters ─────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

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

// ── Group vouchers: fiscal year → month → day ──────────────────────────────────
function fyLabel(m, y) {
  // July(6)+ → FY starts this year: "2026-2027"
  // Jan-Jun  → FY started prev year: "2025-2026"
  const startY = m >= 6 ? y : y - 1;
  return `${startY}-${String(startY + 1).slice(2)}`; // "2026-27"
}

function groupVouchers(vouchers) {
  const years = {};
  for (const v of vouchers) {
    const d      = new Date(v.voucherDate);
    const m      = d.getMonth();
    const y      = d.getFullYear();
    const fyKey  = m >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    const fyLbl  = fyLabel(m, y);
    const mk     = `${y}-${String(m + 1).padStart(2, '0')}`;
    const mLabel = d.toLocaleString('en-US', { month: 'long' }) + ', ' + y;
    const dk     = toDateStr(d);
    const dLabel = fmtDate(v.voucherDate);
    const amt    = Number(v.totalAmount);

    if (!years[fyKey]) years[fyKey] = { label: fyLbl, total: 0, months: {} };
    years[fyKey].total += amt;

    if (!years[fyKey].months[mk]) years[fyKey].months[mk] = { label: mLabel, total: 0, days: {} };
    years[fyKey].months[mk].total += amt;

    if (!years[fyKey].months[mk].days[dk]) years[fyKey].months[mk].days[dk] = { label: dLabel, total: 0, vouchers: [] };
    years[fyKey].months[mk].days[dk].total += amt;
    years[fyKey].months[mk].days[dk].vouchers.push(v);
  }
  return years;
}

// ── Print CSS ──────────────────────────────────────────────────────────────────
const SUMMARY_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:10px; color:#000; background:#fff; }
  .vs-page { padding:16px 22px; }

  .vs-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2px; }
  .vs-entity { font-size:13px; font-weight:900; }
  .vs-page-no { font-size:10px; color:#555; }

  .vs-sub { display:flex; justify-content:space-between; align-items:center;
            border-bottom:2px solid #000; padding-bottom:5px; margin-bottom:0; }
  .vs-report-title { font-size:15px; font-weight:900; text-transform:uppercase; letter-spacing:0.04em; }
  .vs-print-info { display:flex; gap:18px; font-size:9.5px; }
  .vs-print-by   { font-weight:700; }

  table.vs-main { width:100%; border-collapse:collapse; }
  table.vs-main th { padding:4px 7px; font-size:10px; font-weight:700; text-align:left;
                     background:#e0e0e0; border-top:2px solid #000; border-bottom:2px solid #000; }
  table.vs-main td { padding:3px 7px; font-size:10px; text-align:left; }
  .vs-td-r { text-align:right !important; }

  /* Year row */
  .vs-year-row td { font-size:11px; font-weight:900; padding:5px 7px;
                    border-top:1.5px solid #000; border-bottom:1.5px solid #000;
                    vertical-align:middle; }

  /* Month row */
  .vs-month-row td { font-size:10.5px; font-weight:700; padding:4px 7px;
                     border-top:1px solid #bbb; border-bottom:1px solid #bbb;
                     vertical-align:middle; }

  /* Day row */
  .vs-day-row td { font-size:10px; font-weight:700; padding:3px 7px;
                   border-bottom:1px solid #ddd; vertical-align:middle; }

  /* Voucher summary row */
  .vs-voucher-row td { padding:3px 7px 1px 10px; font-size:10px; }

  /* Entries sub-table wrapper */
  .vs-entry-wrap td { padding:1px 0 7px 20px; }
  table.vs-entry { width:100%; border-collapse:collapse; }
  table.vs-entry th { padding:3px 5px; font-size:9px; font-weight:700; text-align:left;
                      background:#ececec; border-top:1.5px solid #000; border-bottom:1.5px solid #000; }
  table.vs-entry td { padding:4px 5px; font-size:9px; text-align:left; border-bottom:1px solid #ccc; }
  table.vs-entry tr:last-child td { border-bottom:1.5px solid #000; }
  .vs-cell-top { font-size:9px; font-weight:700; }
  .vs-cell-sub { font-size:8.5px; color:#555; margin-top:1px; }
`;

// ── Build print HTML ────────────────────────────────────────────────────────────
function printVoucherSummary({ vouchers, entityType, printBy }) {
  const grouped     = groupVouchers(vouchers);
  const fyStart     = getFiscalStart();
  const fyMonthName = fyStart.toLocaleString('en-US', { month: 'long' });
  const fyYear      = fyStart.getFullYear();
  const entityLabel = entityType === 'corporate' ? 'CORPORATE' : 'HOSPITAL';
  const now         = new Date();
  const printDate   = now.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const printTime   = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  const bodyHTML = Object.keys(grouped).sort().map((fy) => {
    const fyData = grouped[fy];

    const monthsHTML = Object.keys(fyData.months).sort().map((mk) => {
      const mData = fyData.months[mk];

      const daysHTML = Object.keys(mData.days).sort().map((dk) => {
        const dData = mData.days[dk];

        const vouchersHTML = dData.vouchers.map((v) => {
          const entriesHTML = v.entries.map((e) => `
            <tr>
              <td>
                <div class="vs-cell-top">${e.mainGlName || '—'}</div>
                <div class="vs-cell-sub">${e.subGlName || ''}</div>
              </td>
              <td>
                <div class="vs-cell-top">${e.mainAccountName || '—'}</div>
                <div class="vs-cell-sub">${e.subAccountName || ''}</div>
              </td>
              <td>${e.payeeName || '—'}</td>
              <td>${e.particulars || '—'}</td>
              <td>${e.chequeNo || '—'}</td>
              <td>${e.chequeDate ? fmtDate(e.chequeDate) : '—'}</td>
              <td class="vs-td-r">${fmt2(e.amount)}</td>
            </tr>
          `).join('');

          return `
            <tr class="vs-voucher-row">
              <td>${v.voucherNo}</td>
              <td>${fmtDate(v.voucherDate)}</td>
              <td class="vs-td-r">${fmt2(v.totalAmount)}</td>
            </tr>
            <tr class="vs-entry-wrap">
              <td colspan="3">
                <table class="vs-entry">
                  <thead>
                    <tr>
                      <th style="width:18%">GL &amp; 3rd Category</th>
                      <th style="width:18%">In Account of</th>
                      <th style="width:13%">PAYEE</th>
                      <th style="width:28%">Particulars</th>
                      <th style="width:6%">Cheque #</th>
                      <th style="width:10%">CHQ DT</th>
                      <th style="width:7%;text-align:right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>${entriesHTML}</tbody>
                </table>
              </td>
            </tr>
          `;
        }).join('');

        return `
          <tr class="vs-day-row">
            <td colspan="2" style="padding-left:34px">${dData.label}</td>
            <td class="vs-td-r">${fmt2(dData.total)}</td>
          </tr>
          ${vouchersHTML}
        `;
      }).join('');

      return `
        <tr class="vs-month-row">
          <td colspan="2" style="padding-left:18px">${mData.label}</td>
          <td class="vs-td-r">${fmt2(mData.total)}</td>
        </tr>
        ${daysHTML}
      `;
    }).join('');

    return `
      <tr class="vs-year-row">
        <td colspan="2">For the Year of ${fyData.label}</td>
        <td class="vs-td-r">${fmt2(fyData.total)}</td>
      </tr>
      ${monthsHTML}
    `;
  }).join('');

  const grandTotal = vouchers.reduce((s, v) => s + Number(v.totalAmount), 0);

  const html = `
    <div class="vs-page">
      <div class="vs-top">
        <div class="vs-entity">${entityLabel} (Current Period: ${fyMonthName}, ${fyYear})</div>
        <div class="vs-page-no">Page: 1 of 1</div>
      </div>
      <div class="vs-sub">
        <div class="vs-report-title">VOUCHER SUMMARY</div>
        <div class="vs-print-info">
          <span class="vs-print-by">Print By: ${printBy}</span>
          <span class="vs-print-date">Print Date: ${printDate}&nbsp;&nbsp;${printTime}</span>
        </div>
      </div>
      <table class="vs-main">
        <thead>
          <tr>
            <th style="width:25%">Voucher #</th>
            <th style="width:35%">Voucher Date</th>
            <th style="width:40%;text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${bodyHTML}</tbody>
        <tfoot>
          <tr style="border-top:2px solid #000">
            <td colspan="2" style="font-size:9px;font-style:italic;padding:4px 7px">${amountInWords(grandTotal)}</td>
            <td style="text-align:right;font-weight:900;font-size:11px;padding:4px 7px">${fmt2(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  const win = window.open('', '_blank');
  win.document.write(
    `<!DOCTYPE html><html><head><title>Voucher Summary</title><style>${SUMMARY_CSS}</style></head><body>${html}</body></html>`
  );
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.onafterprint = () => win.close();
  }, 400);
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function VoucherSummary() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { user }  = useAuthStore();

  const [filters, setFilters] = useState({
    voucherFrom:   '',
    voucherTo:     '',
    supplierId:    '',
    mainAccountId: '',
    dateFrom:      toDateStr(getFiscalStart()),
    dateTo:        todayStr(),
  });
  const [suppliers, setSuppliers] = useState([]);
  const [mainAccs,  setMainAccs]  = useState([]);
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${INVENTORY_API}/suppliers`).then((r) => r.json()),
      fetch(`${ACCOUNTS_API}/main-account?entityType=${entityType}`).then((r) => r.json()),
    ]).then(([sRes, aRes]) => {
      setSuppliers(sRes.data || []);
      setMainAccs(aRes.data || []);
    }).catch(() => {});
  }, [entityType]);

  const upd = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  const handlePrint = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ entityType });
      if (filters.voucherFrom)   p.set('voucherFrom',   filters.voucherFrom);
      if (filters.voucherTo)     p.set('voucherTo',     filters.voucherTo);
      if (filters.supplierId)    p.set('supplierId',    filters.supplierId);
      if (filters.mainAccountId) p.set('mainAccountId', filters.mainAccountId);
      if (filters.dateFrom)      p.set('dateFrom',      filters.dateFrom);
      if (filters.dateTo)        p.set('dateTo',        filters.dateTo);

      const res  = await fetch(`${ACCOUNTS_API}/voucher-summary?${p}`);
      const json = await res.json();
      const vouchers = json.data || [];

      if (!vouchers.length) {
        alert('No vouchers found for the selected filters.');
        return;
      }

      printVoucherSummary({ vouchers, entityType, printBy: user?.name || 'System' });
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vr-page">
      <div className="vr-breadcrumb">
        <button className="vr-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={13} /> Back
        </button>
        <span className="vr-bc-sep">›</span>
        <span>Reports</span>
        <span className="vr-bc-sep">›</span>
        <span className="vr-bc-active">Voucher Summary</span>
      </div>

      <div className="vr-filter-card">
        <div className="vr-filter-title">Voucher Summary — Filters</div>

        {/* Voucher # range */}
        <div className="vr-filter-row">
          <span className="vr-filter-label">Voucher #</span>
          <div className="vr-filter-fields">
            <div className="vr-range-group">
              <span className="vr-range-tag">From</span>
              <input className="vr-input" placeholder="e.g. VE-20260701-001" value={filters.voucherFrom} onChange={upd('voucherFrom')} />
            </div>
            <div className="vr-range-group">
              <span className="vr-range-tag">To</span>
              <input className="vr-input" placeholder="e.g. VE-20260730-999" value={filters.voucherTo} onChange={upd('voucherTo')} />
            </div>
          </div>
        </div>

        {/* Paid to / Supplier */}
        <div className="vr-filter-row">
          <span className="vr-filter-label">Paid to / Supplier</span>
          <div className="vr-filter-fields">
            <select className="vr-input" value={filters.supplierId} onChange={upd('supplierId')}>
              <option value="">— All Suppliers —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* In Account of */}
        <div className="vr-filter-row">
          <span className="vr-filter-label">In Account of</span>
          <div className="vr-filter-fields">
            <select className="vr-input" value={filters.mainAccountId} onChange={upd('mainAccountId')}>
              <option value="">— All Accounts —</option>
              {mainAccs.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Voucher Date range */}
        <div className="vr-filter-row">
          <span className="vr-filter-label">Voucher Date</span>
          <div className="vr-filter-fields">
            <div className="vr-range-group">
              <span className="vr-range-tag">From</span>
              <input className="vr-input" type="date" value={filters.dateFrom} onChange={upd('dateFrom')} />
            </div>
            <div className="vr-range-group">
              <span className="vr-range-tag">To</span>
              <input className="vr-input" type="date" value={filters.dateTo} onChange={upd('dateTo')} />
            </div>
          </div>
        </div>

        <div className="vr-filter-actions">
          <button className="vr-btn-print" onClick={handlePrint} disabled={loading}>
            <Printer size={14} />
            {loading ? 'Loading…' : 'Print'}
          </button>
        </div>
      </div>
    </div>
  );
}
