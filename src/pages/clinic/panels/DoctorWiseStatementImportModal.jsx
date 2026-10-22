import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload, X } from 'lucide-react';
import { useClinicStore } from '../../../store/useClinicStore';
import useModalKeys from '../../../hooks/useModalKeys';
import './DoctorWiseStatement.scss';
import { useShallow } from 'zustand/react/shallow';

// Doctor Wise Statement's "Upload Excel" dialog — moved out of
// DoctorWiseStatement.jsx unchanged so both the filter screen and the
// preview can open it.

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Excel's date epoch is 1899-12-30 — standard serial→JS Date conversion.
function excelSerialToDate(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Math.round((n - 25569) * 86400 * 1000));
}

// Legacy "Statement of Consultant for Indoor Files" .xls export — walked by
// ROW SHAPE. A file is scoped to ONE doctor: its name ("Dr. ...", col1) and
// code (the very next non-blank row, col0 alone) appear once at the top,
// followed by a From/To banner and a column-header row (both skipped —
// From/To here is just this export's own range, not trusted; the live
// report always uses the filter's own dates instead). The body is then a
// flat sequence of Company sections (a row with BOTH col0 — a short company
// code, e.g. "ADM" — and col1 — the full company name — non-blank, nothing
// else in that row), each holding one or more payment Vouchers: patient
// rows (col0 = Admit#, a number; col1 = name; col2 = surgery; col5 = Op.
// Date, an Excel serial, often blank for non-surgery entries like "General
// Admission"; col7 = amount) accumulate until a "Total Patients:" row
// closes that voucher, followed by an amount-in-words row ("Rs. ... Only")
// and a signee-name row (a lone value in col0, e.g. "KOMAIL") — both
// attached back onto the voucher just closed. A "Prepaid By / Administrator
// / Receiver" label row and the file's own grand-total row are decorative,
// skipped, never trusted (this app always recomputes totals bottom-up).
function parseDoctorStatementExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

        const isBlank = (r) => r.every((c) => String(c).trim() === '');
        const isTitle = (r) => String(r[3] || '').includes('STATEMENT OF CONSULTANT');
        const isFromTo = (r) => String(r[0] || '').trim() === 'From:';
        const isColHeader = (r) => String(r[0] || '').trim() === 'Admit #';
        const isPatientRow = (r) => typeof r[0] === 'number' && String(r[1] || '').trim() !== '';
        const isCompanyHeader = (r) =>
          String(r[0] || '').trim() !== '' && String(r[1] || '').trim() !== '' &&
          !isPatientRow(r) && r.slice(2).every((c) => String(c).trim() === '');
        const isSubtotalRow = (r) => String(r[1] || '').trim() === 'Total Patients:';
        const isWordsRow = (r) => /^Rs\./.test(String(r[0] || '').trim());
        const isSigLabelRow = (r) => String(r[0] || '').trim() === 'Prepaid By';
        const isGrandTotalRow = (r) =>
          !String(r[0] || '').trim() && !String(r[1] || '').trim() &&
          typeof r[2] === 'number' && typeof r[7] === 'number';
        const isLoneValueRow = (r) => String(r[0] || '').trim() !== '' && r.slice(1).every((c) => String(c).trim() === '');

        let doctorCode = null;
        let doctorName = null;
        let awaitingDoctorCode = false;
        const companies = [];
        let currentCompany = null;
        let currentVoucher = null;
        let totalVouchers = 0;
        let totalItems = 0;
        let totalAmount = 0;

        for (let i = 0; i < raw.length; i++) {
          const r = raw[i];
          if (isBlank(r) || isTitle(r) || isFromTo(r) || isColHeader(r) || isSigLabelRow(r) || isGrandTotalRow(r)) continue;

          if (!doctorCode && !doctorName && String(r[0] || '').trim() === '' && /^Dr\.?\s/i.test(String(r[1] || '').trim())) {
            doctorName = String(r[1]).trim();
            awaitingDoctorCode = true;
            continue;
          }
          if (awaitingDoctorCode && isLoneValueRow(r)) {
            doctorCode = String(r[0]).trim();
            awaitingDoctorCode = false;
            continue;
          }

          if (isCompanyHeader(r)) {
            currentVoucher = null;
            currentCompany = { companyCode: String(r[0]).trim(), companyName: String(r[1]).trim(), vouchers: [] };
            companies.push(currentCompany);
            continue;
          }

          if (isPatientRow(r)) {
            if (!currentVoucher) currentVoucher = { items: [] };
            const opDate = excelSerialToDate(r[5]);
            currentVoucher.items.push({
              admissionNo: String(r[0]).trim(),
              patientName: String(r[1] || '').trim(),
              surgery: String(r[2] || '').trim() || null,
              opDate: opDate ? opDate.toISOString() : null,
              amount: Number(r[7]) || 0,
            });
            continue;
          }

          if (isSubtotalRow(r)) {
            if (currentVoucher && currentVoucher.items.length && currentCompany) {
              currentVoucher.totalPatients = Number(r[2]) || currentVoucher.items.length;
              currentVoucher.totalAmount = Number(r[7]) || currentVoucher.items.reduce((s, it) => s + it.amount, 0);
              currentCompany.vouchers.push(currentVoucher);
              totalVouchers += 1;
              totalItems += currentVoucher.items.length;
              totalAmount += currentVoucher.totalAmount;
            }
            currentVoucher = null;
            continue;
          }

          if (isWordsRow(r)) {
            const lastVoucher = currentCompany?.vouchers[currentCompany.vouchers.length - 1];
            if (lastVoucher) lastVoucher.amountWords = String(r[0]).trim();
            continue;
          }

          if (isLoneValueRow(r)) {
            const lastVoucher = currentCompany?.vouchers[currentCompany.vouchers.length - 1];
            if (lastVoucher) lastVoucher.signeeName = String(r[0]).trim();
            continue;
          }
        }

        const truncated = raw.length >= 65535;
        resolve({ doctorCode, doctorName, companies, totalVouchers, totalItems, totalAmount, truncated });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function DoctorWiseStatementImportModal({ onClose }) {
  const { previewDoctorStatementImport, confirmDoctorStatementImport } = useClinicStore(useShallow((s) => ({ previewDoctorStatementImport: s.previewDoctorStatementImport, confirmDoctorStatementImport: s.confirmDoctorStatementImport })));
  const fileRef = useRef(null);

  const [step, setStep] = useState('pick'); // pick | preview | importing | done
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // ESC mirrors the header X button: closable only when not mid-import.
  const canClose = step === 'pick' || step === 'preview' || step === 'done';
  useModalKeys({ active: true, onEsc: canClose ? onClose : undefined });

  async function handlePickFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    try {
      const parsedData = await parseDoctorStatementExcel(file);
      if (!parsedData.doctorCode) { toast.error('Excel mein Doctor code nahi mila'); return; }
      if (!parsedData.totalVouchers) { toast.error('Excel mein koi valid voucher nahi mila'); return; }
      const companyNames = parsedData.companies.map((c) => c.companyName);
      const prev = await previewDoctorStatementImport({
        doctorCode: parsedData.doctorCode,
        doctorName: parsedData.doctorName,
        companyNames,
        totalVouchers: parsedData.totalVouchers,
        totalItems: parsedData.totalItems,
        totalAmount: parsedData.totalAmount,
      });
      setParsed(parsedData);
      setPreview(prev);
      setStep('preview');
    } catch (err) {
      toast.error(err.message || 'File parse/preview nahi hui');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function handleConfirmImport() {
    setStep('importing');
    try {
      const res = await confirmDoctorStatementImport({
        doctorCode: parsed.doctorCode,
        doctorName: parsed.doctorName,
        companies: parsed.companies,
      });
      setResult(res);
      setStep('done');
      toast.success(`${res.vouchersCreated} vouchers, ${res.itemsCreated} items import ho gaye`);
    } catch (err) {
      toast.error(err.message || 'Import fail ho gaya');
      setStep('preview');
    }
  }

  return (
    <div className="dws-modal-overlay" onMouseDown={step === 'pick' || step === 'preview' ? onClose : undefined}>
      <div className="dws-modal dws-modal--wide" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dws-modal-head">
          <span>Upload Excel — Statement of Consultant for Indoor Files</span>
          {(step === 'pick' || step === 'preview' || step === 'done') && (
            <button onClick={onClose} aria-label="Close" title="Close"><X size={16} /></button>
          )}
        </div>

        <div className="dws-modal-body">
          {step === 'pick' && (
            <div className="dws-import-pick">
              <p>"Statement of Consultant for Indoor Files" jaisa .xls file select karein — yeh EK doctor ki poori statement (sab companies) honi chahiye.</p>
              <input ref={fileRef} type="file" accept=".xls,.xlsx" style={{ display: 'none' }} onChange={handlePickFile} />
              <button className="dws-btn dws-btn--upload" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Upload size={14} /> {busy ? 'Parsing…' : 'Select File'}
              </button>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="dws-import-preview">
              <div className="dws-import-file">File: <b>{fileName}</b></div>

              {parsed.truncated && (
                <div className="dws-import-warning">
                  Yeh file 65,535 rows pe cut ho gayi hai — purane .xls format ki hard limit hai.
                </div>
              )}

              <div className="dws-import-stats">
                <div><span>File ka doctor</span><b>{preview.doctorCode} - {preview.doctorName}</b></div>
                <div>
                  <span>Live system mein match</span>
                  <b>{preview.doctorMatched ? `code: ${preview.doctorRealCode}` : 'Nahi mila'}</b>
                </div>
                <div><span>Total vouchers</span><b>{preview.totalVouchers}</b></div>
                <div><span>Total patients rows</span><b>{preview.totalItems}</b></div>
                <div><span>Total amount</span><b>{fmt(preview.totalAmount)}</b></div>
                <div>
                  <span>Existing data</span>
                  <b>{preview.willReplace ? `${preview.existingVoucherCount} vouchers replace honge` : 'Kuch nahi (naya)'}</b>
                </div>
              </div>

              {!preview.doctorMatched && (
                <div className="dws-import-warning">
                  "{preview.doctorName}" naam se koi Doctor system mein nahi mila (naam exact match zaroori hai) — filter dialog mein isay select nahi kar sakenge jab tak naam Doctor Parameters mein bilkul isi tarah maujood na ho. Import phir bhi ho jayega, data mehfooz rahega.
                </div>
              )}

              {preview.unmatchedCompanies.length > 0 && (
                <div className="dws-import-warning">
                  Ye company naam DB mein nahi milay, text ke taur pe save ho jayenge (Company link nahi banega): {preview.unmatchedCompanies.join(', ')}
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="dws-import-progress">
              <p>Import ho raha hai…</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="dws-import-done">
              <p><b>{result.vouchersCreated}</b> vouchers, <b>{result.itemsCreated}</b> patient rows import ho gaye.</p>
            </div>
          )}
        </div>

        <div className="dws-modal-footer">
          {step === 'preview' && (
            <button className="dws-btn dws-btn--upload" onClick={handleConfirmImport}>
              Import {preview.totalVouchers} Vouchers
            </button>
          )}
          {step === 'done' && (
            <button className="dws-btn dws-btn--upload" onClick={onClose}>Done</button>
          )}
          {(step === 'pick' || step === 'preview' || step === 'done') && (
            <button className="dws-btn" onClick={onClose}>Close</button>
          )}
        </div>
      </div>
    </div>
  );
}
