import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import './DepartmentDoctorPerformanceReport.scss';
import './CancelRefundHistoryReport.scss';

const API = 'http://localhost:5001/api/clinic';

const fmtDateTime = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  const date = `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
  const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} ${time}`;
};
const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CancelRefundHistoryReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const type = params.get('type') || 'all';
  const fromDate = params.get('fromDate') || '';
  const toDate = params.get('toDate') || '';
  const search = params.get('search') || '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ type, dateFrom: fromDate, dateTo: toDate, search });
      const res = await fetch(`${API}/reports/cancel-refund-history?${q}`).then(r => r.json());
      setData(res.data || null);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const reportTitle = 'Cancel & Refund Slip History';

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('crh-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>${reportTitle}</title>
      <style>
        @page{size:landscape;margin:8mm;}
        *{box-sizing:border-box;}
        body{font-family:Arial,sans-serif;font-size:9.5px;margin:0;padding:8px;}
        h1{font-size:12px;margin:0 0 2px;}
        p{font-size:9px;margin:0;color:#555;}
        table{width:100%;border-collapse:collapse;font-size:9px;margin-top:10px;}
        th{border-bottom:1px solid #000;padding:3px 6px;text-align:left;}
        th.num{text-align:right;}
        td{padding:2.5px 6px;border-bottom:1px solid #ddd;}
        .td-num{text-align:right;}
        .crh-type-cancelled{color:#b91c1c;font-weight:600;}
        .crh-type-refunded{color:#0369a1;font-weight:600;}
        .crh-summary{margin-top:12px;display:flex;gap:30px;font-size:9.5px;}
        .crh-summary b{font-weight:800;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    if (!data || !data.rows.length) { toast.error('No data to export'); return; }
    const aoa = [[reportTitle], [`From: ${fromDate}  To: ${toDate}`], []];
    aoa.push(['Slip #', 'Date/Time', 'Patient Name', 'Department', 'Type', 'Amount', 'Reason', 'Note', 'Done By']);
    data.rows.forEach(r => aoa.push([r.slipNo, fmtDateTime(r.doneAt), r.patientName, r.department, r.type, r.amount, r.reason, r.note, r.doneBy]));
    aoa.push([]);
    aoa.push(['Cancelled', data.summary.cancelledCount, data.summary.cancelledAmount]);
    aoa.push(['Refunded', data.summary.refundedCount, data.summary.refundedAmount]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CancelRefundHistory');
    XLSX.writeFile(wb, `cancel_refund_history_${fromDate}_${toDate}.xlsx`);
  };

  const hasRows = data && data.rows && data.rows.length > 0;

  return (
    <div className="ddp-page">
      <div className="ddp-toolbar no-print">
        <div className="ddp-toolbar-left">
          <button className="ddp-tool-btn" onClick={() => navigate(-1)}><ArrowLeft size={14}/> <span>Back</span></button>
          <div className="ddp-tool-sep"/>
          <button className="ddp-tool-btn" onClick={handlePrint}><Printer size={14}/> <span>Print / PDF</span></button>
          <button className="ddp-tool-btn" onClick={handleExportExcel}><FileDown size={14}/> <span>Export Excel</span></button>
          <div className="ddp-tool-sep"/>
          <button className="ddp-tool-btn" onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'ddp-spin' : ''}/> <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="ddp-report-area">
        <div className="ddp-report-page crh-report-page" id="crh-printable">
          <div className="ddp-print-header">
            <h1>{reportTitle}</h1>
            <p>{fromDate} to {toDate}{search ? ` — Search: "${search}"` : ''}</p>
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !hasRows && <div className="ddp-empty">No records found for the selected filters.</div>}

          {!loading && hasRows && (
            <>
              <table className="ddp-table crh-table">
                <thead>
                  <tr>
                    <th>Slip #</th>
                    <th>Date/Time</th>
                    <th>Patient Name</th>
                    <th>Department</th>
                    <th>Type</th>
                    <th className="num">Amount</th>
                    <th>Reason</th>
                    <th>Done By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={`${r.source}-${r.id}-${r.type}-${i}`}>
                      <td>{r.slipNo}</td>
                      <td>{fmtDateTime(r.doneAt)}</td>
                      <td>{r.patientName}</td>
                      <td>{r.department}</td>
                      <td className={r.type === 'Cancelled' ? 'crh-type-cancelled' : 'crh-type-refunded'}>{r.type}</td>
                      <td className="td-num">{fmt2(r.amount)}</td>
                      <td>{r.reason}{r.note && r.note !== r.reason ? ` — ${r.note}` : ''}</td>
                      <td>{r.doneBy || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="crh-summary">
                <span><b>{data.summary.cancelledCount}</b> Cancelled — Rs. {fmt2(data.summary.cancelledAmount)}</span>
                <span><b>{data.summary.refundedCount}</b> Refunded — Rs. {fmt2(data.summary.refundedAmount)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
