import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload, X } from 'lucide-react';
import { useClinicStore } from '../../../store/useClinicStore';
import useModalKeys from '../../../hooks/useModalKeys';
import './MedicineReport.scss';

// Medicine Report's "Upload Excel" dialog — moved out of MedicineReport.jsx
// unchanged so both the filter screen and the preview can open it.

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Excel's date epoch is 1899-12-30 — this is the standard serial→JS Date
// conversion (25569 = days between that epoch and the Unix epoch).
function excelSerialToDate(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Math.round((n - 25569) * 86400 * 1000));
}

// Legacy "MADICAL ISSUANCE REPORT FOR PANEL" .xls export (Crystal Reports) —
// walked by ROW SHAPE, same principle as the Panel Cheque import: a Day
// subtotal row (col9 has "DAY WISE TOTAL"), a Patient row (col1 === "PATANT
// :", admission#/name in col2, Admit Date + Status further along), the very
// next row is that patient's Company + Discharge Date, then a column-header
// row, then one row per medicine (col0 a running Sno, col1 the
// description — often with NO leading code, unlike the price list import),
// and a TOTAL row closing that patient out. Company/Day totals are never
// trusted from the export, only recomputed server-side downstream.
//
// The source format itself caps a sheet at 65,535 rows — a large export
// lands mid-record at that ceiling, so `truncated` flags whenever the sheet
// hits it, and the parser just keeps whatever full admission blocks it
// managed to read before the cutoff (a half-written last block is dropped,
// never imported partially).
function parsePanelMedicineIssuanceExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

        const isDayRow = (r) => String(r[9] || '').includes('DAY WISE TOTAL');
        const isPatientRow = (r) => String(r[1] || '').trim() === 'PATANT :';
        const isCompanyRow = (r) => String(r[0] || '').trim() === 'COMPANY :';
        const isColHeaderRow = (r) => String(r[0] || '').trim() === 'SNO' && String(r[1] || '').trim() === 'DESCRIPTION';
        const isTotalRow = (r) => String(r[5] || '').trim().replace(/:$/, '') === 'TOTAL';
        const isDetailRow = (r) => Number.isInteger(r[0]) && r[0] > 0 && String(r[1] || '').trim() !== '';

        const admissions = [];
        let current = null;
        let totalRows = 0;
        let totalAmount = 0;
        let corruptDates = 0;

        for (let i = 0; i < raw.length; i++) {
          const r = raw[i];
          if (isDayRow(r) || isColHeaderRow(r) || isTotalRow(r)) continue;
          if (r.every((c) => String(c).trim() === '')) continue;

          if (isPatientRow(r)) {
            if (current && current.items.length) admissions.push(current);
            const admPart = String(r[2] || '');
            const dash = admPart.indexOf(' - ');
            const admissionNo = dash !== -1 ? admPart.slice(0, dash).trim() : '';
            const patientName = dash !== -1 ? admPart.slice(dash + 3).trim() : admPart.trim();
            const admitDate = excelSerialToDate(r[7]);
            if (admissionNo && admitDate) {
              current = { admissionNo, patientName, companyName: '', admitDate: admitDate.toISOString(), dischargeDate: null, items: [] };
            } else {
              current = null;
              if (admissionNo) corruptDates += 1;
            }
            continue;
          }

          if (isCompanyRow(r)) {
            if (current) {
              current.companyName = String(r[1] || '').trim();
              const disDate = excelSerialToDate(r[7]);
              current.dischargeDate = disDate ? disDate.toISOString() : current.admitDate;
            }
            continue;
          }

          if (isDetailRow(r) && current) {
            const medDate = excelSerialToDate(r[3]);
            const rate = Number(r[5]) || 0;
            const qty = Number(r[6]) || 0;
            const amount = Number(r[7]) || 0;
            current.items.push({
              description: String(r[1] || '').trim(),
              medDate: medDate ? medDate.toISOString() : current.admitDate,
              rate, qty, amount,
              store: String(r[10] || '').trim(),
            });
            totalRows += 1;
            totalAmount += amount;
          }
        }
        // The very last block in a truncated file has no closing TOTAL row —
        // still a real, fully-parsed patient with real items, so keep it.
        if (current && current.items.length) admissions.push(current);

        const truncated = raw.length >= 65535;
        resolve({ admissions, totalRows, totalAmount, truncated, corruptDates });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const CONFIRM_BATCH_SIZE = 300; // admissions per request — keeps each POST well under the body-size limit regardless of file size

export default function MedicineReportImportModal({ onClose }) {
  const { previewPanelMedicineIssuanceImport, confirmPanelMedicineIssuanceImportBatch, createPanelCompany } = useClinicStore();
  const fileRef = useRef(null);

  const [step, setStep] = useState('pick'); // pick | preview | importing | done
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null); // { admissions, totalRows, totalAmount, truncated, corruptDates }
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
      const data = await parsePanelMedicineIssuanceExcel(file);
      if (!data.admissions.length) { toast.error('Excel mein koi valid admission nahi mili'); return; }
      const admissionNos = data.admissions.map((a) => a.admissionNo);
      const companyNames = [...new Set(data.admissions.map((a) => a.companyName).filter(Boolean))];
      const prev = await previewPanelMedicineIssuanceImport({
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

      const totals = { imported: 0, refreshed: 0, skipped: 0, itemsCreated: 0 };
      for (const batch of batches) {
        const res = await confirmPanelMedicineIssuanceImportBatch(batch, companyNameMap);
        totals.imported += res.imported;
        totals.refreshed += res.refreshed;
        totals.skipped += res.skipped;
        totals.itemsCreated += res.itemsCreated;
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
      setResult(totals);
      setStep('done');
      toast.success(`${totals.imported + totals.refreshed} patient record(s), ${totals.itemsCreated} medicine rows import ho gaye`);
    } catch (err) {
      toast.error(err.message || 'Import fail ho gaya');
      setStep('preview');
    }
  }

  return (
    <div className="mrp-modal-overlay" onMouseDown={step === 'pick' || step === 'preview' ? onClose : undefined}>
      <div className="mrp-modal mrp-modal--wide" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mrp-modal-head">
          <span>Upload Excel — Medical Issuance Report for Panel</span>
          {(step === 'pick' || step === 'preview' || step === 'done') && (
            <button onClick={onClose} aria-label="Close" title="Close"><X size={16} /></button>
          )}
        </div>

        <div className="mrp-modal-body">
          {step === 'pick' && (
            <div className="mrp-import-pick">
              <p>"MADICAL ISSUANCE REPORT FOR PANEL" jaisa .xls file select karein — patient/company/medicine structure khud detect ho jayega.</p>
              <input ref={fileRef} type="file" accept=".xls,.xlsx" style={{ display: 'none' }} onChange={handlePickFile} />
              <button className="mrp-btn mrp-btn--upload" onClick={() => fileRef.current?.click()} disabled={parsing}>
                <Upload size={14} /> {parsing ? 'Parsing…' : 'Select File'}
              </button>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="mrp-import-preview">
              <div className="mrp-import-file">File: <b>{fileName}</b></div>

              {parsed.truncated && (
                <div className="mrp-import-warning">
                  Yeh file 65,535 rows pe cut ho gayi hai — purane .xls format ki hard limit hai. Ho sakta hai
                  is se aage ka data is export mein shamil na ho — agar zaroorat ho to .xlsx format mein
                  dobara export kar ke check kar lein.
                </div>
              )}
              {parsed.corruptDates > 0 && (
                <div className="mrp-import-warning">
                  {parsed.corruptDates} admission(s) ki Admit Date parse nahi hui (corrupt source data) — yeh skip ho jayengi.
                </div>
              )}

              <div className="mrp-import-stats">
                <div><span>Total admissions found</span><b>{preview.totalAdmissions}</b></div>
                <div><span>Total medicine rows</span><b>{preview.totalRows}</b></div>
                <div><span>Will import (new)</span><b>{preview.willCreate}</b></div>
                <div><span>Will refresh (already imported before)</span><b>{preview.willRefresh}</b></div>
                <div><span>Total amount</span><b>{fmt(preview.totalAmount)}</b></div>
              </div>

              {preview.unmatchedCompanies.length > 0 && (
                <div className="mrp-import-unmatched">
                  <div className="mrp-import-unmatched-title">Ye company naam DB mein nahi milay — nayi company banegi is code ke sath:</div>
                  {preview.unmatchedCompanies.map((name) => {
                    const key = name.trim().toLowerCase();
                    return (
                      <div className="mrp-import-unmatched-row" key={key}>
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
            <div className="mrp-import-progress">
              <p>Import ho raha hai — batch {progress.done} / {progress.total}…</p>
              <div className="mrp-import-progress-bar">
                <div className="mrp-import-progress-fill" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {step === 'done' && result && (
            <div className="mrp-import-done">
              <p><b>{result.imported}</b> new patient record(s) imported, <b>{result.refreshed}</b> already-imported one(s) refreshed with this file.</p>
              <p><b>{result.itemsCreated}</b> medicine rows created.</p>
              {result.skipped > 0 && <p>{result.skipped} row(s) skipped (admission # ya admit date missing/invalid).</p>}
            </div>
          )}
        </div>

        <div className="mrp-modal-footer">
          {step === 'preview' && (
            <button className="mrp-btn mrp-btn--upload" onClick={handleConfirmImport}>
              Import {preview.willCreate + preview.willRefresh} Records
            </button>
          )}
          {step === 'done' && (
            <button className="mrp-btn mrp-btn--upload" onClick={onClose}>Done</button>
          )}
          {(step === 'pick' || step === 'preview' || step === 'done') && (
            <button className="mrp-btn" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}
