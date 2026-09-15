import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './DepartmentDoctorPerformanceReport.scss';
import './WardWiseBillReport.scss';

const API = 'http://localhost:5001/api/clinic';

const PAT_TYPE_LABEL = { private: 'Cash', staff: 'Staff', panel: 'Panel', complementary: 'Complimentary' };

const fmtDateShort = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const fmtDateTime = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${fmtDateShort(d)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
};
const fmtProduced = (d) => {
  const dt = new Date(d);
  const date = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
  const time = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  return `${date} AT ${time}`;
};
const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WardWiseBillReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuthStore();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const billType     = params.get('billType') || 'provisional';
  const withSummary   = params.get('withSummary') !== '0';
  const patientTypes  = params.get('patientTypes') || 'ALL';
  const dateMode      = params.get('dateMode') || 'discharge';
  const fromDate      = params.get('fromDate') || '';
  const toDate        = params.get('toDate') || '';
  const ward          = params.get('ward') || 'ALL';
  const billHeads     = params.get('billHeads') || 'ALL';
  const consultants   = params.get('consultants') || 'ALL';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        billType, withSummary: withSummary ? '1' : '0', patientTypes, dateMode,
        fromDate, toDate, ward, billHeads, consultants,
      });
      const res = await fetch(`${API}/reports/ward-wise-bill?${q}`).then(r => r.json());
      setData(res.data || null);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const printedBy = user?.name || user?.username || 'User';
  const reportTitle = billType === 'final' ? 'Ward Wise Final Bill Report' : 'Ward Wise Provisional Bill Report';

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('wwb-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>${reportTitle}</title>
      <style>
        @page{size:landscape;margin:8mm;}
        *{box-sizing:border-box;}
        body{font-family:Arial,sans-serif;font-size:9px;margin:0;padding:10px;}
        table{width:100%;border-collapse:collapse;font-size:8.5px;table-layout:fixed;}
        th,td{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        th{background:#1a3c6e!important;color:#fff!important;padding:3px 5px;text-align:left;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        th.num{text-align:right;}
        td{padding:2px 5px;border-bottom:1px solid #ddd;}
        .td-num{text-align:right;}
        .wwb-ward-row td{font-weight:700;text-decoration:underline;border-top:1px solid #999;padding-top:6px;}
        .wwb-head-row td{padding-left:20px;}
        .wwb-detail-row td{padding-left:34px;color:#334155;font-size:7.5px;}
        .wwb-grand-row td{font-weight:800;border-top:2px solid #000;padding-top:6px;}
        h1{font-size:12px;margin:0 0 2px;text-transform:uppercase;letter-spacing:.04em;}
        p{font-size:9px;margin:0;color:#555;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    if (!data || !data.wards.length) { toast.error('No data to export'); return; }
    const aoa = [[reportTitle], [`From: ${fmtDateShort(fromDate)}  To: ${fmtDateShort(toDate)}`], []];
    aoa.push(['Admit No', 'Slip No', 'Date/Time', 'Patient Name', 'Consultant Name', 'Pat. type', 'Rate', 'Qty', 'Total Amount', 'Discount', 'Amount']);
    data.wards.forEach((w) => {
      aoa.push([`${w.name}${w.code ? ' - ' + w.code : ''}`, '', '', '', '', '', '', '', w.totalAmount, w.discount, w.amount]);
      w.heads.forEach((h) => {
        aoa.push(['', `  ${h.description}${h.headCode ? ' - ' + h.headCode : ''}`, '', '', '', '', '', h.qty, h.totalAmount, h.discount, h.amount]);
        if (!withSummary) {
          h.lines.forEach((l) => {
            aoa.push([l.admissionNo, l.slipNo, fmtDateTime(l.date), l.patientName, l.consultantName, PAT_TYPE_LABEL[l.patientType] || l.patientType, l.rate, l.qty, l.totalAmount, l.discount, l.amount]);
          });
        }
      });
    });
    aoa.push([]);
    aoa.push(['TOTAL WARD', '', '', '', '', '', '', '', data.grandTotal.totalAmount, data.grandTotal.discount, data.grandTotal.amount]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'WardWiseBill');
    XLSX.writeFile(wb, `ward_wise_bill_${fromDate}_${toDate}.xlsx`);
  };

  const hasRows = data && data.wards && data.wards.length > 0;

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
        <div className="ddp-report-page wwb-report-page" id="wwb-printable">
          <div className="wwb-print-header">
            <div className="wwb-hospital-name">Darul Shifa Hospital</div>
            <h1 className="wwb-title">{reportTitle}</h1>
            <p className="wwb-period">From : {fmtDateShort(fromDate)}  To : {fmtDateShort(toDate)}</p>
            <p className="wwb-produced">Produced On : {fmtProduced(new Date())}</p>
            <p className="wwb-printed-by">Printed By: {printedBy}</p>
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !hasRows && <div className="ddp-empty">No records found for the selected filters.</div>}

          {!loading && hasRows && (
            <table className="ddp-table wwb-table">
              <colgroup>
                <col style={{ width: '9%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '6%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Admit No</th>
                  <th>Slip NO</th>
                  <th>Date / Time</th>
                  <th>Patient Name</th>
                  <th>Consultant Name</th>
                  <th>Pat. type</th>
                  <th className="num">Rate</th>
                  <th className="num">Qty</th>
                  <th className="num">Total Amount</th>
                  <th className="num">Discount</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.wards.map((w) => (
                  <Fragment key={`w-${w.id}`}>
                    <tr className="wwb-ward-row">
                      <td colSpan={8}>{w.name}{w.code ? ` - ${w.code}` : ''}</td>
                      <td className="td-num">{fmt2(w.totalAmount)}</td>
                      <td className="td-num">{fmt2(w.discount)}</td>
                      <td className="td-num">{fmt2(w.amount)}</td>
                    </tr>
                    {w.heads.map((h) => (
                      <Fragment key={`h-${w.id}-${h.id}`}>
                        <tr className="wwb-head-row">
                          <td colSpan={7}>{h.description}{h.headCode ? ` - ${h.headCode}` : ''}</td>
                          <td className="td-num">{h.qty}</td>
                          <td className="td-num">{fmt2(h.totalAmount)}</td>
                          <td className="td-num">{fmt2(h.discount)}</td>
                          <td className="td-num">{fmt2(h.amount)}</td>
                        </tr>
                        {!withSummary && h.lines.map((l, i) => (
                          <tr key={`l-${w.id}-${h.id}-${i}`} className="wwb-detail-row">
                            <td>{l.admissionNo}</td>
                            <td>{l.slipNo}</td>
                            <td>{fmtDateTime(l.date)}</td>
                            <td>{l.patientName}</td>
                            <td>{l.consultantName}</td>
                            <td>{PAT_TYPE_LABEL[l.patientType] || l.patientType}</td>
                            <td className="td-num">{fmt2(l.rate)}</td>
                            <td className="td-num">{l.qty}</td>
                            <td className="td-num">{fmt2(l.totalAmount)}</td>
                            <td className="td-num">{fmt2(l.discount)}</td>
                            <td className="td-num">{fmt2(l.amount)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="wwb-grand-row">
                  <td colSpan={8}>TOTAL WARD :</td>
                  <td className="td-num">{fmt2(data.grandTotal.totalAmount)}</td>
                  <td className="td-num">{fmt2(data.grandTotal.discount)}</td>
                  <td className="td-num">{fmt2(data.grandTotal.amount)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
