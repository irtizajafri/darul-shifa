import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { REPORT_PRINT_FONT_CSS } from '../../../components/reports/reportFont';
import './DepartmentDoctorPerformanceReport.scss';
import './WardWisePaymentDistributionReport.scss';

const API = 'http://localhost:5001/api/clinic';

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const COLS = [
  ['admissionNo', 'Admt. No', false],
  ['patientName', 'Pat. Name', false],
  ['depBilAmt', 'Dep. Bil Amt', true],
  ['discount', 'Discount', true],
  ['otherWards', 'OtherWards', true],
  ['netAmt', 'Net Amt', true],
  ['daAmt', 'Da Amt', true],
  ['pharmAmt', 'Pharm Amt', true],
  ['consRmoAmt', 'Cons/Rmo Amt', true],
  ['procedureAmt', 'Procedure', true],
  ['tafd', 'TAFD', true],
];

export default function WardWisePaymentDistributionReport() {
  const [params] = useSearchParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const admissionFrom = params.get('admissionFrom') || '';
  const admissionTo = params.get('admissionTo') || '';
  const dateFrom = params.get('dateFrom') || '';
  const dateTo = params.get('dateTo') || '';
  const wardIds = params.get('wardIds') || '';
  const salary = params.get('salary') || '';
  const sharePercent = params.get('sharePercent') || '';
  const otherAdd = params.get('otherAdd') || '';
  const otherLess = params.get('otherLess') || '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ admissionFrom, admissionTo, dateFrom, dateTo, wardIds, salary, sharePercent, otherAdd, otherLess });
      const res = await fetch(`${API}/reports/ward-wise-payment-distribution?${q}`).then(r => r.json());
      setData(res.data || null);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('wpr-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>Ward Wise Payment Distribution</title>
      <style>
        @page{size:landscape;margin:8mm;}
        *{box-sizing:border-box;}
        body{font-family:Arial,sans-serif;font-size:9px;margin:0;padding:6px;}
        h2{font-size:11px;margin:14px 0 6px;}
        table{width:100%;border-collapse:collapse;font-size:8.5px;}
        th{border-bottom:1px solid #000;padding:3px 5px;text-align:left;}
        th.num{text-align:right;}
        td{padding:2px 5px;}
        .td-num{text-align:right;}
        .wpr-total-row td{font-weight:800;border-top:1px solid #000;}
        .wpr-summary{margin-top:14px;border-top:2px solid #000;padding-top:6px;font-size:9.5px;}
        .wpr-summary div{display:flex;justify-content:space-between;max-width:320px;padding:1px 0;}
        .wpr-summary .wpr-net{font-weight:800;border-top:1px solid #000;margin-top:4px;padding-top:4px;}
        ${REPORT_PRINT_FONT_CSS}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    if (!data || !data.wards.length) { toast.error('No data to export'); return; }
    const aoa = [['Ward Wise Payment Distribution'], [`From: ${fmtDate(dateFrom)}  To: ${fmtDate(dateTo)}`], []];
    data.wards.forEach((w) => {
      aoa.push([`${w.name} Statement`]);
      aoa.push(COLS.map(([, label]) => label));
      w.rows.forEach((r) => aoa.push(COLS.map(([key]) => r[key])));
      aoa.push([`${w.rows.length} patient(s)`, 'TOTAL', ...COLS.slice(2).map(([key]) => w.total[key])]);
      aoa.push([]);
    });
    // Grand Total — one line per ward, then all wards together
    aoa.push(['Grand Total']);
    aoa.push(['Ward', 'Patients', ...COLS.slice(2).map(([, label]) => label)]);
    data.wards.forEach((w) => aoa.push([w.name, w.rows.length, ...COLS.slice(2).map(([key]) => w.total[key])]));
    aoa.push(['GRAND TOTAL', totalPatients, ...COLS.slice(2).map(([key]) => data.grandTotal?.[key] || 0)]);
    aoa.push([]);
    if (data.summary) {
      aoa.push(['Salary', data.summary.salary]);
      aoa.push(['Share %', data.summary.sharePercent]);
      aoa.push(['Other (Add)', data.summary.otherAdd]);
      aoa.push(['Other (Less)', data.summary.otherLess]);
      aoa.push(['Net Payable', data.summary.netPayable]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WardWisePayment');
    XLSX.writeFile(wb, `ward_wise_payment_${dateFrom}_${dateTo}.xlsx`);
  };

  const hasData = data && data.wards && data.wards.length > 0;
  const totalPatients = hasData ? data.wards.reduce((n, w) => n + w.rows.length, 0) : 0;

  return (
    <div className="ddp-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExportExcel} onRefresh={fetchData} refreshing={loading} />

      <div className="ddp-report-area">
        <div className="ddp-report-page wpr-report-page rpt-arial9" id="wpr-printable">
          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !hasData && <div className="ddp-empty">No records found for the selected filters.</div>}

          {!loading && hasData && data.wards.map((w) => (
            <div key={w.id} className="wpr-ward-block">
              <h2 className="wpr-ward-title">
                {w.name} Statement for the period of {fmtDate(dateFrom)} to {fmtDate(dateTo)}
              </h2>
              <table className="ddp-table wpr-table">
                <thead>
                  <tr>
                    {COLS.map(([key, label, isNum]) => <th key={key} className={isNum ? 'num' : ''}>{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {w.rows.map((r) => (
                    <tr key={r.admissionNo}>
                      {COLS.map(([key, , isNum]) => (
                        <td key={key} className={isNum ? 'td-num' : ''}>{isNum ? fmt2(r[key]) : r[key]}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="wpr-total-row">
                    <td colSpan={2}>TOTAL — {w.rows.length} patient{w.rows.length === 1 ? '' : 's'}</td>
                    {COLS.slice(2).map(([key]) => <td key={key} className="td-num">{fmt2(w.total[key])}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          {/* Grand Total — each ward's patients and totals, then all wards together */}
          {!loading && hasData && (
            <div className="wpr-ward-block">
              <h2 className="wpr-ward-title">Grand Total — {fmtDate(dateFrom)} to {fmtDate(dateTo)}</h2>
              <table className="ddp-table wpr-table">
                <thead>
                  <tr>
                    <th>Ward</th>
                    <th className="num">Patients</th>
                    {COLS.slice(2).map(([key, label]) => <th key={key} className="num">{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.wards.map((w) => (
                    <tr key={w.id}>
                      <td>{w.name}</td>
                      <td className="td-num">{w.rows.length}</td>
                      {COLS.slice(2).map(([key]) => <td key={key} className="td-num">{fmt2(w.total[key])}</td>)}
                    </tr>
                  ))}
                  <tr className="wpr-total-row">
                    <td>GRAND TOTAL</td>
                    <td className="td-num">{totalPatients}</td>
                    {COLS.slice(2).map(([key]) => <td key={key} className="td-num">{fmt2(data.grandTotal?.[key])}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {!loading && hasData && data.summary && (
            <div className="wpr-summary">
              <div><span>Salary</span><span>{fmt2(data.summary.salary)}</span></div>
              <div><span>Share % of TAFD ({fmt2(data.grandTotal.tafd)})</span><span>{data.summary.sharePercent}%</span></div>
              <div><span>Other (Add)</span><span>{fmt2(data.summary.otherAdd)}</span></div>
              <div><span>Other (Less)</span><span>-{fmt2(data.summary.otherLess)}</span></div>
              <div className="wpr-net"><span>Net Payable</span><span>{fmt2(data.summary.netPayable)}</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
