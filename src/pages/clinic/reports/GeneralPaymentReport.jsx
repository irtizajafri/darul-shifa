import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { printElementInPopup } from '../../../utils/printPopup';
import { openPrintWindow } from '../../../utils/printRelay';
import './DepartmentDoctorPerformanceReport.scss';
import './GeneralPaymentReport.scss';

const API = 'http://localhost:5001/api/clinic';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const parts = (ymd) => { const [y, m, d] = String(ymd).split('-').map(Number); return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }; };
// "20-October-2026" (day heading) / "Tue Oct-20-2026" (line PayDate) — as the old report.
const fmtHeading = (ymd) => { const p = parts(ymd); return `${String(p.d).padStart(2, '0')}-${MONTH[p.m - 1]}-${p.y}`; };
const fmtPayDate = (ymd) => { const p = parts(ymd); return `${DAY[p.dow]} ${MON[p.m - 1]}-${String(p.d).padStart(2, '0')}-${p.y}`; };
const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const modeLabel = (m) => (String(m || '').toLowerCase() === 'bank' ? 'Bank' : 'Cash');
// Book = which Pending Draft book: non-corporate → Cash, corporate → Panel.
const bookLabel = (b) => (b === 'panel' ? 'Panel' : 'Cash');

// Reports — General Payment Date Wise (Pending Draft payments, real time).
export default function GeneralPaymentReport() {
  const [params] = useSearchParams();
  const fromDate = params.get('fromDate') || '';
  const toDate = params.get('toDate') || '';
  const doctorId = params.get('doctorId') || '';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const printRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ fromDate, toDate, ...(doctorId ? { doctorId } : {}) });
      const res = await fetch(`${API}/reports/general-payment?${q}`).then(r => r.json());
      setData(res.data || { rows: [], cashTotal: 0, panelTotal: 0, total: 0 });
    } catch { toast.error('Data load nahi hua'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [fromDate, toDate, doctorId]);
  useEffect(() => {
    if (!doctorId) return;
    fetch(`${API}/doctors?minimal=true`).then(r => r.json())
      .then(j => setDoctorName((j.data || []).find(d => String(d.id) === doctorId)?.name || ''))
      .catch(() => {});
  }, [doctorId]);

  // One PAGE per business day per book — that day's Cash page, then its
  // Panel page (corporate-book drafts); a book with no payments that day gets
  // no page. Inside a page the old report's per-mode (Cash / Bank) blocks.
  const pages = useMemo(() => {
    const map = new Map();
    for (const r of data?.rows || []) {
      const book = r.book === 'panel' ? 'panel' : 'cash';
      const k = `${r.businessDate}|${book}`;
      if (!map.has(k)) map.set(k, { date: r.businessDate, book, modes: new Map(), count: 0, total: 0 });
      const pg = map.get(k);
      const mode = modeLabel(r.mode);
      if (!pg.modes.has(mode)) pg.modes.set(mode, { mode, rows: [], total: 0 });
      const g = pg.modes.get(mode);
      g.rows.push(r); g.total += r.amount;
      pg.count += 1; pg.total += r.amount;
    }
    const order = { cash: 0, panel: 1 };
    return [...map.values()]
      .map(pg => ({ ...pg, modes: [...pg.modes.values()] }))
      .sort((a, b) => a.date.localeCompare(b.date) || order[a.book] - order[b.book]);
  }, [data]);

  const title = 'General Payment Date Wise';
  const subtitle = `From: ${fromDate ? fmtHeading(fromDate) : '—'}  To: ${toDate ? fmtHeading(toDate) : '—'}${doctorId ? `  —  Consultant: ${doctorName || doctorId}` : ''}`;

  const handlePrint = () => {
    const w = openPrintWindow('width=900,height=1000');
    printElementInPopup(printRef.current, { title, page: 'A4 portrait', margin: '10mm', targetWindow: w });
  };

  const handleExport = () => {
    if (!data?.rows?.length) { toast.error('No data to export'); return; }
    const aoa = [[title], [subtitle], [], ['Book', 'PayDate', 'Code', 'Payee', 'Particulars', 'Amount']];
    for (const pg of pages) {
      const book = bookLabel(pg.book);
      for (const g of pg.modes) {
        aoa.push([book, fmtHeading(pg.date), '', '', g.mode]);
        g.rows.forEach(r => aoa.push([book, fmtPayDate(r.businessDate), r.code, r.payeeName, r.particulars, r.amount]));
        if (pg.modes.length > 1) aoa.push([book, '', '', '', `Total ${g.mode}`, g.total]);
      }
      aoa.push([book, '', '', '', `${book} Total ${fmtHeading(pg.date)}`, pg.total], []);
    }
    aoa.push(['', '', '', '', 'Cash Total', data.cashTotal || 0]);
    aoa.push(['', '', '', '', 'Panel Total', data.panelTotal || 0]);
    aoa.push(['', '', '', '', 'Grand Total', data.total]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GeneralPayment');
    XLSX.writeFile(wb, `general_payment_${fromDate}_${toDate}.xlsx`);
  };

  return (
    <div className="ddp-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExport} onRefresh={fetchData} refreshing={loading} />

      <div className="ddp-report-area">
        <div className={`gpr-page rpt-arial9${pages.length && !loading ? ' gpr-page--sheets' : ' ddp-report-page'}`} ref={printRef}>
          {(loading || !data?.rows?.length) && (
            <div className="ddp-print-header">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
          )}
          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !data?.rows?.length && <div className="ddp-empty">Is filter mein koi pending payment nahi.</div>}

          {!loading && data?.rows?.length > 0 && pages.map((pg, i) => (
            <section key={`${pg.date}-${pg.book}`} className={`gpr-sheet${i > 0 ? ' gpr-sheet-break' : ''}`}>
              <div className="ddp-print-header">
                <div className="gpr-hospital">Darul Shifa Hospital</div>
                <h1>{title}</h1>
                <p>{subtitle}</p>
                <div className="gpr-sheet-head">
                  <span>{fmtHeading(pg.date)}</span>
                  <span className="gpr-book">{bookLabel(pg.book)} Payments</span>
                </div>
              </div>
              <table className="gpr-table">
                <colgroup><col className="gpr-c-date" /><col className="gpr-c-code" /><col /><col className="gpr-c-amt" /></colgroup>
                <thead>
                  <tr><th>PayDate</th><th>Code</th><th>Particulars</th><th className="num">Amount</th></tr>
                </thead>
                {pg.modes.map(g => (
                  <tbody key={g.mode}>
                    <tr className="gpr-day">
                      <td colSpan={3}>{fmtHeading(pg.date)}</td>
                      <td className="num">{g.mode}</td>
                    </tr>
                    {g.rows.map(r => (
                      <tr key={r.id} className="gpr-line">
                        <td>{fmtPayDate(r.businessDate)}</td>
                        <td>{r.code}</td>
                        <td className="gpr-part">{r.particulars || r.payeeName}{r.code ? ` - ${r.code}` : ''}</td>
                        <td className="num">{fmt2(r.amount)}</td>
                      </tr>
                    ))}
                    {pg.modes.length > 1 && (
                      <tr className="gpr-subtotal">
                        <td colSpan={3}>Total {g.mode}</td>
                        <td className="num">{fmt2(g.total)}</td>
                      </tr>
                    )}
                  </tbody>
                ))}
                <tfoot>
                  <tr className="gpr-grand">
                    <td colSpan={3}>{bookLabel(pg.book)} Total {fmtHeading(pg.date)} — {pg.count} payment{pg.count !== 1 ? 's' : ''}</td>
                    <td className="num">{fmt2(pg.total)}</td>
                  </tr>
                </tfoot>
              </table>
              {/* Whole-range Summary closes the last page. */}
              {i === pages.length - 1 && (
                <table className="gpr-table gpr-summary">
                  <colgroup><col /><col className="gpr-c-amt" /></colgroup>
                  <tbody>
                    <tr><td colSpan={2} className="gpr-summary-title">Summary — {subtitle}</td></tr>
                    <tr><td>Cash Total</td><td className="num">{fmt2(data.cashTotal)}</td></tr>
                    <tr><td>Panel Total</td><td className="num">{fmt2(data.panelTotal)}</td></tr>
                    <tr className="gpr-grand"><td>Grand Total — {data.rows.length} payment{data.rows.length !== 1 ? 's' : ''}</td><td className="num">{fmt2(data.total)}</td></tr>
                  </tbody>
                </table>
              )}
              <div className="gpr-page-no">Page {i + 1} of {pages.length}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
