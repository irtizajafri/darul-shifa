import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, FileDown, RefreshCw, Upload } from 'lucide-react';
import './ConsultantWiseReport.scss';

const API = 'http://localhost:5001/api/clinic';

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2,'0')}-${dt.toLocaleString('en',{month:'short',timeZone:'UTC'})}-${dt.getUTCFullYear()}`;
};

const BADGE_MAP = {
  cash: 'cash', Cash: 'cash',
  panel: 'panel', Panel: 'panel',
  staff: 'staff', Staff: 'staff',
  JazzCash: 'jazzcash', jazzcash: 'jazzcash',
  CC: 'cc', cc: 'cc',
  'Complem.': 'complem', complem: 'complem',
};

function groupByConsultant(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.doctor || '(No Consultant)';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return [...map.entries()].map(([consultant, patients]) => ({ consultant, patients }));
}

// Normalize name: lowercase, replace hyphens/dots with space, collapse whitespace
function normName(s) {
  return (s || '').toLowerCase().replace(/[-._]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Build lookup maps from doctor-subdept-rates data
function buildDrMaps(drData) {
  const drMap = {};      // normDoctor → normSubDept → { paymentType, normalFees }
  const drFirstMap = {}; // normDoctor → first available { paymentType, normalFees }

  for (const r of drData) {
    const dk = normName(r.doctorName);
    const sk = normName(r.subDeptName);
    if (!drMap[dk]) drMap[dk] = {};
    drMap[dk][sk] = { paymentType: r.paymentType, normalFees: Number(r.normalFees) };
    if (!drFirstMap[dk]) drFirstMap[dk] = { paymentType: r.paymentType, normalFees: Number(r.normalFees) };
  }
  return { drMap, drFirstMap };
}

// Calculate hospital and consultant share for a single row
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

export default function ConsultantWiseReport() {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();
  const [rows,      setRows]      = useState([]);
  const [drMap,     setDrMap]     = useState({});
  const [drFirstMap,setDrFirstMap]= useState({});
  const [loading,   setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fromDate       = params.get('fromDate')       || '';
  const toDate         = params.get('toDate')         || '';
  const fromTime       = params.get('fromTime')       || '';
  const toTime         = params.get('toTime')         || '';
  const fromConsultant = params.get('fromConsultant') || '';
  const toConsultant   = params.get('toConsultant')   || '';
  const typesParam     = params.get('types')          || '';

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
    finally   { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const groups = groupByConsultant(rows);

  const grandAmt  = rows.reduce((s, r) => s + Number(r.received || 0), 0);
  const grandCons = rows.reduce((s, r) => s + calcShares(r, drMap, drFirstMap).consAmt, 0);
  const grandHos  = grandAmt - grandCons;

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = document.getElementById('cwr-printable')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>Consultant Wise Patients</title>
      <style>
        body{font-family:Tahoma,sans-serif;font-size:11px;margin:0;padding:12px;}
        table{width:100%;border-collapse:collapse;font-size:10px;}
        th{background:#1a3c6e!important;color:#fff!important;padding:4px 5px;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        td{padding:3px 5px;border-bottom:1px solid #ddd;}
        .cwr-con-header{background:#e8eef8;font-weight:700;padding:5px 6px;margin:10px 0 0;border-left:3px solid #1a3c6e;font-size:11px;}
        .cwr-sub-row td{background:#f0f4fa;font-weight:700;border-top:1px solid #1a3c6e;}
        tfoot td{background:#eef2f8;font-weight:700;border-top:2px solid #1a3c6e;}
        .divider{border:none;border-top:2px solid #1a3c6e;margin:6px 0 8px;}
        h1{font-size:13px;margin:0 0 2px;text-transform:uppercase;letter-spacing:.04em;}
        p{font-size:10px;margin:0;color:#555;}
        .cwr-td-num{text-align:right;}
        .cwr-td-hos{color:#1a3c6e;}
        .cwr-td-cons{color:#166534;}
      </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const handleExportExcel = () => {
    const aoa = [
      ['Consultant Wise Patients Report'],
      [`Date: ${fmtDate(fromDate)} To ${fmtDate(toDate)}`],
      [],
    ];
    for (const { consultant, patients } of groups) {
      aoa.push([`Consultant: ${consultant}`]);
      aoa.push(['S.No','Date','Time','Patient Name','Department','Sub Department','Type','Amount','Hos. Amt.','Cons. Amt.']);
      patients.forEach((r) => {
        const { consAmt, hosAmt } = calcShares(r, drMap, drFirstMap);
        aoa.push([
          r.serialNo ?? '', fmtDate(r.visitDate), r.visitTime || '',
          r.patientName, r.department || '', r.subDepartment || '',
          r.paymentType || '',
          Number(r.received || 0), hosAmt, consAmt,
        ]);
      });
      const subAmt  = patients.reduce((s,r) => s + Number(r.received||0), 0);
      const subCons = patients.reduce((s,r) => s + calcShares(r, drMap, drFirstMap).consAmt, 0);
      aoa.push(['',`Sub Total: ${patients.length} patients`,'','','','','',subAmt, subAmt - subCons, subCons]);
      aoa.push([]);
    }
    aoa.push(['','Grand Total: '+rows.length+' patients','','','','','',grandAmt, grandHos, grandCons]);
    const ws  = XLSX.utils.aoa_to_sheet(aoa);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ConsultantWise');
    XLSX.writeFile(wb, `consultant_wise_${fromDate}_${toDate}.xlsx`);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    toast('Use Patients List page for importing Excel data');
    e.target.value = '';
  };

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
          <button className="cwr-tool-btn cwr-tool-btn--upload" onClick={() => document.getElementById('cwr-file-input').click()} disabled={uploading}>
            <Upload size={14}/> <span>{uploading ? 'Importing…' : 'Import Excel'}</span>
          </button>
          <input id="cwr-file-input" type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={handleUpload}/>
        </div>
        {lastRefresh && (
          <span className="cwr-last-refresh">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* ── Report Area ── */}
      <div className="cwr-report-area">
        <div className="cwr-report-page" id="cwr-printable">

          {/* Hospital header */}
          <div className="cwr-rpt-header">
            <div className="cwr-rpt-hospital">
              <h1>Darul Shifa Hospital</h1>
              <p>Comprehensive Healthcare Services</p>
            </div>
          </div>
          <hr className="cwr-rpt-divider"/>

          {/* Report meta */}
          <div className="cwr-rpt-meta">
            <h2 className="cwr-rpt-title">Consultant Wise Patients</h2>
            <div className="cwr-rpt-dates">
              <span>Date: {fmtDate(fromDate)} To {fmtDate(toDate)}</span>
              {fromConsultant && <span>Consultant: {fromConsultant}{toConsultant !== fromConsultant ? ` → ${toConsultant}` : ''}</span>}
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

          {/* Grand Total */}
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
        </div>
      </div>
    </div>
  );
}
