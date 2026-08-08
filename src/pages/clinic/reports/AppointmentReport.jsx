import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import './DepartmentDoctorPerformanceReport.scss';

const API = 'http://localhost:5001/api/clinic';
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DATE_TYPE_LABEL = { lastVisit: 'Last Visit Date', nextVisit: 'Next Visit Date', entry: 'Entry Date' };

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS_SHORT[dt.getMonth()]}-${dt.getFullYear()}`;
};

export default function AppointmentReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);

  const dateType = params.get('dateType') || 'lastVisit';
  const date     = params.get('date') || '';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ dateType, date });
      const res = await fetch(`${API}/reports/appointment?${q}`).then(r => r.json());
      setRows(res.data?.rows || []);
      setTotal(res.data?.total || null);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('apr-rep-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>Daily Appointment Sheet</title>
      <style>
        *{box-sizing:border-box;}
        body{font-family:Tahoma,sans-serif;font-size:11px;margin:0;padding:12px;}
        table{width:100%;border-collapse:collapse;font-size:10px;}
        th{background:#1a3c6e!important;color:#fff!important;padding:4px 6px;text-align:left;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        td{padding:3px 6px;border-bottom:1px solid #ddd;}
        h1{font-size:13px;margin:0 0 2px;text-transform:uppercase;letter-spacing:.04em;}
        p{font-size:10px;margin:0;color:#555;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    const aoa = [['Daily Appointment Sheet'], [`${DATE_TYPE_LABEL[dateType]}: ${fmtDate(date)}`], []];
    aoa.push(['Sno', 'PatName', 'Consultaint', 'Last Visit', 'NextDt', 'PhoneNumber', 'CreatedBy']);
    for (const r of rows) {
      aoa.push([r.slipNo, r.patientName, r.consultantName || '', fmtDate(r.lastVisitDate), fmtDate(r.nextAppointmentDate), r.phoneNo || '', r.createdByName || '']);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Appointment');
    XLSX.writeFile(wb, `appointment_${date}.xlsx`);
  };

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
        <div className="ddp-report-page" id="apr-rep-printable">
          <div className="ddp-print-header">
            <h1>Daily Appointment Sheet</h1>
            <p>{DATE_TYPE_LABEL[dateType]}: {fmtDate(date)}</p>
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !rows.length && <div className="ddp-empty">No records found for the selected date.</div>}

          {!loading && rows.length > 0 && (
            <table className="ddp-table">
              <thead>
                <tr>
                  <th>Sno</th>
                  <th>PatName</th>
                  <th>Consultaint</th>
                  <th>Last Visit</th>
                  <th>NextDt</th>
                  <th>PhoneNumber</th>
                  <th>CreatedBy</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td>{r.slipNo}</td>
                    <td>{r.patientName}</td>
                    <td>{r.consultantName || '—'}</td>
                    <td>{fmtDate(r.lastVisitDate)}</td>
                    <td>{fmtDate(r.nextAppointmentDate)}</td>
                    <td>{r.phoneNo || '—'}</td>
                    <td>{r.createdByName || '—'}</td>
                  </tr>
                ))}
              </tbody>
              {total && (
                <tfoot>
                  <tr className="ddp-total-row">
                    <td colSpan={7}>Total: {total.count}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
