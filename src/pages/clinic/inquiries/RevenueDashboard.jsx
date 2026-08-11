import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { RefreshCw, ChevronLeft, ChevronRight, BarChart2, TrendingUp, Activity } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './RevenueDashboard.scss';

const API = 'http://localhost:5001/api/clinic';

const MN  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MNF = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DN  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat','Total'];

const PERIODS = [
  { value: 'monthly_daily',  label: 'One Month (Daily)' },
  { value: 'yearly_monthly', label: 'One Year (Monthly)' },
  { value: 'yearly_daily',   label: 'One Year (Daily & Monthly)' },
  { value: 'multi_year',     label: 'Yearly (Multiple Years)' },
];

const PAY_TYPES = [
  { value: 'ALL',           label: 'All' },
  { value: 'Staff',         label: 'Staff' },
  { value: 'Panel',         label: 'Panel' },
  { value: 'Complementary', label: 'Complementary' },
  { value: 'Cash',          label: 'Cash' },
  { value: 'C Card',        label: 'CC' },
  { value: 'JazzCash',      label: 'JazzCash' },
  { value: 'Discount',      label: 'Discount' },
];

const fmtN = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtA = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const todayStr = (() => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
})();

const fmtStmtDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-');
  return `${d}-${MN[Number(m) - 1]}-${y}`;
};

// ── Daily Department Statement Modal (double-click a calendar day) ────────────
// Same underlying data as the "Department wise Patients" report — just this
// one day, grouped by department, so the numbers reconcile with the cell.
function DailyStatementModal({ date, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/inquiries/daily-department-statement?date=${date}`)
      .then(r => r.json())
      .then(json => setData(json.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <div className="rd-stmt-overlay" onClick={onClose}>
      <div className="rd-stmt-modal" onClick={e => e.stopPropagation()}>
        <div className="rd-stmt-hdr">
          <span>Statement for the Date of {fmtStmtDate(date)}</span>
          <button className="rd-stmt-close" onClick={onClose}>✕</button>
        </div>
        <div className="rd-stmt-body">
          {loading && <div className="rd-stmt-loading">Loading…</div>}
          {!loading && (!data || data.rows.length === 0) && (
            <div className="rd-stmt-empty">Is date ke liye koi data nahi mila.</div>
          )}
          {!loading && data && data.rows.length > 0 && (
            <table className="rd-stmt-tbl">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="num"># of Patients</th>
                  <th className="num">Amount</th>
                  <th className="num">Discount</th>
                  <th className="num">Cancel</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => (
                  <tr key={r.department}>
                    <td>{r.department.toUpperCase()}</td>
                    <td className="td-num">{fmtN(r.count)}</td>
                    <td className="td-num">{fmtA(r.amount)}</td>
                    <td className="td-num">{fmtA(r.discount)}</td>
                    <td className="td-num">{fmtN(r.cancel)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="rd-stmt-total-row">
                  <td>TOTAL</td>
                  <td className="td-num">{fmtN(data.total.count)}</td>
                  <td className="td-num">{fmtA(data.total.amount)}</td>
                  <td className="td-num">{fmtA(data.total.discount)}</td>
                  <td className="td-num">{fmtN(data.total.cancel)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
        {!loading && data && data.rows.length > 0 && (
          <div className="rd-stmt-net">
            <span>Net Received</span>
            <span>{fmtA(data.netReceived)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RevenueDashboard() {
  const now = new Date();
  const { user } = useAuthStore();

  const [period,     setPeriod]     = useState('monthly_daily');
  const [year,       setYear]       = useState(now.getFullYear());
  const [month,      setMonth]      = useState(now.getMonth() + 1);
  const [dept,       setDept]       = useState('ALL');
  const [subDept,    setSubDept]    = useState('ALL');
  const [consultant, setConsultant] = useState('ALL');
  const [payType,    setPayType]    = useState('ALL');
  const [chartType,  setChartType]  = useState('bar');

  const [departments,  setDepartments]  = useState([]);
  const [subDepts,     setSubDepts]     = useState([]);
  const [consultants,  setConsultants]  = useState([]);

  const [dashData, setDashData] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [lastRun,  setLastRun]  = useState(null);

  const [statementDate, setStatementDate] = useState(null);

  // Load dropdowns on mount
  useEffect(() => {
    fetch(`${API}/departments`).then(r=>r.json()).then(j=>setDepartments(j.data||[])).catch(()=>{});
    fetch(`${API}/sub-departments`).then(r=>r.json()).then(j=>setSubDepts(j.data||[])).catch(()=>{});
    fetch(`${API}/doctors?minimal=true`).then(r=>r.json()).then(j=>setConsultants(j.data||[])).catch(()=>{});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ period, year, month, department: dept, subDept, consultant, paymentType: payType });
      const res  = await fetch(`${API}/inquiries/revenue-dashboard?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed');
      setDashData(json.data);
      setLastRun(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period, year, month, dept, subDept, consultant, payType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmtLastRun = lastRun
    ? `${String(lastRun.getDate()).padStart(2,'0')} ${MN[lastRun.getMonth()]} ${String(lastRun.getHours()).padStart(2,'0')}:${String(lastRun.getMinutes()).padStart(2,'0')} ${lastRun.getHours()>=12?'PM':'AM'}`
    : '—';

  const prevPeriod = () => {
    if (period === 'monthly_daily') {
      if (month === 1) { setMonth(12); setYear(y => y-1); }
      else setMonth(m => m-1);
    } else if (period === 'yearly_monthly' || period === 'yearly_daily') {
      setYear(y => y-1);
    }
  };
  const nextPeriod = () => {
    if (period === 'monthly_daily') {
      if (month === 12) { setMonth(1); setYear(y => y+1); }
      else setMonth(m => m+1);
    } else if (period === 'yearly_monthly' || period === 'yearly_daily') {
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

    const withAmt = rawData.filter(d => d.totalAmount > 0);
    const minAmt  = withAmt.length > 1 ? Math.min(...withAmt.map(d => d.totalAmount)) : -1;
    const maxAmt  = withAmt.length > 1 ? Math.max(...withAmt.map(d => d.totalAmount)) : -1;

    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dd = rawData.find(x => x.date === ds) || { totalPatients:0, totalAmount:0, cashPatients:0, panelPatients:0 };
      cells.push({ day: d, dateStr: ds, ...dd });
    }
    while (cells.length % 7 !== 0) cells.push(null);

    // Build weeks array (each week = 7 day cells + 1 weekly total)
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      const wTotal = week.reduce((acc, c) => {
        if (!c) return acc;
        return {
          totalPatients: acc.totalPatients + (c.totalPatients || 0),
          totalAmount:   acc.totalAmount   + (c.totalAmount   || 0),
          panelPatients: acc.panelPatients + (c.panelPatients || 0),
          cashPatients:  acc.cashPatients  + (c.cashPatients  || 0),
        };
      }, { totalPatients: 0, totalAmount: 0, panelPatients: 0, cashPatients: 0 });
      weeks.push({ days: week, total: wTotal });
    }

    // Column totals: for each day-of-week (0=Sun … 6=Sat)
    const colTotals = Array.from({ length: 7 }, () => ({ totalPatients:0, totalAmount:0, panelPatients:0, cashPatients:0 }));
    for (const { days } of weeks) {
      days.forEach((cell, di) => {
        if (!cell) return;
        colTotals[di].totalPatients += cell.totalPatients || 0;
        colTotals[di].totalAmount   += cell.totalAmount   || 0;
        colTotals[di].panelPatients += cell.panelPatients || 0;
        colTotals[di].cashPatients  += cell.cashPatients  || 0;
      });
    }
    const grandColTotal = colTotals.reduce((acc, c) => ({
      totalPatients: acc.totalPatients + c.totalPatients,
      totalAmount:   acc.totalAmount   + c.totalAmount,
      panelPatients: acc.panelPatients + c.panelPatients,
      cashPatients:  acc.cashPatients  + c.cashPatients,
    }), { totalPatients:0, totalAmount:0, panelPatients:0, cashPatients:0 });

    const cellClass = (cell) => {
      if (!cell) return 'rd-cell rd-cell--blank';
      if (cell.totalAmount === 0) return 'rd-cell rd-cell--zero';
      if (cell.dateStr === todayStr) return 'rd-cell rd-cell--today';
      if (maxAmt > 0 && cell.totalAmount === maxAmt) return 'rd-cell rd-cell--max';
      if (minAmt > 0 && cell.totalAmount === minAmt) return 'rd-cell rd-cell--min';
      return 'rd-cell';
    };

    return (
      <div className="rd-calendar">
        <div className="rd-cal-nav">
          <button className="rd-nav-btn" onClick={prevPeriod}><ChevronLeft size={16}/></button>
          <span className="rd-cal-title">{MNF[month-1]} {year}</span>
          <button className="rd-nav-btn" onClick={nextPeriod}><ChevronRight size={16}/></button>
        </div>
        <div className="rd-cal-grid">
          <div className="rd-cal-hdr-row">
            {DN.map(d => (
              <div key={d} className={`rd-cal-hdr ${d === 'Total' ? 'rd-cal-hdr--total' : ''}`}>{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="rd-week-row">
              {week.days.map((cell, di) => (
                <div
                  key={di}
                  className={`${cellClass(cell)}${cell ? ' rd-cell--clickable' : ''}`}
                  onDoubleClick={() => cell && setStatementDate(cell.dateStr)}
                  title={cell ? 'Double-click for department-wise statement' : undefined}
                >
                  {cell && (
                    <>
                      <div className="rd-cell-day">{cell.day}</div>
                      {cell.totalPatients > 0 && (
                        <>
                          <div className="rd-cell-total">{cell.totalPatients}</div>
                          <div className="rd-cell-amt">{fmtN(cell.totalAmount)}</div>
                          <div className="rd-cell-badges">
                            {cell.panelPatients > 0 && <span className="rd-badge rd-badge--panel">{cell.panelPatients}</span>}
                            {cell.cashPatients  > 0 && <span className="rd-badge rd-badge--cash">{cell.cashPatients}</span>}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
              {/* Weekly Total cell */}
              <div className={`rd-cell rd-cell--week-total ${week.total.totalPatients === 0 ? 'rd-cell--zero' : ''}`}>
                {week.total.totalPatients > 0 && (
                  <>
                    <div className="rd-cell-wk-label">Wk Total</div>
                    <div className="rd-cell-total">{week.total.totalPatients}</div>
                    <div className="rd-cell-amt">{fmtN(week.total.totalAmount)}</div>
                    <div className="rd-cell-badges">
                      {week.total.panelPatients > 0 && <span className="rd-badge rd-badge--panel">{week.total.panelPatients}</span>}
                      {week.total.cashPatients  > 0 && <span className="rd-badge rd-badge--cash">{week.total.cashPatients}</span>}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {/* Column (day-of-week) totals row */}
          <div className="rd-week-row rd-col-total-row">
            {colTotals.map((ct, di) => (
              <div key={di} className="rd-cell rd-cell--col-total">
                <div className="rd-cell-wk-label">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][di]}</div>
                <div className="rd-cell-total">{ct.totalPatients}</div>
                <div className="rd-cell-amt">{fmtN(ct.totalAmount)}</div>
                <div className="rd-cell-badges">
                  {ct.panelPatients > 0 && <span className="rd-badge rd-badge--panel">{ct.panelPatients}</span>}
                  {ct.cashPatients  > 0 && <span className="rd-badge rd-badge--cash">{ct.cashPatients}</span>}
                </div>
              </div>
            ))}
            {/* Grand total corner */}
            <div className="rd-cell rd-cell--grand-corner">
              <div className="rd-cell-wk-label">Grand</div>
              <div className="rd-cell-total">{grandColTotal.totalPatients}</div>
              <div className="rd-cell-amt">{fmtN(grandColTotal.totalAmount)}</div>
            </div>
          </div>
        </div>
        <div className="rd-cal-legend">
          <span className="rd-leg rd-leg--today">Today</span>
          <span className="rd-leg rd-leg--max">Highest</span>
          <span className="rd-leg rd-leg--min">Lowest</span>
          <span className="rd-leg rd-leg--panel">Panel</span>
          <span className="rd-leg rd-leg--cash">Cash</span>
        </div>
      </div>
    );
  };

  // ── Yearly Monthly Grid ───────────────────────────────────────────────────
  const renderYearlyMonthly = () => {
    const withAmt = rawData.filter(d => d.totalAmount > 0);
    const maxAmt  = withAmt.length > 0 ? Math.max(...withAmt.map(d => d.totalAmount)) : 1;

    return (
      <div className="rd-yearly">
        <div className="rd-cal-nav">
          <button className="rd-nav-btn" onClick={prevPeriod}><ChevronLeft size={16}/></button>
          <span className="rd-cal-title">{year}</span>
          <button className="rd-nav-btn" onClick={nextPeriod}><ChevronRight size={16}/></button>
        </div>
        <div className="rd-month-grid">
          {rawData.map(d => (
            <div key={d.month} className={`rd-month-card ${d.totalAmount === maxAmt && maxAmt > 0 ? 'rd-month-card--max' : ''} ${d.totalPatients === 0 ? 'rd-month-card--zero' : ''}`}>
              <div className="rd-mc-name">{MN[d.month-1]}</div>
              <div className="rd-mc-patients">{fmtN(d.totalPatients)}</div>
              <div className="rd-mc-amount">{fmtN(d.totalAmount)}</div>
              <div className="rd-mc-bar-wrap">
                <div className="rd-mc-bar" style={{ width: `${maxAmt > 0 ? (d.totalAmount/maxAmt)*100 : 0}%` }}/>
              </div>
              <div className="rd-mc-sub">
                {d.panelPatients > 0 && <span className="rd-badge rd-badge--panel">{d.panelPatients}P</span>}
                {d.cashPatients  > 0 && <span className="rd-badge rd-badge--cash">{d.cashPatients}C</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Multi Year ────────────────────────────────────────────────────────────
  const renderMultiYear = () => {
    const withAmt = rawData.filter(d => d.totalAmount > 0);
    const maxAmt  = withAmt.length > 0 ? Math.max(...withAmt.map(d => d.totalAmount)) : 1;

    return (
      <div className="rd-multiyear">
        <div className="rd-cal-nav">
          <span className="rd-cal-title">All Years</span>
        </div>
        <div className="rd-year-list">
          {rawData.map(d => (
            <div key={d.year} className="rd-year-row">
              <div className="rd-yr-label">{d.year}</div>
              <div className="rd-yr-bar-wrap">
                <div className="rd-yr-bar" style={{ width: `${maxAmt > 0 ? (d.totalAmount/maxAmt)*100 : 0}%` }}/>
              </div>
              <div className="rd-yr-patients">{fmtN(d.totalPatients)} pts</div>
              <div className="rd-yr-amount">{fmtA(d.totalAmount)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMain = () => {
    if (loading) return <div className="rd-loading"><RefreshCw size={20} className="rd-spin"/><span>Loading…</span></div>;
    if (period === 'monthly_daily') return renderCalendar();
    if (period === 'yearly_monthly' || period === 'yearly_daily') return renderYearlyMonthly();
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
    <div className="rd-page">
      <ClinicMenuBar />

      <div className="rd-body">
        {/* ─── Left Sidebar ─── */}
        <div className="rd-sidebar">

          <div className="rd-filter-group">
            <label className="rd-flabel">Period Selection</label>
            <select className="rd-select" value={period} onChange={e => { setPeriod(e.target.value); }}>
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <button className="rd-last-run" onClick={fetchData} disabled={loading}>
            <RefreshCw size={12} className={loading ? 'rd-spin' : ''}/>
            Last Run {fmtLastRun}
          </button>

          <div className="rd-filter-group">
            <label className="rd-flabel">Department</label>
            <select className="rd-select" value={dept} onChange={e => { setDept(e.target.value); setSubDept('ALL'); }}>
              <option value="ALL">ALL</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>

          <div className="rd-filter-group">
            <label className="rd-flabel">Sub Dep.</label>
            <select className="rd-select" value={subDept} onChange={e => setSubDept(e.target.value)}>
              <option value="ALL">ALL</option>
              {subDepts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>

          <div className="rd-filter-group">
            <label className="rd-flabel">RMO / Consultant</label>
            <select className="rd-select" value={consultant} onChange={e => setConsultant(e.target.value)}>
              <option value="ALL">ALL</option>
              {consultants.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>

          <div className="rd-radio-grid">
            {PAY_TYPES.map(pt => (
              <label key={pt.value} className={`rd-radio-item ${payType === pt.value ? 'rd-radio-item--active' : ''}`}>
                <input type="radio" name="payType" value={pt.value} checked={payType === pt.value} onChange={() => setPayType(pt.value)}/>
                {pt.label}
              </label>
            ))}
          </div>

          <div className="rd-chart-header">
            <span className="rd-chart-title">Revenue Trend</span>
            <div className="rd-ct-toggle">
              <button className={`rd-ct-btn ${chartType==='bar'?'--on':''}`} onClick={()=>setChartType('bar')}><BarChart2 size={11}/></button>
              <button className={`rd-ct-btn ${chartType==='line'?'--on':''}`} onClick={()=>setChartType('line')}><TrendingUp size={11}/></button>
              <button className={`rd-ct-btn ${chartType==='area'?'--on':''}`} onClick={()=>setChartType('area')}><Activity size={11}/></button>
            </div>
          </div>

          <div className="rd-chart-wrap">
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

          <div className="rd-prognosis-box">
            <div className="rd-prog-row"><span>Prognosis:</span><strong>{fmtA(summary.prognosis)}</strong></div>
            <div className="rd-prog-row"><span>{MN[(dashData?.month||month)-1]}, {(dashData?.year||year)-1}:</span><strong>{fmtA(summary.lastYearAmount)}</strong></div>
          </div>
        </div>

        {/* ─── Main Content ─── */}
        <div className="rd-main">
          {renderMain()}

          {/* Summary Bar */}
          <div className="rd-summary">
            <div className="rd-sum-left">
              <div className="rd-sum-item">
                <div className="rd-sum-lbl">Daily Avg.</div>
                <div className="rd-sum-val">{fmtA(summary.dailyAvg)}</div>
              </div>
              <div className="rd-sum-sep"/>
              <div className="rd-sum-item">
                <div className="rd-sum-lbl">Prognosis</div>
                <div className="rd-sum-val">{fmtA(summary.prognosis)}</div>
              </div>
              <div className="rd-sum-sep"/>
              <div className="rd-sum-item">
                <div className="rd-sum-lbl">{MN[(dashData?.month||month)-1]}, {(dashData?.year||year)-1}</div>
                <div className="rd-sum-val">{fmtA(summary.lastYearAmount)}</div>
              </div>
            </div>
            <div className="rd-sum-right">
              <div className="rd-sum-big">
                <span className="rd-sum-icon">👥</span>
                <div>
                  <div className="rd-sum-lbl">Total Patients:</div>
                  <div className="rd-sum-big-val rd-sum-big-val--p">{fmtN(summary.totalPatients)}</div>
                </div>
              </div>
              <div className="rd-sum-big">
                <span className="rd-sum-icon">💰</span>
                <div>
                  <div className="rd-sum-lbl">Total Amount:</div>
                  <div className="rd-sum-big-val rd-sum-big-val--a">{fmtA(summary.totalAmount)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {statementDate && (
        <DailyStatementModal date={statementDate} onClose={() => setStatementDate(null)} />
      )}
    </div>
  );
}
