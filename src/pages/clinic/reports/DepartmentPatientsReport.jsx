import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './DepartmentPatientsReport.scss';

const API = 'http://localhost:5001/api/clinic';
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const DEPT_CODE = {
  'General OPD': 'GOPD', 'Consultant OPD': 'COPD', 'Emergency': 'EMR',
  'Laboratory': 'LAB', 'Miscellaneous': 'MISC',
  'Ultra Sound, Echo & Color Doppler': 'US', 'Radiology': 'XRAY',
  'Dental OPD': 'DENTAL', 'Therapy': 'THERAPY', 'Blood Bank': 'BB',
  'Ambulance': 'AMB', 'Admission': 'ADMIT',
};

function canonicalDept(raw) {
  const u = (raw || '').trim().toUpperCase();
  if (!u) return 'Unknown';
  if (u.includes('EMERGENCY')) return 'Emergency';
  if (u.includes('CONSULTANT')) return 'Consultant OPD';
  if (u.includes('GENERAL OPD')) return 'General OPD';
  if (u.includes('LAB')) return 'Laboratory';
  if (u.includes('ULTRA') || u === 'US') return 'Ultra Sound, Echo & Color Doppler';
  if (u.includes('X-RAY') || u.includes('XRAY') || u.includes('RADIOLOGY')) return 'Radiology';
  if (u.includes('BLOOD')) return 'Blood Bank';
  if (u.includes('MISC')) return 'Miscellaneous';
  if (u.includes('DENTAL')) return 'Dental OPD';
  if (u.includes('THERAPY')) return 'Therapy';
  if (u.includes('AMBULANCE')) return 'Ambulance';
  if (u.includes('ADMISSION')) return 'Admission';
  return raw;
}

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS_SHORT[dt.getMonth()]}-${dt.getFullYear()}`;
};
const fmtDateDay = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${fmtDate(d)} ${DAYS[dt.getDay()]}`;
};
const fmtNum = (n) => Number(n || 0).toFixed(2);

// Shift is purely a function of time-of-day, so it can be derived for EVERY
// row (old bulk data included) by matching visitTime against configured
// shifts — not just the rows that happen to have a stored shiftName (only
// visits created after the Shift feature existed have that).
function resolveShiftName(visitTime, shifts) {
  if (!shifts?.length || !visitTime) return null;
  const t = visitTime.length >= 5 ? visitTime.slice(0, 5) : visitTime;
  const inRange = (from, to) => (from <= to ? (t >= from && t <= to) : (t >= from || t <= to));
  const match = shifts.find(s => inRange(s.fromTime, s.toTime));
  return match?.name || null;
}

export default function DepartmentPatientsReport() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuthStore();
  const [rows, setRows] = useState([]);
  const [doctorMap, setDoctorMap] = useState({});
  const [subDeptMap, setSubDeptMap] = useState({});
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fromDate    = params.get('fromDate') || '';
  const toDate      = params.get('toDate') || '';
  const fromDept    = params.get('fromDept') || '';
  const toDept      = params.get('toDept') || '';
  const fromSubDept = params.get('fromSubDept') || '';
  const toSubDept   = params.get('toSubDept') || '';
  const typesParam  = params.get('types') || '';
  const reportType  = params.get('reportType') || 'detail';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ fromDate, toDate, fromTime: '00:00', toTime: '23:59' });
      if (typesParam) q.set('paymentTypes', typesParam);
      const [visitsRes, docsRes, subDeptRes, shiftsRes] = await Promise.all([
        fetch(`${API}/patient-visits?${q}`).then(r => r.json()),
        fetch(`${API}/doctors`).then(r => r.json()),
        fetch(`${API}/sub-departments`).then(r => r.json()),
        fetch(`${API}/shifts`).then(r => r.json()),
      ]);
      setRows(visitsRes.data || []);
      setShifts(shiftsRes.data || []);
      const dm = {};
      for (const d of (docsRes.data || [])) dm[(d.name || '').trim().toLowerCase()] = d;
      setDoctorMap(dm);
      const sdm = {};
      for (const sd of (subDeptRes.data || [])) sdm[(sd.name || '').trim().toLowerCase()] = sd;
      setSubDeptMap(sdm);
    } catch { toast.error('Data load failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  // ── Filter by department / sub-department range (lexicographic, same
  // pattern as the doctor-code range filters elsewhere in these reports) ──
  const filtered = rows.filter(r => {
    const dept = canonicalDept(r.department);
    if (fromDept && dept.toLowerCase() < fromDept.toLowerCase()) return false;
    if (toDept && dept.toLowerCase() > toDept.toLowerCase()) return false;
    if (fromSubDept || toSubDept) {
      const sd = (r.subDepartment || '').toLowerCase();
      if (fromSubDept && sd < fromSubDept.toLowerCase()) return false;
      if (toSubDept && sd > toSubDept.toLowerCase()) return false;
    }
    return true;
  });

  const printedBy = user?.name || user?.username || 'User';
  const printedAtStr = `${fmtDate(new Date())} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;

  const isSubDeptScope = Boolean(fromSubDept || toSubDept);
  const reportTitle = isSubDeptScope ? 'Sub Department wise Patients' : 'Department wise Patients';

  // ── Sub Department scope: Sub Department -> patient rows -> subtotal ───
  // (No doctor-level grouping here — doctor shows as an "Advise By" column
  // per row instead, matching the legacy report's drill-down behaviour.)
  function buildSubDeptGroups() {
    const sdMap = new Map();
    for (const r of filtered) {
      const key = (r.subDepartment || '(No Sub Department)').trim();
      if (!sdMap.has(key)) sdMap.set(key, []);
      sdMap.get(key).push(r);
    }
    return [...sdMap.entries()].map(([subDeptName, list]) => {
      const info = subDeptMap[subDeptName.trim().toLowerCase()];
      return {
        subDeptName, code: info?.code || '',
        rows: list.sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate)),
        count: list.length,
        amount: list.reduce((s, r) => s + Number(r.received || 0), 0),
      };
    }).sort((a, b) => a.subDeptName.localeCompare(b.subDeptName));
  }

  // ── Detail: Department -> Doctor -> patient rows -> subtotal ────────────
  function buildDetailGroups() {
    const deptMap = new Map();
    for (const r of filtered) {
      const dept = canonicalDept(r.department);
      if (!deptMap.has(dept)) deptMap.set(dept, new Map());
      const docMap = deptMap.get(dept);
      const docKey = r.doctor || '(No Doctor)';
      if (!docMap.has(docKey)) docMap.set(docKey, []);
      docMap.get(docKey).push(r);
    }
    return [...deptMap.entries()].map(([dept, docMap]) => ({
      dept,
      doctors: [...docMap.entries()].map(([docName, list]) => {
        const info = doctorMap[docName.trim().toLowerCase()];
        return {
          docName, code: info?.code || '', category: info?.staffCategory?.name || '',
          rows: list.sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate)),
          count: list.length,
          amount: list.reduce((s, r) => s + Number(r.received || 0), 0),
        };
      }).sort((a, b) => a.docName.localeCompare(b.docName)),
    })).sort((a, b) => a.dept.localeCompare(b.dept));
  }

  // ── Summary: Payment Type -> Department -> Total Patients/Amount/Discount ──
  function buildSummaryGroups() {
    const ptMap = new Map();
    for (const r of filtered) {
      const pt = r.paymentType || 'cash';
      const dept = canonicalDept(r.department);
      if (!ptMap.has(pt)) ptMap.set(pt, new Map());
      const dm = ptMap.get(pt);
      if (!dm.has(dept)) dm.set(dept, { count: 0, amount: 0, discount: 0 });
      const e = dm.get(dept);
      e.count += 1; e.amount += Number(r.received || 0); e.discount += Number(r.discount || 0);
    }
    return [...ptMap.entries()].map(([pt, dm]) => ({
      pt,
      depts: [...dm.entries()].map(([dept, e]) => ({ dept, ...e })).sort((a, b) => a.dept.localeCompare(b.dept)),
      total: [...dm.values()].reduce((s, e) => ({ count: s.count + e.count, amount: s.amount + e.amount, discount: s.discount + e.discount }), { count: 0, amount: 0, discount: 0 }),
    }));
  }

  // ── Date Wise Tabular: Date x Department cross-tab ──────────────────────
  function buildDateTabular() {
    const dateMap = new Map();
    const deptCodesSeen = new Set();
    for (const r of filtered) {
      const dateKey = new Date(r.visitDate).toISOString().split('T')[0];
      const code = DEPT_CODE[canonicalDept(r.department)] || canonicalDept(r.department);
      deptCodesSeen.add(code);
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, {});
      const day = dateMap.get(dateKey);
      if (!day[code]) day[code] = { count: 0, amount: 0 };
      day[code].count += 1;
      day[code].amount += Number(r.received || 0);
    }
    const dates = [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const codes = [...deptCodesSeen].sort();
    const totals = {};
    for (const code of codes) totals[code] = dates.reduce((s, [, day]) => s + (day[code]?.count || 0), 0);
    const grand = { count: filtered.length, amount: filtered.reduce((s, r) => s + Number(r.received || 0), 0) };
    return { dates, codes, totals, grand };
  }

  // ── Department and Shift Wise Summary: Shift -> User -> count/amount ───
  // Only reflects visits created after Shift/user tracking was added
  // (rows from before that, or from the old bulk-imported data, have no
  // shiftName/createdByName and fall into "Unassigned").
  function buildShiftUserGroups() {
    const shiftMap = new Map(); // shift -> dept -> user -> {count, amount}
    for (const r of filtered) {
      // Shift is derivable from visitTime for every row, old or new — only
      // the "who created it" side is genuinely unrecoverable for old data.
      const shift = r.shiftName || resolveShiftName(r.visitTime, shifts) || 'Unassigned';
      const dept = canonicalDept(r.department);
      const who = r.createdByName || 'Unassigned';
      if (!shiftMap.has(shift)) shiftMap.set(shift, new Map());
      const deptMap = shiftMap.get(shift);
      if (!deptMap.has(dept)) deptMap.set(dept, new Map());
      const userMap = deptMap.get(dept);
      if (!userMap.has(who)) userMap.set(who, { count: 0, amount: 0 });
      const e = userMap.get(who);
      e.count += 1;
      e.amount += Number(r.received || 0);
    }
    const sumAll = (userMap) => [...userMap.values()].reduce((s, e) => ({ count: s.count + e.count, amount: s.amount + e.amount }), { count: 0, amount: 0 });
    return [...shiftMap.entries()].map(([shift, deptMap]) => {
      const depts = [...deptMap.entries()].map(([dept, userMap]) => ({
        dept,
        users: [...userMap.entries()].map(([who, e]) => ({ who, ...e })).sort((a, b) => a.who.localeCompare(b.who)),
        total: sumAll(userMap),
      })).sort((a, b) => a.dept.localeCompare(b.dept));
      const shiftTotal = depts.reduce((s, d) => ({ count: s.count + d.total.count, amount: s.amount + d.total.amount }), { count: 0, amount: 0 });
      return { shift, depts, total: shiftTotal };
    }).sort((a, b) => a.shift.localeCompare(b.shift));
  }

  const slipNos = filtered.map(r => Number(r.serialNo)).filter(n => !Number.isNaN(n));
  const slipRange = slipNos.length ? [Math.min(...slipNos), Math.max(...slipNos)] : null;

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('dpr-printable')?.innerHTML || '';
    const landscape = reportType === 'dateTabular';
    win.document.write(`<!DOCTYPE html><html><head><title>${reportTitle}</title>
      <style>
        *{box-sizing:border-box;}
        body{font-family:Tahoma,sans-serif;font-size:11px;margin:0;padding:12px;}
        table{width:100%;border-collapse:collapse;font-size:10px;}
        th{background:#1a3c6e!important;color:#fff!important;padding:4px 6px;text-align:left;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        th.num{text-align:right;}
        td{padding:3px 6px;border-bottom:1px solid #ddd;}
        .td-num{text-align:right;}
        .dpr-dept-row td{background:#bfe8e8!important;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .dpr-doc-row td{background:#e2e2e2!important;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .dpr-sub-row td{background:#eef2f8!important;font-weight:700;border-top:1px solid #1a3c6e;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .dpr-total-row td{background:#eef2f8!important;font-weight:700;border-top:2px solid #1a3c6e;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .dpr-table--boxed{border:1px solid #94a3b8;}
        .dpr-table--boxed th, .dpr-table--boxed td{border:1px solid #94a3b8;text-align:center;}
        .dpr-table--boxed td:first-child, .dpr-table--boxed th:first-child{text-align:left;}
        h1{font-size:13px;margin:0 0 2px;text-transform:uppercase;letter-spacing:.04em;}
        p{font-size:10px;margin:0;color:#555;}
        @page { size: ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    const aoa = [[reportTitle], [`Date: ${fmtDate(fromDate)} To ${fmtDate(toDate)}`], []];
    if (reportType === 'summary') {
      for (const g of buildSummaryGroups()) {
        aoa.push([`${g.pt} Transaction`]);
        aoa.push(['Department', 'Total Patients', 'Amount', 'Discount']);
        g.depts.forEach(d => aoa.push([d.dept, d.count, d.amount, d.discount]));
        aoa.push(['Total', g.total.count, g.total.amount, g.total.discount]);
        aoa.push([]);
      }
    } else if (reportType === 'dateTabular') {
      const { dates, codes, totals, grand } = buildDateTabular();
      aoa.push(['Date', ...codes, 'Total']);
      dates.forEach(([dateKey, day]) => {
        aoa.push([fmtDateDay(dateKey), ...codes.map(c => day[c]?.count || ''), Object.values(day).reduce((s, v) => s + v.count, 0)]);
      });
      aoa.push(['Total', ...codes.map(c => totals[c]), grand.count]);
    } else if (reportType === 'deptShift') {
      for (const g of buildShiftUserGroups()) {
        aoa.push([g.shift]);
        for (const d of g.depts) {
          aoa.push([d.dept.toUpperCase(), d.total.count, d.total.amount]);
          d.users.filter(u => u.who !== 'Unassigned').forEach(u => aoa.push(['  ' + u.who, u.count, u.amount]));
        }
        aoa.push([`Total for ${g.shift}`, g.total.count, g.total.amount]);
        aoa.push([]);
      }
    } else if (isSubDeptScope) {
      for (const g of buildSubDeptGroups()) {
        aoa.push([`${g.code}  ${g.subDeptName}`]);
        aoa.push(['S.No', 'AdmitNo', 'Date', 'Time', 'Patient', 'Advise By', 'Type', 'Amount']);
        g.rows.forEach(r => aoa.push([r.serialNo, r.admitNo || '', fmtDate(r.visitDate), r.visitTime || '', r.patientName, r.doctor || '', r.paymentType, Number(r.received || 0)]));
        aoa.push(['Total Patients for Sub Dep.', g.count, '', '', '', '', 'Total Amount for Sub Dep.', g.amount]);
        aoa.push([]);
      }
    } else {
      for (const g of buildDetailGroups()) {
        aoa.push([g.dept.toUpperCase()]);
        for (const d of g.doctors) {
          aoa.push([`${d.code}  ${d.docName}`, d.category]);
          aoa.push(['S.No', 'AdmitNo', 'Date', 'Time', 'Patient', 'Type', 'Amount', 'Discount']);
          d.rows.forEach(r => aoa.push([r.serialNo, r.admitNo || '', fmtDate(r.visitDate), r.visitTime || '', r.patientName, r.paymentType, Number(r.received || 0), Number(r.discount || 0)]));
          aoa.push(['Total For Consultant', d.count, '', '', '', '', d.amount]);
        }
        aoa.push([]);
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `department_patients_${fromDate}_${toDate}.xlsx`);
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
        <div className="dpr-report-page" id="dpr-printable">
          <div className="dpr-print-header">
            <h1>{reportTitle}</h1>
            <p>Date &amp; Time: {printedAtStr} | Printed By: {printedBy}</p>
            <p>Dep.: {fromDept || 'All'} To {toDept || 'All'} | Date: {fmtDate(fromDate)} To {fmtDate(toDate)}</p>
            {slipRange && <p>Slip Number: {slipRange[0]} To {slipRange[1]}</p>}
          </div>

          {loading && <div className="dpr-empty">Loading data…</div>}
          {!loading && filtered.length === 0 && <div className="dpr-empty">No records found for the selected filters.</div>}

          {!loading && filtered.length > 0 && reportType === 'detail' && isSubDeptScope && (
            <table className="dpr-table">
              <thead>
                <tr>
                  <th>S.No.</th><th>AdmitNo</th><th>Date</th><th>Time</th><th>Patient</th>
                  <th>Advise By</th><th>Type</th><th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {buildSubDeptGroups().map(g => (
                  <Fragment key={g.subDeptName}>
                    <tr className="dpr-dept-row"><td colSpan={2}>{g.code}</td><td colSpan={6}>{g.subDeptName}</td></tr>
                    {g.rows.map((r, i) => (
                      <tr key={`${g.subDeptName}-${i}`}>
                        <td>{r.serialNo}</td>
                        <td>{r.admitNo || '-'}</td>
                        <td>{fmtDate(r.visitDate)}</td>
                        <td>{r.visitTime}</td>
                        <td>{r.patientName}</td>
                        <td>{r.doctor || '-'}</td>
                        <td>{r.paymentType}</td>
                        <td className="td-num">{fmtNum(r.received)}</td>
                      </tr>
                    ))}
                    <tr className="dpr-sub-row">
                      <td colSpan={2}>Total Patients for Sub Dep.:</td>
                      <td>{g.count}</td>
                      <td colSpan={3}></td>
                      <td>Total Amount for Sub Dep.:</td>
                      <td className="td-num">{fmtNum(g.amount)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}

          {!loading && filtered.length > 0 && reportType === 'detail' && !isSubDeptScope && (
            <table className="dpr-table">
              <thead>
                <tr>
                  <th>S.No.</th><th>AdmitNo</th><th>Date</th><th>Time</th><th>Patient</th>
                  <th>Type</th><th className="num">Amount</th><th className="num">Discount</th>
                </tr>
              </thead>
              <tbody>
                {buildDetailGroups().map(g => (
                  <Fragment key={g.dept}>
                    <tr className="dpr-dept-row"><td colSpan={8}>{g.dept.toUpperCase()}</td></tr>
                    {g.doctors.map(d => (
                      <Fragment key={d.docName}>
                        <tr className="dpr-doc-row">
                          <td colSpan={5}>{d.code} {d.docName}</td>
                          <td colSpan={3}>{d.category}</td>
                        </tr>
                        {d.rows.map((r, i) => (
                          <tr key={`${d.docName}-${i}`}>
                            <td>{r.serialNo}</td>
                            <td>{r.admitNo || '-'}</td>
                            <td>{fmtDate(r.visitDate)}</td>
                            <td>{r.visitTime}</td>
                            <td>{r.patientName}</td>
                            <td>{r.paymentType}</td>
                            <td className="td-num">{fmtNum(r.received)}</td>
                            <td className="td-num">{fmtNum(r.discount)}</td>
                          </tr>
                        ))}
                        <tr className="dpr-sub-row">
                          <td colSpan={2}>Total For Consultant</td>
                          <td>{d.count}</td>
                          <td colSpan={3}></td>
                          <td className="td-num">{fmtNum(d.amount)}</td>
                          <td></td>
                        </tr>
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}

          {!loading && filtered.length > 0 && reportType === 'summary' && (
            <table className="dpr-table">
              <thead>
                <tr><th>Sub Department</th><th className="num">Total Patients</th><th className="num">Amount</th><th className="num">Discount</th></tr>
              </thead>
              <tbody>
                {buildSummaryGroups().map(g => (
                  <Fragment key={g.pt}>
                    <tr className="dpr-dept-row"><td colSpan={4}>{g.pt} Transaction</td></tr>
                    {g.depts.map(d => (
                      <tr key={d.dept}>
                        <td>{d.dept.toUpperCase()}</td>
                        <td className="td-num">{d.count}</td>
                        <td className="td-num">{fmtNum(d.amount)}</td>
                        <td className="td-num">{fmtNum(d.discount)}</td>
                      </tr>
                    ))}
                    <tr className="dpr-sub-row">
                      <td>Total Patients:</td>
                      <td className="td-num">{g.total.count}</td>
                      <td className="td-num">{fmtNum(g.total.amount)}</td>
                      <td className="td-num">{fmtNum(g.total.discount)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}

          {!loading && filtered.length > 0 && reportType === 'dateTabular' && (() => {
            const { dates, codes, totals, grand } = buildDateTabular();
            return (
              <table className="dpr-table dpr-table--boxed">
                <thead>
                  <tr>
                    <th></th>
                    {codes.map(c => <th className="num" key={c}>{c}</th>)}
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dates.map(([dateKey, day]) => (
                    <tr key={dateKey}>
                      <td>{fmtDateDay(dateKey)}</td>
                      {codes.map(c => (
                        <td className="td-num" key={c}>
                          {day[c] ? <>{day[c].count}<br/><span style={{ fontSize: '0.7em', color: '#64748b' }}>{fmtNum(day[c].amount)}</span></> : ''}
                        </td>
                      ))}
                      <td className="td-num">{Object.values(day).reduce((s, v) => s + v.count, 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="dpr-total-row">
                    <td>Total</td>
                    {codes.map(c => (
                      <td className="td-num" key={c}>
                        {totals[c]}<br/>
                        <span style={{ fontSize: '0.7em' }}>{fmtNum(dates.reduce((s, [, day]) => s + (day[c]?.amount || 0), 0))}</span>
                      </td>
                    ))}
                    <td className="td-num">{grand.count}<br/><span style={{ fontSize: '0.7em' }}>{fmtNum(grand.amount)}</span></td>
                  </tr>
                </tfoot>
              </table>
            );
          })()}

          {!loading && filtered.length > 0 && reportType === 'deptShift' && (
            <table className="dpr-table">
              <thead>
                <tr><th>Department / User</th><th className="num">Patients</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                {buildShiftUserGroups().map(g => (
                  <Fragment key={g.shift}>
                    <tr className="dpr-dept-row"><td colSpan={3}>{g.shift}</td></tr>
                    {g.depts.map(d => (
                      <Fragment key={`${g.shift}-${d.dept}`}>
                        <tr className="dpr-doc-row">
                          <td>{d.dept.toUpperCase()}</td>
                          <td className="td-num">{d.total.count}</td>
                          <td className="td-num">{fmtNum(d.total.amount)}</td>
                        </tr>
                        {d.users.filter(u => u.who !== 'Unassigned').map(u => (
                          <tr key={u.who} style={{ color: '#64748b' }}>
                            <td style={{ paddingLeft: 20 }}>{u.who}</td>
                            <td className="td-num">{u.count}</td>
                            <td className="td-num">{fmtNum(u.amount)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    <tr className="dpr-sub-row">
                      <td>Total for {g.shift}</td>
                      <td className="td-num">{g.total.count}</td>
                      <td className="td-num">{fmtNum(g.total.amount)}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
          {reportType === 'deptShift' && (
            <p className="dpr-note">
              Note: "Unassigned" un visits ke liye hai jo Shift feature banne se pehle create hui thi, ya jinke sath koi shift us waqt configure nahi thi.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
