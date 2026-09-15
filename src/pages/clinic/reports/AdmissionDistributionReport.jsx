import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './DepartmentDoctorPerformanceReport.scss';
import './AdmissionDistributionReport.scss';

const API = 'http://localhost:5001/api/clinic';

const STYLE_TITLE = {
  matrix: 'Admission Distribution Report',
  pageLayout: 'Admission Distribution Report',
  summary: 'Admission Summary',
  billHeadWise: 'Head Wise Admission Distribution Report',
};

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const fmtDateTime = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${fmtDate(d)} ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
};
const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function AdmissionDistributionReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuthStore();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const admissionFrom = params.get('admissionFrom') || '';
  const admissionTo = params.get('admissionTo') || '';
  const billHeadFromCode = params.get('billHeadFromCode') || '';
  const billHeadToCode = params.get('billHeadToCode') || '';
  const closingFrom = params.get('closingFrom') || '';
  const closingTo = params.get('closingTo') || '';
  const reportStyle = params.get('reportStyle') || 'pageLayout';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ admissionFrom, admissionTo, billHeadFromCode, billHeadToCode, closingFrom, closingTo, reportStyle });
      const res = await fetch(`${API}/reports/admission-distribution?${q}`).then(r => r.json());
      setData(res.data || null);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const reportTitle = STYLE_TITLE[reportStyle] || 'Admission Distribution Report';
  const printedBy = user?.name || user?.username || 'User';

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('adr-printable')?.innerHTML || '';
    const matrixCss = `
        table{border-collapse:collapse;border:1px solid #999;}
        th,td{border:1px solid #999;padding:3px 6px;white-space:nowrap;}
        th{background:#f2f2f2!important;text-align:center;text-transform:uppercase;font-size:8px;letter-spacing:.02em;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        td.td-num{text-align:right;}
        .adr-matrix-total-row td{font-weight:800;background:#f2f2f2!important;border-top:2px solid #000;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .adr-matrix-total-col{font-weight:700;}`;
    const otherCss = `
        table{width:100%;border-collapse:collapse;}
        th{border-bottom:1px solid #000;padding:3px 5px;text-align:left;}
        th.num{text-align:right;}
        td{padding:2px 5px;}
        .td-num{text-align:right;}
        .adr-adm-header td{font-weight:700;border-top:1px solid #000;padding-top:6px;}
        .adr-item-row td{padding-left:24px;color:#333;}
        .adr-group-row td{font-weight:700;background:#e8e2c8!important;border-top:1px solid #999;padding-top:5px;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .adr-group-footer td{border-top:1px solid #999;color:#333;padding-bottom:8px;}
        .adr-grand-row td{font-weight:800;border-top:2px solid #000;}`;
    win.document.write(`<!DOCTYPE html><html><head><title>${reportTitle}</title>
      <style>
        @page{size:${reportStyle === 'matrix' ? 'landscape' : 'portrait'};margin:8mm;}
        *{box-sizing:border-box;}
        body{font-family:Arial,sans-serif;font-size:9px;margin:0;padding:6px;}
        h1{font-size:12px;margin:0 0 6px;}
        ${reportStyle === 'matrix' ? matrixCss : otherCss}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    if (!data) { toast.error('No data to export'); return; }
    const aoa = [[reportTitle], []];
    if (reportStyle === 'summary') {
      aoa.push(['Admit #', 'DateTime', 'Adv Amount', 'Bill Amount', 'Discount']);
      data.rows.forEach(r => aoa.push([r.admissionNo, fmtDateTime(r.dateTime), r.advAmount, r.billAmount, r.discount]));
    } else if (reportStyle === 'billHeadWise') {
      data.groups.forEach(g => {
        aoa.push([g.description, '', '', '', g.headTotal]);
        g.rows.forEach(r => aoa.push([r.admissionNo, fmtDate(r.admitDate), fmtDate(r.closingDate), r.status, r.amount]));
        aoa.push(['# of Admission', g.count]);
        aoa.push([]);
      });
    } else if (reportStyle === 'matrix') {
      aoa.push(['Admit #', ...data.heads.map(h => h.description), 'Total']);
      data.rows.forEach(r => aoa.push([r.admissionNo, ...data.heads.map(h => r.cells[h.id] || ''), r.rowTotal]));
    } else {
      aoa.push(['Admit #', 'Admit Date', 'Closing Date', 'Status', 'Bill Amount']);
      data.admissions.forEach(a => {
        aoa.push([a.admissionNo, fmtDate(a.admitDate), fmtDate(a.closingDate), a.status, a.billAmount]);
        a.items.forEach(it => aoa.push(['', it.description, '', '', it.amount]));
      });
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AdmissionDistribution');
    XLSX.writeFile(wb, `admission_distribution_${reportStyle}.xlsx`);
  };

  const hasData = data && (
    (reportStyle === 'summary' && data.rows?.length) ||
    (reportStyle === 'billHeadWise' && data.groups?.length) ||
    (reportStyle === 'matrix' && data.rows?.length) ||
    (reportStyle === 'pageLayout' && data.admissions?.length)
  );

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
        <div className={`ddp-report-page adr-report-page adr-report-page--${reportStyle}`} id="adr-printable">
          <div className="adr-hdr">
            <div className="adr-hosp">Darul Shifa Hospital</div>
            <h1 className="adr-title">{reportTitle}</h1>
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !hasData && <div className="ddp-empty">No records found for the selected filters.</div>}

          {!loading && hasData && reportStyle === 'summary' && (
            <table className="ddp-table adr-table">
              <thead>
                <tr>
                  <th>Admitno</th>
                  <th>DateTime</th>
                  <th className="num">AdvAmount</th>
                  <th className="num">BillAmount</th>
                  <th className="num">Discount</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.admissionNo}</td>
                    <td>{fmtDateTime(r.dateTime)}</td>
                    <td className="td-num">{fmt2(r.advAmount)}</td>
                    <td className="td-num">{fmt2(r.billAmount)}</td>
                    <td className="td-num">{r.discount ? fmt2(r.discount) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && hasData && reportStyle === 'billHeadWise' && (
            <table className="ddp-table adr-table">
              <thead>
                <tr>
                  <th>Admit #</th>
                  <th>Admit. Date</th>
                  <th>Closing Date</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g) => (
                  <Fragment key={g.description}>
                    <tr className="adr-group-row">
                      <td colSpan={4}>{g.description}</td>
                      <td className="td-num">{fmt2(g.headTotal)}</td>
                    </tr>
                    {g.rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.admissionNo}</td>
                        <td>{fmtDate(r.admitDate)}</td>
                        <td>{fmtDate(r.closingDate)}</td>
                        <td>{r.status}</td>
                        <td className="td-num">{fmt2(r.amount)}</td>
                      </tr>
                    ))}
                    <tr className="adr-group-footer">
                      <td colSpan={5}># of Admission: {g.count}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}

          {!loading && hasData && reportStyle === 'matrix' && (
            <div className="adr-matrix-scroll">
              <table className="adr-matrix-table">
                <thead>
                  <tr>
                    <th>Admit #</th>
                    {data.heads.map(h => <th key={h.id}>{h.description}</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.admissionNo}>
                      <td>{r.admissionNo}</td>
                      {data.heads.map(h => <td className="td-num" key={h.id}>{r.cells[h.id] ? fmt2(r.cells[h.id]) : ''}</td>)}
                      <td className="td-num adr-matrix-total-col">{fmt2(r.rowTotal)}</td>
                    </tr>
                  ))}
                  <tr className="adr-matrix-total-row">
                    <td>TOTAL</td>
                    {data.heads.map(h => (
                      <td className="td-num" key={h.id}>
                        {fmt2(data.rows.reduce((s, r) => s + (r.cells[h.id] || 0), 0))}
                      </td>
                    ))}
                    <td className="td-num">{fmt2(data.rows.reduce((s, r) => s + r.rowTotal, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {!loading && hasData && reportStyle === 'pageLayout' && (
            <table className="ddp-table adr-table">
              <thead>
                <tr>
                  <th>Admit. #</th>
                  <th>Admit. Date</th>
                  <th>Closing Date</th>
                  <th>Status</th>
                  <th className="num">Bill Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.admissions.map((a) => (
                  <Fragment key={a.admissionNo}>
                    <tr className="adr-adm-header">
                      <td>{a.admissionNo}</td>
                      <td>{fmtDate(a.admitDate)}</td>
                      <td>{fmtDate(a.closingDate)}</td>
                      <td>{a.status}</td>
                      <td className="td-num">{fmt2(a.billAmount)}</td>
                    </tr>
                    {a.items.map((it, i) => (
                      <tr key={i} className="adr-item-row">
                        <td colSpan={4}>{it.description}</td>
                        <td className="td-num">{fmt2(it.amount)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}

          <div className="adr-footer">
            <span>{fmtDate(new Date())}</span>
            <span>Printed By: {printedBy}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
