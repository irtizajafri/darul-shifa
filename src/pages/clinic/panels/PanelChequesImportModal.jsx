import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload, X } from 'lucide-react';
import { useClinicStore } from '../../../store/useClinicStore';
import useModalKeys from '../../../hooks/useModalKeys';
import './PanelChequesReport.scss';

// Panel Cheques Report's "Upload Excel" dialog — moved out of
// PanelChequesReport.jsx unchanged so both the filter screen and the preview
// can open it.

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

// Bulk-import a legacy "PENAL IPD SUMMARY REPORT" .xls export — parse
// (client-side) → Preview (server dry-run: unmatched companies / collisions
// / duplicates, nothing written yet) → resolve any unmatched company names
// → Confirm (actually writes: one Admission + Billing snapshot + a Cheque
// Receipt for every already-"received" row).
export default function PanelChequesImportModal({ onClose, onImported }) {
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

  useModalKeys({ active: true, onEsc: onClose });
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
      <div className="pcqr-modal pcqr-modal--wide" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pcqr-modal-head">
          <span>Upload Excel — Legacy Panel Bill/Cheque Import</span>
          <button onClick={onClose} aria-label="Close" title="Close"><X size={16} /></button>
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
