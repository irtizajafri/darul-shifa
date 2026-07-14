import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw, Upload } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import './ConsultantWiseReport.scss';

const API = 'http://localhost:5001/api/clinic';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS         = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2,'0')}-${MONTHS_SHORT[dt.getUTCMonth()]}-${dt.getUTCFullYear()}`;
};

const fmtDateWithDay = (dateStr) => {
  if (!dateStr || dateStr === '—') return '—';
  const d = new Date(dateStr + 'T00:00:00Z');
  return `${String(d.getUTCDate()).padStart(2,'0')}-${MONTHS_LONG[d.getUTCMonth()]}-${d.getUTCFullYear()} ${DAYS[d.getUTCDay()]}`;
};

const fmtNum = (n) =>
  Number(n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const BADGE_MAP = {
  cash: 'cash', Cash: 'cash',
  panel: 'panel', Panel: 'panel',
  staff: 'staff', Staff: 'staff',
  JazzCash: 'jazzcash', jazzcash: 'jazzcash',
  CC: 'cc', cc: 'cc',
  'Complem.': 'complem', complem: 'complem',
};

function normName(s) {
  return (s || '').toLowerCase().replace(/[-._]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildDrMaps(drData) {
  const drMap = {};
  const drFirstMap = {};
  for (const r of drData) {
    const dk = normName(r.doctorName);
    const sk = normName(r.subDeptName);
    if (!drMap[dk]) drMap[dk] = {};
    drMap[dk][sk] = { paymentType: r.paymentType, normalFees: Number(r.normalFees) };
    if (!drFirstMap[dk]) drFirstMap[dk] = { paymentType: r.paymentType, normalFees: Number(r.normalFees) };
  }
  return { drMap, drFirstMap };
}

function calcShares(row, drMap, drFirstMap) {
  const dk = normName(row.doctor);
  const sk = normName(row.subDepartment);
  const rateInfo = drMap[dk]?.[sk] || drFirstMap[dk] || null;
  if (!rateInfo || !rateInfo.normalFees) return { consAmt: 0, hosAmt: 0, hasRate: false };
  const amt = Number(row.received || 0);
  const consAmt = rateInfo.paymentType === 'percent'
    ? amt * rateInfo.normalFees / 100
    : rateInfo.normalFees;
  return { consAmt, hosAmt: amt - consAmt, hasRate: true };
}

function groupByConsultant(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.doctor || '(No Consultant)';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map.entries()].map(([consultant, patients]) => ({ consultant, patients }));
}

function groupByConsultantDateWise(rows, drMap, drFirstMap) {
  const conMap = new Map();
  for (const r of rows) {
    const conKey = r.doctor || '(No Consultant)';
    if (!conMap.has(conKey)) conMap.set(conKey, new Map());
    const subMap = conMap.get(conKey);
    const subKey = r.subDepartment || '(No Sub-Dept)';
    if (!subMap.has(subKey)) subMap.set(subKey, new Map());
    const dateMap = subMap.get(subKey);
    const dateKey = r.visitDate ? String(r.visitDate).split('T')[0] : '—';
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, { count: 0, amount: 0, hosAmt: 0, consAmt: 0 });
    const entry = dateMap.get(dateKey);
    const amt = Number(r.received || 0);
    const { consAmt, hosAmt } = calcShares(r, drMap, drFirstMap);
    entry.count   += 1;
    entry.amount  += amt;
    entry.hosAmt  += hosAmt;
    entry.consAmt += consAmt;
  }

  return [...conMap.entries()].map(([consultant, subMap]) => {
    const subDepts = [...subMap.entries()].map(([name, dateMap]) => {
      const dates = [...dateMap.entries()]
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));
      const subTotal = dates.reduce((acc, d) => ({
        count:   acc.count   + d.count,
        amount:  acc.amount  + d.amount,
        hosAmt:  acc.hosAmt  + d.hosAmt,
        consAmt: acc.consAmt + d.consAmt,
      }), { count: 0, amount: 0, hosAmt: 0, consAmt: 0 });
      return { name, dates, subTotal };
    });
    const consultantTotal = subDepts.reduce((acc, s) => ({
      count:   acc.count   + s.subTotal.count,
      amount:  acc.amount  + s.subTotal.amount,
      hosAmt:  acc.hosAmt  + s.subTotal.hosAmt,
      consAmt: acc.consAmt + s.subTotal.consAmt,
    }), { count: 0, amount: 0, hosAmt: 0, consAmt: 0 });
    return { consultant, subDepts, consultantTotal };
  });
}

export default function ConsultantWiseReport() {
  const navigate        = useNavigate();
  const [params]        = useSearchParams();
  const { user }        = useAuthStore();
  const [rows,       setRows]       = useState([]);
  const [drMap,      setDrMap]      = useState({});
  const [drFirstMap, setDrFirstMap] = useState({});
  const [loading,    setLoading]    = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [lastRefresh,setLastRefresh]= useState(null);

  const fromDate       = params.get('fromDate')       || '';
  const toDate         = params.get('toDate')         || '';
  const fromTime       = params.get('fromTime')       || '';
  const toTime         = params.get('toTime')         || '';
  const fromConsultant = params.get('fromConsultant') || '';
  const toConsultant   = params.get('toConsultant')   || '';
  const typesParam     = params.get('types')          || '';
  const reportType     = params.get('reportType')     || 'detail';

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ fromDate, toDate, fromTime, toTime });
      if (typesParam)     q.set('paymentTypes',  typesParam);
      if (fromConsultant) q.set('fromConsultant', fromConsultant);
      if (toConsultant)   q.set('toConsultant',   toConsultant);
      const [visitsRes, drRes] = await Promise.all([
        fetch(`${API}/patient-visits?${q}`).then(r => r.json()),
        fetch(`${API}/doctor-subdept-rates`).then(r => r.json()),
      ]);
      setRows(visitsRes.data || []);
      const { drMap: dm, drFirstMap: dfm } = buildDrMaps(drRes.data || []);
      setDrMap(dm);
      setDrFirstMap(dfm);
      setLastRefresh(new Date());
    } catch { toast.error('Data load failed'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const groups    = groupByConsultant(rows);
  const dwsGroups = groupByConsultantDateWise(rows, drMap, drFirstMap);

  const grandAmt   = rows.reduce((s, r) => s + Number(r.received || 0), 0);
  const grandCons  = rows.reduce((s, r) => s + calcShares(r, drMap, drFirstMap).consAmt, 0);
  const grandHos   = grandAmt - grandCons;

  const printedBy  = user?.name || 'User';
  const printedAt  = new Date();
  const printedAtStr = `${String(printedAt.getDate()).padStart(2,'0')}-${MONTHS_SHORT[printedAt.getMonth()]}-${printedAt.getFullYear()} ` +
    `${String(printedAt.getHours()).padStart(2,'0')}:${String(printedAt.getMinutes()).padStart(2,'0')}:${String(printedAt.getSeconds()).padStart(2,'0')} ` +
    `${printedAt.getHours() >= 12 ? 'PM' : 'AM'}`;

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('cwr-printable')?.innerHTML || '';
    const title = reportType === 'date_wise_summary'
      ? 'Consultant Date Wise Summary'
      : 'Consultant Wise Patients';
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        *{box-sizing:border-box;}
        body{font-family:Tahoma,sans-serif;font-size:11px;margin:0;padding:12px;}
        table{width:100%;border-collapse:collapse;font-size:10px;}
        th{background:#1a3c6e!important;color:#fff!important;padding:4px 6px;text-align:left;
           -webkit-print-color-adjust:exact;print-color-adjust:exact;white-space:nowrap;}
        th.num{text-align:right;}
        td{padding:3px 6px;border-bottom:1px solid #ddd;}
        .td-num{text-align:right;}
        /* detail view */
        .cwr-con-header{background:#e8eef8!important;font-weight:700;padding:5px 8px;
          margin:10px 0 0;border-left:3px solid #1a3c6e;font-size:11px;
          display:flex;justify-content:space-between;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .cwr-sub-row td{background:#f0f4fa!important;font-weight:700;border-top:1px solid #1a3c6e;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        tfoot td{background:#eef2f8!important;font-weight:700;border-top:2px solid #1a3c6e;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .cwr-td-hos{color:#1a3c6e;}
        .cwr-td-cons{color:#166534;}
        h1{font-size:13px;margin:0 0 2px;text-transform:uppercase;letter-spacing:.04em;}
        p{font-size:10px;margin:0;color:#555;}
        /* date-wise */
        .dws-main-title{font-size:14px;font-weight:700;text-align:center;text-decoration:underline;margin:0 0 6px;}
        .dws-info-row{display:flex;justify-content:space-between;font-size:10px;padding:2px 0;border-bottom:1px solid #ccc;margin-bottom:3px;}
        .dws-date-row{display:flex;justify-content:space-between;font-size:10px;background:#f8e8e8!important;
          padding:2px 4px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .dws-con-row td{background:#e8eef8!important;font-weight:700;font-size:11px;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .dws-subdept-row td{background:#f4f6fa!important;font-weight:700;font-style:italic;padding-left:16px;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .dws-subtotal-row td{background:#dce8d4!important;font-weight:700;border-top:1px solid #5a8a4a;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .dws-grand-row td{background:#eef2f8!important;font-weight:700;border-top:2px solid #1a3c6e;
          -webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .dws-sign-area{display:flex;justify-content:space-between;margin-top:30px;font-size:10px;}
        .dws-sign-col{text-align:center;min-width:130px;}
        .dws-sign-line{border-top:1px solid #333;margin-bottom:2px;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    if (reportType === 'date_wise_summary') {
      const aoa = [['Consultant Date Wise Summary'], [`Date: ${fmtDate(fromDate)} To ${fmtDate(toDate)}`], []];
      for (const { consultant, subDepts, consultantTotal } of dwsGroups) {
        aoa.push([`Consultant: ${consultant}`]);
        for (const { name, dates, subTotal } of subDepts) {
          aoa.push(['', name]);
          aoa.push(['', 'Date', 'Patients', 'Amount', 'Hos. Amt.', 'Cons. Amt.']);
          for (const d of dates)
            aoa.push(['', fmtDateWithDay(d.date), d.count, d.amount, d.hosAmt, d.consAmt]);
          aoa.push(['', `${name} Total`, subTotal.count, subTotal.amount, subTotal.hosAmt, subTotal.consAmt]);
        }
        aoa.push(['', 'Consultant Total', consultantTotal.count, consultantTotal.amount, consultantTotal.hosAmt, consultantTotal.consAmt]);
        aoa.push([]);
      }
      aoa.push(['Grand Total', '', rows.length, grandAmt, grandHos, grandCons]);
      const ws  = XLSX.utils.aoa_to_sheet(aoa);
      const wb  = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DateWiseSummary');
      XLSX.writeFile(wb, `consultant_datewise_${fromDate}_${toDate}.xlsx`);
      return;
    }

    const aoa = [['Consultant Wise Patients Report'], [`Date: ${fmtDate(fromDate)} To ${fmtDate(toDate)}`], []];
    for (const { consultant, patients } of groups) {
      aoa.push([`Consultant: ${consultant}`]);
      aoa.push(['S.No','Date','Time','Patient Name','Department','Sub Department','Type','Amount','Hos. Amt.','Cons. Amt.']);
      patients.forEach((r) => {
        const { consAmt, hosAmt } = calcShares(r, drMap, drFirstMap);
        aoa.push([r.serialNo ?? '', fmtDate(r.visitDate), r.visitTime || '', r.patientName,
          r.department || '', r.subDepartment || '', r.paymentType || '',
          Number(r.received || 0), hosAmt, consAmt]);
      });
      const subAmt  = patients.reduce((s,r) => s + Number(r.received||0), 0);
      const subCons = patients.reduce((s,r) => s + calcShares(r, drMap, drFirstMap).consAmt, 0);
      aoa.push(['', `Sub Total: ${patients.length} patients`,'','','','','', subAmt, subAmt - subCons, subCons]);
      aoa.push([]);
    }
    aoa.push(['','Grand Total: '+rows.length+' patients','','','','','', grandAmt, grandHos, grandCons]);
    const ws  = XLSX.utils.aoa_to_sheet(aoa);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ConsultantWise');
    XLSX.writeFile(wb, `consultant_wise_${fromDate}_${toDate}.xlsx`);
  };

  const handleUpload = async (e) => {
    toast('Use Patients List page for importing Excel data');
    e.target.value = '';
  };

  const isDateWise = reportType === 'date_wise_summary';

  return (
    <div className="cwr-page">

      {/* ── Toolbar ── */}
      <div className="cwr-toolbar no-print">
        <div className="cwr-toolbar-left">
          <button className="cwr-tool-btn cwr-tool-btn--back" onClick={() => navigate(-1)}>
            <ArrowLeft size={14}/> <span>Back</span>
          </button>
          <div className="cwr-tool-sep"/>
          <button className="cwr-tool-btn" onClick={handlePrint}>
            <Printer size={14}/> <span>Print / PDF</span>
          </button>
          <button className="cwr-tool-btn cwr-tool-btn--excel" onClick={handleExportExcel}>
            <FileDown size={14}/> <span>Export Excel</span>
          </button>
          <div className="cwr-tool-sep"/>
          <button className="cwr-tool-btn" onClick={fetchData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'cwr-spin' : ''}/> <span>Refresh</span>
          </button>
          <button className="cwr-tool-btn cwr-tool-btn--upload"
            onClick={() => document.getElementById('cwr-file-input').click()} disabled={uploading}>
            <Upload size={14}/> <span>{uploading ? 'Importing…' : 'Import Excel'}</span>
          </button>
          <input id="cwr-file-input" type="file" accept=".xlsx,.xls"
            style={{display:'none'}} onChange={handleUpload}/>
        </div>
        {lastRefresh && (
          <span className="cwr-last-refresh">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
        )}
      </div>

      {/* ── Report Area ── */}
      <div className="cwr-report-area">
        <div className="cwr-report-page" id="cwr-printable">

          {/* ═══════════════ DATE WISE SUMMARY VIEW ═══════════════ */}
          {isDateWise ? (
            <>
              {/* Print-style header */}
              <div className="dws-print-header">
                <div className="dws-main-title">Consultant Date wise Summary</div>
                <div className="dws-info-bar">
                  <span>Date &amp; Time: {printedAtStr}</span>
                  <span>Printed By: {printedBy}</span>
                  <span>Page: 1 of 1</span>
                </div>
                <div className="dws-date-bar">
                  <span>Date: {fmtDate(fromDate)}</span>
                  <span>To:</span>
                  <span>{fmtDate(toDate)}</span>
                </div>
              </div>

              {loading && <div className="cwr-empty">Loading data…</div>}
              {!loading && rows.length === 0 && (
                <div className="cwr-empty">No records found for the selected filters.</div>
              )}

              {!loading && dwsGroups.length > 0 && (
                <table className="dws-table">
                  <thead>
                    <tr>
                      <th className="dws-col-date">Date</th>
                      <th className="dws-col-pts num">Patients</th>
                      <th className="dws-col-num num">Amount</th>
                      <th className="dws-col-num num">Hos. Amt.</th>
                      <th className="dws-col-num num">Cons. Amt.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dwsGroups.map(({ consultant, subDepts, consultantTotal }) => (
                      <>
                        {/* Consultant header row */}
                        <tr key={`con-${consultant}`} className="dws-con-row">
                          <td className="dws-con-name">{consultant}</td>
                          <td colSpan={4} className="dws-con-right">{consultant}</td>
                        </tr>

                        {subDepts.map(({ name, dates, subTotal }) => (
                          <>
                            {/* Sub-dept label */}
                            <tr key={`sd-${consultant}-${name}`} className="dws-subdept-row">
                              <td colSpan={5}>{name}</td>
                            </tr>

                            {/* Date rows */}
                            {dates.map((d) => (
                              <tr key={`d-${consultant}-${name}-${d.date}`} className="dws-date-row">
                                <td className="dws-td-date">{fmtDateWithDay(d.date)}</td>
                                <td className="td-num">{d.count}</td>
                                <td className="td-num">{fmtNum(d.amount)}</td>
                                <td className="td-num cwr-td-hos">{fmtNum(d.hosAmt)}</td>
                                <td className="td-num cwr-td-cons">{fmtNum(d.consAmt)}</td>
                              </tr>
                            ))}

                            {/* Sub-dept subtotal */}
                            <tr key={`st-${consultant}-${name}`} className="dws-subtotal-row">
                              <td className="dws-subtotal-label">{name}</td>
                              <td className="td-num">{subTotal.count}</td>
                              <td className="td-num">{fmtNum(subTotal.amount)}</td>
                              <td className="td-num cwr-td-hos">{fmtNum(subTotal.hosAmt)}</td>
                              <td className="td-num cwr-td-cons">{fmtNum(subTotal.consAmt)}</td>
                            </tr>
                          </>
                        ))}
                      </>
                    ))}

                    {/* Grand Total */}
                    <tr className="dws-grand-row">
                      <td className="dws-grand-label">Grand Total</td>
                      <td className="td-num">{rows.length}</td>
                      <td className="td-num">{fmtNum(grandAmt)}</td>
                      <td className="td-num cwr-td-hos">{fmtNum(grandHos)}</td>
                      <td className="td-num cwr-td-cons">{fmtNum(grandCons)}</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Signature row */}
              {!loading && rows.length > 0 && (
                <div className="dws-sign-area">
                  <div className="dws-sign-col">
                    <div className="dws-sign-line">{printedBy}</div>
                    <div className="dws-sign-sub">Prepared By:</div>
                  </div>
                  <div className="dws-sign-col">
                    <div className="dws-sign-line">&nbsp;</div>
                    <div className="dws-sign-sub">Administrator</div>
                  </div>
                  <div className="dws-sign-col">
                    <div className="dws-sign-line">&nbsp;</div>
                    <div className="dws-sign-sub">Receive By:</div>
                  </div>
                </div>
              )}
            </>
          ) : (

          /* ═══════════════ DETAIL VIEW (existing) ═══════════════ */
          <>
            <div className="cwr-rpt-header">
              <div className="cwr-rpt-hospital">
                <h1>Darul Shifa Hospital</h1>
                <p>Comprehensive Healthcare Services</p>
              </div>
            </div>
            <hr className="cwr-rpt-divider"/>

            <div className="cwr-rpt-meta">
              <h2 className="cwr-rpt-title">Consultant Wise Patients</h2>
              <div className="cwr-rpt-dates">
                <span>Date: {fmtDate(fromDate)} To {fmtDate(toDate)}</span>
                {fromConsultant && (
                  <span>Consultant: {fromConsultant}
                    {toConsultant !== fromConsultant ? ` → ${toConsultant}` : ''}
                  </span>
                )}
                {typesParam && <span>Types: {typesParam}</span>}
              </div>
            </div>

            {loading && <div className="cwr-empty">Loading data…</div>}

            {!loading && rows.length === 0 && (
              <div className="cwr-empty">No records found for the selected filters.</div>
            )}

            {!loading && groups.map(({ consultant, patients }) => {
              const subAmt  = patients.reduce((s,r) => s + Number(r.received||0), 0);
              const subCons = patients.reduce((s,r) => s + calcShares(r, drMap, drFirstMap).consAmt, 0);
              const subHos  = subAmt - subCons;
              return (
                <div key={consultant} className="cwr-con-group">
                  <div className="cwr-con-header">
                    <span className="cwr-con-name">{consultant}</span>
                    <span className="cwr-con-count">{patients.length} patient{patients.length !== 1 ? 's' : ''}</span>
                  </div>
                  <table className="cwr-rpt-table">
                    <thead>
                      <tr>
                        <th className="cwr-col-sno">S.No.</th>
                        <th className="cwr-col-date">Date</th>
                        <th className="cwr-col-time">Time</th>
                        <th className="cwr-col-name">Patient Name</th>
                        <th className="cwr-col-dept">Department</th>
                        <th className="cwr-col-subdept">Sub Department</th>
                        <th className="cwr-col-type">Type</th>
                        <th className="cwr-col-num">Amount</th>
                        <th className="cwr-col-num cwr-th-hos">Hos. Amt.</th>
                        <th className="cwr-col-num cwr-th-cons">Cons. Amt.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((r, i) => {
                        const badge = BADGE_MAP[r.paymentType] || 'cash';
                        const { consAmt, hosAmt } = calcShares(r, drMap, drFirstMap);
                        const amt = Number(r.received || 0);
                        return (
                          <tr key={r.id} className={i % 2 === 1 ? 'cwr-row-even' : ''}>
                            <td>{r.serialNo ?? (i + 1)}</td>
                            <td>{fmtDate(r.visitDate)}</td>
                            <td>{r.visitTime || '—'}</td>
                            <td className="cwr-td-name">{r.patientName}</td>
                            <td>{r.department || '—'}</td>
                            <td>{r.subDepartment || '—'}</td>
                            <td><span className={`cwr-badge cwr-badge--${badge}`}>{r.paymentType || '—'}</span></td>
                            <td className="cwr-td-num">{amt.toFixed(2)}</td>
                            <td className="cwr-td-num cwr-td-hos">{hosAmt.toFixed(2)}</td>
                            <td className="cwr-td-num cwr-td-cons">{consAmt.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="cwr-sub-row">
                        <td colSpan={7} className="cwr-tf-label">
                          Sub Total — {patients.length} Patient{patients.length !== 1 ? 's' : ''}
                        </td>
                        <td className="cwr-td-num cwr-tf-val">{subAmt.toFixed(2)}</td>
                        <td className="cwr-td-num cwr-tf-val cwr-td-hos">{subHos.toFixed(2)}</td>
                        <td className="cwr-td-num cwr-tf-val cwr-td-cons">{subCons.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })}

            {!loading && rows.length > 0 && (
              <table className="cwr-rpt-table cwr-grand-table">
                <tfoot>
                  <tr>
                    <td colSpan={7} className="cwr-tf-label">Grand Total — {rows.length} Patients</td>
                    <td className="cwr-td-num cwr-tf-val">{grandAmt.toFixed(2)}</td>
                    <td className="cwr-td-num cwr-tf-val cwr-td-hos">{grandHos.toFixed(2)}</td>
                    <td className="cwr-td-num cwr-tf-val cwr-td-cons">{grandCons.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            )}

            <div className="cwr-rpt-footer">
              <span>Generated: {new Date().toLocaleString()}</span>
              <span>Total Patients: {rows.length}</span>
            </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
