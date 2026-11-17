import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, FileSpreadsheet, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../../config';
import { openPrintWindow } from '../../../utils/printRelay';
import { REPORT_PRINT_BW_CSS } from '../../../components/reports/reportFont';
import './CashFlowStatement.scss';

// Accounts → Reports → Cash Flow Statement (owner, 2026-11-17), laid out like
// the hospital's Excel sheet: one row per day — Revenue from the Patients
// List (Cash, JazzCash, Bank Online, CC), then this book's Voucher Expense by
// Main GL split Cash / Online / Cheque, the day's paid totals and the cash
// deposited to the bank for that day.

const API = `${API_BASE_URL}/api/accounts`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MODE_LABEL = { cash: 'Cash', online: 'Online', cheque: 'Cheque' };
const pktToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fmtDay = (iso) => (iso ? `${iso.slice(8, 10)}-${SHORT[Number(iso.slice(5, 7)) - 1]}-${iso.slice(0, 4)}` : '');
// Blank for zero, like the sheet.
const num = (n) => (Number(n) ? Number(n).toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '');
const numAlways = (n) => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });

const REVENUE_COLS = [
  ['cash', 'Revenue Cash'], ['jazzcash', 'Revenue JazzCash'], ['online', 'Revenue Bank Online'],
  ['subtotal', 'Cash + JazzCash + Online'], ['cc', 'CC-Income'], ['total', 'Total Revenue'],
];
const PAID_COLS = [['cash', 'Total Paid Cash'], ['online', 'Total Paid Online'], ['cheque', 'Total Paid Cheque'], ['total', 'Total Payments']];

export default function CashFlowStatement() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const book = entityType === 'corporate' ? 'Panel (Corporate)' : 'Cash GL';
  const today = pktToday();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (y, m) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/cash-flow-statement?entityType=${entityType}&year=${y}&month=${m}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Report did not load');
      setData(j.data);
    } catch (e) {
      toast.error(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => { load(year, month); /* first load only; Show reloads */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const title = data ? `Cash Flow Statement - ${MONTHS[data.month - 1]} ${data.year}` : 'Cash Flow Statement';
  const groups = data?.groups || [];
  const expenseCols = groups.reduce((s, g) => s + g.modes.length, 0);

  const handlePrint = () => {
    if (!data) return;
    const win = openPrintWindow();
    const content = document.getElementById('cfs-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      @page { size: A4 landscape; margin: 6mm; }
      * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif !important; }
      body { margin: 0; font-size: 6.5pt; color: #000; }
      .cfs-title { font-size: 10pt; font-weight: 700; margin: 0 0 1mm; }
      .cfs-sub { font-size: 7pt; margin: 0 0 2mm; }
      table { width: 100%; border-collapse: collapse; table-layout: auto; }
      th, td { font-size: 6.5pt !important; padding: 1px 2px; border: 1px solid #777; }
      th { text-align: center; font-weight: 700; }
      td.n { text-align: right; white-space: nowrap; }
      td.d { white-space: nowrap; }
      td.cfs-center { text-align: center; }
      thead { display: table-header-group; }
      tfoot { display: table-row-group; }
      tr { page-break-inside: avoid; }
      .cfs-total td, .cfs-gtotal td { font-weight: 700; }
      ${REPORT_PRINT_BW_CSS}
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const handleExcel = () => {
    if (!data) return;
    const h1 = ['Date', ...REVENUE_COLS.map(([, l]) => l)];
    const h2 = ['', ...REVENUE_COLS.map(() => '')];
    const merges = [];
    // Date + revenue columns span both header rows
    for (let c = 0; c < h1.length; c += 1) merges.push({ s: { r: 2, c }, e: { r: 3, c } });
    groups.forEach((g) => {
      const start = h1.length;
      g.modes.forEach((md, i) => { h1.push(i === 0 ? g.name : ''); h2.push(MODE_LABEL[md]); });
      if (g.modes.length > 1) merges.push({ s: { r: 2, c: start }, e: { r: 2, c: start + g.modes.length - 1 } });
    });
    const tailStart = h1.length;
    [...PAID_COLS.map(([, l]) => l), 'Cash Deposited to Bank', 'Bank Deposit Date'].forEach((l, i) => {
      h1.push(l); h2.push('');
      merges.push({ s: { r: 2, c: tailStart + i }, e: { r: 3, c: tailStart + i } });
    });
    const line = (label, rev, expOf, paid, dep, depDates) => [
      label, ...REVENUE_COLS.map(([k]) => rev[k] || 0),
      ...groups.flatMap((g) => g.modes.map((md) => expOf(g)[md] || 0)),
      ...PAID_COLS.map(([k]) => paid[k] || 0), dep || 0, depDates,
    ];
    const aoa = [[title], [`${book}`], h1, h2];
    data.days.forEach((d) => aoa.push(line(fmtDay(d.date), d.revenue, (g) => d.expense[g.id] || {}, d.paid, d.deposit.amount, d.deposit.dates.map(fmtDay).join(', '))));
    aoa.push(line('Month Total', data.total.revenue, (g) => data.total.expense[g.id] || {}, data.total.paid, data.total.deposit, ''));
    const gRow = ['Main GL Total', ...REVENUE_COLS.map(() => '')];
    groups.forEach((g) => g.modes.forEach((md, i) => gRow.push(i === 0 ? data.total.groupTotal[g.id] : '')));
    aoa.push(gRow);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = [{ wch: 12 }, ...Array(h1.length - 1).fill({ wch: 12 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cash Flow');
    XLSX.writeFile(wb, `cash_flow_${data.year}_${String(data.month).padStart(2, '0')}_${entityType}.xlsx`);
  };

  const years = [];
  for (let y = Number(today.slice(0, 4)) + 1; y >= 2020; y -= 1) years.push(y);

  return (
    <div className="cfs">
      <div className="cfs__bar">
        <button type="button" className="cfs__back" onClick={() => navigate(`/accounts/${entityType}/reports`)}><ArrowLeft size={14} /> Reports</button>
        <div className="cfs__heading">
          <h1>Cash Flow Statement</h1>
          <span>{book}</span>
        </div>
        <div className="cfs__controls">
          <label>
            <span>Month</span>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <label>
            <span>Year</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button type="button" className="cfs__btn cfs__btn--primary" onClick={() => load(year, month)} disabled={loading}><RefreshCw size={14} /> Show</button>
          <button type="button" className="cfs__btn" onClick={handlePrint} disabled={!data}><Printer size={14} /> Print</button>
          <button type="button" className="cfs__btn" onClick={handleExcel} disabled={!data}><FileSpreadsheet size={14} /> Excel</button>
        </div>
      </div>

      {loading && <p className="cfs__empty">Loading…</p>}
      {!loading && data && (
        <div className="cfs__sheet" id="cfs-printable">
          <p className="cfs-title">{title}</p>
          <p className="cfs-sub">{book} · Revenue from the Patients List (business day 8:00 AM – 7:59 AM) · Payments from posted Voucher Expense</p>
          <div className="cfs__scroll">
            <table className="cfs__table">
              <thead>
                <tr>
                  <th rowSpan={2} className="cfs-h-date">Date</th>
                  {REVENUE_COLS.map(([k, l]) => <th key={k} rowSpan={2} className={`cfs-h-rev${k === 'total' || k === 'subtotal' ? ' cfs-h-strong' : ''}`}>{l}</th>)}
                  {groups.map((g, i) => (
                    <th key={g.id} colSpan={g.modes.length} className={`cfs-h-gl cfs-h-gl--${i % 2 ? 'b' : 'a'}`}>{g.name}</th>
                  ))}
                  {PAID_COLS.map(([k, l]) => <th key={k} rowSpan={2} className="cfs-h-paid">{l}</th>)}
                  <th rowSpan={2} className="cfs-h-dep">Cash Deposited to Bank</th>
                  <th rowSpan={2} className="cfs-h-dep">Bank Deposit Date</th>
                </tr>
                <tr>
                  {groups.map((g, i) => g.modes.map((md) => (
                    <th key={`${g.id}-${md}`} className={`cfs-h-mode cfs-h-gl--${i % 2 ? 'b' : 'a'}`}>{MODE_LABEL[md]}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => (
                  <tr key={d.date}>
                    <td className="d">{fmtDay(d.date)}</td>
                    {REVENUE_COLS.map(([k]) => <td key={k} className={`n cfs-rev${k === 'total' || k === 'subtotal' ? ' cfs-strong' : ''}`}>{num(d.revenue[k])}</td>)}
                    {groups.map((g) => g.modes.map((md) => <td key={`${g.id}-${md}`} className="n">{num(d.expense[g.id]?.[md])}</td>))}
                    {PAID_COLS.map(([k]) => <td key={k} className={`n cfs-paid${k === 'total' ? ' cfs-strong' : ''}`}>{num(d.paid[k])}</td>)}
                    <td className="n cfs-dep">{num(d.deposit.amount)}</td>
                    <td className="d cfs-dep">{d.deposit.dates.map(fmtDay).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="cfs-total">
                  <td className="d">Month Total</td>
                  {REVENUE_COLS.map(([k]) => <td key={k} className="n">{numAlways(data.total.revenue[k])}</td>)}
                  {groups.map((g) => g.modes.map((md) => <td key={`${g.id}-${md}`} className="n">{numAlways(data.total.expense[g.id]?.[md])}</td>))}
                  {PAID_COLS.map(([k]) => <td key={k} className="n">{numAlways(data.total.paid[k])}</td>)}
                  <td className="n">{numAlways(data.total.deposit)}</td>
                  <td />
                </tr>
                {groups.length > 0 && (
                  <tr className="cfs-gtotal">
                    <td className="d">Main GL Total</td>
                    <td colSpan={REVENUE_COLS.length} />
                    {groups.map((g) => (
                      <Fragment key={g.id}>
                        <td colSpan={g.modes.length} className="n cfs-center">{numAlways(data.total.groupTotal[g.id])}</td>
                      </Fragment>
                    ))}
                    <td colSpan={PAID_COLS.length + 2} />
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
          {expenseCols === 0 && <p className="cfs__note">No posted Voucher Expense in this month for {book}.</p>}
        </div>
      )}
    </div>
  );
}
