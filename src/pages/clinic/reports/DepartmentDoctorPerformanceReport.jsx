import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './DepartmentDoctorPerformanceReport.scss';

const API = 'http://localhost:5001/api/clinic';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const BUCKETS = [
  { key: 'GOPD', label: 'GOPD' },
  { key: 'COPD', label: 'COPD' },
  { key: 'EMR',  label: 'EMR' },
  { key: 'LAB',  label: 'LAB' },
  { key: 'US',   label: 'US' },
  { key: 'XRAY', label: 'X-Ray' },
];

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS_SHORT[dt.getMonth()]}-${dt.getFullYear()}`;
};
const fmtDateTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${fmtDate(d)} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
};

export default function DepartmentDoctorPerformanceReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuthStore();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);

  const fromDate       = params.get('fromDate') || '';
  const toDate         = params.get('toDate') || '';
  const fromDoctorCode = params.get('fromDoctorCode') || '';
  const toDoctorCode   = params.get('toDoctorCode') || '';
  const activeOnly     = params.get('activeOnly') === '1';
  const reportType     = params.get('reportType') || 'summary';
  const isDetail       = reportType === 'detail';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ fromDate, toDate });
      if (fromDoctorCode) q.set('fromDoctorCode', fromDoctorCode);
      if (toDoctorCode)   q.set('toDoctorCode', toDoctorCode);
      if (activeOnly)     q.set('activeOnly', '1');
      const res = await fetch(`${API}/reports/department-doctor-performance?${q}`).then(r => r.json());
      setRows(res.data?.rows || []);
      setTotal(res.data?.total || null);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const printedBy = user?.name || user?.username || 'User';
  const printedAtStr = fmtDateTime(new Date());

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('ddp-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>Department wise Doctor's Performance</title>
      <style>
        *{box-sizing:border-box;}
        body{font-family:Tahoma,sans-serif;font-size:11px;margin:0;padding:12px;}
        table{width:100%;border-collapse:collapse;font-size:10px;}
        th{background:#1a3c6e!important;color:#fff!important;padding:4px 6px;text-align:left;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        th.num{text-align:right;}
        td{padding:3px 6px;border-bottom:1px solid #ddd;}
        .td-num{text-align:right;}
        .ddp-total-row td{background:#eef2f8!important;font-weight:700;border-top:2px solid #1a3c6e;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .ddp-bucket-row td{background:#f4f6fa!important;font-style:italic;padding-left:20px;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .ddp-detail-row td{padding-left:34px;color:#334155;}
        h1{font-size:13px;margin:0 0 2px;text-transform:uppercase;letter-spacing:.04em;}
        p{font-size:10px;margin:0;color:#555;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    const aoa = [["Department wise Doctor's Performance"], [`Date: ${fmtDate(fromDate)} To ${fmtDate(toDate)}`], []];
    aoa.push(['Doctor', 'Patients', 'GOPD', 'COPD', 'EMR', 'Admit', 'Not Admit', 'LAB', 'US', 'X-Ray']);
    for (const r of rows) {
      aoa.push([`${r.code}  ${r.name}`, r.patients, r.GOPD || '', r.COPD || '', r.EMR || '', r.admit, r.notAdmit, r.LAB || '', r.US || '', r.XRAY || '']);
      if (isDetail) {
        for (const b of BUCKETS) {
          const list = r.detail[b.key];
          if (!list.length) continue;
          aoa.push(['', b.label]);
          list.forEach(v => aoa.push(['', '', v.slipNo, fmtDateTime(v.slipDate), v.patientName, v.admissionNo || '']));
        }
      }
    }
    if (total) aoa.push(['TOTAL', total.patients, total.GOPD, total.COPD, total.EMR, total.admit, total.notAdmit, total.LAB, total.US, total.XRAY]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DoctorPerformance');
    XLSX.writeFile(wb, `department_doctor_performance_${fromDate}_${toDate}.xlsx`);
  };

  return (
    <div className="ddp-page">
      <div className="ddp-toolbar no-print">
        <div className="ddp-toolbar-left">
          <button className="ddp-tool-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={14}/> <span>Back</span>
          </button>
          <div className="ddp-tool-sep"/>
          <button className="ddp-tool-btn" onClick={handlePrint}>
            <Printer size={14}/> <span>Print / PDF</span>
          </button>
          <button className="ddp-tool-btn" onClick={handleExportExcel}>
            <FileDown size={14}/> <span>Export Excel</span>
          </button>
          <div className="ddp-tool-sep"/>
          <button className="ddp-tool-btn" onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'ddp-spin' : ''}/> <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="ddp-report-area">
        <div className="ddp-report-page" id="ddp-printable">
          <div className="ddp-print-header">
            <h1>Department wise Doctor's Performance</h1>
            <p>Date &amp; Time: {printedAtStr} | Printed By: {printedBy}</p>
            <p>{fmtDate(fromDate)} to {fmtDate(toDate)}</p>
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && rows.length === 0 && <div className="ddp-empty">No records found for the selected filters.</div>}

          {!loading && rows.length > 0 && (
            <table className="ddp-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th className="num">Patients</th>
                  <th className="num">GOPD</th>
                  <th className="num">COPD</th>
                  <th className="num">EMR</th>
                  <th className="num">Admit</th>
                  <th className="num">Not Admit</th>
                  <th className="num">LAB</th>
                  <th className="num">US</th>
                  <th className="num">X-Ray</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <Fragment key={r.code}>
                    <tr className="ddp-doc-row">
                      <td>{r.code}&nbsp;&nbsp;{r.name}</td>
                      <td className="td-num">{r.patients}</td>
                      <td className="td-num">{r.GOPD || ''}</td>
                      <td className="td-num">{r.COPD || ''}</td>
                      <td className="td-num">{r.EMR || ''}</td>
                      <td className="td-num">{r.admit}</td>
                      <td className="td-num">{r.notAdmit}</td>
                      <td className="td-num">{r.LAB || ''}</td>
                      <td className="td-num">{r.US || ''}</td>
                      <td className="td-num">{r.XRAY || ''}</td>
                    </tr>
                    {isDetail && BUCKETS.map(b => {
                      const list = r.detail[b.key];
                      if (!list.length) return null;
                      return (
                        <Fragment key={`${r.code}-${b.key}`}>
                          <tr className="ddp-bucket-row">
                            <td colSpan={10}>{b.label} ({list.length})</td>
                          </tr>
                          {list.map((v, i) => (
                            <tr className="ddp-detail-row" key={`${r.code}-${b.key}-${i}`}>
                              <td colSpan={4}>{v.slipNo} — {fmtDateTime(v.slipDate)} — {v.patientName}</td>
                              <td colSpan={6} className="td-num">{v.admissionNo || (v.admitted === false ? 'Not Admitted' : '')}</td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
              {total && (
                <tfoot>
                  <tr className="ddp-total-row">
                    <td>TOTAL</td>
                    <td className="td-num">{total.patients}</td>
                    <td className="td-num">{total.GOPD || ''}</td>
                    <td className="td-num">{total.COPD || ''}</td>
                    <td className="td-num">{total.EMR || ''}</td>
                    <td className="td-num">{total.admit}</td>
                    <td className="td-num">{total.notAdmit}</td>
                    <td className="td-num">{total.LAB || ''}</td>
                    <td className="td-num">{total.US || ''}</td>
                    <td className="td-num">{total.XRAY || ''}</td>
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
