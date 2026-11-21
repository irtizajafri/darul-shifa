import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, FileSpreadsheet, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../../config';
import { openPrintWindow } from '../../../utils/printRelay';
import { REPORT_PRINT_BW_CSS } from '../../../components/reports/reportFont';
import './CashFlowStatement.scss';

// Accounts → Reports → Cash In Hand Statement (owner, 2026-11-21). Day-wise:
// Cash Deposited to Bank (Revenue Cash − Total Paid Cash, as on the Cash Flow
// Statement) less what Bank Deposit shows for that day = the cash still in
// hand; Total Cash In Hand adds the days up through the month. Same look as
// the Cash Flow Statement.

const API = `${API_BASE_URL}/api/accounts`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pktToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fmtDay = (iso) => (iso ? `${iso.slice(8, 10)}-${SHORT[Number(iso.slice(5, 7)) - 1]}-${iso.slice(0, 4)}` : '');
// Blank for zero, like the sheet.
const num = (n) => (Number(n) ? Number(n).toLocaleString('en-PK', { maximumFractionDigits: 2 }) : '');
const numAlways = (n) => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const neg = (n) => (Number(n) < 0 ? ' cfs-neg' : '');

const COLS = [
  ['revenueCash', 'Revenue Cash', 'cfs-h-rev', 'cfs-rev'],
  ['paidCash', 'Total Paid Cash', 'cfs-h-paid', 'cfs-paid'],
  ['toBank', 'Cash Deposited to Bank', 'cfs-h-dep', 'cfs-dep'],
  ['deposited', 'Deposited (Bank Deposit)', 'cfs-h-dep', 'cfs-dep'],
];

export default function CashInHandStatement() {
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
      const res = await fetch(`${API}/cash-in-hand-statement?entityType=${entityType}&year=${y}&month=${m}`);
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

  const title = data ? `Cash In Hand Statement - ${MONTHS[data.month - 1]} ${data.year}` : 'Cash In Hand Statement';
  // The running total isn't shown on days that haven't come yet.
  const future = (iso) => iso > today;

  const handlePrint = () => {
    if (!data) return;
    const win = openPrintWindow();
    const content = document.getElementById('cih-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      @page { size: A4 portrait; margin: 8mm; }
      * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif !important; }
      body { margin: 0; font-size: 8pt; color: #000; }
      .cfs-title { font-size: 11pt; font-weight: 700; margin: 0 0 1mm; }
      .cfs-sub { font-size: 7.5pt; margin: 0 0 2mm; }
      table { width: 100%; border-collapse: collapse; }
      th, td { font-size: 8pt !important; padding: 2px 4px; border: 1px solid #777; }
      th { text-align: center; font-weight: 700; }
      td.n { text-align: right; white-space: nowrap; }
      td.d { white-space: nowrap; }
      thead { display: table-header-group; }
      tfoot { display: table-row-group; }
      tr { page-break-inside: avoid; }
      .cfs-total td { font-weight: 700; }
      ${REPORT_PRINT_BW_CSS}
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const handleExcel = () => {
    if (!data) return;
    const head = ['Date', ...COLS.map(([, l]) => l), 'Bank Deposit Date', 'Cash In Hand', 'Total Cash In Hand'];
    const aoa = [[title], [book], head];
    data.days.forEach((d) => aoa.push([
      fmtDay(d.date), ...COLS.map(([k]) => d[k] || 0), d.depositDates.map(fmtDay).join(', '),
      d.inHand || 0, future(d.date) ? '' : d.totalInHand,
    ]));
    aoa.push(['Month Total', ...COLS.map(([k]) => data.total[k] || 0), '', data.total.inHand || 0, '']);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 12 }, ...Array(head.length - 1).fill({ wch: 16 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cash In Hand');
    XLSX.writeFile(wb, `cash_in_hand_${data.year}_${String(data.month).padStart(2, '0')}_${entityType}.xlsx`);
  };

  const years = [];
  for (let y = Number(today.slice(0, 4)) + 1; y >= 2020; y -= 1) years.push(y);

  return (
    <div className="cfs">
      <div className="cfs__bar">
        <button type="button" className="cfs__back" onClick={() => navigate(`/accounts/${entityType}/reports`)}><ArrowLeft size={14} /> Reports</button>
        <div className="cfs__heading">
          <h1>Cash In Hand Statement</h1>
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
        <div className="cfs__sheet" id="cih-printable">
          <p className="cfs-title">{title}</p>
          <p className="cfs-sub">
            {book} · Cash Deposited to Bank = Revenue Cash − Total Paid Cash · Cash In Hand = Cash Deposited to Bank − Deposited (Bank Deposit, by its &quot;Deposit Of&quot; day) · Total Cash In Hand = this month&apos;s days added up
          </p>
          <div className="cfs__scroll">
            <table className="cfs__table">
              <thead>
                <tr>
                  <th className="cfs-h-date">Date</th>
                  {COLS.map(([k, l, h]) => <th key={k} className={h}>{l}</th>)}
                  <th className="cfs-h-dep">Bank Deposit Date</th>
                  <th className="cfs-h-hand">Cash In Hand</th>
                  <th className="cfs-h-hand">Total Cash In Hand</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => (
                  <tr key={d.date}>
                    <td className="d">{fmtDay(d.date)}</td>
                    {COLS.map(([k, , , c]) => <td key={k} className={`n ${c}${neg(d[k])}`}>{num(d[k])}</td>)}
                    <td className="d cfs-dep">{d.depositDates.map(fmtDay).join(', ')}</td>
                    <td className={`n cfs-hand cfs-strong${neg(d.inHand)}`}>{num(d.inHand)}</td>
                    <td className={`n cfs-hand${neg(d.totalInHand)}`}>{future(d.date) ? '' : numAlways(d.totalInHand)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="cfs-total">
                  <td className="d">Month Total</td>
                  {COLS.map(([k]) => <td key={k} className={`n${neg(data.total[k])}`}>{numAlways(data.total[k])}</td>)}
                  <td />
                  <td className={`n${neg(data.total.inHand)}`}>{numAlways(data.total.inHand)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
