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
      setData(res.data || { rows: [], total: 0 });
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

  // One block per business day → per payment mode (Cash / Bank), as the old report.
  const days = useMemo(() => {
    const map = new Map();
    for (const r of data?.rows || []) {
      const k = `${r.businessDate}|${modeLabel(r.mode)}`;
      if (!map.has(k)) map.set(k, { date: r.businessDate, mode: modeLabel(r.mode), rows: [], total: 0 });
      const g = map.get(k); g.rows.push(r); g.total += r.amount;
    }
    return [...map.values()];
  }, [data]);

  const title = 'General Payment Date Wise';
  const subtitle = `From: ${fromDate ? fmtHeading(fromDate) : '—'}  To: ${toDate ? fmtHeading(toDate) : '—'}${doctorId ? `  —  Consultant: ${doctorName || doctorId}` : ''}`;

  const handlePrint = () => {
    const w = openPrintWindow('width=900,height=1000');
    printElementInPopup(printRef.current, { title, page: 'A4 portrait', margin: '10mm', targetWindow: w });
  };

  const handleExport = () => {
    if (!data?.rows?.length) { toast.error('No data to export'); return; }
    const aoa = [[title], [subtitle], [], ['PayDate', 'Code', 'Payee', 'Particulars', 'Amount']];
    for (const g of days) {
      aoa.push([fmtHeading(g.date), '', '', g.mode]);
      g.rows.forEach(r => aoa.push([fmtPayDate(r.businessDate), r.code, r.payeeName, r.particulars, r.amount]));
      aoa.push(['', '', '', `Total ${fmtHeading(g.date)} (${g.mode})`, g.total]);
    }
    aoa.push([], ['', '', '', 'Grand Total', data.total]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GeneralPayment');
    XLSX.writeFile(wb, `general_payment_${fromDate}_${toDate}.xlsx`);
  };

  return (
    <div className="ddp-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExport} onRefresh={fetchData} refreshing={loading} />

      <div className="ddp-report-area">
        <div className="ddp-report-page gpr-page rpt-arial9" ref={printRef}>
          <div className="ddp-print-header">
            <h1>{title}</h1>
            <p>{subtitle}</p>
            <p className="gpr-note">Pending Draft se aayi payments — aaj ki foran, purani Day Close ke baad bhi</p>
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !data?.rows?.length && <div className="ddp-empty">Is filter mein koi pending payment nahi.</div>}

          {!loading && data?.rows?.length > 0 && (
            <table className="gpr-table">
              <colgroup><col className="gpr-c-date" /><col className="gpr-c-code" /><col /><col className="gpr-c-amt" /></colgroup>
              <thead>
                <tr><th>PayDate</th><th>Code</th><th>Particulars</th><th className="num">Amount</th></tr>
              </thead>
              {days.map(g => (
                <tbody key={`${g.date}-${g.mode}`}>
                  <tr className="gpr-day">
                    <td colSpan={3}>{fmtHeading(g.date)}</td>
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
                  <tr className="gpr-subtotal">
                    <td colSpan={3}>Total {fmtHeading(g.date)} ({g.mode})</td>
                    <td className="num">{fmt2(g.total)}</td>
                  </tr>
                </tbody>
              ))}
              <tfoot>
                <tr className="gpr-grand"><td colSpan={3}>Grand Total — {data.rows.length} payment{data.rows.length !== 1 ? 's' : ''}</td><td className="num">{fmt2(data.total)}</td></tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
