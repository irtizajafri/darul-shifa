import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import JsBarcode from 'jsbarcode';
import { buildReceiptHtml } from '../receiptUtils';
import { buildConsultantReceiptHtml } from '../consultantReceiptUtils';
import { buildEmergencyReceiptHtml } from '../emergencyReceiptUtils';
import { useAuthStore, SUPER_ADMIN_EMAIL } from '../../../store/useAuthStore';
import { buildReprint, REPRINT_POPUP_FEATURES } from './reprintPrinters';
import { buildSequentialPrintHtml } from '../clinicalRecordPrintUtils';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './ReprintFilter.scss';
import { openPrintWindow } from '../../../utils/printRelay';

const API = 'http://localhost:5001/api/clinic';

const todayStr = () => new Date().toISOString().split('T')[0];
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; };

// Birth/Death Certificate reprint — superadmin only, per explicit request.
const ALL_DOC_TYPES = [
  { value: 'slip',        label: 'Slip',                 enabled: true },
  { value: 'admission',   label: 'Admission',             enabled: true },
  { value: 'discharge',   label: 'Discharge Certificate', enabled: true },
  { value: 'birth',       label: 'Birth Cert.',           enabled: true, superAdminOnly: true },
  { value: 'death',       label: 'Death Certificate',     enabled: true, superAdminOnly: true },
  { value: 'provisional', label: 'Provisional Bill',      enabled: true },
  { value: 'final',       label: 'Final Bill',            enabled: true },
  { value: 'antenatal',   label: 'Antenatal',             enabled: true },
];

export default function ReprintFilter() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isMaster = Boolean(user?.isSuperAdmin) || user?.email === SUPER_ADMIN_EMAIL;
  const DOC_TYPES = ALL_DOC_TYPES.filter((t) => !t.superAdminOnly || isMaster);

  const [slipNo, setSlipNo] = useState('');
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(tomorrowStr());
  const [docType, setDocType] = useState('slip');
  const [busy, setBusy] = useState(false);

  // `w` — the print window, opened by the caller on the click before this
  // fetch (a window opened after an await is blocked as a popup).
  async function reprintSlip(no, w) {
    const res = await fetch(`${API}/opd/reprint/${encodeURIComponent(no)}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Slip nahi mila');
    const { visit, tokenNo, isDuplicate } = json.data;
    const printedBy = user?.name || user?.username || user?.email || '';

    // Route to the SAME template the visit was originally printed with — each
    // department has its own layout (Emergency = full A4 clinical form,
    // Consultant = its own receipt with token always shown, everything else
    // shares the generic A6 receipt).
    const dept = String(visit.department || '').trim().toLowerCase();
    let html;
    if (dept === 'emergency') {
      html = buildEmergencyReceiptHtml({ visit, isDuplicate, printedBy });
    } else {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, visit.serialNo, { format: 'CODE128', width: 2, height: 48, displayValue: true, fontSize: 11, margin: 4 });
      const barcodeDataUrl = canvas.toDataURL('image/png');
      html = dept === 'consultant opd'
        ? buildConsultantReceiptHtml({ visit, tokenNo, isDuplicate, barcodeDataUrl, printedBy })
        : buildReceiptHtml({ visit, tokenNo, isDuplicate, barcodeDataUrl, printedBy });
    }

    w.document.write(html);
    w.document.close();
  }

  async function handleView() {
    const no = slipNo.trim();
    if (!no) return toast.error('Slip # / Admission # daalo');

    const type = DOC_TYPES.find((d) => d.value === docType);
    if (!type.enabled) { toast.error(`${type.label} abhi available nahi hai`); return; }

    if (docType === 'slip') {
      const w = openPrintWindow('width=420,height=680');
      setBusy(true);
      try {
        await reprintSlip(no, w);
      } catch (err) {
        w.close();
        toast.error(err.message || 'Slip nahi mila');
      } finally {
        setBusy(false);
      }
      return;
    }

    // Every other document: print-only. Open the popup synchronously on the
    // click (before any await — otherwise popup blockers kill it), fetch the
    // saved record and write the same print the document's own screen would
    // produce. Never navigates to the (editable) working screen.
    const w = openPrintWindow(REPRINT_POPUP_FEATURES[docType] || 'width=900,height=1000');
    setBusy(true);
    try {
      const printedBy = user?.name || user?.username || user?.email || '';
      const { html, extraHtml } = await buildReprint(docType, no, printedBy);
      // A second slip (Antenatal card) prints from the same window, after the
      // first — never from a hidden iframe (its dialog froze the app).
      w.document.write(buildSequentialPrintHtml(html, extraHtml));
      w.document.close();
    } catch (err) {
      w.close();
      toast.error(err.message || `${type.label} reprint nahi ho saka`);
    } finally {
      setBusy(false);
    }
  }

  const handleClose = () => navigate(-1);

  return (
    <div className="rpf-page">
      <ClinicMenuBar />

      <div className="rpf-center">
        <div className="rpf-window">
          <div className="rpf-titlebar">Reports — Slip</div>

          <div className="rpf-body">
            <div className="rpf-row">
              <label>Slip #</label>
              <input
                value={slipNo}
                onChange={(e) => setSlipNo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleView()}
                placeholder="e.g. 2826042"
              />
            </div>

            <div className="rpf-row rpf-row--dates">
              <div className="rpf-date-group">
                <label>List Filter From</label>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="rpf-date-group">
                <label>To</label>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>

            <div className="rpf-radio-grid">
              {DOC_TYPES.map((t) => (
                <label key={t.value} className={`rpf-radio ${!t.enabled ? 'rpf-radio--disabled' : ''}`}>
                  <input
                    type="radio"
                    name="docType"
                    checked={docType === t.value}
                    onChange={() => setDocType(t.value)}
                  />
                  {t.label}
                  {!t.enabled && <span className="rpf-soon">(soon)</span>}
                </label>
              ))}
            </div>
          </div>

          <div className="rpf-actions">
            <button className="rpf-btn rpf-btn--view" onClick={handleView} disabled={busy}>
              {busy ? 'Loading…' : 'View'}
            </button>
            <button className="rpf-btn rpf-btn--close" onClick={handleClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
