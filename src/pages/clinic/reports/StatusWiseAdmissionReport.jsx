import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import './DepartmentDoctorPerformanceReport.scss';
import './StatusWiseAdmissionReport.scss';

const API = 'http://localhost:5001/api/clinic';

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const fmtDateTime = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return `${fmtDate(d)} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
};
const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function StatusWiseAdmissionReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const dateFrom = params.get('dateFrom') || '';
  const dateTo = params.get('dateTo') || '';
  const admissionFrom = params.get('admissionFrom') || '';
  const admissionTo = params.get('admissionTo') || '';
  const doctorFromCode = params.get('doctorFromCode') || '';
  const doctorToCode = params.get('doctorToCode') || '';
  const surgeryFromCode = params.get('surgeryFromCode') || '';
  const surgeryToCode = params.get('surgeryToCode') || '';
  const patientTypes = (params.get('patientTypes') || '').split(',').filter(Boolean);
  const admissionTypes = (params.get('admissionTypes') || '').split(',').filter(Boolean);
  const groupMode = params.get('groupMode') || 'normal';

  // The Bill Amount -> Provisional/Final split only applies for a Cash-only
  // selection, per explicit instruction — any other/mixed Patient Type keeps
  // the legacy single "Bill Amount" column (whichever bill stage applies).
  const cashOnly = patientTypes.length === 1 && patientTypes[0] === 'private';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        dateFrom, dateTo, admissionFrom, admissionTo,
        doctorFromCode, doctorToCode, surgeryFromCode, surgeryToCode,
        patientTypes: patientTypes.join(','), admissionTypes: admissionTypes.join(','), groupMode,
      });
      const res = await fetch(`${API}/reports/status-wise-admission?${q}`).then(r => r.json());
      setData(res.data || null);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const reportTitle = 'All Admission Status Wise';

  const billAmountOf = (r) => (r.status === 'Active' ? r.provisionalBillAmount : (r.finalBillAmount || r.provisionalBillAmount));

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('swa-printable')?.innerHTML || '';
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
        .swa-group-row td{font-weight:700;background:#eef2f8!important;border-top:1px solid #94a3b8;padding-top:5px;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .swa-group-total-row td{font-weight:700;border-top:1px solid #cbd5e1;}
        .swa-grand-row td{font-weight:800;border-top:2px solid #000;padding-top:6px;}
        h1{font-size:12px;margin:0 0 2px;text-transform:uppercase;letter-spacing:.04em;}
        p{font-size:9px;margin:0;color:#555;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const rowToAoa = (r) => cashOnly
    ? [r.admissionNo, fmtDateTime(r.admitDate), r.patientName, r.patStatus, r.preSNo, r.advance, r.provisionalBillAmount, r.finalBillAmount, r.discount, fmtDate(r.refundDisDate), r.status, fmtDateTime(r.lastUpdate)]
    : [r.admissionNo, fmtDateTime(r.admitDate), r.patientName, r.patStatus, r.preSNo, r.advance, billAmountOf(r), r.discount, fmtDate(r.refundDisDate), r.status, fmtDateTime(r.lastUpdate)];

  const handleExportExcel = () => {
    if (!data) { toast.error('No data to export'); return; }
    const header = cashOnly
      ? ['Admit #', 'Admit. Date', 'Patient Name', 'Pat. Status', 'Pre S. No', 'Advance', 'Provisional Bill Amount', 'Final Bill Amount', 'Discount', 'Refund Dis. Date', 'Status', 'Last Update']
      : ['Admit #', 'Admit. Date', 'Patient Name', 'Pat. Status', 'Pre S. No', 'Advance', 'Bill Amount', 'Discount', 'Refund Dis. Date', 'Status', 'Last Update'];
    const aoa = [[reportTitle], [`From: ${fmtDate(dateFrom)}  To: ${fmtDate(dateTo)}`], [], header];
    if (groupMode === 'group') {
      (data.groups || []).forEach((g) => {
        aoa.push([`${g.code} - ${g.name}`]);
        g.rows.forEach((r) => aoa.push(rowToAoa(r)));
      });
    } else {
      (data.rows || []).forEach((r) => aoa.push(rowToAoa(r)));
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'StatusWiseAdmission');
    XLSX.writeFile(wb, `status_wise_admission_${dateFrom}_${dateTo}.xlsx`);
  };

  const hasRows = data && ((groupMode === 'group' ? data.groups : data.rows) || []).length > 0;
  const colCount = cashOnly ? 12 : 11;

  const renderRow = (r, i) => (
    <tr key={i}>
      <td>{r.admissionNo}</td>
      <td>{fmtDateTime(r.admitDate)}</td>
      <td>{r.patientName}</td>
      <td>{r.patStatus}</td>
      <td>{r.preSNo}</td>
      <td className="td-num">{fmt2(r.advance)}</td>
      {cashOnly ? (
        <>
          <td className="td-num">{fmt2(r.provisionalBillAmount)}</td>
          <td className="td-num">{fmt2(r.finalBillAmount)}</td>
        </>
      ) : (
        <td className="td-num">{fmt2(billAmountOf(r))}</td>
      )}
      <td className="td-num">{r.discount ? fmt2(r.discount) : ''}</td>
      <td>{fmtDate(r.refundDisDate)}</td>
      <td>{r.status}</td>
      <td>{fmtDateTime(r.lastUpdate)}</td>
    </tr>
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
        <div className="ddp-report-page swa-report-page" id="swa-printable">
          <div className="ddp-print-header">
            <h1>{reportTitle}</h1>
            <p>{fmtDate(dateFrom)} to {fmtDate(dateTo)}</p>
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !hasRows && <div className="ddp-empty">No records found for the selected filters.</div>}

          {!loading && hasRows && (
            <table className="ddp-table swa-table">
              <thead>
                <tr>
                  <th>Admit #</th>
                  <th>Admit. Date</th>
                  <th>Patient Name</th>
                  <th>Pat. Status</th>
                  <th>Pre S. No</th>
                  <th className="num">Advance</th>
                  {cashOnly ? (
                    <>
                      <th className="num">Provisional Bill Amount</th>
                      <th className="num">Final Bill Amount</th>
                    </>
                  ) : (
                    <th className="num">Bill Amount</th>
                  )}
                  <th className="num">Discount</th>
                  <th>Refund Dis. Date</th>
                  <th>Status</th>
                  <th>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {groupMode === 'group' ? (
                  data.groups.map((g) => (
                    <Fragment key={g.code}>
                      <tr className="swa-group-row">
                        <td colSpan={colCount}>{g.code} - {g.name}</td>
                      </tr>
                      {g.rows.map((r, i) => renderRow(r, i))}
                      <tr className="swa-group-total-row">
                        <td colSpan={5}>Total ({g.rows.length})</td>
                        <td className="td-num">{fmt2(g.total.advance)}</td>
                        {cashOnly ? (
                          <>
                            <td className="td-num">{fmt2(g.total.provisionalBillAmount)}</td>
                            <td className="td-num">{fmt2(g.total.finalBillAmount)}</td>
                          </>
                        ) : (
                          <td className="td-num">{fmt2(g.total.provisionalBillAmount + g.total.finalBillAmount)}</td>
                        )}
                        <td className="td-num">{fmt2(g.total.discount)}</td>
                        <td></td><td></td><td></td>
                      </tr>
                    </Fragment>
                  ))
                ) : (
                  data.rows.map((r, i) => renderRow(r, i))
                )}
              </tbody>
              {data.grandTotal && (
                <tfoot>
                  <tr className="swa-grand-row">
                    <td colSpan={5}>GRAND TOTAL</td>
                    <td className="td-num">{fmt2(data.grandTotal.advance)}</td>
                    {cashOnly ? (
                      <>
                        <td className="td-num">{fmt2(data.grandTotal.provisionalBillAmount)}</td>
                        <td className="td-num">{fmt2(data.grandTotal.finalBillAmount)}</td>
                      </>
                    ) : (
                      <td className="td-num">{fmt2(data.grandTotal.provisionalBillAmount + data.grandTotal.finalBillAmount)}</td>
                    )}
                    <td className="td-num">{fmt2(data.grandTotal.discount)}</td>
                    <td></td><td></td><td></td>
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
