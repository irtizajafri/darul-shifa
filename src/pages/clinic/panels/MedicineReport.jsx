import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Filter as FilterIcon, Printer, Search, Upload, X } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import './MedicineReport.scss';

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};

// `@page` is document-level and shared across the whole app's stylesheet —
// inject a highest-priority override right before printing, remove it after
// (same pattern as Panel Cheques Report / Provisional Bill's own print).
function printMedicineReport() {
  const styleId = 'mrp-page-size-override';
  let style = document.getElementById(styleId);
  if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
  style.textContent = '@page { size: A4 portrait !important; margin: 10mm !important; }';
  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000);
  window.print();
}

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

// Panels > Reports > Medicine Report — legacy "Medican Report" filter dialog:
// Admission # (exact) OR a date-range (by Admission/Discharge Date) scope the
// report, an optional Company narrows it further, and Details vs Admit-wise
// Summary picks the output shape. Only the filter dialog is built for now —
// the results view lands once its own reference screenshot is provided,
// matching how Panel Cheques Report was staged in two steps.
export default function MedicineReport() {
  const { panelCompanies, fetchPanelCompanies, fetchPanelMedicineIssuanceReport } = useClinicStore();

  const [showFilter, setShowFilter] = useState(true);

  const [scopeMode, setScopeMode] = useState('date'); // 'admission' | 'date'
  const [admissionNo, setAdmissionNo] = useState('');
  const [dateType, setDateType] = useState('discharge'); // 'admission' | 'discharge'
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());

  const [companyId, setCompanyId] = useState('');
  const [showCompanyPicker, setShowCompanyPicker] = useState(false);

  const [viewMode, setViewMode] = useState('details'); // 'details' | 'summary'
  const [summaryCompanyId, setSummaryCompanyId] = useState('ALL');

  const [showImport, setShowImport] = useState(false);

  const [data, setData] = useState(null);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState(null);

  useEffect(() => { fetchPanelCompanies(); }, [fetchPanelCompanies]);

  const selectedCompany = panelCompanies.find((c) => String(c.id) === String(companyId));

  async function handleView() {
    if (scopeMode === 'admission' && !admissionNo.trim()) {
      toast.error('Admission # darj karein');
      return;
    }
    if (scopeMode === 'date' && (!fromDate || !toDate)) {
      toast.error('From/To date select karein');
      return;
    }
    const effectiveCompanyId = (viewMode === 'summary' && summaryCompanyId !== 'ALL') ? summaryCompanyId : companyId;
    setLoading(true);
    try {
      const res = await fetchPanelMedicineIssuanceReport({
        scopeMode,
        admissionNo: scopeMode === 'admission' ? admissionNo.trim() : undefined,
        dateType: scopeMode === 'date' ? dateType : undefined,
        fromDate: scopeMode === 'date' ? fromDate : undefined,
        toDate: scopeMode === 'date' ? toDate : undefined,
        panelCompanyId: effectiveCompanyId || undefined,
        viewMode,
      });
      setData(res);
      setShown(true);
      setAppliedFilters({ scopeMode, admissionNo: admissionNo.trim(), dateType, fromDate, toDate });
      setShowFilter(false);
    } catch (err) {
      toast.error(err.message || 'Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }

  const hasRows = data && (data.mode === 'summary' ? data.rows.length > 0 : data.days.length > 0);

  return (
    <div className="mrp-page">
      <ClinicMenuBar />
      <div className="mrp-body">
        <div className="mrp-toolbar no-print">
          <div className="mrp-titlebar">Medicine Report</div>
          <div className="mrp-toolbar-actions">
            <button className="mrp-btn" onClick={() => setShowFilter(true)}><FilterIcon size={14} /> Filter</button>
            <button className="mrp-btn mrp-btn--upload" onClick={() => setShowImport(true)}><Upload size={14} /> Upload Excel</button>
            <button className="mrp-btn mrp-btn--print" onClick={printMedicineReport} disabled={!hasRows}>
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        <div className="mrp-report">
          <div className="mrp-rpt-head">
            <div className="mrp-rpt-hospital">Darul Shifa Hospital</div>
            <div className="mrp-rpt-title">MEDICINE ISSUANCE REPORT FOR PANEL</div>
            {appliedFilters && (
              <div className="mrp-rpt-meta">
                <span>
                  {appliedFilters.scopeMode === 'admission'
                    ? `Admission # : ${appliedFilters.admissionNo}`
                    : `From : ${fmtDate(appliedFilters.fromDate)} &nbsp; To : ${fmtDate(appliedFilters.toDate)}`}
                </span>
                <span>Produced On : {new Date().toLocaleString('en-GB')}</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="mrp-empty">Loading…</div>
          ) : !shown ? (
            <div className="mrp-empty">Filter set karke <b>View</b> dabao.</div>
          ) : !hasRows ? (
            <div className="mrp-empty">Is filter par koi record nahi mila.</div>
          ) : data.mode === 'summary' ? (
            <div className="mrp-table-wrap">
              <table className="mrp-rpt-table">
                <thead>
                  <tr>
                    <th className="mrp-l">Sno</th>
                    <th className="mrp-l">Admission #</th>
                    <th className="mrp-l">Patient</th>
                    <th className="mrp-l">Company</th>
                    <th className="mrp-l">Admit Date</th>
                    <th className="mrp-l">Dis. Date</th>
                    <th className="mrp-r">Items</th>
                    <th className="mrp-r">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, idx) => (
                    <tr key={r.admissionNo}>
                      <td className="mrp-l">{idx + 1}</td>
                      <td className="mrp-l">{r.admissionNo}</td>
                      <td className="mrp-l">{r.patientName}</td>
                      <td className="mrp-l">{r.companyName || '—'}</td>
                      <td className="mrp-l">{fmtDate(r.admitDate)}</td>
                      <td className="mrp-l">{fmtDate(r.dischargeDate)}</td>
                      <td className="mrp-r">{r.itemCount}</td>
                      <td className="mrp-r">{fmt(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="mrp-rpt-totals">
                    <td colSpan={7} className="mrp-l">Grand Total</td>
                    <td className="mrp-r">{fmt(data.grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="mrp-details">
              {data.days.map((day) => (
                <div className="mrp-day-block" key={day.date}>
                  <div className="mrp-day-hdr">
                    <span>{fmtDate(day.date)}</span>
                    <span className="mrp-day-total">DAY WISE TOTAL : <b>{fmt(day.dayTotal)}</b></span>
                  </div>

                  {day.patients.map((p) => (
                    <div className="mrp-patient-block" key={`${day.date}-${p.admissionNo}`}>
                      <div className="mrp-patient-hdr">
                        <span><b>PATIENT :</b> {p.admissionNo} - {p.patientName}</span>
                        <span><b>ADMIT DATE :</b> {fmtDate(p.admitDate)}</span>
                      </div>
                      <div className="mrp-patient-hdr">
                        <span><b>COMPANY :</b> {p.companyName || '—'}</span>
                        <span><b>DIS. DATE :</b> {fmtDate(p.dischargeDate)}</span>
                      </div>

                      <table className="mrp-rpt-table mrp-rpt-table--items">
                        <thead>
                          <tr>
                            <th className="mrp-l">Sno</th>
                            <th className="mrp-l">Description</th>
                            <th className="mrp-l">Med Date</th>
                            <th className="mrp-r">Rate</th>
                            <th className="mrp-r">Qty</th>
                            <th className="mrp-r">Amount</th>
                            <th className="mrp-l">Medical Store</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.items.map((it) => (
                            <tr key={it.sno}>
                              <td className="mrp-l">{it.sno}</td>
                              <td className="mrp-l">{it.description}</td>
                              <td className="mrp-l">{fmtDate(it.medDate)}</td>
                              <td className="mrp-r">{fmt(it.rate)}</td>
                              <td className="mrp-r">{it.qty}</td>
                              <td className="mrp-r">{fmt(it.amount)}</td>
                              <td className="mrp-l">{it.store || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="mrp-patient-totals">
                            <td colSpan={5} className="mrp-l">TOTAL :</td>
                            <td className="mrp-r">{fmt(p.patientTotal)}</td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))}
                </div>
              ))}

              <div className="mrp-grand-total">Grand Total : <b>{fmt(data.grandTotal)}</b></div>
            </div>
          )}
        </div>
      </div>

      {showFilter && (
        <FilterModal
          scopeMode={scopeMode} onScopeModeChange={setScopeMode}
          admissionNo={admissionNo} onAdmissionNoChange={setAdmissionNo}
          dateType={dateType} onDateTypeChange={setDateType}
          fromDate={fromDate} onFromDateChange={setFromDate}
          toDate={toDate} onToDateChange={setToDate}
          selectedCompany={selectedCompany}
          onPickCompany={() => setShowCompanyPicker(true)}
          onClearCompany={() => setCompanyId('')}
          viewMode={viewMode} onViewModeChange={setViewMode}
          summaryCompanyId={summaryCompanyId} onSummaryCompanyIdChange={setSummaryCompanyId}
          companies={panelCompanies}
          onClose={() => setShowFilter(false)}
          onView={handleView}
        />
      )}

      {showCompanyPicker && (
        <CompanyPickerModal
          companies={panelCompanies}
          onSelect={(c) => { setCompanyId(String(c.id)); setShowCompanyPicker(false); }}
          onClose={() => setShowCompanyPicker(false)}
        />
      )}

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}

function FilterModal({
  scopeMode, onScopeModeChange, admissionNo, onAdmissionNoChange,
  dateType, onDateTypeChange, fromDate, onFromDateChange, toDate, onToDateChange,
  selectedCompany, onPickCompany, onClearCompany,
  viewMode, onViewModeChange, summaryCompanyId, onSummaryCompanyIdChange, companies,
  onClose, onView,
}) {
  return (
    <div className="mrp-modal-overlay" onMouseDown={onClose}>
      <div className="mrp-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mrp-modal-head">
          <span>Medicine Report</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="mrp-modal-body">
          <div className="mrp-section">
            <label className="mrp-radio-lbl">
              <input type="radio" name="mrp-scope" checked={scopeMode === 'admission'} onChange={() => onScopeModeChange('admission')} />
              Admission #
            </label>
            <input
              className="mrp-text-input"
              value={admissionNo}
              onChange={(e) => onAdmissionNoChange(e.target.value)}
              disabled={scopeMode !== 'admission'}
              onFocus={() => onScopeModeChange('admission')}
            />
          </div>

          <div className="mrp-section">
            <label className="mrp-radio-lbl">
              <input type="radio" name="mrp-scope" checked={scopeMode === 'date'} onChange={() => onScopeModeChange('date')} />
            </label>
            <select
              className="mrp-select"
              value={dateType}
              onChange={(e) => { onDateTypeChange(e.target.value); onScopeModeChange('date'); }}
              disabled={scopeMode !== 'date'}
            >
              <option value="admission">Admission Date</option>
              <option value="discharge">Discharge Date</option>
            </select>
            <label className="mrp-date-lbl">From :</label>
            <input
              type="date" className="mrp-date-input" value={fromDate}
              onChange={(e) => { onFromDateChange(e.target.value); onScopeModeChange('date'); }}
              disabled={scopeMode !== 'date'}
            />
            <label className="mrp-date-lbl">To :</label>
            <input
              type="date" className="mrp-date-input" value={toDate}
              onChange={(e) => { onToDateChange(e.target.value); onScopeModeChange('date'); }}
              disabled={scopeMode !== 'date'}
            />
          </div>

          <div className="mrp-section">
            <label className="mrp-company-lbl">Company</label>
            <div className="mrp-lookup-row">
              <input
                className="mrp-text-input"
                readOnly
                value={selectedCompany ? `${selectedCompany.code} — ${selectedCompany.name}` : ''}
                placeholder="— Sab companies —"
                onClick={onPickCompany}
              />
              {selectedCompany && (
                <button className="mrp-lookup-clear" onClick={onClearCompany} title="Clear">✕</button>
              )}
              <button className="mrp-lookup-btn" onClick={onPickCompany} title="Search company"><Search size={13} /></button>
            </div>
          </div>

          <div className="mrp-section mrp-section--viewmode">
            <label className="mrp-radio-lbl">
              <input type="radio" name="mrp-viewmode" checked={viewMode === 'details'} onChange={() => onViewModeChange('details')} />
              Details
            </label>
            <label className="mrp-radio-lbl">
              <input type="radio" name="mrp-viewmode" checked={viewMode === 'summary'} onChange={() => onViewModeChange('summary')} />
              Admit wise Summary
            </label>
            <select
              className="mrp-select mrp-select--grow"
              value={summaryCompanyId}
              onChange={(e) => onSummaryCompanyIdChange(e.target.value)}
            >
              <option value="ALL">ALL</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="mrp-modal-footer">
          <button className="mrp-btn mrp-btn--view" onClick={onView}>View</button>
          <button className="mrp-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function CompanyPickerModal({ companies, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = companies.filter((c) =>
    !q.trim() ||
    c.name.toLowerCase().includes(q.trim().toLowerCase()) ||
    c.code.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="mrp-modal-overlay" onMouseDown={onClose}>
      <div className="mrp-modal mrp-modal--picker" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mrp-modal-head">
          <span>Select Company</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="mrp-picker-search">
          <Search size={13} />
          <input ref={inputRef} placeholder="Search company…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mrp-picker-list">
          {filtered.length === 0 ? (
            <div className="mrp-picker-empty">Koi company nahi mili</div>
          ) : filtered.map((c) => (
            <div key={c.id} className="mrp-picker-row" onClick={() => onSelect(c)}>
              <span className="mrp-picker-code">{c.code}</span>
              <span className="mrp-picker-name">{c.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CONFIRM_BATCH_SIZE = 300; // admissions per request — keeps each POST well under the body-size limit regardless of file size

function ImportModal({ onClose }) {
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
      <div className="mrp-modal mrp-modal--wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mrp-modal-head">
          <span>Upload Excel — Medical Issuance Report for Panel</span>
          {(step === 'pick' || step === 'preview' || step === 'done') && (
            <button onClick={onClose}><X size={16} /></button>
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
