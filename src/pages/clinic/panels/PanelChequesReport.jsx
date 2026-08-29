import { useState, useEffect, useRef, Fragment } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Printer, Filter as FilterIcon, Upload, X } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import './PanelChequesReport.scss';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const todayIso = () => new Date().toISOString().slice(0, 10);

// `@page` is document-level and shared across the whole app's stylesheet —
// inject a highest-priority override right before printing, remove it after
// (same pattern as PanelBillingDetailReport / PanelBilling's own print).
function printChequesReport() {
  const styleId = 'pcqr-page-size-override';
  let style = document.getElementById(styleId);
  if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
  style.textContent = '@page { size: A4 portrait !important; margin: 10mm !important; }';
  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000);
  window.print();
}

// Legacy "PENAL IPD SUMMARY REPORT" .xls export — Crystal Reports preserves
// the print layout in the sheet (Company header row → Month subtotal row →
// Patient detail rows, all interleaved in column 0/1/5/8/9/10), so this
// walks it by ROW SHAPE rather than fixed columns: a row is a Month subtotal
// if col0 matches "MM - YYYY", a Patient row if col0 is a running Sno AND
// col1 looks like "AdmissionNo - Patient Name" — anything else non-blank in
// col0 is a new Company header ("CODE-Name"). Only col1/5/8/9/10 are ever
// read from a Patient row (Admission#-Name / Bill Type / Date / Amount /
// Status) — every Company/Month row's own totals are recomputed server-side
// instead of trusted from the export.
function parsePanelChequeExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

        const isMonthRow = (c0) => /^\d{2}\s*-\s*\d{4}$/.test(String(c0).trim());
        const isPatientRow = (r) => /^\d+$/.test(String(r[0] || '').trim()) && String(r[1] || '').includes(' - ');

        let dataStartIdx = raw.findIndex((r) => String(r[0] || '').trim().toUpperCase() === 'COMPANY CODE & NAME');
        if (dataStartIdx === -1) dataStartIdx = 0;

        let currentCompany = null;
        const rows = [];
        let skippedOpd = 0;
        let skippedOpdAmount = 0;

        for (let i = dataStartIdx + 1; i < raw.length; i++) {
          const r = raw[i];
          const c0 = String(r[0] || '').trim();
          if (!c0) continue;
          if (isMonthRow(c0)) continue;
          if (isPatientRow(r)) {
            const admPart = String(r[1] || '');
            const dashIdx = admPart.indexOf(' - ');
            if (dashIdx === -1) continue;
            const admissionNo = admPart.slice(0, dashIdx).trim();
            const patientName = admPart.slice(dashIdx + 3).trim();
            const billType = String(r[5] || '').trim();
            const dateRaw = String(r[8] || '').trim(); // ddmmyyyy, no separators
            const amountRaw = String(r[9] || '').trim();
            const status = String(r[10] || '').trim();
            if (billType !== 'Admission') {
              skippedOpd += 1;
              skippedOpdAmount += Number(amountRaw.replace(/,/g, '')) || 0;
              continue;
            }
            const amount = Number(amountRaw.replace(/,/g, '')) || 0;
            let dateIso = null;
            if (/^\d{8}$/.test(dateRaw)) {
              dateIso = `${dateRaw.slice(4, 8)}-${dateRaw.slice(2, 4)}-${dateRaw.slice(0, 2)}`;
            }
            if (!admissionNo || !dateIso || !currentCompany) continue;
            rows.push({
              companyName: currentCompany, admissionNo, patientName, billType, date: dateIso, amount,
              status: status === 'Received' ? 'received' : 'due',
            });
            continue;
          }
          // Company header row — "CODE-Name" (only the name half matters, matched by name below)
          const dashIdx = c0.indexOf('-');
          currentCompany = dashIdx !== -1 ? c0.slice(dashIdx + 1).trim() : c0;
        }
        resolve({ rows, skippedOpd, skippedOpdAmount });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Panels > Reports > Panel Cheques Report — "Bill Report" filter (Due /
// Received / Both, optional Post DT date range, Company, Summary + Comp /
// Month / Patient depth) then a Preview matching the legacy "PANEL IPD
// SUMMARY REPORT": Company header → Billing-Month subtotal → (Patient depth
// only) individual admission rows.
export default function PanelChequesReport() {
  const { fetchPanelChequesReport, panelCompanies, fetchPanelCompanies } = useClinicStore();

  const [showFilter, setShowFilter] = useState(true);
  const [status, setStatus] = useState('both'); // due | received | both
  const [postDT, setPostDT] = useState(false);
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [companyId, setCompanyId] = useState('ALL');
  const [summary, setSummary] = useState(true);
  const [groupBy, setGroupBy] = useState('comp'); // comp | month | patient

  const [data, setData] = useState(null);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appliedFrom, setAppliedFrom] = useState(null);
  const [appliedTo, setAppliedTo] = useState(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => { fetchPanelCompanies(); }, [fetchPanelCompanies]);

  async function handlePreview() {
    setLoading(true);
    try {
      const res = await fetchPanelChequesReport({
        status,
        from: postDT ? fromDate : undefined,
        to: postDT ? toDate : undefined,
        panelCompanyId: companyId,
      });
      setData(res);
      setShown(true);
      setAppliedFrom(postDT ? fromDate : null);
      setAppliedTo(postDT ? toDate : null);
      setShowFilter(false);
    } catch (e) {
      toast.error(e.message || 'Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }

  const companies = data?.companies || [];
  const grandTotal = data?.grandTotal;

  return (
    <div className="pcqr-page">
      <ClinicMenuBar />

      <div className="pcqr-body">
        <div className="pcqr-toolbar no-print">
          <div className="pcqr-titlebar">Panel Cheques Report</div>
          <div className="pcqr-toolbar-actions">
            <button className="pcqr-btn" onClick={() => setShowFilter(true)}><FilterIcon size={14} /> Filter</button>
            <button className="pcqr-btn pcqr-btn--upload" onClick={() => setShowImport(true)}><Upload size={14} /> Upload Excel</button>
            <button className="pcqr-btn pcqr-btn--print" onClick={printChequesReport} disabled={!shown || !companies.length}>
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        <div className="pcqr-report">
          <div className="pcqr-rpt-head">
            <div className="pcqr-rpt-sub">Darul Shifa Hospital</div>
            <div className="pcqr-rpt-title">PANEL IPD SUMMARY REPORT</div>
            <div className="pcqr-rpt-meta">
              <span>From : {appliedFrom ? fmtDate(appliedFrom) : '—'} &nbsp;&nbsp;&nbsp; To : {appliedTo ? fmtDate(appliedTo) : '—'}</span>
              <span>Produced On : {new Date().toLocaleString('en-GB')}</span>
            </div>
          </div>

          {!shown ? (
            <div className="pcqr-empty">Filter set karke <b>Preview</b> dabao.</div>
          ) : !companies.length ? (
            <div className="pcqr-empty">Is filter par koi record nahi mila.</div>
          ) : summary ? (
            <div className="pcqr-table-wrap">
              <table className="pcqr-table">
                <thead>
                  <tr>
                    <th className="pcqr-l">Company Code &amp; Name</th>
                    <th className="pcqr-r">Pat.</th>
                    <th className="pcqr-r">IPD AMT</th>
                    <th className="pcqr-r">OPD AMT</th>
                    <th className="pcqr-r">Amount</th>
                    <th className="pcqr-r">Received</th>
                    <th className="pcqr-r">Ded</th>
                    <th className="pcqr-r">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <Fragment key={c.panelCompanyId ?? 'none'}>
                      <tr className="pcqr-comp-row">
                        <td className="pcqr-l">{c.companyCode ? `${c.companyCode}-` : ''}{c.companyName}</td>
                        <td className="pcqr-r">{c.patCount}</td>
                        <td className="pcqr-r">{fmt(c.ipdAmt)}</td>
                        <td className="pcqr-r">{fmt(c.opdAmt)}</td>
                        <td className="pcqr-r">{fmt(c.amount)}</td>
                        <td className="pcqr-r">{fmt(c.received)}</td>
                        <td className="pcqr-r">{fmt(c.deduction)}</td>
                        <td className="pcqr-r">{fmt(c.balance)}</td>
                      </tr>
                      {groupBy !== 'comp' && c.months.map((m) => (
                        <Fragment key={`${c.panelCompanyId ?? 'none'}-${m.year}-${m.month}`}>
                          <tr className="pcqr-month-row">
                            <td className="pcqr-l pcqr-indent">{m.monthLabel}</td>
                            <td className="pcqr-r">{m.patCount}</td>
                            <td className="pcqr-r">{fmt(m.ipdAmt)}</td>
                            <td className="pcqr-r">{fmt(m.opdAmt)}</td>
                            <td className="pcqr-r">{fmt(m.amount)}</td>
                            <td className="pcqr-r">{fmt(m.received)}</td>
                            <td className="pcqr-r">{fmt(m.deduction)}</td>
                            <td className="pcqr-r">{fmt(m.balance)}</td>
                          </tr>
                          {groupBy === 'patient' && m.patients.map((p) => (
                            <tr className="pcqr-patient-row" key={p.admissionId}>
                              <td className="pcqr-l pcqr-indent2" colSpan={4}>
                                <span className="pcqr-sno">{p.sno}</span>
                                {p.admissionNo} - {p.patientName}
                                <span className="pcqr-bill-type">{p.billType}</span>
                              </td>
                              <td className="pcqr-l pcqr-pdate">{fmtDate(p.date)}</td>
                              <td className="pcqr-r">{fmt(p.amount)}</td>
                              <td className={`pcqr-l pcqr-status ${p.status === 'Due' ? 'pcqr-status--due' : ''}`} colSpan={2}>{p.status}</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
                {grandTotal && (
                  <tfoot>
                    <tr className="pcqr-totals">
                      <td className="pcqr-l">GRAND TOTAL</td>
                      <td className="pcqr-r">{grandTotal.patCount}</td>
                      <td className="pcqr-r">{fmt(grandTotal.ipdAmt)}</td>
                      <td className="pcqr-r">{fmt(grandTotal.opdAmt)}</td>
                      <td className="pcqr-r">{fmt(grandTotal.amount)}</td>
                      <td className="pcqr-r">{fmt(grandTotal.received)}</td>
                      <td className="pcqr-r">{fmt(grandTotal.deduction)}</td>
                      <td className="pcqr-r">{fmt(grandTotal.balance)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            // Summary unchecked — flat, ungrouped list (one row per admission)
            <div className="pcqr-table-wrap">
              <table className="pcqr-table">
                <thead>
                  <tr>
                    <th className="pcqr-l">Company</th>
                    <th className="pcqr-l">Month</th>
                    <th className="pcqr-l">Admission #</th>
                    <th className="pcqr-l">Patient</th>
                    <th className="pcqr-l">Date</th>
                    <th className="pcqr-r">Amount</th>
                    <th className="pcqr-r">Received</th>
                    <th className="pcqr-r">Ded</th>
                    <th className="pcqr-r">Balance</th>
                    <th className="pcqr-l">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.flatMap((c) => c.months.flatMap((m) => m.patients.map((p) => (
                    <tr key={p.admissionId}>
                      <td className="pcqr-l">{c.companyCode} — {c.companyName}</td>
                      <td className="pcqr-l">{m.monthLabel}</td>
                      <td className="pcqr-l">{p.admissionNo}</td>
                      <td className="pcqr-l">{p.patientName}</td>
                      <td className="pcqr-l">{fmtDate(p.date)}</td>
                      <td className="pcqr-r">{fmt(p.amount)}</td>
                      <td className="pcqr-r">{fmt(p.received)}</td>
                      <td className="pcqr-r">{fmt(p.deduction)}</td>
                      <td className="pcqr-r">{fmt(p.balance)}</td>
                      <td className={`pcqr-l ${p.status === 'Due' ? 'pcqr-status--due' : ''}`}>{p.status}</td>
                    </tr>
                  ))))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showFilter && (
        <FilterModal
          status={status} onStatusChange={setStatus}
          postDT={postDT} onPostDTChange={setPostDT}
          fromDate={fromDate} onFromDateChange={setFromDate}
          toDate={toDate} onToDateChange={setToDate}
          companyId={companyId} onCompanyIdChange={setCompanyId}
          companies={panelCompanies}
          summary={summary} onSummaryChange={setSummary}
          groupBy={groupBy} onGroupByChange={setGroupBy}
          onClose={() => setShowFilter(false)}
          onPreview={handlePreview}
          loading={loading}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); if (shown) handlePreview(); }}
        />
      )}
    </div>
  );
}

// Matches the legacy "Bill Report" dialog exactly.
// Bulk-import a legacy "PENAL IPD SUMMARY REPORT" .xls export — parse
// (client-side) → Preview (server dry-run: unmatched companies / collisions
// / duplicates, nothing written yet) → resolve any unmatched company names
// → Confirm (actually writes: one Admission + Billing snapshot + a Cheque
// Receipt for every already-"received" row).
function ImportModal({ onClose, onImported }) {
  const { previewPanelChequeImport, confirmPanelChequeImport, createPanelCompany } = useClinicStore();
  const fileRef = useRef(null);

  const [step, setStep] = useState('pick'); // pick | preview | done
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [skippedOpd, setSkippedOpd] = useState({ count: 0, amount: 0 });
  const [preview, setPreview] = useState(null);
  const [newCodes, setNewCodes] = useState({}); // { companyNameLower: code }
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
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
      const { rows, skippedOpd: opdCount, skippedOpdAmount } = await parsePanelChequeExcel(file);
      if (!rows.length) { toast.error('Excel mein koi valid Admission row nahi mili'); return; }
      const prev = await previewPanelChequeImport(rows);
      setParsedRows(rows);
      setSkippedOpd({ count: opdCount, amount: skippedOpdAmount });
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
    setImporting(true);
    try {
      const companyNameMap = {};
      for (const name of preview.unmatchedCompanies) {
        const key = name.trim().toLowerCase();
        const code = (newCodes[key] || suggestCode(name)).trim();
        if (!code) { toast.error(`"${name}" ke liye code zaroori hai`); setImporting(false); return; }
        const company = await createPanelCompany({ code, name: name.trim(), status: 'active' });
        companyNameMap[key] = company.id;
      }
      const res = await confirmPanelChequeImport(parsedRows, companyNameMap);
      setResult(res);
      setStep('done');
      toast.success(`${res.imported} admissions imported`);
    } catch (err) {
      toast.error(err.message || 'Import fail ho gaya');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="pcqr-modal-overlay" onMouseDown={onClose}>
      <div className="pcqr-modal pcqr-modal--wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pcqr-modal-head">
          <span>Upload Excel — Legacy Panel Bill/Cheque Import</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="pcqr-modal-body">
          {step === 'pick' && (
            <div className="pcqr-import-pick">
              <p>"PENAL IPD SUMMARY REPORT" jaisa .xls file select karein — Company/Month/Patient structure khud detect ho jayega.</p>
              <input ref={fileRef} type="file" accept=".xls,.xlsx" style={{ display: 'none' }} onChange={handlePickFile} />
              <button className="pcqr-btn pcqr-btn--upload" onClick={() => fileRef.current?.click()} disabled={parsing}>
                <Upload size={14} /> {parsing ? 'Parsing…' : 'Select File'}
              </button>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="pcqr-import-preview">
              <div className="pcqr-import-file">File: <b>{fileName}</b></div>
              <div className="pcqr-import-stats">
                <div><span>Total rows found</span><b>{preview.totalRows}</b></div>
                <div><span>Will import (new)</span><b>{preview.willImport - preview.willUpdate}</b></div>
                <div><span>Will backfill (already real, in-progress)</span><b>{preview.willUpdate}</b></div>
                <div><span>Total amount</span><b>{fmt(preview.totalAmount)}</b></div>
                <div><span>Already exist (skipped)</span><b>{preview.collisions.length}</b></div>
                <div><span>Duplicate in file (skipped)</span><b>{preview.duplicatesInFile.length}</b></div>
                {skippedOpd.count > 0 && <div><span>OPD rows skipped</span><b>{skippedOpd.count} ({fmt(skippedOpd.amount)})</b></div>}
              </div>

              {preview.unmatchedCompanies.length > 0 && (
                <div className="pcqr-import-unmatched">
                  <div className="pcqr-import-unmatched-title">Ye company naam DB mein nahi milay — nayi company banegi is code ke sath:</div>
                  {preview.unmatchedCompanies.map((name) => {
                    const key = name.trim().toLowerCase();
                    return (
                      <div className="pcqr-import-unmatched-row" key={key}>
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

          {step === 'done' && result && (
            <div className="pcqr-import-done">
              <p><b>{result.imported}</b> new admissions imported, <b>{result.updated}</b> real in-progress ones backfilled.</p>
              {result.skipped > 0 && <p>{result.skipped} rows skipped (already closed / different patient / unresolved company).</p>}
            </div>
          )}
        </div>

        <div className="pcqr-modal-footer">
          {step === 'preview' && (
            <button className="pcqr-btn pcqr-btn--preview" onClick={handleConfirmImport} disabled={importing}>
              {importing ? 'Importing…' : `Import ${preview.willImport} Admissions`}
            </button>
          )}
          {step === 'done' && (
            <button className="pcqr-btn pcqr-btn--preview" onClick={onImported}>Done</button>
          )}
          <button className="pcqr-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function FilterModal({
  status, onStatusChange, postDT, onPostDTChange, fromDate, onFromDateChange, toDate, onToDateChange,
  companyId, onCompanyIdChange, companies, summary, onSummaryChange, groupBy, onGroupByChange,
  onClose, onPreview, loading,
}) {
  return (
    <div className="pcqr-modal-overlay" onMouseDown={onClose}>
      <div className="pcqr-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pcqr-modal-head">
          <span>Bill Report</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="pcqr-modal-body">
          <div className="pcqr-filter-section pcqr-filter-radios">
            {[['due', 'Due'], ['received', 'Received'], ['both', 'Both']].map(([v, l]) => (
              <label key={v} className="pcqr-radio-lbl">
                <input type="radio" name="pcqr-status" value={v} checked={status === v} onChange={() => onStatusChange(v)} />
                {l}
              </label>
            ))}
          </div>

          <div className="pcqr-filter-section">
            <label className="pcqr-checkbox-lbl">
              <input type="checkbox" checked={postDT} onChange={(e) => onPostDTChange(e.target.checked)} />
              Post DT
            </label>
            <div className="pcqr-date-row">
              <label>From :</label>
              <input type="date" value={fromDate} onChange={(e) => onFromDateChange(e.target.value)} disabled={!postDT} />
              <label>To :</label>
              <input type="date" value={toDate} onChange={(e) => onToDateChange(e.target.value)} disabled={!postDT} />
            </div>
          </div>

          <div className="pcqr-filter-section">
            <label className="pcqr-company-lbl">Company :</label>
            <select value={companyId} onChange={(e) => onCompanyIdChange(e.target.value)}>
              <option value="ALL">ALL</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>

          <div className="pcqr-filter-section pcqr-filter-summary">
            <label className="pcqr-checkbox-lbl">
              <input type="checkbox" checked={summary} onChange={(e) => onSummaryChange(e.target.checked)} />
              Summary
            </label>
            {[['comp', 'Comp'], ['month', 'Month'], ['patient', 'Patient']].map(([v, l]) => (
              <label key={v} className="pcqr-radio-lbl">
                <input type="radio" name="pcqr-groupby" value={v} checked={groupBy === v} onChange={() => onGroupByChange(v)} disabled={!summary} />
                {l}
              </label>
            ))}
          </div>
        </div>

        <div className="pcqr-modal-footer">
          <button className="pcqr-btn pcqr-btn--preview" onClick={onPreview} disabled={loading}>{loading ? 'Loading…' : 'Preview'}</button>
          <button className="pcqr-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
