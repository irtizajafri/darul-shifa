import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import { numberToWords } from '../receiptUtils';
import './DepartmentDoctorPerformanceReport.scss';
import './StatementOfSurgeryReport.scss';

const API = 'http://localhost:5001/api/clinic';

const fmtDateShort = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StatementOfSurgeryReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const doctorFromCode = params.get('doctorFromCode') || '';
  const doctorToCode   = params.get('doctorToCode') || '';
  const fromDate = params.get('fromDate') || '';
  const toDate   = params.get('toDate') || '';
  const fromTime = params.get('fromTime') || '';
  const toTime   = params.get('toTime') || '';
  const patientType = params.get('patientType') || 'cash';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ doctorFromCode, doctorToCode, fromDate, toDate, fromTime, toTime, patientType });
      const res = await fetch(`${API}/reports/statement-of-surgery?${q}`).then(r => r.json());
      setData(res.data || null);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const reportTitle = 'Statement of Consultant for Indoor Files';

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('sos-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>${reportTitle}</title>
      <style>
        @page{size:portrait;margin:10mm;}
        *{box-sizing:border-box;}
        body{font-family:Arial,sans-serif;font-size:10px;margin:0;padding:0;}
        .sos-doc-block{page-break-after:always;padding:6px 4px;}
        .sos-doc-block:last-child{page-break-after:auto;}
        table{width:100%;border-collapse:collapse;font-size:9.5px;}
        th{border-bottom:1px solid #000;padding:3px 5px;text-align:left;}
        th.num{text-align:right;}
        td{padding:2px 5px;}
        .td-num{text-align:right;}
        .sos-title{text-align:center;font-weight:700;font-size:12px;text-decoration:underline;margin-bottom:10px;}
        .sos-doc-name{font-weight:700;font-size:11px;border-bottom:3px double #000;padding-bottom:3px;margin-bottom:6px;}
        .sos-period{display:flex;justify-content:space-between;border-bottom:1px solid #000;padding-bottom:4px;margin-bottom:2px;}
        .sos-group-row td{font-weight:700;border-top:1px solid #999;padding-top:6px;}
        .sos-footer-row td{font-weight:700;border-top:1px solid #000;padding-top:5px;}
        .sos-words{margin-top:6px;font-size:9.5px;}
        .sos-sign-row{display:flex;justify-content:space-between;margin-top:40px;text-align:center;}
        .sos-sign-block{width:30%;}
        .sos-sign-line{border-top:1px solid #000;padding-top:3px;font-size:9px;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    if (!data || !data.doctors.length) { toast.error('No data to export'); return; }
    const aoa = [[reportTitle], [`From: ${fmtDateShort(fromDate)}  To: ${fmtDateShort(toDate)}`], []];
    data.doctors.forEach((d) => {
      aoa.push([`${d.code} - ${d.name}`]);
      aoa.push(['Admit #', 'Pat Name', 'Surgery', 'Op. Date', 'Amount']);
      const emitRows = (rows) => rows.forEach((r) => aoa.push([r.admissionNo, r.patientName, r.surgery, fmtDateShort(r.opDate), r.amount]));
      if (patientType === 'panel') {
        (d.groups || []).forEach((g) => {
          aoa.push([`${g.code} ${g.name}`]);
          emitRows(g.rows);
          aoa.push(['', '', '', 'Total Patients', g.totalPatients, '', g.totalAmount]);
        });
      } else {
        emitRows(d.rows);
      }
      aoa.push(['', '', '', 'Total Patients', d.totalPatients, 'Total For Doctor', d.totalAmount]);
      aoa.push([]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'StatementOfSurgery');
    XLSX.writeFile(wb, `statement_of_surgery_${fromDate}_${toDate}.xlsx`);
  };

  const hasRows = data && data.doctors && data.doctors.length > 0;

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
        <div className="ddp-report-page sos-report-page" id="sos-printable">
          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !hasRows && <div className="ddp-empty">No records found for the selected filters.</div>}

          {!loading && hasRows && data.doctors.map((d) => (
            <div className="sos-doc-block" key={d.code}>
              <div className="sos-title">{reportTitle}</div>
              <div className="sos-doc-name">{d.code}&nbsp;&nbsp;&nbsp;{d.name}</div>
              <div className="sos-period">
                <span>From: {fmtDateShort(fromDate)}</span>
                <span>To: {fmtDateShort(toDate)}</span>
              </div>

              <table>
                <colgroup>
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '34%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '18%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Admit # PatName</th>
                    <th>Surgery</th>
                    <th>Op. Date</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {patientType === 'panel' ? (
                    (d.groups || []).map((g) => (
                      <Fragment key={g.code}>
                        <tr className="sos-group-row">
                          <td colSpan={4}>{g.code} {g.name}</td>
                        </tr>
                        {g.rows.map((r, i) => (
                          <tr key={i}>
                            <td>{r.admissionNo}&nbsp;&nbsp;{r.patientName}</td>
                            <td>{r.surgery}</td>
                            <td>{fmtDateShort(r.opDate)}</td>
                            <td className="td-num">{fmt2(r.amount)}</td>
                          </tr>
                        ))}
                        <tr className="sos-footer-row">
                          <td colSpan={2}>Total Patients: {g.totalPatients}</td>
                          <td colSpan={2} className="td-num">{fmt2(g.totalAmount)}</td>
                        </tr>
                      </Fragment>
                    ))
                  ) : (
                    d.rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.admissionNo}&nbsp;&nbsp;{r.patientName}</td>
                        <td>{r.surgery}</td>
                        <td>{fmtDateShort(r.opDate)}</td>
                        <td className="td-num">{fmt2(r.amount)}</td>
                      </tr>
                    ))
                  )}
                  <tr className="sos-footer-row">
                    <td colSpan={2}>Total Patients: {d.totalPatients}</td>
                    <td>Total For Doctor:</td>
                    <td className="td-num">{fmt2(d.totalAmount)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="sos-words">Rs. {numberToWords(d.totalAmount)}</div>

              <div className="sos-sign-row">
                <div className="sos-sign-block"><div className="sos-sign-line">Prepaid By</div></div>
                <div className="sos-sign-block"><div className="sos-sign-line">Administrator</div></div>
                <div className="sos-sign-block"><div className="sos-sign-line">Receiver</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
