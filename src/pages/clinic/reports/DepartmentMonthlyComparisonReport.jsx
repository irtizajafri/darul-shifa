import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import './DepartmentMonthlyComparisonReport.scss';

const API = 'http://localhost:5001/api/clinic';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]}, ${y}`;
};

export default function DepartmentMonthlyComparisonReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const deptFromCode = params.get('deptFromCode') || '';
  const deptToCode = params.get('deptToCode') || '';
  const months = (params.get('months') || '').split(',').filter(Boolean);

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ deptFromCode, deptToCode, months: months.join(',') });
      const res = await fetch(`${API}/reports/department-monthly-comparison?${q}`).then(r => r.json());
      setData(res.data || null);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('dmr-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>Department wise Monthly Comparison</title>
      <style>
        @page{size:landscape;margin:10mm;}
        *{box-sizing:border-box;}
        body{font-family:Arial,sans-serif;font-size:10px;color:#000;padding:6px;}
        h2{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin:0 0 10px;}
        table{border-collapse:collapse;border:1px solid #999;}
        th,td{border:1px solid #999;padding:4px 8px;white-space:nowrap;}
        th{background:#f2f2f2!important;font-size:9.5px;font-weight:700;text-transform:uppercase;text-align:center;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        td{font-size:9.5px;text-align:right;}
        td.name-cell{text-align:left;font-weight:600;}
        tr.total-row td{font-weight:800;background:#f2f2f2!important;border-top:2px solid #000;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        td.grand-cell{font-weight:800;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    if (!data || !data.departments.length) { toast.error('No data to export'); return; }
    const aoa = [['Department wise Monthly Comparison'], []];
    aoa.push(['Department', ...months.map(monthLabel), 'Total']);
    data.departments.forEach(d => aoa.push([d.name, ...months.map(m => d.cells[m]), d.rowTotal]));
    aoa.push(['TOTAL', ...months.map(m => data.columnTotals[m]), data.grandTotal]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DeptMonthlyComparison');
    XLSX.writeFile(wb, `department_monthly_comparison.xlsx`);
  };

  const hasData = data && data.departments && data.departments.length > 0;

  return (
    <div className="dmr-page">
      <div className="dmr-toolbar no-print">
        <button className="dmr-tool-btn" onClick={() => navigate(-1)}><ArrowLeft size={14}/> <span>Back</span></button>
        <div className="dmr-tool-sep"/>
        <button className="dmr-tool-btn" onClick={handlePrint}><Printer size={14}/> <span>Print / PDF</span></button>
        <button className="dmr-tool-btn" onClick={handleExportExcel}><FileDown size={14}/> <span>Export Excel</span></button>
        <div className="dmr-tool-sep"/>
        <button className="dmr-tool-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'dmr-spin' : ''}/> <span>Refresh</span>
        </button>
      </div>

      <div className="dmr-area">
        <div className="dmr-sheet" id="dmr-printable">
          <h2>Department wise Monthly Comparison</h2>

          {loading && <div className="dmr-empty">Loading data…</div>}
          {!loading && !hasData && <div className="dmr-empty">No records found for the selected filters.</div>}

          {!loading && hasData && (
            <div className="dmr-scroll">
              <table className="dmr-matrix">
                <thead>
                  <tr>
                    <th>Department</th>
                    {months.map(m => <th key={m}>{monthLabel(m)}</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.departments.map(d => (
                    <tr key={d.id}>
                      <td className="name-cell">{d.name}</td>
                      {months.map(m => <td key={m}>{d.cells[m] || ''}</td>)}
                      <td className="grand-cell">{d.rowTotal}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td className="name-cell">TOTAL</td>
                    {months.map(m => <td key={m}>{data.columnTotals[m]}</td>)}
                    <td className="grand-cell">{data.grandTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
