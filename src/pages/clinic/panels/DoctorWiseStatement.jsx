import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Filter as FilterIcon, Printer, Search, Upload, X } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import './DoctorWiseStatement.scss';

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const todayIso = () => new Date().toISOString().slice(0, 10);
// The hospital's own operating day runs 08:00:00 AM to 07:59:59 AM (next
// day) — matches the backend's own daily "Day close" boundary, not
// midnight — so that's the sane default here, not 00:00/23:59.
const DEFAULT_FROM_TIME = '08:00:00';
const DEFAULT_TO_TIME = '07:59:59';

function printDoctorWiseStatement() {
  const styleId = 'dws-page-size-override';
  let style = document.getElementById(styleId);
  if (!style) { style = document.createElement('style'); style.id = styleId; document.head.appendChild(style); }
  style.textContent = '@page { size: A4 portrait !important; margin: 10mm !important; }';
  const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 5000);
  window.print();
}

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

// Panels > Reports > Doctor Wise Statement — legacy "Statement of Surgery"
// filter dialog / "Statement of Consultant for Indoor Files" print output.
// Only one Doctor is ever actually pickable — the legacy screen's own "To"
// Doctor field is disabled/hatched with its label left as the unrenamed
// default "Label1" (preserved here exactly). Import is fully standalone —
// never creates or matches a ClinicAdmission — and is scoped per-doctor:
// re-uploading a doctor's file wholesale replaces that doctor's statement.
// Results print one Company section per A4 page (page-break-before, see
// DoctorWiseStatement.scss), each a self-contained mini-statement with its
// own repeated doctor/date header, matching the legacy paper output.
export default function DoctorWiseStatement() {
  const { doctors, fetchDoctors, fetchDoctorStatement } = useClinicStore();

  const [showFilter, setShowFilter] = useState(true);

  const [activeConsultantsOnly, setActiveConsultantsOnly] = useState(false);
  const [doctorId, setDoctorId] = useState('');
  const [showDoctorPicker, setShowDoctorPicker] = useState(false);

  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(todayIso());
  const [fromTime, setFromTime] = useState(DEFAULT_FROM_TIME);
  const [toTime, setToTime] = useState(DEFAULT_TO_TIME);

  const [showImport, setShowImport] = useState(false);

  const [data, setData] = useState(null);
  const [shown, setShown] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const selectedDoctor = doctors.find((d) => String(d.id) === String(doctorId));
  const pickableDoctors = activeConsultantsOnly ? doctors.filter((d) => d.status === 'active') : doctors;

  async function handlePreview() {
    if (!doctorId) return;
    setShown(true);
    setShowFilter(false);
    setLoading(true);
    try {
      const res = await fetchDoctorStatement({ doctorId, fromDate, toDate });
      setData(res);
    } catch (err) {
      toast.error(err.message || 'Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }

  const hasRows = data && data.companies && data.companies.length > 0;

  return (
    <div className="dws-page">
      <ClinicMenuBar />

      <div className="dws-body">
        <div className="dws-toolbar no-print">
          <div className="dws-titlebar">Doctor Wise Statement</div>
          <div className="dws-toolbar-actions">
            <button className="dws-btn" onClick={() => setShowFilter(true)}><FilterIcon size={14} /> Filter</button>
            <button className="dws-btn dws-btn--upload" onClick={() => setShowImport(true)}><Upload size={14} /> Upload Excel</button>
            <button className="dws-btn dws-btn--print" onClick={printDoctorWiseStatement} disabled={!hasRows}>
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        {loading ? (
          <div className="dws-report"><div className="dws-empty">Loading…</div></div>
        ) : !shown ? (
          <div className="dws-report"><div className="dws-empty">Filter set karke <b>Preview</b> dabao.</div></div>
        ) : !hasRows ? (
          <div className="dws-report"><div className="dws-empty">Is filter par koi record nahi mila.</div></div>
        ) : (
          data.companies.map((c) => (
            <div className="dws-report dws-company-page" key={c.companyName}>
              <div className="dws-rpt-head">
                <div className="dws-rpt-sub">Darul Shifa Hospital</div>
                <div className="dws-rpt-title">Statement of Consultant for Indoor Files</div>
                <div className="dws-doctor-line">
                  <span className="dws-doctor-code">{data.doctor.code}</span>
                  <span className="dws-doctor-name">{data.doctor.name}</span>
                </div>
                <div className="dws-fromto">
                  <span>From : {fmtDate(fromDate)}</span>
                  <span>To : {fmtDate(toDate)}</span>
                </div>
              </div>

              <div className="dws-company-hdr">
                <span className="dws-company-code">{c.companyCode}</span>
                <b>{c.companyName}</b>
              </div>

              <table className="dws-col-labels">
                <thead>
                  <tr>
                    <th className="dws-l">Admit #</th>
                    <th className="dws-l">PatName</th>
                    <th className="dws-l">Surgery</th>
                    <th className="dws-l">Op. Date</th>
                    <th className="dws-r">Amount</th>
                  </tr>
                </thead>
              </table>

              {c.vouchers.map((v, vi) => (
                <div className="dws-voucher" key={vi}>
                  <table className="dws-items-table">
                    <tbody>
                      {v.items.map((it, ii) => (
                        <tr key={ii}>
                          <td className="dws-l">{it.admissionNo}</td>
                          <td className="dws-l">{it.patientName}</td>
                          <td className="dws-l">{it.surgery || ''}</td>
                          <td className="dws-l">{fmtDate(it.opDate)}</td>
                          <td className="dws-r">{fmt(it.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="dws-voucher-total">
                    <span>Total Patients: <b>{v.totalPatients}</b></span>
                    <span>Total For Doctor: <b>{fmt(v.totalAmount)}</b></span>
                  </div>

                  {v.amountWords && <div className="dws-words">{v.amountWords}</div>}
                  {v.signeeName && <div className="dws-signee">{v.signeeName}</div>}

                  <div className="dws-siglabels">
                    <span>Prepaid By</span>
                    <span>Administrator</span>
                    <span>Receiver</span>
                  </div>
                </div>
              ))}

              <div className="dws-company-total">
                <span>{c.companyName} — Total Patients : <b>{c.totalPatients}</b></span>
                <span>Total Amount : <b>{fmt(c.totalAmount)}</b></span>
              </div>
            </div>
          ))
        )}
      </div>

      {showFilter && (
        <FilterModal
          activeConsultantsOnly={activeConsultantsOnly} onActiveConsultantsOnlyChange={setActiveConsultantsOnly}
          selectedDoctor={selectedDoctor}
          onPickDoctor={() => setShowDoctorPicker(true)}
          onClearDoctor={() => setDoctorId('')}
          fromDate={fromDate} onFromDateChange={setFromDate}
          toDate={toDate} onToDateChange={setToDate}
          fromTime={fromTime} onFromTimeChange={setFromTime}
          toTime={toTime} onToTimeChange={setToTime}
          onClose={() => setShowFilter(false)}
          onPreview={handlePreview}
        />
      )}

      {showDoctorPicker && (
        <DoctorPickerModal
          doctors={pickableDoctors}
          onSelect={(d) => { setDoctorId(String(d.id)); setShowDoctorPicker(false); }}
          onClose={() => setShowDoctorPicker(false)}
        />
      )}

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}

// Matches the legacy "Statement of Surgery" dialog: From Doctor is a real
// lookup, To Doctor is permanently disabled (the legacy screen's own
// unfinished "Label1" placeholder, kept as-is rather than invented over).
function FilterModal({
  activeConsultantsOnly, onActiveConsultantsOnlyChange,
  selectedDoctor, onPickDoctor, onClearDoctor,
  fromDate, onFromDateChange, toDate, onToDateChange,
  fromTime, onFromTimeChange, toTime, onToTimeChange,
  onClose, onPreview,
}) {
  return (
    <div className="dws-modal-overlay" onMouseDown={onClose}>
      <div className="dws-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dws-modal-head">
          <span>Statement of Surgery</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="dws-modal-body">
          <label className="dws-checkbox-lbl dws-active-consultants">
            <input
              type="checkbox"
              checked={activeConsultantsOnly}
              onChange={(e) => onActiveConsultantsOnlyChange(e.target.checked)}
            />
            Active Consultants
          </label>

          <div className="dws-cols">
            <div className="dws-col">
              <div className="dws-col-hdr">From</div>

              <label className="dws-field-lbl">Doctor</label>
              <div className="dws-lookup-row">
                <input
                  className="dws-text-input"
                  readOnly
                  value={selectedDoctor ? `${selectedDoctor.code} — ${selectedDoctor.name}` : ''}
                  placeholder="Doctor select karein"
                  onClick={onPickDoctor}
                />
                {selectedDoctor && (
                  <button className="dws-lookup-clear" onClick={onClearDoctor} title="Clear">✕</button>
                )}
                <button className="dws-lookup-btn" onClick={onPickDoctor} title="Search doctor"><Search size={13} /></button>
              </div>

              <label className="dws-field-lbl">Date</label>
              <input type="date" className="dws-date-input" value={fromDate} onChange={(e) => onFromDateChange(e.target.value)} />

              <label className="dws-field-lbl">Time</label>
              <input type="time" step="1" className="dws-date-input" value={fromTime} onChange={(e) => onFromTimeChange(e.target.value)} />
            </div>

            <div className="dws-col">
              <div className="dws-col-hdr">To</div>

              <label className="dws-field-lbl">Doctor</label>
              <input className="dws-text-input" disabled placeholder="Label1" />

              <label className="dws-field-lbl">Date</label>
              <input type="date" className="dws-date-input" value={toDate} onChange={(e) => onToDateChange(e.target.value)} />

              <label className="dws-field-lbl">Time</label>
              <input type="time" step="1" className="dws-date-input" value={toTime} onChange={(e) => onToTimeChange(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="dws-modal-footer">
          <button className="dws-btn dws-btn--preview" onClick={onPreview} disabled={!selectedDoctor} title={!selectedDoctor ? 'Doctor select karein' : ''}>
            Preview
          </button>
          <button className="dws-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function DoctorPickerModal({ doctors, onSelect, onClose }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = doctors.filter((d) =>
    !q.trim() ||
    d.name.toLowerCase().includes(q.trim().toLowerCase()) ||
    d.code.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="dws-modal-overlay" onMouseDown={onClose}>
      <div className="dws-modal dws-modal--picker" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dws-modal-head">
          <span>Select Doctor</span>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="dws-picker-search">
          <Search size={13} />
          <input ref={inputRef} placeholder="Search doctor…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="dws-picker-list">
          {filtered.length === 0 ? (
            <div className="dws-picker-empty">Koi doctor nahi mila</div>
          ) : filtered.map((d) => (
            <div key={d.id} className="dws-picker-row" onClick={() => onSelect(d)}>
              <span className="dws-picker-code">{d.code}</span>
              <span className="dws-picker-name">{d.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImportModal({ onClose }) {
  const { previewDoctorStatementImport, confirmDoctorStatementImport } = useClinicStore();
  const fileRef = useRef(null);

  const [step, setStep] = useState('pick'); // pick | preview | importing | done
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

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
      <div className="dws-modal dws-modal--wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dws-modal-head">
          <span>Upload Excel — Statement of Consultant for Indoor Files</span>
          {(step === 'pick' || step === 'preview' || step === 'done') && (
            <button onClick={onClose}><X size={16} /></button>
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
