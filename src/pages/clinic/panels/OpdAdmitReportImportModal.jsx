import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload, X } from 'lucide-react';
import { useClinicStore } from '../../../store/useClinicStore';
import useModalKeys from '../../../hooks/useModalKeys';
import './OpdAdmitReport.scss';
import { useShallow } from 'zustand/react/shallow';

// OPD Admit Report's "Upload Excel" dialog — moved out of OpdAdmitReport.jsx
// unchanged so both the filter screen and the preview can open it.

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

const CONFIRM_BATCH_SIZE = 300; // admissions per request — same body-size safety margin as Medicine Report's import

export default function OpdAdmitReportImportModal({ onClose }) {
  const { previewPanelAdmitReportImport, confirmPanelAdmitReportImportBatch, createPanelCompany } = useClinicStore(useShallow((s) => ({ previewPanelAdmitReportImport: s.previewPanelAdmitReportImport, confirmPanelAdmitReportImportBatch: s.confirmPanelAdmitReportImportBatch, createPanelCompany: s.createPanelCompany })));
  const fileRef = useRef(null);

  const [step, setStep] = useState('pick'); // pick | preview | importing | done
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // { admissions, totalRows, totalAmount, truncated, corruptDates, disBeforeAdmit }
  const [preview, setPreview] = useState(null);
  const [newCodes, setNewCodes] = useState({});
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);

  // ESC mirrors the header X button: closable only when not mid-import.
  const canClose = step === 'pick' || step === 'preview' || step === 'done';
  useModalKeys({ active: true, onEsc: canClose ? onClose : undefined });

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
      <div className="oar-modal oar-modal--wide" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="oar-modal-head">
          <span>Upload Excel — Admission Wise Panel Report</span>
          {(step === 'pick' || step === 'preview' || step === 'done') && (
            <button onClick={onClose} aria-label="Close" title="Close"><X size={16} /></button>
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
