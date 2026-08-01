import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './DepartmentDoctorPerformanceReport.scss';

const API = 'http://localhost:5001/api/clinic';
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PAT_TYPE_LABEL = { private: 'CASH', panel: 'PANEL', staff: 'STAFF', cc: 'CC', complementary: 'COMPLEM.' };

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
const fmtNum = (n) => Number(n || 0).toFixed(2);

export default function AdmissionWiseReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuthStore();
  const [rows, setRows] = useState([]);
  const [bucketCodes, setBucketCodes] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);

  const fromDate    = params.get('fromDate') || '';
  const toDate      = params.get('toDate') || '';
  const statusMode  = params.get('statusMode') || 'discharge';
  const patientType = params.get('patientType') || 'ALL';
  const reportType  = params.get('reportType') || 'detail';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ fromDate, toDate, statusMode, patientType });
      const res = await fetch(`${API}/reports/admission-wise?${q}`).then(r => r.json());
      setRows(res.data?.rows || []);
      setBucketCodes(res.data?.bucketCodes || []);
      setTotal(res.data?.total || null);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const printedBy = user?.name || user?.username || 'User';
  const printedAtStr = fmtDateTime(new Date());
  const showBuckets = reportType === 'detail' || reportType === 'withSlip';
  const showItems = reportType === 'withSlip';
  const isSummary = reportType === 'summary';

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('awr-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>Admission Wise Report</title>
      <style>
        *{box-sizing:border-box;}
        body{font-family:Tahoma,sans-serif;font-size:11px;margin:0;padding:12px;}
        table{width:100%;border-collapse:collapse;font-size:10px;}
        th{background:#1a3c6e!important;color:#fff!important;padding:4px 6px;text-align:left;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        th.num{text-align:right;}
        td{padding:3px 6px;border-bottom:1px solid #ddd;}
        .td-num{text-align:right;}
        .ddp-doc-row td{font-weight:600;}
        .ddp-bucket-row td{background:#f4f6fa!important;font-style:italic;padding-left:20px;font-size:9px;color:#475569;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .ddp-detail-row td{padding-left:34px;color:#334155;font-size:9px;}
        .ddp-total-row td{background:#eef2f8!important;font-weight:700;border-top:2px solid #1a3c6e;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        h1{font-size:13px;margin:0 0 2px;text-transform:uppercase;letter-spacing:.04em;}
        p{font-size:10px;margin:0;color:#555;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    const aoa = [['Admission Wise Report'], [`Date: ${fmtDate(fromDate)} To ${fmtDate(toDate)}`], []];
    if (isSummary && total) {
      aoa.push(['Patient Type', 'Admissions', 'Slips', 'Amount', ...bucketCodes]);
      for (const [pt, v] of Object.entries(total.byPatientType)) {
        aoa.push([PAT_TYPE_LABEL[pt] || pt, v.admissions, v.slipCount, v.amount, ...bucketCodes.map(c => v.buckets[c]?.amount || '')]);
      }
      aoa.push(['TOTAL', total.admissions, total.slipCount, total.amount]);
    } else {
      aoa.push(['Admit # - Patient Name', 'MR#', 'Age', 'Gender', 'Phone', 'Pat.Type', 'Status', 'Admit Date', 'Dis Date', 'Slip', 'Amount']);
      for (const r of rows) {
        aoa.push([`${r.admissionNo} - ${r.patientName}`, r.mrNo || '', r.age, r.gender, r.phoneNo || '', PAT_TYPE_LABEL[r.patientType] || r.patientType, r.status, fmtDate(r.admitDate), fmtDate(r.disDate), r.slipCount, r.amount]);
        if (showBuckets) {
          for (const [code, b] of Object.entries(r.buckets)) {
            aoa.push(['', '', '', '', '', code, '', '', '', b.count, b.amount]);
            if (showItems) b.items.forEach(it => aoa.push(['', '', '', '', '', '', it.slipNo, it.patientName, '', '', it.amount]));
          }
        }
      }
      if (total) aoa.push(['TOTAL OF ADMISSION', total.admissions, '', '', '', '', '', '', 'TOTAL OF SLIP', total.slipCount, total.amount]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AdmissionWise');
    XLSX.writeFile(wb, `admission_wise_${fromDate}_${toDate}.xlsx`);
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
        <div className="ddp-report-page" id="awr-printable">
          <div className="ddp-print-header">
            <h1>Admission Wise Report</h1>
            <p>Date &amp; Time: {printedAtStr} | Printed By: {printedBy}</p>
            <p>{fmtDate(fromDate)} to {fmtDate(toDate)}</p>
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && rows.length === 0 && <div className="ddp-empty">No records found for the selected filters.</div>}

          {!loading && rows.length > 0 && isSummary && total && (
            <table className="ddp-table">
              <thead>
                <tr>
                  <th>Patient Type</th>
                  <th className="num">Admissions</th>
                  <th className="num">Slips</th>
                  <th className="num">Amount</th>
                  {bucketCodes.map(c => <th className="num" key={c}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(total.byPatientType).map(([pt, v]) => (
                  <tr key={pt}>
                    <td>{PAT_TYPE_LABEL[pt] || pt}</td>
                    <td className="td-num">{v.admissions}</td>
                    <td className="td-num">{v.slipCount}</td>
                    <td className="td-num">{fmtNum(v.amount)}</td>
                    {bucketCodes.map(c => <td className="td-num" key={c}>{v.buckets[c] ? fmtNum(v.buckets[c].amount) : ''}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="ddp-total-row">
                  <td>TOTAL</td>
                  <td className="td-num">{total.admissions}</td>
                  <td className="td-num">{total.slipCount}</td>
                  <td className="td-num">{fmtNum(total.amount)}</td>
                  {bucketCodes.map(c => {
                    const sum = Object.values(total.byPatientType).reduce((s, v) => s + (v.buckets[c]?.amount || 0), 0);
                    return <td className="td-num" key={c}>{sum ? fmtNum(sum) : ''}</td>;
                  })}
                </tr>
              </tfoot>
            </table>
          )}

          {!loading && rows.length > 0 && !isSummary && (
            <table className="ddp-table">
              <thead>
                <tr>
                  <th>Admit Number &amp; Patient Name</th>
                  <th>MR#</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Phone</th>
                  <th>Pat.Type</th>
                  <th>Status</th>
                  <th>Admit Date</th>
                  <th>Dis Date</th>
                  <th className="num">Slip</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <Fragment key={r.admissionNo}>
                    <tr className="ddp-doc-row">
                      <td>{r.admissionNo} - {r.patientName}</td>
                      <td>{r.mrNo || '—'}</td>
                      <td>{r.age}</td>
                      <td>{r.gender}</td>
                      <td>{r.phoneNo || '—'}</td>
                      <td>{PAT_TYPE_LABEL[r.patientType] || r.patientType}</td>
                      <td>{r.status}</td>
                      <td>{fmtDate(r.admitDate)}</td>
                      <td>{fmtDate(r.disDate)}</td>
                      <td className="td-num">{r.slipCount}</td>
                      <td className="td-num">{fmtNum(r.amount)}</td>
                    </tr>
                    {showBuckets && Object.entries(r.buckets).map(([code, b]) => (
                      <Fragment key={`${r.admissionNo}-${code}`}>
                        <tr className="ddp-bucket-row">
                          <td colSpan={9}>{code}</td>
                          <td className="td-num">{b.count}</td>
                          <td className="td-num">{fmtNum(b.amount)}</td>
                        </tr>
                        {showItems && b.items.map((it, i) => (
                          <tr className="ddp-detail-row" key={`${r.admissionNo}-${code}-${i}`}>
                            <td colSpan={9}>{it.slipNo} - {it.patientName}</td>
                            <td></td>
                            <td className="td-num">{fmtNum(it.amount)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              {total && (
                <tfoot>
                  <tr className="ddp-total-row">
                    <td colSpan={9}>TOTAL OF ADMISSION: {total.admissions}</td>
                    <td className="td-num">{total.slipCount}</td>
                    <td className="td-num">{fmtNum(total.amount)}</td>
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
