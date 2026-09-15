import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import './DepartmentDoctorPerformanceReport.scss';
import './DoctorScheduleReport.scss';

const API = 'http://localhost:5001/api/clinic';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${period}`;
};

export default function DoctorScheduleReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const doctorFromCode = params.get('doctorFromCode') || '';
  const doctorToCode = params.get('doctorToCode') || '';
  const deptFromCode = params.get('deptFromCode') || '';
  const deptToCode = params.get('deptToCode') || '';
  const activeOnly = params.get('activeOnly') || '0';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ doctorFromCode, doctorToCode, deptFromCode, deptToCode, activeOnly });
      const res = await fetch(`${API}/reports/doctor-schedule?${q}`).then(r => r.json());
      setData(res.data || null);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const reportTitle = 'Doctor Schedule Report';

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('dsr-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>${reportTitle}</title>
      <style>
        @page{size:landscape;margin:8mm;}
        *{box-sizing:border-box;}
        body{font-family:Arial,sans-serif;font-size:9.5px;margin:0;padding:8px;}
        h1{font-size:12px;margin:0 0 10px;}
        .dsr-doc-block{margin-bottom:14px;page-break-inside:avoid;}
        .dsr-doc-name{font-weight:700;font-size:11px;border-bottom:1px solid #000;padding-bottom:2px;margin-bottom:4px;}
        .dsr-doc-sub{font-size:9px;color:#555;margin-bottom:4px;}
        table{width:100%;border-collapse:collapse;font-size:9px;}
        th{border-bottom:1px solid #000;padding:3px 5px;text-align:left;}
        th.day{text-align:center;width:26px;}
        td{padding:2.5px 5px;border-bottom:1px solid #eee;}
        td.day{text-align:center;}
        .dsr-tick{color:#0a7a2a;font-weight:800;}
        .dsr-oncall{color:#b45309;font-weight:600;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    if (!data || !data.doctors.length) { toast.error('No data to export'); return; }
    const aoa = [[reportTitle], []];
    data.doctors.forEach((doc) => {
      aoa.push([`${doc.code} - ${doc.name}`, doc.speciality || '', doc.staffCategory || '']);
      aoa.push(['Department', 'Sub-Department', ...DAYS, 'From', 'To', 'On Call']);
      doc.schedules.forEach((s) => {
        aoa.push([s.department, s.subDept, ...DAYS.map(d => (s.days.includes(d) ? 'Y' : '')), s.fromTime || '', s.toTime || '', s.onCall ? 'Y' : '']);
      });
      aoa.push([]);
    });
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DoctorSchedule');
    XLSX.writeFile(wb, `doctor_schedule.xlsx`);
  };

  const hasData = data && data.doctors && data.doctors.length > 0;

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
        <div className="ddp-report-page dsr-report-page" id="dsr-printable">
          <div className="ddp-print-header">
            <h1>{reportTitle}</h1>
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !hasData && <div className="ddp-empty">No records found for the selected filters.</div>}

          {!loading && hasData && data.doctors.map((doc) => (
            <div key={doc.code} className="dsr-doc-block">
              <div className="dsr-doc-name">{doc.code} — {doc.name}</div>
              <div className="dsr-doc-sub">
                {[doc.speciality, doc.staffCategory].filter(Boolean).join(' · ') || ' '}
                {doc.status !== 'active' && <span className="dsr-inactive"> (Inactive)</span>}
              </div>
              <table className="dsr-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Sub-Department</th>
                    {DAYS.map(d => <th key={d} className="day">{d}</th>)}
                    <th>Time</th>
                    <th>On Call</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.schedules.map((s, i) => (
                    <tr key={i}>
                      <td>{s.department}</td>
                      <td>{s.subDept}</td>
                      {DAYS.map(d => (
                        <td key={d} className="day">{s.days.includes(d) ? <span className="dsr-tick">✓</span> : ''}</td>
                      ))}
                      <td>{s.fromTime || s.toTime ? `${fmtTime(s.fromTime)} – ${fmtTime(s.toTime)}` : ''}</td>
                      <td>{s.onCall && <span className="dsr-oncall">On Call</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
