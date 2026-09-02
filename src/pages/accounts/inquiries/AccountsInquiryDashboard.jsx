import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { RefreshCw, ChevronLeft, ChevronRight, BarChart2, TrendingUp, Activity, ArrowLeft } from 'lucide-react';
import './AccountsInquiryDashboard.scss';

const API = 'http://localhost:5001/api/accounts';

const MN  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MNF = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DN  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat','Total'];

const PERIODS = [
  { value: 'monthly_daily',  label: 'One Month (Daily)' },
  { value: 'yearly_monthly', label: 'One Year (Monthly)' },
  { value: 'multi_year',     label: 'Yearly (Multiple Years)' },
];

// All/Expense/Income is a display filter on data already fetched for the
// period — it swaps which pre-aggregated field (total/expense/income) the
// calendar reads, no extra request needed.
const VOUCHER_TYPES = [
  { value: 'ALL',     label: 'All' },
  { value: 'expense', label: 'Expense' },
  { value: 'income',  label: 'Income' },
];

const fmtN = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtA = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const todayStr = (() => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
})();

// Pick the right count/amount pair off a data row for the selected voucher type.
function pickFields(row, voucherType) {
  if (voucherType === 'expense') return { count: row.cashPatients,  amount: row.cashAmount  };
  if (voucherType === 'income')  return { count: row.panelPatients, amount: row.panelAmount };
  return { count: row.totalPatients, amount: row.totalAmount };
}

const modeLabel = (m) => m === 'cheque' ? 'Cheque' : m === 'online' ? 'Online' : m === 'system' ? 'System' : 'Cash';
const fmtStmtDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-');
  return `${d}-${MN[Number(m) - 1]}-${y}`;
};

// ── Expense voucher card — GL/Account/Payee/Particulars per entry ─────────────
function ExpenseVoucherCard({ v }) {
  return (
    <div className="aid-hist-voucher" key={v.id}>
      <div className="aid-hist-voucher-hdr">
        <span className="aid-hist-vno">{v.voucherNo}</span>
        <span className="aid-hist-vmode">{modeLabel(v.mode)}</span>
        <span className="aid-hist-vamt aid-hist-vamt--exp">{fmtA(v.totalAmount)}</span>
      </div>
      <table className="aid-hist-tbl">
        <thead>
          <tr>
            <th>GL / Account</th>
            <th>Payee</th>
            <th>Particulars</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(v.entries || []).map(e => (
            <tr key={e.id}>
              <td>{e.mainGlName || '—'} / {e.subGlName || '—'}</td>
              <td>{e.payeeName || '—'}</td>
              <td>{e.particulars || '—'}</td>
              <td className="td-num">{fmtA(e.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Income voucher card — Income Category/Particulars per entry ───────────────
function IncomeVoucherCard({ v }) {
  return (
    <div className="aid-hist-voucher" key={v.id}>
      <div className="aid-hist-voucher-hdr">
        <span className="aid-hist-vno">{v.voucherNo}</span>
        {v.source === 'auto' && <span className="aid-hist-vauto">Auto (Day Close)</span>}
        <span className="aid-hist-vmode">{modeLabel(v.mode)}</span>
        <span className="aid-hist-vamt aid-hist-vamt--inc">{fmtA(v.totalAmount)}</span>
      </div>
      <table className="aid-hist-tbl">
        <thead>
          <tr>
            <th>Income Category</th>
            <th>Particulars</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(v.entries || []).map(e => (
            <tr key={e.id}>
              <td>{e.incomeCategoryName || '—'}</td>
              <td>{e.particulars || '—'}</td>
              <td className="td-num">{fmtA(e.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Clinic revenue card — department breakdown for the day (Non-Corporate only) ─
function ClinicRevenueCard({ data }) {
  if (!data || !data.rows.length) return null;
  return (
    <div className="aid-hist-voucher">
      <div className="aid-hist-voucher-hdr">
        <span className="aid-hist-vno">Clinic Patient Revenue</span>
        <span className="aid-hist-vamt aid-hist-vamt--inc">{fmtA(data.total.amount)}</span>
      </div>
      <table className="aid-hist-tbl">
        <thead>
          <tr>
            <th>Department</th>
            <th className="num">Patients</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map(r => (
            <tr key={r.department}>
              <td>{r.department}</td>
              <td className="td-num">{fmtN(r.count)}</td>
              <td className="td-num">{fmtA(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Panel Cheque revenue card — cheques received that day (Corporate only) ────
function PanelChequeRevenueCard({ data }) {
  if (!data || !data.rows.length) return null;
  return (
    <div className="aid-hist-voucher">
      <div className="aid-hist-voucher-hdr">
        <span className="aid-hist-vno">Panel Cheques Received</span>
        <span className="aid-hist-vamt aid-hist-vamt--inc">{fmtA(data.total.amount)}</span>
      </div>
      <table className="aid-hist-tbl">
        <thead>
          <tr>
            <th>Panel Company</th>
            <th>Cheque #</th>
            <th>Billing Month</th>
            <th className="num">Admissions</th>
            <th className="num">Deduction</th>
            <th className="num">Received</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map(r => (
            <tr key={r.id}>
              <td>{r.companyName}</td>
              <td>{r.chequeNo}</td>
              <td>{MN[r.billingMonth - 1]} {r.billingYear}</td>
              <td className="td-num">{fmtN(r.admissionsCount)}</td>
              <td className="td-num">{fmtA(r.deduction)}</td>
              <td className="td-num">{fmtA(r.receivedAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Voucher History Modal (double-click a calendar day) ────────────────────────
// Income = Clinic patient revenue (Non-Corporate) / Panel Cheques received
// (Corporate) + Voucher Income entries. Expense = Voucher Expense entries.
function VoucherHistoryModal({ date, entityType, onClose }) {
  const [expenseVouchers, setExpenseVouchers] = useState([]);
  const [incomeVouchers, setIncomeVouchers] = useState([]);
  const [clinicRevenue, setClinicRevenue] = useState(null);
  const [chequeRevenue, setChequeRevenue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = { entityType: entityType || 'non-corporate', dateFrom: date, dateTo: date };
    const qExp = new URLSearchParams({ type: 'expense', ...base });
    const qInc = new URLSearchParams({ type: 'income',  ...base });
    const isNonCorporate = (entityType || 'non-corporate') === 'non-corporate';
    const isCorporate = entityType === 'corporate';
    Promise.all([
      fetch(`${API}/voucher-reprint?${qExp}`).then(r => r.json()),
      fetch(`${API}/voucher-reprint?${qInc}`).then(r => r.json()),
      isNonCorporate ? fetch(`${API}/inquiry/clinic-revenue?date=${date}`).then(r => r.json()) : Promise.resolve(null),
      isCorporate ? fetch(`${API}/inquiry/panel-cheque-revenue?date=${date}`).then(r => r.json()) : Promise.resolve(null),
    ])
      .then(([expJson, incJson, clinicJson, chequeJson]) => {
        setExpenseVouchers(expJson.data || []);
        setIncomeVouchers(incJson.data || []);
        setClinicRevenue(clinicJson?.data || null);
        setChequeRevenue(chequeJson?.data || null);
      })
      .catch(() => { setExpenseVouchers([]); setIncomeVouchers([]); setClinicRevenue(null); setChequeRevenue(null); })
      .finally(() => setLoading(false));
  }, [date, entityType]);

  const expenseTotal = expenseVouchers.reduce((s, v) => s + Number(v.totalAmount || 0), 0);
  const voucherIncomeTotal = incomeVouchers.reduce((s, v) => s + Number(v.totalAmount || 0), 0);
  const clinicTotal = clinicRevenue?.total?.amount || 0;
  const chequeTotal = chequeRevenue?.total?.amount || 0;
  const incomeTotal = voucherIncomeTotal + clinicTotal + chequeTotal;
  const hasClinic = Boolean(clinicRevenue?.rows?.length);
  const hasCheques = Boolean(chequeRevenue?.rows?.length);
  const isEmpty = !loading && expenseVouchers.length === 0 && incomeVouchers.length === 0 && !hasClinic && !hasCheques;

  return (
    <div className="aid-hist-overlay" onClick={onClose}>
      <div className="aid-hist-modal" onClick={e => e.stopPropagation()}>
        <div className="aid-hist-hdr">
          <span>Voucher History — {fmtStmtDate(date)}</span>
          <button className="aid-hist-close" onClick={onClose}>✕</button>
        </div>
        <div className="aid-hist-body">
          {loading && <div className="aid-hist-loading">Loading…</div>}
          {isEmpty && <div className="aid-hist-empty">Is date ke liye koi voucher ya revenue nahi mila.</div>}

          {!loading && (hasClinic || hasCheques || incomeVouchers.length > 0) && (
            <>
              <div className="aid-hist-section-lbl aid-hist-section-lbl--inc">Income</div>
              {hasClinic && <ClinicRevenueCard data={clinicRevenue} />}
              {hasCheques && <PanelChequeRevenueCard data={chequeRevenue} />}
              {incomeVouchers.map(v => <IncomeVoucherCard v={v} key={v.id} />)}
            </>
          )}

          {!loading && expenseVouchers.length > 0 && (
            <>
              <div className="aid-hist-section-lbl aid-hist-section-lbl--exp">Expense Vouchers</div>
              {expenseVouchers.map(v => <ExpenseVoucherCard v={v} key={v.id} />)}
            </>
          )}
        </div>
        {!isEmpty && !loading && (
          <div className="aid-hist-net">
            <span>Income {hasClinic ? '(incl. Clinic revenue)' : hasCheques ? '(incl. Panel Cheques)' : ''}: {incomeVouchers.length + (hasClinic ? 1 : 0) + (hasCheques ? 1 : 0)} entries</span>
            <span className="aid-hist-net-inc">{fmtA(incomeTotal)}</span>
          </div>
        )}
        {!isEmpty && !loading && (
          <div className="aid-hist-net">
            <span>Expense: {expenseVouchers.length} vouchers</span>
            <span className="aid-hist-net-exp">{fmtA(expenseTotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AccountsInquiryDashboard() {
  const now = new Date();
  const { entityType } = useParams();
  const navigate = useNavigate();
  const entityLabel = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';

  const [period,      setPeriod]      = useState('monthly_daily');
  const [year,        setYear]        = useState(now.getFullYear());
  const [month,       setMonth]       = useState(now.getMonth() + 1);
  const [voucherType, setVoucherType] = useState('ALL');
  const [chartType,   setChartType]   = useState('bar');

  const [dashData, setDashData] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [lastRun,  setLastRun]  = useState(null);

  const [historyDate, setHistoryDate] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ entityType: entityType || 'non-corporate', period, year, month });
      const res  = await fetch(`${API}/inquiry/dashboard?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed');
      setDashData(json.data);
      setLastRun(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [entityType, period, year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmtLastRun = lastRun
    ? `${String(lastRun.getDate()).padStart(2,'0')} ${MN[lastRun.getMonth()]} ${String(lastRun.getHours()).padStart(2,'0')}:${String(lastRun.getMinutes()).padStart(2,'0')} ${lastRun.getHours()>=12?'PM':'AM'}`
    : '—';

  const prevPeriod = () => {
    if (period === 'monthly_daily') {
      if (month === 1) { setMonth(12); setYear(y => y-1); }
      else setMonth(m => m-1);
    } else if (period === 'yearly_monthly') {
      setYear(y => y-1);
    }
  };
  const nextPeriod = () => {
    if (period === 'monthly_daily') {
      if (month === 12) { setMonth(1); setYear(y => y+1); }
      else setMonth(m => m+1);
    } else if (period === 'yearly_monthly') {
      setYear(y => y+1);
    }
  };

  const summary   = dashData?.summary   || {};
  const trendData = dashData?.trendData || [];
  const rawData   = dashData?.data      || [];

  // ── Calendar (monthly_daily) ──────────────────────────────────────────────
  const renderCalendar = () => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay    = new Date(year, month-1, 1).getDay();

    const cellData = rawData.map(d => ({ date: d.date, ...pickFields(d, voucherType), expenseCount: d.cashPatients, expenseAmount: d.cashAmount, incomeCount: d.panelPatients, incomeAmount: d.panelAmount }));
    const withAmt = cellData.filter(d => d.amount > 0);
    const minAmt  = withAmt.length > 1 ? Math.min(...withAmt.map(d => d.amount)) : -1;
    const maxAmt  = withAmt.length > 1 ? Math.max(...withAmt.map(d => d.amount)) : -1;

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dd = cellData.find(x => x.date === ds) || { count:0, amount:0, expenseCount:0, expenseAmount:0, incomeCount:0, incomeAmount:0 };
      cells.push({ day: d, dateStr: ds, ...dd });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      const wTotal = week.reduce((acc, c) => {
        if (!c) return acc;
        return {
          count: acc.count + (c.count || 0),
          amount: acc.amount + (c.amount || 0),
          incomeAmount: acc.incomeAmount + (c.incomeAmount || 0),
          expenseAmount: acc.expenseAmount + (c.expenseAmount || 0),
        };
      }, { count: 0, amount: 0, incomeAmount: 0, expenseAmount: 0 });
      weeks.push({ days: week, total: wTotal });
    }

    const colTotals = Array.from({ length: 7 }, () => ({ count:0, amount:0, incomeAmount:0, expenseAmount:0 }));
    for (const { days } of weeks) {
      days.forEach((cell, di) => {
        if (!cell) return;
        colTotals[di].count += cell.count || 0;
        colTotals[di].amount += cell.amount || 0;
        colTotals[di].incomeAmount += cell.incomeAmount || 0;
        colTotals[di].expenseAmount += cell.expenseAmount || 0;
      });
    }
    const grandColTotal = colTotals.reduce((acc, c) => ({
      count: acc.count + c.count, amount: acc.amount + c.amount,
      incomeAmount: acc.incomeAmount + c.incomeAmount, expenseAmount: acc.expenseAmount + c.expenseAmount,
    }), { count:0, amount:0, incomeAmount:0, expenseAmount:0 });

    const cellClass = (cell) => {
      if (!cell) return 'aid-cell aid-cell--blank';
      if (cell.amount === 0) return 'aid-cell aid-cell--zero';
      if (cell.dateStr === todayStr) return 'aid-cell aid-cell--today';
      if (maxAmt > 0 && cell.amount === maxAmt) return 'aid-cell aid-cell--max';
      if (minAmt > 0 && cell.amount === minAmt) return 'aid-cell aid-cell--min';
      return 'aid-cell';
    };

    return (
      <div className="aid-calendar">
        <div className="aid-cal-nav">
          <button className="aid-nav-btn" onClick={prevPeriod}><ChevronLeft size={16}/></button>
          <span className="aid-cal-title">{MNF[month-1]} {year}</span>
          <button className="aid-nav-btn" onClick={nextPeriod}><ChevronRight size={16}/></button>
        </div>
        <div className="aid-cal-grid">
          <div className="aid-cal-hdr-row">
            {DN.map(d => (
              <div key={d} className={`aid-cal-hdr ${d === 'Total' ? 'aid-cal-hdr--total' : ''}`}>{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="aid-week-row">
              {week.days.map((cell, di) => (
                <div
                  key={di}
                  className={`${cellClass(cell)}${cell ? ' aid-cell--clickable' : ''}`}
                  onDoubleClick={() => cell && setHistoryDate(cell.dateStr)}
                  title={cell ? 'Double-click for Voucher history' : undefined}
                >
                  {cell && (
                    <>
                      <div className="aid-cell-day">{cell.day}</div>
                      {(cell.incomeAmount > 0 || cell.expenseAmount > 0) && (
                        <div className="aid-cell-fin">
                          <div className="aid-cell-inc">In {fmtN(cell.incomeAmount)}</div>
                          <div className="aid-cell-exp">Exp {fmtN(cell.expenseAmount)}</div>
                          <div className={`aid-cell-diff ${(cell.incomeAmount - cell.expenseAmount) >= 0 ? 'aid-cell-diff--profit' : 'aid-cell-diff--loss'}`}>
                            {(cell.incomeAmount - cell.expenseAmount) >= 0 ? '+' : ''}{fmtN(cell.incomeAmount - cell.expenseAmount)}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
              <div className={`aid-cell aid-cell--week-total ${(week.total.incomeAmount + week.total.expenseAmount) === 0 ? 'aid-cell--zero' : ''}`}>
                {(week.total.incomeAmount > 0 || week.total.expenseAmount > 0) && (
                  <>
                    <div className="aid-cell-wk-label">Wk Total</div>
                    <div className="aid-cell-fin">
                      <div className="aid-cell-inc">In {fmtN(week.total.incomeAmount)}</div>
                      <div className="aid-cell-exp">Exp {fmtN(week.total.expenseAmount)}</div>
                      <div className={`aid-cell-diff ${(week.total.incomeAmount - week.total.expenseAmount) >= 0 ? 'aid-cell-diff--profit' : 'aid-cell-diff--loss'}`}>
                        {(week.total.incomeAmount - week.total.expenseAmount) >= 0 ? '+' : ''}{fmtN(week.total.incomeAmount - week.total.expenseAmount)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="aid-week-row aid-col-total-row">
            {colTotals.map((ct, di) => (
              <div key={di} className="aid-cell aid-cell--col-total">
                <div className="aid-cell-wk-label">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][di]}</div>
                <div className="aid-cell-fin">
                  <div className="aid-cell-inc">In {fmtN(ct.incomeAmount)}</div>
                  <div className="aid-cell-exp">Exp {fmtN(ct.expenseAmount)}</div>
                  <div className={`aid-cell-diff ${(ct.incomeAmount - ct.expenseAmount) >= 0 ? 'aid-cell-diff--profit' : 'aid-cell-diff--loss'}`}>
                    {(ct.incomeAmount - ct.expenseAmount) >= 0 ? '+' : ''}{fmtN(ct.incomeAmount - ct.expenseAmount)}
                  </div>
                </div>
              </div>
            ))}
            <div className="aid-cell aid-cell--grand-corner">
              <div className="aid-cell-wk-label">Grand</div>
              <div className="aid-cell-fin">
                <div className="aid-cell-inc">In {fmtN(grandColTotal.incomeAmount)}</div>
                <div className="aid-cell-exp">Exp {fmtN(grandColTotal.expenseAmount)}</div>
                <div className={`aid-cell-diff ${(grandColTotal.incomeAmount - grandColTotal.expenseAmount) >= 0 ? 'aid-cell-diff--profit' : 'aid-cell-diff--loss'}`}>
                  {(grandColTotal.incomeAmount - grandColTotal.expenseAmount) >= 0 ? '+' : ''}{fmtN(grandColTotal.incomeAmount - grandColTotal.expenseAmount)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="aid-cal-legend">
          <span className="aid-leg aid-leg--today">Today</span>
          <span className="aid-leg aid-leg--max">Highest</span>
          <span className="aid-leg aid-leg--min">Lowest</span>
          <span className="aid-leg aid-leg--panel">Income</span>
          <span className="aid-leg aid-leg--cash">Expense</span>
        </div>
      </div>
    );
  };

  // ── Yearly Monthly Grid ───────────────────────────────────────────────────
  const renderYearlyMonthly = () => {
    const cellData = rawData.map(d => ({ month: d.month, ...pickFields(d, voucherType), expenseCount: d.cashPatients, incomeCount: d.panelPatients }));
    const withAmt = cellData.filter(d => d.amount > 0);
    const maxAmt  = withAmt.length > 0 ? Math.max(...withAmt.map(d => d.amount)) : 1;

    return (
      <div className="aid-yearly">
        <div className="aid-cal-nav">
          <button className="aid-nav-btn" onClick={prevPeriod}><ChevronLeft size={16}/></button>
          <span className="aid-cal-title">{year}</span>
          <button className="aid-nav-btn" onClick={nextPeriod}><ChevronRight size={16}/></button>
        </div>
        <div className="aid-month-grid">
          {cellData.map(d => (
            <div key={d.month} className={`aid-month-card ${d.amount === maxAmt && maxAmt > 0 ? 'aid-month-card--max' : ''} ${d.count === 0 ? 'aid-month-card--zero' : ''}`}>
              <div className="aid-mc-name">{MN[d.month-1]}</div>
              <div className="aid-mc-patients">{fmtN(d.count)}</div>
              <div className="aid-mc-amount">{fmtN(d.amount)}</div>
              <div className="aid-mc-bar-wrap">
                <div className="aid-mc-bar" style={{ width: `${maxAmt > 0 ? (d.amount/maxAmt)*100 : 0}%` }}/>
              </div>
              <div className="aid-mc-sub">
                {d.incomeCount > 0 && <span className="aid-badge aid-badge--panel">{d.incomeCount}In</span>}
                {d.expenseCount > 0 && <span className="aid-badge aid-badge--cash">{d.expenseCount}Exp</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Multi Year ────────────────────────────────────────────────────────────
  const renderMultiYear = () => {
    const cellData = rawData.map(d => ({ year: d.year, ...pickFields(d, voucherType) }));
    const withAmt = cellData.filter(d => d.amount > 0);
    const maxAmt  = withAmt.length > 0 ? Math.max(...withAmt.map(d => d.amount)) : 1;

    return (
      <div className="aid-multiyear">
        <div className="aid-cal-nav">
          <span className="aid-cal-title">All Years</span>
        </div>
        <div className="aid-year-list">
          {cellData.map(d => (
            <div key={d.year} className="aid-year-row">
              <div className="aid-yr-label">{d.year}</div>
              <div className="aid-yr-bar-wrap">
                <div className="aid-yr-bar" style={{ width: `${maxAmt > 0 ? (d.amount/maxAmt)*100 : 0}%` }}/>
              </div>
              <div className="aid-yr-patients">{fmtN(d.count)} vch</div>
              <div className="aid-yr-amount">{fmtA(d.amount)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMain = () => {
    if (loading) return <div className="aid-loading"><RefreshCw size={20} className="aid-spin"/><span>Loading…</span></div>;
    if (period === 'monthly_daily') return renderCalendar();
    if (period === 'yearly_monthly') return renderYearlyMonthly();
    if (period === 'multi_year') return renderMultiYear();
    return null;
  };

  const ChartComp = chartType === 'line' ? LineChart : chartType === 'area' ? AreaChart : BarChart;
  const DataComp  = chartType === 'line' ? Line       : chartType === 'area' ? Area      : Bar;
  const dataProps = chartType === 'bar'
    ? { fill: '#1a3c6e', radius: [2,2,0,0] }
    : chartType === 'line'
    ? { stroke: '#1a3c6e', strokeWidth: 2, dot: { r:2 } }
    : { stroke: '#1a3c6e', fill: '#c8d8f0', strokeWidth: 2 };

  return (
    <div className="aid-page">
      <div className="aid-topbar">
        <button className="aid-back-btn" onClick={() => navigate(-1)}><ArrowLeft size={15}/> Back</button>
        <span className="aid-topbar-title">Accounts Inquiry — {entityLabel}</span>
      </div>

      <div className="aid-body">
        {/* ─── Left Sidebar ─── */}
        <div className="aid-sidebar">

          <div className="aid-filter-group">
            <label className="aid-flabel">Period Selection</label>
            <select className="aid-select" value={period} onChange={e => { setPeriod(e.target.value); }}>
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <button className="aid-last-run" onClick={fetchData} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'aid-spin' : ''}/>
            Last Run {fmtLastRun}
          </button>

          <div className="aid-radio-grid">
            {VOUCHER_TYPES.map(vt => (
              <label key={vt.value} className={`aid-radio-item ${voucherType === vt.value ? 'aid-radio-item--active' : ''}`}>
                <input type="radio" name="voucherType" value={vt.value} checked={voucherType === vt.value} onChange={() => setVoucherType(vt.value)}/>
                {vt.label}
              </label>
            ))}
          </div>

          <div className="aid-chart-header">
            <span className="aid-chart-title">Amount Trend</span>
            <div className="aid-ct-toggle">
              <button className={`aid-ct-btn ${chartType==='bar'?'--on':''}`} onClick={()=>setChartType('bar')}><BarChart2 size={11}/></button>
              <button className={`aid-ct-btn ${chartType==='line'?'--on':''}`} onClick={()=>setChartType('line')}><TrendingUp size={11}/></button>
              <button className={`aid-ct-btn ${chartType==='area'?'--on':''}`} onClick={()=>setChartType('area')}><Activity size={11}/></button>
            </div>
          </div>

          <div className="aid-chart-wrap">
            <ResponsiveContainer width="100%" height={150}>
              <ChartComp data={trendData} margin={{ top:4, right:4, bottom:28, left:4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="label" tick={{ fontSize:8 }} angle={-40} textAnchor="end" interval={0}/>
                <YAxis tick={{ fontSize:8 }} width={34}/>
                <Tooltip formatter={v => fmtA(v)} labelStyle={{ fontSize:9 }} itemStyle={{ fontSize:9 }}/>
                <DataComp dataKey="totalAmount" {...dataProps}/>
              </ChartComp>
            </ResponsiveContainer>
          </div>

          <div className="aid-prognosis-box">
            <div className="aid-prog-row"><span>Prognosis:</span><strong>{fmtA(summary.prognosis)}</strong></div>
            <div className="aid-prog-row"><span>{MN[(dashData?.month||month)-1]}, {(dashData?.year||year)-1}:</span><strong>{fmtA(summary.lastYearAmount)}</strong></div>
          </div>
        </div>

        {/* ─── Main Content ─── */}
        <div className="aid-main">
          {renderMain()}

          {/* Summary Bar */}
          <div className="aid-summary">
            <div className="aid-sum-left">
              <div className="aid-sum-item">
                <div className="aid-sum-lbl">Daily Avg.</div>
                <div className="aid-sum-val">{fmtA(summary.dailyAvg)}</div>
              </div>
              <div className="aid-sum-sep"/>
              <div className="aid-sum-item">
                <div className="aid-sum-lbl">Prognosis</div>
                <div className="aid-sum-val">{fmtA(summary.prognosis)}</div>
              </div>
              <div className="aid-sum-sep"/>
              <div className="aid-sum-item">
                <div className="aid-sum-lbl">{MN[(dashData?.month||month)-1]}, {(dashData?.year||year)-1}</div>
                <div className="aid-sum-val">{fmtA(summary.lastYearAmount)}</div>
              </div>
            </div>
            <div className="aid-sum-right">
              <div className="aid-sum-big">
                <span className="aid-sum-icon">👥</span>
                <div>
                  <div className="aid-sum-lbl">Total Patients:</div>
                  <div className="aid-sum-big-val aid-sum-big-val--p">{fmtN(summary.totalPatients)}</div>
                </div>
              </div>
              <div className="aid-sum-big">
                <span className="aid-sum-icon">💰</span>
                <div>
                  <div className="aid-sum-lbl">Income Amount:</div>
                  <div className="aid-sum-big-val aid-sum-big-val--inc">{fmtA(summary.incomeAmount)}</div>
                </div>
              </div>
              <div className="aid-sum-big">
                <span className="aid-sum-icon">💸</span>
                <div>
                  <div className="aid-sum-lbl">Expense Amount:</div>
                  <div className="aid-sum-big-val aid-sum-big-val--exp">{fmtA(summary.expenseAmount)}</div>
                </div>
              </div>
              <div className="aid-sum-big">
                <span className="aid-sum-icon">{Number(summary.netAmount) >= 0 ? '📈' : '📉'}</span>
                <div>
                  <div className="aid-sum-lbl">Difference:</div>
                  <div className={`aid-sum-big-val ${Number(summary.netAmount) >= 0 ? 'aid-sum-big-val--profit' : 'aid-sum-big-val--loss'}`}>
                    {Number(summary.netAmount) >= 0 ? '+' : '-'}{fmtA(Math.abs(summary.netAmount || 0))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {historyDate && (
        <VoucherHistoryModal date={historyDate} entityType={entityType} onClose={() => setHistoryDate(null)} />
      )}
    </div>
  );
}
