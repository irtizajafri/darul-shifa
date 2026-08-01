import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './DepartmentPatientsReport.scss';

const API = 'http://localhost:5001/api/clinic';
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const DEPT_CODE = {
  'General OPD': 'GOPD', 'Consultant OPD': 'COPD', 'Emergency': 'EMR',
  'Laboratory': 'LAB', 'Miscellaneous': 'MISC',
  'Ultra Sound, Echo & Color Doppler': 'US', 'Radiology': 'XRAY',
  'Dental OPD': 'DENTAL', 'Therapy': 'THERAPY', 'Blood Bank': 'BB',
  'Ambulance': 'AMB', 'Admission': 'ADMIT',
};
const PT_LABEL = {
  cash: { code: 'C', label: 'Cash Transaction' },
  private: { code: 'C', label: 'Cash Transaction' },
  panel: { code: 'P', label: 'Panel Transaction' },
  staff: { code: 'S', label: 'Staff Transaction' },
  cc: { code: 'CC', label: 'CC Transaction' },
  complementary: { code: 'K', label: 'Complementary Transaction' },
  jazzcash: { code: 'J', label: 'JazzCash Transaction' },
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS_SHORT[dt.getMonth()]}-${dt.getFullYear()}`;
};
const fmtNum = (n) => Number(n || 0).toFixed(2);

export default function UserDateSummaryReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const userId = params.get('userId') || '';
  const date   = params.get('date') || '';
  const shift  = params.get('shift') || 'ALL';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ userId, date, shift });
      const res = await fetch(`${API}/reports/user-date-summary?${q}`).then(r => r.json());
      if (!res.ok) { toast.error(res.message || 'Failed to load'); setData(null); return; }
      setData(res.data);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const printedBy = user?.name || user?.username || 'User';
  const dateObj = date ? new Date(date + 'T00:00:00') : null;
  const dayName = dateObj ? DAYS[dateObj.getDay()] : '';

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('uds-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>Date wise Summary</title>
      <style>
        *{box-sizing:border-box;}
        body{font-family:Tahoma,sans-serif;font-size:11px;margin:0;padding:12px;}
        table{width:100%;border-collapse:collapse;font-size:10px;}
        td{padding:3px 6px;}
        .td-num{text-align:right;}
        .uds-pt-row td{background:#e2e2e2!important;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .uds-total-row td{font-weight:700;border-top:1px solid #333;}
        h1{font-size:13px;margin:0 0 4px;}
        .uds-sign{display:flex;justify-content:space-between;margin-top:40px;font-size:10px;}
        .uds-sign div{width:45%;border-top:1px solid #333;padding-top:4px;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    if (!data) return;
    const aoa = [['Department wise Summary'], [`User: ${data.userName}`], [`Date: ${fmtDate(date)} (${dayName})`], [`Shift: ${data.shiftUsed || shift}`], []];
    aoa.push(['Departments', 'Number of Patients', 'Amount']);
    for (const g of data.groups) {
      const pt = PT_LABEL[g.paymentType] || { code: g.paymentType, label: `${g.paymentType} Transaction` };
      aoa.push([`${pt.code}  ${pt.label}`, '', '']);
      g.depts.forEach(d => aoa.push([`${DEPT_CODE[d.dept] || ''}  ${d.dept}`, d.count, d.amount]));
      aoa.push(['', g.total.count, g.total.amount]);
      aoa.push([]);
    }
    aoa.push(['GRAND TOTAL', data.grandTotal.count, data.grandTotal.amount]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'UserDateSummary');
    XLSX.writeFile(wb, `user_date_summary_${date}.xlsx`);
  };

  return (
    <div className="dpr-page">
      <div className="dpr-toolbar no-print">
        <div className="dpr-toolbar-left">
          <button className="dpr-tool-btn" onClick={() => navigate(-1)}><ArrowLeft size={14}/> <span>Back</span></button>
          <div className="dpr-tool-sep"/>
          <button className="dpr-tool-btn" onClick={handlePrint}><Printer size={14}/> <span>Print / PDF</span></button>
          <button className="dpr-tool-btn" onClick={handleExportExcel}><FileDown size={14}/> <span>Export Excel</span></button>
          <div className="dpr-tool-sep"/>
          <button className="dpr-tool-btn" onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'dpr-spin' : ''}/> <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="dpr-report-area">
        <div className="dpr-report-page" id="uds-printable">
          {loading && <div className="dpr-empty">Loading data…</div>}
          {!loading && !data && <div className="dpr-empty">No data found.</div>}

          {!loading && data && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <h1 style={{ margin: 0, fontSize: '1rem' }}>Department wise Summary</h1>
                <span style={{ fontSize: '0.8rem' }}>User: <strong>{data.userName}</strong></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', borderBottom: '1px solid #333', paddingBottom: 4, marginBottom: 8 }}>
                <span>Date: <strong>{fmtDate(date)}</strong> &nbsp; {dayName}</span>
                <span>Shift: <strong>{data.shiftUsed || shift}</strong></span>
              </div>

              {data.groups.length === 0 && <div className="dpr-empty">Is user/date/shift ke liye koi record nahi mila.</div>}

              {data.groups.length > 0 && (
                <table className="dpr-table">
                  <thead>
                    <tr><th>Departments</th><th className="num">Number of Patients</th><th className="num">Amount</th></tr>
                  </thead>
                  <tbody>
                    {data.groups.map(g => {
                      const pt = PT_LABEL[g.paymentType] || { code: g.paymentType, label: `${g.paymentType} Transaction` };
                      return (
                        <Fragment key={g.paymentType}>
                          <tr className="uds-pt-row dpr-doc-row">
                            <td>{pt.code} &nbsp; <em>{pt.label}</em></td>
                            <td colSpan={2} style={{ textAlign: 'right' }}>{printedBy}</td>
                          </tr>
                          {g.depts.map(d => (
                            <tr key={d.dept}>
                              <td style={{ paddingLeft: 20 }}>{DEPT_CODE[d.dept] || ''} &nbsp; {d.dept.toUpperCase()}</td>
                              <td className="td-num">{d.count}</td>
                              <td className="td-num">{fmtNum(d.amount)}</td>
                            </tr>
                          ))}
                          <tr className="uds-total-row">
                            <td></td>
                            <td className="td-num">{g.total.count}</td>
                            <td className="td-num">{fmtNum(g.total.amount)}</td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <div className="uds-sign" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, fontSize: '0.75rem' }}>
                <div style={{ width: '45%', borderTop: '1px solid #333', paddingTop: 4 }}>Prepaid By</div>
                <div style={{ width: '45%', borderTop: '1px solid #333', paddingTop: 4 }}>Checked By</div>
              </div>
              <div className="uds-sign" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, fontSize: '0.75rem' }}>
                <div style={{ width: '45%', borderTop: '1px solid #333', paddingTop: 4 }}>Received By</div>
                <div style={{ width: '45%', borderTop: '1px solid #333', paddingTop: 4 }}>Accountant</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
