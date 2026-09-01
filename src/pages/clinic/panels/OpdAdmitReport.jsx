import { useState, useEffect, useRef, Fragment } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Filter as FilterIcon, Printer, Upload, X } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import './OpdAdmitReport.scss';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const todayIso = () => new Date().toISOString().slice(0, 10);

// `@page` is document-level and shared across the whole app's stylesheet —
// inject a highest-priority override right before printing, remove it after
// (same pattern as Panel Cheques Report / Medicine Report's own print).
function printOpdAdmitReport() {
  const styleId = 'oar-page-size-override';
  let style = document.getElementById(styleId);
  if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
  style.textContent = '@page { size: A4 portrait !important; margin: 10mm !important; }';
  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000);
  window.print();
}

// Excel's date epoch is 1899-12-30 — standard serial→JS Date conversion
// (25569 = days between that epoch and the Unix epoch).
function excelSerialToDate(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Math.round((n - 25569) * 86400 * 1000));
}

// Legacy "ADMISSION WISE PANEL REPORT" (RptAdmitPanel.rpt) .xls export —
// walked by ROW SHAPE, same principle as the other Panel imports. A header
// row always has a non-blank col0 ("AdmitNo - Patient Name", Employee in
// col3, Company in col5, Status in col7, Admit/Dis Date in col8/col9). A
// footer row ("TOTAL OF ADMISSION :" etc — col4 non-blank) plus a trailing
// Crystal Reports pagination artifact ("4294967295 of 1") close the sheet —
// both skipped, never trusted, same as a header row's own SLIP/AMOUNT (the
// report always recomputes those as the sum of the dept rows underneath).
//
// Two export variants exist, matching the legacy dialog's "Details" vs
// "With Slip" radio — same admissions/depts/totals, different sub-row
// layout, auto-detected from the first sub-row seen after the first header:
//   plain:      dept label in col8, its own Slip/Amount in col10/col11.
//   with slip:  dept label in col3 instead (Slip/Amount in col6/col7), PLUS
//               one child row per individual slip underneath each dept —
//               "SlipNo - Patient Name" in col3, its own Amount in col7 (no
//               Slip count column for a slip row, only a dept row has one).
function parseAdmitPanelExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

        const isFooterRow = (r) => String(r[4] || '').trim() !== '';
        const isJunkRow = (r) => String(r[8] || '').includes('4294967295');
        const isHeaderRow = (r) => String(r[0] || '').trim() !== '';

        const admissions = [];
        let current = null;
        let currentDept = null;
        let format = null; // 'plain' | 'withSlip' — decided from the first sub-row seen
        let totalRows = 0;
        let totalAmount = 0;
        let corruptDates = 0;
        let disBeforeAdmit = 0;

        for (let i = 0; i < raw.length; i++) {
          const r = raw[i];
          if (r.every((c) => String(c).trim() === '')) continue;
          if (isFooterRow(r) || isJunkRow(r)) continue;

          if (isHeaderRow(r)) {
            if (current && current.depts.length) admissions.push(current);
            const admPart = String(r[0] || '');
            const dash = admPart.indexOf(' - ');
            const admissionNo = dash !== -1 ? admPart.slice(0, dash).trim() : '';
            const patientName = dash !== -1 ? admPart.slice(dash + 3).trim() : admPart.trim();
            const admitDate = excelSerialToDate(r[8]);
            const dischargeDate = excelSerialToDate(r[9]);
            if (admissionNo) {
              current = {
                admissionNo, patientName,
                employeeName: String(r[3] || '').trim(),
                companyName: String(r[5] || '').trim(),
                status: String(r[7] || '').trim(),
                admitDate: admitDate ? admitDate.toISOString() : null,
                dischargeDate: dischargeDate ? dischargeDate.toISOString() : null,
                depts: [],
              };
              if (!admitDate) corruptDates += 1;
              if (admitDate && dischargeDate && dischargeDate < admitDate) disBeforeAdmit += 1;
            } else {
              current = null;
            }
            currentDept = null;
            continue;
          }
          if (!current) continue;

          if (format === null) {
            format = (String(r[3] || '').trim() && !String(r[3]).includes(' - ')) ? 'withSlip' : 'plain';
          }

          if (format === 'plain') {
            if (String(r[8] || '').trim()) {
              const slip = Number(r[10]) || 0;
              const amount = Number(r[11]) || 0;
              current.depts.push({ dept: String(r[8]).trim(), slip, amount, slips: [] });
              totalRows += 1;
              totalAmount += amount;
            }
            continue;
          }

          // withSlip: a dept row (plain label, no dash) opens a new dept;
          // a slip row ("SlipNo - Name") attaches under whichever dept
          // opened most recently. The " - " check runs on the UNtrimmed cell
          // — a slip with no patient name after the dash ("002847837 - ")
          // loses its trailing space to trim() and would otherwise be
          // misread as a dept row.
          const col3Raw = String(r[3] || '');
          const col3 = col3Raw.trim();
          const hasDash = col3Raw.includes(' - ');
          if (col3 && !hasDash) {
            currentDept = { dept: col3, slip: Number(r[6]) || 0, amount: Number(r[7]) || 0, slips: [] };
            current.depts.push(currentDept);
            totalRows += 1;
          } else if (hasDash && currentDept) {
            const dash = col3Raw.indexOf(' - ');
            const slipNo = col3Raw.slice(0, dash).trim();
            const slipName = col3Raw.slice(dash + 3).trim();
            const amount = Number(r[7]) || 0;
            currentDept.slips.push({ slipNo: slipNo || null, patientName: slipName || null, amount });
            totalAmount += amount;
          }
        }
        if (current && current.depts.length) admissions.push(current);

        const truncated = raw.length >= 65535;
        resolve({ admissions, totalRows, totalAmount, truncated, corruptDates, disBeforeAdmit, format: format || 'plain' });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Panels > Reports > OPD Admit Report — legacy "Panel Report" filter dialog.
// Admission/OPD picks which patient universe, Discharge/Admit picks which
// date the From/To range applies to, an optional Company narrows it, and
// Details/Headers/Summary/With Slip picks the output shape. Only
// Admission + Details is built (matching the "ADMISSION WISE PANEL REPORT"
// reference) — the other combinations still show a placeholder until their
// own reference is provided, same staged approach as every other report in
// this section. Import is fully standalone — same architecture/rationale as
// Medicine Report's (see clinic.service.js): never creates or matches a
// ClinicAdmission, just reflects the uploaded file's own data as-is.
export default function OpdAdmitReport() {
  const { panelCompanies, fetchPanelCompanies, fetchPanelAdmitReport } = useClinicStore();

  const [showFilter, setShowFilter] = useState(true);

  const [scopeType, setScopeType] = useState('admission'); // admission | opd
  const [dateType, setDateType] = useState('discharge'); // discharge | admit
  // Wide-open by default (this report's data is legacy/bulk-imported, not
  // "today"-centric) — narrows to today-today would silently show zero rows
  // right after a fresh import. User can tighten the range from here.
  const [fromDate, setFromDate] = useState('2000-01-01');
  const [toDate, setToDate] = useState(todayIso());
  const [companyId, setCompanyId] = useState('ALL');
  // Defaults to 'details' rather than the legacy dialog's own 'headers'
  // default — only Details is actually wired up so far (see notBuiltYet
  // below), and defaulting into an unbuilt stub would hide real data.
  const [viewMode, setViewMode] = useState('details'); // details | headers | summary | withSlip

  const [showImport, setShowImport] = useState(false);

  const [data, setData] = useState(null);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appliedFrom, setAppliedFrom] = useState(null);
  const [appliedTo, setAppliedTo] = useState(null);
  const [appliedScope, setAppliedScope] = useState(null);
  const [appliedViewMode, setAppliedViewMode] = useState(null);

  useEffect(() => { fetchPanelCompanies(); }, [fetchPanelCompanies]);

  const selectedCompany = panelCompanies.find((c) => String(c.id) === String(companyId));

  async function handlePreview() {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setAppliedScope(scopeType);
    setAppliedViewMode(viewMode);
    setShown(true);
    setShowFilter(false);

    if (scopeType !== 'admission' || (viewMode !== 'details' && viewMode !== 'withSlip')) {
      setData(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetchPanelAdmitReport({
        dateType, fromDate, toDate,
        panelCompanyId: companyId !== 'ALL' ? companyId : undefined,
      });
      setData(res);
    } catch (err) {
      toast.error(err.message || 'Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }

  const hasRows = data && data.admissions && data.admissions.length > 0;
  const notBuiltYet = shown && (appliedScope !== 'admission' || (appliedViewMode !== 'details' && appliedViewMode !== 'withSlip'));
  const showSlips = appliedViewMode === 'withSlip';

  const metaText = [
    scopeType === 'admission' ? 'Admission' : 'OPD',
    dateType === 'discharge' ? 'Discharge Date' : 'Admit Date',
    `From : ${fmtDate(appliedFrom)}   To : ${fmtDate(appliedTo)}`,
    selectedCompany ? `Company : ${selectedCompany.code} - ${selectedCompany.name}` : null,
  ].filter(Boolean).join('   |   ');

  return (
    <div className="oar-page">
      <ClinicMenuBar />

      <div className="oar-body">
        <div className="oar-toolbar no-print">
          <div className="oar-titlebar">OPD Admit Report</div>
          <div className="oar-toolbar-actions">
            <button className="oar-btn" onClick={() => setShowFilter(true)}><FilterIcon size={14} /> Filter</button>
            <button className="oar-btn oar-btn--upload" onClick={() => setShowImport(true)}><Upload size={14} /> Upload Excel</button>
            <button className="oar-btn oar-btn--print" onClick={printOpdAdmitReport} disabled={!hasRows}>
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        <div className="oar-report">
          <div className="oar-rpt-head">
            <div className="oar-rpt-sub">Darul Shifa Hospital</div>
            <div className="oar-rpt-title">ADMISSION WISE PANEL REPORT</div>
            {shown && (
              <div className="oar-rpt-meta">
                <span>{metaText}</span>
                <span>Produced On : {new Date().toLocaleString('en-GB')}</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="oar-empty">Loading…</div>
          ) : !shown ? (
            <div className="oar-empty">Filter set karke <b>Preview</b> dabao.</div>
          ) : notBuiltYet ? (
            <div className="oar-empty">
              Yeh combination (OPD scope / Headers / Summary) abhi banaya nahi gaya — filhal sirf <b>Admission</b> + <b>Details</b>/<b>With Slip</b> available hai.
            </div>
          ) : !hasRows ? (
            <div className="oar-empty">Is filter par koi record nahi mila.</div>
          ) : (
            <div className="oar-table-wrap">
              <table className="oar-table">
                <thead>
                  <tr>
                    <th className="oar-l">Admit Number &amp; Patient Name</th>
                    <th className="oar-l">Employee Name</th>
                    <th className="oar-l">Company</th>
                    <th className="oar-l">Status</th>
                    <th className="oar-l">Admit Date</th>
                    <th className="oar-l">Dis Date</th>
                    <th className="oar-r">Slip</th>
                    <th className="oar-r">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.admissions.map((a) => (
                    <Fragment key={a.admissionNo}>
                      <tr className="oar-adm-row">
                        <td className="oar-l">{a.admissionNo} - {a.patientName}</td>
                        <td className="oar-l">{a.employeeName || '—'}</td>
                        <td className="oar-l">{a.companyName || '—'}</td>
                        <td className="oar-l">{a.status || '—'}</td>
                        <td className="oar-l">{fmtDate(a.admitDate)}</td>
                        <td className="oar-l">{fmtDate(a.dischargeDate)}</td>
                        <td className="oar-r">{a.slip}</td>
                        <td className="oar-r">{fmt(a.amount)}</td>
                      </tr>
                      {a.depts.map((d, idx) => (
                        <Fragment key={`${a.admissionNo}-${idx}`}>
                          <tr className="oar-dept-row">
                            <td className="oar-l" colSpan={3} />
                            <td className="oar-l oar-dept-lbl">{d.dept}</td>
                            <td colSpan={2} />
                            <td className="oar-r">{d.slip}</td>
                            <td className="oar-r">{fmt(d.amount)}</td>
                          </tr>
                          {showSlips && d.slips.map((s, sidx) => (
                            <tr className="oar-slip-row" key={`${a.admissionNo}-${idx}-${sidx}`}>
                              <td className="oar-l" colSpan={3} />
                              <td className="oar-l oar-slip-lbl">
                                {s.slipNo ? String(s.slipNo).padStart(9, '0') : '—'} - {s.patientName || a.patientName}
                              </td>
                              <td colSpan={3} />
                              <td className="oar-r">{fmt(s.amount)}</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="oar-totals">
                    <td className="oar-l" colSpan={6}>Total Admissions : {data.totals.admissionCount}</td>
                    <td className="oar-r">{data.totals.slip}</td>
                    <td className="oar-r">{fmt(data.totals.amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {showFilter && (
        <FilterModal
          scopeType={scopeType} onScopeTypeChange={setScopeType}
          dateType={dateType} onDateTypeChange={setDateType}
          fromDate={fromDate} onFromDateChange={setFromDate}
          toDate={toDate} onToDateChange={setToDate}
          companyId={companyId} onCompanyIdChange={setCompanyId}
          companies={panelCompanies}
          viewMode={viewMode} onViewModeChange={setViewMode}
          onClose={() => setShowFilter(false)}
          onPreview={handlePreview}
        />
      )}

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}

// Matches the legacy "Panel Report" dialog exactly.
function FilterModal({
  scopeType, onScopeTypeChange, dateType, onDateTypeChange,
  fromDate, onFromDateChange, toDate, onToDateChange,
  companyId, onCompanyIdChange, companies,
  viewMode, onViewModeChange,
  onClose, onPreview,
}) {
  return (
    <div className="oar-modal-overlay" onMouseDown={onClose}>
      <div className="oar-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="oar-modal-head">
          <span>Panel Report</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="oar-modal-body">
          <div className="oar-filter-section oar-filter-radios">
            {[['admission', 'Admission'], ['opd', 'OPD']].map(([v, l]) => (
              <label key={v} className="oar-radio-lbl">
                <input type="radio" name="oar-scope" value={v} checked={scopeType === v} onChange={() => onScopeTypeChange(v)} />
                {l}
              </label>
            ))}
          </div>

          <div className="oar-filter-section oar-filter-radios">
            {[['discharge', 'Discharge'], ['admit', 'Admit']].map(([v, l]) => (
              <label key={v} className="oar-radio-lbl">
                <input type="radio" name="oar-datetype" value={v} checked={dateType === v} onChange={() => onDateTypeChange(v)} />
                {l}
              </label>
            ))}
          </div>

          <div className="oar-filter-section">
            <div className="oar-date-row">
              <label>From :</label>
              <input type="date" value={fromDate} onChange={(e) => onFromDateChange(e.target.value)} />
              <label>To :</label>
              <input type="date" value={toDate} onChange={(e) => onToDateChange(e.target.value)} />
            </div>
          </div>

          <div className="oar-filter-section">
            <label className="oar-company-lbl">Company :</label>
            <select value={companyId} onChange={(e) => onCompanyIdChange(e.target.value)}>
              <option value="ALL">ALL</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>

          <div className="oar-filter-section oar-filter-radios">
            {[['details', 'Details'], ['headers', 'Headers'], ['summary', 'Summary'], ['withSlip', 'With Slip']].map(([v, l]) => (
              <label key={v} className="oar-radio-lbl">
                <input type="radio" name="oar-viewmode" value={v} checked={viewMode === v} onChange={() => onViewModeChange(v)} />
                {l}
              </label>
            ))}
          </div>
        </div>

        <div className="oar-modal-footer">
          <button className="oar-btn oar-btn--preview" onClick={onPreview}>Preview</button>
          <button className="oar-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

const CONFIRM_BATCH_SIZE = 300; // admissions per request — same body-size safety margin as Medicine Report's import

function ImportModal({ onClose }) {
  const { previewPanelAdmitReportImport, confirmPanelAdmitReportImportBatch, createPanelCompany } = useClinicStore();
  const fileRef = useRef(null);

  const [step, setStep] = useState('pick'); // pick | preview | importing | done
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // { admissions, totalRows, totalAmount, truncated, corruptDates, disBeforeAdmit }
  const [preview, setPreview] = useState(null);
  const [newCodes, setNewCodes] = useState({});
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);

  function suggestCode(name) {
    return name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 8);
  }

  async function handlePickFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    try {
      const data = await parseAdmitPanelExcel(file);
      if (!data.admissions.length) { toast.error('Excel mein koi valid admission nahi mili'); return; }
      const admissionNos = data.admissions.map((a) => a.admissionNo);
      const companyNames = [...new Set(data.admissions.map((a) => a.companyName).filter(Boolean))];
      const prev = await previewPanelAdmitReportImport({
        admissionNos, companyNames, totalRows: data.totalRows, totalAmount: data.totalAmount,
      });
      setParsed(data);
      setPreview(prev);
      const codes = {};
      prev.unmatchedCompanies.forEach((name) => { codes[name.trim().toLowerCase()] = suggestCode(name); });
      setNewCodes(codes);
      setStep('preview');
    } catch (err) {
      toast.error(err.message || 'File parse/preview nahi hui');
    } finally {
      setParsing(false);
      e.target.value = '';
    }
  }

  async function handleConfirmImport() {
    setStep('importing');
    try {
      const companyNameMap = {};
      for (const name of preview.unmatchedCompanies) {
        const key = name.trim().toLowerCase();
        const code = (newCodes[key] || suggestCode(name)).trim();
        if (!code) { toast.error(`"${name}" ke liye code zaroori hai`); setStep('preview'); return; }
        const company = await createPanelCompany({ code, name: name.trim(), status: 'active' });
        companyNameMap[key] = company.id;
      }

      const batches = [];
      for (let i = 0; i < parsed.admissions.length; i += CONFIRM_BATCH_SIZE) {
        batches.push(parsed.admissions.slice(i, i + CONFIRM_BATCH_SIZE));
      }
      setProgress({ done: 0, total: batches.length });

      const totals = { imported: 0, refreshed: 0, skipped: 0, deptsCreated: 0 };
      for (const batch of batches) {
        const res = await confirmPanelAdmitReportImportBatch(batch, companyNameMap);
        totals.imported += res.imported;
        totals.refreshed += res.refreshed;
        totals.skipped += res.skipped;
        totals.deptsCreated += res.deptsCreated;
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
      setResult(totals);
      setStep('done');
      toast.success(`${totals.imported + totals.refreshed} admission record(s) import ho gaye`);
    } catch (err) {
      toast.error(err.message || 'Import fail ho gaya');
      setStep('preview');
    }
  }

  return (
    <div className="oar-modal-overlay" onMouseDown={step === 'pick' || step === 'preview' ? onClose : undefined}>
      <div className="oar-modal oar-modal--wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="oar-modal-head">
          <span>Upload Excel — Admission Wise Panel Report</span>
          {(step === 'pick' || step === 'preview' || step === 'done') && (
            <button onClick={onClose}><X size={16} /></button>
          )}
        </div>

        <div className="oar-modal-body">
          {step === 'pick' && (
            <div className="oar-import-pick">
              <p>"ADMISSION WISE PANEL REPORT" (RptAdmitPanel.rpt) jaisa .xls file select karein — plain ya "with slip" (dept ke andar individual slip breakdown) dono variant khud detect ho jayenge.</p>
              <input ref={fileRef} type="file" accept=".xls,.xlsx" style={{ display: 'none' }} onChange={handlePickFile} />
              <button className="oar-btn oar-btn--upload" onClick={() => fileRef.current?.click()} disabled={parsing}>
                <Upload size={14} /> {parsing ? 'Parsing…' : 'Select File'}
              </button>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="oar-import-preview">
              <div className="oar-import-file">File: <b>{fileName}</b></div>

              {parsed.truncated && (
                <div className="oar-import-warning">
                  Yeh file 65,535 rows pe cut ho gayi hai — purane .xls format ki hard limit hai. Zaroorat ho to .xlsx
                  format mein dobara export kar ke check kar lein.
                </div>
              )}
              {parsed.corruptDates > 0 && (
                <div className="oar-import-warning">
                  {parsed.corruptDates} admission(s) ki Admit Date parse nahi hui (corrupt source data) — yeh skip ho jayengi.
                </div>
              )}
              {parsed.disBeforeAdmit > 0 && (
                <div className="oar-import-warning">
                  {parsed.disBeforeAdmit} admission(s) mein Dis Date, Admit Date se pehle hai — yeh source file ka apna data hai, as-is import hoga.
                </div>
              )}

              <div className="oar-import-stats">
                <div><span>Total admissions found</span><b>{preview.totalAdmissions}</b></div>
                <div><span>Total dept rows</span><b>{preview.totalRows}</b></div>
                <div><span>Will import (new)</span><b>{preview.willCreate}</b></div>
                <div><span>Will refresh (already imported before)</span><b>{preview.willRefresh}</b></div>
                <div><span>Total amount</span><b>{fmt(preview.totalAmount)}</b></div>
              </div>

              {preview.unmatchedCompanies.length > 0 && (
                <div className="oar-import-unmatched">
                  <div className="oar-import-unmatched-title">Ye company naam DB mein nahi milay — nayi company banegi is code ke sath:</div>
                  {preview.unmatchedCompanies.map((name) => {
                    const key = name.trim().toLowerCase();
                    return (
                      <div className="oar-import-unmatched-row" key={key}>
                        <span>{name}</span>
                        <input
                          value={newCodes[key] || ''}
                          onChange={(e) => setNewCodes((c) => ({ ...c, [key]: e.target.value.toUpperCase() }))}
                          placeholder="CODE"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="oar-import-progress">
              <p>Import ho raha hai — batch {progress.done} / {progress.total}…</p>
              <div className="oar-import-progress-bar">
                <div className="oar-import-progress-fill" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div className="oar-import-done">
              <p><b>{result.imported}</b> new admission record(s) imported, <b>{result.refreshed}</b> already-imported one(s) refreshed with this file.</p>
              <p><b>{result.deptsCreated}</b> department rows created.</p>
              {result.skipped > 0 && <p>{result.skipped} row(s) skipped (admission # ya department rows missing).</p>}
            </div>
          )}
        </div>

        <div className="oar-modal-footer">
          {step === 'preview' && (
            <button className="oar-btn oar-btn--upload" onClick={handleConfirmImport}>
              Import {preview.willCreate + preview.willRefresh} Records
            </button>
          )}
          {step === 'done' && (
            <button className="oar-btn oar-btn--upload" onClick={onClose}>Done</button>
          )}
          {(step === 'pick' || step === 'preview' || step === 'done') && (
            <button className="oar-btn" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}
