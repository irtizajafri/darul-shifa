import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Binoculars, X } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { buildReceiptHtml } from '../receiptUtils';
import { buildConsultantReceiptHtml } from '../consultantReceiptUtils';
import { buildEmergencyReceiptHtml } from '../emergencyReceiptUtils';
import { useAuthStore, SUPER_ADMIN_EMAIL } from '../../../store/useAuthStore';
import { buildReprint, REPRINT_POPUP_FEATURES } from './reprintPrinters';
import { buildSequentialPrintHtml } from '../clinicalRecordPrintUtils';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import useModalKeys from '../../../hooks/useModalKeys';
import './ReprintFilter.scss';
import { printedByCode } from '../../../utils/printedBy';
import { openPrintWindow } from '../../../utils/printRelay';
import { API_BASE_URL } from '../../../config';

const API = `${API_BASE_URL}/api/clinic`;

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

// What each document is looked up by (owner, 2026-11-21): a slip by its
// Slip #, Antenatal by its Antenatal #, every other document by Admission #.
// The binoculars next to the box open that list in a popup to pick from.
const kindOf = (docType) => (docType === 'slip' ? 'slip' : docType === 'antenatal' ? 'antenatal' : 'admission');
const KIND_LABEL = { slip: 'Slip #', admission: 'Admission #', antenatal: 'Antenatal #' };
const KIND_HINT = { slip: 'Slip #, MR # ya naam', admission: 'Admission #, MR # ya naam', antenatal: 'Antenatal #, slip # ya naam' };
const KIND_DETAIL = { slip: 'Department', admission: 'Category · Status', antenatal: 'Slip' };
const KIND_TITLE = { slip: 'Slip dhoondein', admission: 'Admission dhoondein', antenatal: 'Antenatal dhoondein' };
const fmtDay = (iso) => (iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : '');
function fmtWhen(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // Excel rows carry a day only (midnight UTC); everything else its time.
  const dayOnly = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Karachi', day: '2-digit', month: 'short', year: 'numeric',
    ...(dayOnly ? {} : { hour: '2-digit', minute: '2-digit', hour12: false }),
  });
}

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
  const kind = kindOf(docType);
  // The search popup (binoculars): open + its own search text.
  const [finderOpen, setFinderOpen] = useState(false);
  const [finderQ, setFinderQ] = useState('');
  const [list, setList] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const closeFinder = () => setFinderOpen(false);
  useModalKeys({ active: finderOpen, onEsc: closeFinder });

  // Popup list: the typed number / name over all dates, or the List Filter
  // From–To days when nothing is typed.
  useEffect(() => {
    if (!finderOpen) return undefined;
    let off = false;
    const term = finderQ.trim();
    const t = setTimeout(async () => {
      setListLoading(true);
      try {
        const qs = new URLSearchParams({ kind, q: term, from: fromDate, to: toDate });
        const res = await fetch(`${API}/reprint/search?${qs}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message || 'List load nahi hui');
        if (!off) setList(json.data?.rows || []);
      } catch {
        if (!off) setList([]);
      } finally {
        if (!off) setListLoading(false);
      }
    }, term ? 350 : 0);
    return () => { off = true; clearTimeout(t); };
  }, [finderOpen, kind, finderQ, fromDate, toDate]);

  const openFinder = () => { setFinderQ(slipNo.trim()); setList(null); setFinderOpen(true); };
  const pickRow = (row) => { setSlipNo(row.no); setFinderOpen(false); };
  const pickType = (value) => {
    if (kindOf(value) !== kind) setSlipNo('');
    setDocType(value);
  };

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

  // `picked` — a list row's number (Print / double-click); else the box.
  async function handleView(picked) {
    const no = (typeof picked === 'string' ? picked : slipNo).trim();
    if (!no) return toast.error(`${KIND_LABEL[kind]} likhein ya list se chunein`);

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
      // Discharge Certificate prints the user's employee code (printedByCode).
      const printedBy = docType === 'discharge' ? printedByCode(user) : (user?.name || user?.username || user?.email || '');
      const { html, extraHtml } = await buildReprint(docType, no, printedBy, { category: 'cash' });
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
          <div className="rpf-titlebar">Reports — Reprint {DOC_TYPES.find((d) => d.value === docType)?.label}</div>

          <div className="rpf-body">
            <div className="rpf-row">
              <label htmlFor="rpf-no">{KIND_LABEL[kind]}</label>
              <input
                id="rpf-no"
                value={slipNo}
                onChange={(e) => setSlipNo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleView()}
                placeholder={kind === 'slip' ? 'e.g. 2826042' : kind === 'admission' ? 'e.g. 177524' : 'e.g. 03'}
                autoComplete="off"
              />
              <button type="button" className="rpf-find" onClick={openFinder} title={KIND_TITLE[kind]} aria-label={KIND_TITLE[kind]}>
                <Binoculars size={16} />
              </button>
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
                    onChange={() => pickType(t.value)}
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

      {finderOpen && (
        <div className="rpf-finder__overlay" onClick={closeFinder}>
          <div className="rpf-finder" role="dialog" aria-modal="true" aria-label={KIND_TITLE[kind]} onClick={(e) => e.stopPropagation()}>
            <div className="rpf-finder__title">
              <span><Binoculars size={15} /> {KIND_TITLE[kind]}</span>
              <button type="button" className="rpf-finder__close" onClick={closeFinder} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="rpf-finder__bar">
              <input
                value={finderQ}
                onChange={(e) => setFinderQ(e.target.value)}
                placeholder={KIND_HINT[kind]}
                aria-label={KIND_HINT[kind]}
                autoFocus
              />
              <label>From <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
              <label>To <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
            </div>
            <div className="rpf-finder__info">
              <span>{finderQ.trim() ? `"${finderQ.trim()}" — sab dino me` : `${fmtDay(fromDate)} se ${fmtDay(toDate)} tak`}</span>
              <span>{listLoading ? 'Dhoond raha hai…' : `${list?.length || 0} mile`}</span>
            </div>
            <div className="rpf-finder__scroll">
              <table>
                <thead>
                  <tr>
                    <th>{KIND_LABEL[kind]}</th><th>Date</th><th>Patient</th><th>{KIND_DETAIL[kind]}</th>
                    {kind !== 'admission' && <th className="r">Amount</th>}
                  </tr>
                </thead>
                <tbody>
                  {list && !list.length && !listLoading && (
                    <tr><td colSpan={5} className="rpf-finder__empty">Kuch nahi mila — number / naam ya dates badal ke dekhein</td></tr>
                  )}
                  {(list || []).map((r, i) => (
                    <tr key={`${r.no}-${r.date}-${i}`} onClick={() => pickRow(r)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') pickRow(r); }}>
                      <td className="rpf-finder__no">{r.no}</td>
                      <td className="nowrap">{fmtWhen(r.date)}</td>
                      <td>{r.patientName}</td>
                      <td>{r.detail}</td>
                      {kind !== 'admission' && <td className="r">{Number(r.amount || 0).toLocaleString('en-PK')}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="rpf-finder__hint">Jo reprint karna hai us pe click karein — number upar aa jayega, phir View dabayein.</p>
          </div>
        </div>
      )}
    </div>
  );
}
