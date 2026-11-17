import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import ReportToolbar from '../../../components/reports/ReportToolbar';
import { REPORT_PRINT_FONT_CSS, REPORT_PRINT_TIGHT8_CSS } from '../../../components/reports/reportFont';
import { openPrintWindow } from '../../../utils/printRelay';
import { API_BASE_URL } from '../../../config';
import '../reports/DepartmentDoctorPerformanceReport.scss';
import './PatientSearch.scss';

// Clinic → Inquiries → Patient Search — the result (owner, 2026-11-17).
// One row per visit: Clinic slip, Antenatal, Admission file or Excel
// Patients List slip. Printed on A4 portrait in Arial 8pt (owner): the
// columns have fixed widths (mm) and long text wraps, so all 13 fit.

const API = `${API_BASE_URL}/api/clinic`;
const PKT = 'Asia/Karachi';
const fmtDate = (iso) => (iso ? iso.split('-').reverse().join('-') : '');
const fmtDateTime = (d) => {
  if (!d) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: PKT, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(d)).map((x) => [x.type, x.value]));
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
};
// Column widths in mm — 194mm = A4 (210) less 8mm margins each side.
const COLS = [
  ['#', 7], ['Date / Time', 17], ['Slip #', 13], ['Adm #', 12], ['MR #', 9], ['Patient Name', 26], ['Age / Sex', 11],
  ['Phone #', 19], ['Department', 20], ['Sub Dep.', 16], ['Doctor', 17], ['Patient Type', 12], ['Amount', 15],
];
// "Complementary" doesn't fit the 12mm column; the old screens say "Complem.".
const typeShort = (t) => (t === 'Complementary' ? 'Complem.' : t);
const fmtDay = (d) => fmtDateTime(d).slice(0, 10);
const fmtTime = (d) => fmtDateTime(d).slice(11);
const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const ageSex = (r) => [r.age, cap(r.gender)].filter(Boolean).join(' / ');

export default function PatientSearchReport() {
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const query = params.toString();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/inquiries/patient-search?${query}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Search failed');
      setData(j.data || null);
    } catch (e) {
      toast.error(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Reload when the filter changes, even if this page is already open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [query]);

  const title = 'Patient Search';
  const f = data?.filters;
  const criteria = f ? [
    `${fmtDate(f.fromDate)} to ${fmtDate(f.toDate)}`,
    f.name && `Name: ${f.name}`,
    f.phone && `Phone: ${f.phone}`,
    f.sex !== 'both' && `Sex: ${cap(f.sex)}`,
    f.department && `Department: ${f.department}`,
    f.subDept && `Sub Dep.: ${f.subDept}`,
    `Patient Type: ${f.patientType}`,
  ].filter(Boolean).join('  ·  ') : '';

  const handlePrint = () => {
    const win = openPrintWindow();
    const content = document.getElementById('psr-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        @page{size:A4 portrait;margin:8mm;}
        *{box-sizing:border-box;}
        html,body{width:194mm;}
        body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;}
        .ddp-print-header{text-align:center;margin-bottom:3mm;}
        h1{text-transform:uppercase;font-weight:700;}
        .psr-criteria{margin:1mm 0 0 !important;}
        table{width:194mm;border-collapse:collapse;table-layout:fixed;}
        th,td{white-space:normal !important;overflow-wrap:break-word;vertical-align:top;text-align:left;}
        .psr-nowrap{white-space:nowrap !important;}
        th{border-bottom:1px solid #000;}
        td{border-bottom:1px solid #ccc;}
        th.num,.td-num{text-align:right !important;}
        thead{display:table-header-group;}
        tfoot{display:table-row-group;}
        tr{page-break-inside:avoid;break-inside:avoid;}
        .psr-source{font-style:italic;}
        .psr-total-row td{font-weight:700;border-top:1px solid #000;border-bottom:none;}
        ${REPORT_PRINT_FONT_CSS}
        ${REPORT_PRINT_TIGHT8_CSS}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    if (!data?.rows?.length) { toast.error('No data to export'); return; }
    const aoa = [[title], [criteria], [],
      ['#', 'Date / Time', 'Slip #', 'Adm #', 'MR #', 'Patient Name', 'Age / Sex', 'Phone #', 'Department', 'Sub Dep.', 'Doctor', 'Patient Type', 'Amount', 'From']];
    data.rows.forEach((r, i) => aoa.push([i + 1, fmtDateTime(r.at), r.slipNo || '', r.admitNo || '', r.mrNo ?? '', r.patientName, ageSex(r), r.phone, r.department, r.subDept, r.doctor, r.patientType, r.amount, r.source]));
    aoa.push(['', `Total: ${data.total.patients} patient(s)`, '', '', '', '', '', '', '', '', '', '', data.total.amount]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PatientSearch');
    XLSX.writeFile(wb, `patient_search_${f?.fromDate || ''}_${f?.toDate || ''}.xlsx`);
  };

  const rows = data?.rows || [];

  return (
    <div className="ddp-page">
      <ReportToolbar onPrint={handlePrint} onExport={handleExportExcel} onRefresh={fetchData} refreshing={loading} />

      <div className="ddp-report-area">
        <div className="ddp-report-page psr-report-page psr-a4" id="psr-printable">
          <div className="ddp-print-header">
            <h1>{title}</h1>
            {criteria && <p className="psr-criteria">{criteria}</p>}
          </div>

          {loading && <div className="ddp-empty">Loading data…</div>}
          {!loading && !rows.length && <div className="ddp-empty">No patients found for the selected criteria.</div>}

          {!loading && rows.length > 0 && (
            <table className="ddp-table psr-table">
              <colgroup>
                {COLS.map(([label, mm]) => <col key={label} style={{ width: `${mm}mm` }} />)}
              </colgroup>
              <thead>
                <tr>
                  {COLS.map(([label]) => <th key={label} className={label === 'Amount' ? 'num' : undefined}>{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    <td className="psr-nowrap">{i + 1}</td>
                    <td className="psr-nowrap">{fmtDay(r.at)}<br />{fmtTime(r.at)}</td>
                    <td className="psr-nowrap">{r.slipNo || ''}</td>
                    <td className="psr-nowrap">{r.admitNo || ''}</td>
                    <td className="psr-nowrap">{r.mrNo ?? ''}</td>
                    <td>{r.patientName}<div className="psr-source">{r.source}</div></td>
                    <td>{ageSex(r)}</td>
                    <td className="psr-nowrap">{r.phone}</td>
                    <td>{r.department}</td>
                    <td>{r.subDept}</td>
                    <td>{r.doctor}</td>
                    <td>{typeShort(r.patientType)}</td>
                    <td className="td-num psr-nowrap">{fmt2(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="psr-total-row">
                  <td colSpan={12}>TOTAL ({data.total.patients} Patient{data.total.patients === 1 ? '' : 's'})</td>
                  <td className="td-num">{fmt2(data.total.amount)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
