import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ConsultantStatementReport.scss';

const API = 'http://localhost:5001/api/clinic';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmtDate = (s) => {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00Z');
  return `${String(d.getUTCDate()).padStart(2,'0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

const fmtNum = (n) =>
  Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Returns grouped structure: [ { label, sections: [ { sectionLabel, depts: [ { deptLabel, rows[] } ] } ] } ]
function buildGroups(visits) {
  // Group by paymentType category
  const catMap = new Map();
  for (const v of visits) {
    const cat = v.paymentType === 'panel' ? 'Panel' : 'Other then Panel';
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat).push(v);
  }

  const result = [];
  for (const [label, catVisits] of catMap) {
    const sectionMap = new Map();
    for (const v of catVisits) {
      const sec = v.admitPatient ? 'Admission' : 'OPD';
      if (!sectionMap.has(sec)) sectionMap.set(sec, new Map());
      const deptMap = sectionMap.get(sec);
      const dk = v.subDepartment || v.department || '—';
      if (!deptMap.has(dk)) deptMap.set(dk, []);
      deptMap.get(dk).push(v);
    }

    const sections = [];
    // Admission first, then OPD
    for (const sec of ['Admission', 'OPD']) {
      if (!sectionMap.has(sec)) continue;
      const depts = [];
      for (const [deptLabel, rows] of sectionMap.get(sec)) {
        depts.push({ deptLabel, rows });
      }
      sections.push({ sectionLabel: sec, depts });
    }
    result.push({ label, sections });
  }
  return result;
}

export default function ConsultantStatementReport() {
  const [params]       = useSearchParams();
  const navigate       = useNavigate();
  const { user }       = useAuthStore();
  const printRef       = useRef(null);

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const consultantId = params.get('consultant') || '';
  const fromDate     = params.get('fromDate')   || '';
  const toDate       = params.get('toDate')     || '';
  const fromTime     = params.get('fromTime')   || '';
  const toTime       = params.get('toTime')     || '';
  const shift        = params.get('shift')      || 'ALL';

  const fetchData = async () => {
    if (!consultantId) return;
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams({ consultantId, fromDate, toDate, fromTime, toTime });
      const res = await fetch(`${API}/consultant-statement?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed');
      setData(json.data);
    } catch (e) {
      setError(e.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const now = new Date();
  const printedAt = `${String(now.getDate()).padStart(2,'0')}-${MONTHS[now.getMonth()]}-${now.getFullYear()} ` +
    `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const printedBy = user?.name || 'User';

  const handlePrint = () => {
    const win = window.open('', '_blank');
    const content = printRef.current?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>Consultant Statement</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Tahoma,Arial,sans-serif;font-size:10.5px;padding:10px 14px;color:#111;}
.csr-print-header{margin-bottom:6px;}
.csr-main-title{font-size:13px;font-weight:700;text-align:center;margin-bottom:4px;}
.csr-info-bar{display:flex;justify-content:space-between;font-size:10px;border-top:1px solid #aaa;border-bottom:1px solid #aaa;padding:2px 0;margin-bottom:4px;}
.csr-col-hdr{background:#e8c8c8;font-size:10px;font-weight:700;padding:2px 5px;border-bottom:1px solid #aaa;}
table{width:100%;border-collapse:collapse;}
th,td{padding:2px 5px;font-size:10px;}
.csr-cat-row{background:#f5f5f5;font-weight:700;font-style:italic;font-size:10.5px;padding:3px 5px;border-top:1px solid #aaa;border-bottom:1px solid #aaa;}
.csr-con-row{display:flex;justify-content:space-between;font-weight:700;font-size:11px;padding:3px 5px;border-bottom:1px solid #ddd;}
.csr-con-spec{font-style:italic;}
.csr-sec-row{font-weight:700;padding:2px 8px;background:#f0f0f0;border-bottom:1px solid #ddd;}
.csr-dept-row{font-size:10px;color:#444;padding:1px 14px;border-bottom:1px solid #eee;}
.csr-data-row td{border-bottom:1px solid #eee;}
.csr-data-row:nth-child(even) td{background:#fafafa;}
.csr-total-row td{background:#f0f8e8!important;font-weight:700;border-top:1px solid #aaa;border-bottom:2px solid #aaa;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.csr-grand-row td{background:#e8eef8!important;font-weight:700;border-top:2px solid #333;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.td-r{text-align:right;}
.td-c{text-align:center;}
</style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const visits = data?.visits || [];
  const consultant = data?.consultant;
  const groups = buildGroups(visits);

  const grandAmt  = visits.reduce((s, v) => s + Number(v.amount  || 0), 0);
  const grandCons = visits.reduce((s, v) => s + Number(v.consAmt || 0), 0);

  return (
    <div className="csr-page">
      <ClinicMenuBar />

      {/* Toolbar */}
      <div className="csr-toolbar no-print">
        <button className="csr-btn-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="csr-tool-sep" />
        <button className="csr-btn-tool" onClick={handlePrint} disabled={loading || !data}>
          <Printer size={14} /> Print / PDF
        </button>
        <button className="csr-btn-tool" onClick={fetchData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'csr-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Report Area */}
      <div className="csr-report-area">
        <div className="csr-report-page" ref={printRef}>

          {/* ─── Header ─── */}
          <div className="csr-print-header">
            <div className="csr-main-title">Consultant wise Patients</div>
            <div className="csr-info-bar">
              <span>Date &amp; Time: {printedAt}</span>
              <span>Printed By: {printedBy}</span>
              <span>Page: 1 of 1</span>
            </div>
            <div className="csr-filter-bar">
              <span>Date: {fmtDate(fromDate)} To {fmtDate(toDate)}</span>
              {shift !== 'ALL' && <span>Shift: {shift}</span>}
              {fromTime && <span>Time: {fromTime} — {toTime}</span>}
            </div>
          </div>

          {/* ─── Column Headers ─── */}
          <div className="csr-col-hdr">
            <table>
              <colgroup>
                <col style={{ width: 90 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 55 }} />
                <col />
                <col style={{ width: 95 }} />
                <col style={{ width: 85 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>S. No.</th>
                  <th>MR #</th>
                  <th>Time</th>
                  <th>Patient</th>
                  <th className="td-r">Amount</th>
                  <th className="td-r">Cons. Amt.</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* ─── Loading / Error ─── */}
          {loading && <div className="csr-empty">Loading…</div>}
          {error   && <div className="csr-empty csr-empty--err">{error}</div>}
          {!loading && !error && visits.length === 0 && (
            <div className="csr-empty">No records found for the selected filters.</div>
          )}

          {/* ─── Report Body ─── */}
          {!loading && !error && groups.map(({ label, sections }) => (
            <div key={label}>
              {/* Category header: Other then Panel / Panel */}
              <div className="csr-cat-row">{label}</div>

              {/* Consultant header */}
              {consultant && (
                <div className="csr-con-row">
                  <span><strong>{consultant.code}</strong>&nbsp;&nbsp;<strong>{consultant.name}</strong></span>
                  <span className="csr-con-spec">{consultant.speciality || ''}</span>
                </div>
              )}

              {sections.map(({ sectionLabel, depts }) => {
                const secAmt  = depts.flatMap(d => d.rows).reduce((s, v) => s + Number(v.amount  || 0), 0);
                const secCons = depts.flatMap(d => d.rows).reduce((s, v) => s + Number(v.consAmt || 0), 0);
                const secCount = depts.flatMap(d => d.rows).length;

                return (
                  <div key={sectionLabel}>
                    {/* Section header: Admission / OPD */}
                    <div className="csr-sec-row">{sectionLabel}</div>

                    {depts.map(({ deptLabel, rows }) => {
                      const deptAmt  = rows.reduce((s, v) => s + Number(v.amount  || 0), 0);
                      const deptCons = rows.reduce((s, v) => s + Number(v.consAmt || 0), 0);
                      return (
                        <div key={deptLabel}>
                          {/* Dept/Sub-dept header */}
                          <div className="csr-dept-row">{deptLabel}</div>

                          <table className="csr-table">
                            <colgroup>
                              <col style={{ width: 90 }} />
                              <col style={{ width: 70 }} />
                              <col style={{ width: 55 }} />
                              <col />
                              <col style={{ width: 95 }} />
                              <col style={{ width: 85 }} />
                            </colgroup>
                            <tbody>
                              {rows.map((v) => (
                                <tr key={v.id} className="csr-data-row">
                                  <td>{v.serialNo}</td>
                                  <td className="td-c">{v.mrNo || '—'}</td>
                                  <td className="td-c">{v.visitTime}</td>
                                  <td>{v.patientName}</td>
                                  <td className="td-r">{fmtNum(v.amount)}</td>
                                  <td className="td-r">{fmtNum(v.consAmt)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="csr-total-row">
                                <td colSpan={3} />
                                <td className="csr-total-label">
                                  Total For This Department &nbsp;&nbsp; {rows.length}
                                </td>
                                <td className="td-r">{fmtNum(deptAmt)}</td>
                                <td className="td-r">{fmtNum(deptCons)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}

          {/* ─── Grand Total ─── */}
          {!loading && !error && visits.length > 0 && (
            <table className="csr-table csr-grand-table">
              <colgroup>
                <col style={{ width: 90 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 55 }} />
                <col />
                <col style={{ width: 95 }} />
                <col style={{ width: 85 }} />
              </colgroup>
              <tfoot>
                <tr className="csr-grand-row">
                  <td colSpan={3} />
                  <td>
                    Total Patients: &nbsp;<strong>{visits.length}</strong>
                    &nbsp;&nbsp;&nbsp; Total Amount:
                  </td>
                  <td className="td-r"><strong>{fmtNum(grandAmt)}</strong></td>
                  <td className="td-r"><strong>{fmtNum(grandCons)}</strong></td>
                </tr>
              </tfoot>
            </table>
          )}

        </div>
      </div>
    </div>
  );
}
