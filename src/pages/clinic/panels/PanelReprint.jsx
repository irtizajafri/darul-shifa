import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useShallow } from 'zustand/react/shallow';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useAuthStore } from '../../../store/useAuthStore';
import { useClinicStore } from '../../../store/useClinicStore';
import { buildReprint, REPRINT_POPUP_FEATURES } from '../reports/reprintPrinters';
import { printedByCode } from '../../../utils/printedBy';
import { openPrintWindow } from '../../../utils/printRelay';
import { PanelReportViewer } from './PanelBilling';
import '../reports/ReprintFilter.scss';
import './PanelReprint.scss';

const API = 'http://localhost:5001/api/clinic';

const todayStr = () => new Date().toISOString().split('T')[0];
const monthAgoStr = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');

// Panels > Reports > Reprint Panel Bill/Form (owner, 2026-10-27) — Clinic's
// Report > Reprint for panel files only. Admission Form, Provisional Bill and
// Discharge Certificate print exactly as Clinic's Reprint does
// (reprintPrinters.js); Diagnostic Bill, Pharmacy Bill and the Front Bill
// (Billing Covering Page) open in Panel Billing's own Report Viewer — the
// Diagnostic / Pharmacy lines are the Provisional Bill's tabs.
const DOC_TYPES = [
  { value: 'admission',   label: 'Admission Form' },
  { value: 'provisional', label: 'Provisional Bill' },
  { value: 'diagnostic',  label: 'Diagnostic Bill', panel: true },
  { value: 'medicine',    label: 'Pharmacy Bill', panel: true },
  { value: 'covering',    label: 'Front Bill', panel: true },
  { value: 'discharge',   label: 'Discharge Certificate' },
];

export default function PanelReprint() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { fetchPanelAdmissionBilling } = useClinicStore(useShallow((s) => ({ fetchPanelAdmissionBilling: s.fetchPanelAdmissionBilling })));

  const [admitNo, setAdmitNo] = useState('');
  const [fromDate, setFromDate] = useState(monthAgoStr());
  const [toDate, setToDate] = useState(todayStr());
  const [docType, setDocType] = useState('admission');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [viewer, setViewer] = useState(null); // { bill, reports }

  // Panel files admitted in the From/To range.
  useEffect(() => {
    if (!fromDate || !toDate) return;
    let alive = true;
    setListLoading(true);
    fetch(`${API}/admission/panel-reprint/list?fromDate=${fromDate}&toDate=${toDate}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setFiles(Array.isArray(j?.data) ? j.data : []); })
      .catch(() => { if (alive) setFiles([]); })
      .finally(() => { if (alive) setListLoading(false); });
    return () => { alive = false; };
  }, [fromDate, toDate]);

  async function assertPanelFile(no) {
    const res = await fetch(`${API}/admission/by-number/${encodeURIComponent(no)}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.data) throw new Error(json.message || 'Is Admission # ka koi record nahi mila');
    if (json.data.patientCategory !== 'panel') throw new Error(`Admission # ${no} panel file nahi hai`);
  }

  async function handleView() {
    const no = admitNo.trim();
    if (!no) { toast.error('Admission # daalo'); return; }
    const type = DOC_TYPES.find((d) => d.value === docType);

    if (type.panel) {
      setBusy(true);
      try {
        await assertPanelFile(no);
        const bill = await fetchPanelAdmissionBilling(no);
        setViewer({ bill, reports: [docType] });
      } catch (err) {
        toast.error(err.message || `${type.label} load nahi hua`);
      } finally {
        setBusy(false);
      }
      return;
    }

    // Opened on the click, before any await, so popup blockers allow it.
    const w = openPrintWindow(REPRINT_POPUP_FEATURES[docType] || 'width=900,height=1000');
    setBusy(true);
    try {
      await assertPanelFile(no);
      const printedBy = docType === 'discharge' ? printedByCode(user) : (user?.name || user?.username || user?.email || '');
      const { html } = await buildReprint(docType, no, printedBy, { category: 'panel' });
      w.document.write(html);
      w.document.close();
    } catch (err) {
      w.close();
      toast.error(err.message || `${type.label} reprint nahi ho saka`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rpf-page">
      <ClinicMenuBar />

      <div className="rpf-center prp-center">
        <div className="rpf-window">
          <div className="rpf-titlebar">Reprint Panel Bill / Form</div>

          <div className="rpf-body">
            <div className="rpf-row">
              <label>Admission #</label>
              <input
                value={admitNo}
                onChange={(e) => setAdmitNo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleView()}
                placeholder="e.g. 174628"
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
                <label key={t.value} className="rpf-radio">
                  <input type="radio" name="panelDocType" checked={docType === t.value} onChange={() => setDocType(t.value)} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div className="rpf-actions">
            <button className="rpf-btn rpf-btn--view" onClick={handleView} disabled={busy}>
              {busy ? 'Loading…' : 'View'}
            </button>
            <button className="rpf-btn rpf-btn--close" onClick={() => navigate(-1)}>Close</button>
          </div>
        </div>

        <div className="prp-list">
          <div className="prp-list-head">
            Panel files — {listLoading ? 'loading…' : `${files.length} record${files.length === 1 ? '' : 's'}`}
            <span className="prp-list-hint">Row par click karein to Admission # bhar jayega</span>
          </div>
          <div className="prp-list-scroll">
            <table className="prp-table">
              <thead>
                <tr><th>Admission #</th><th>Patient</th><th>Company</th><th>Admit Date</th><th>Status</th></tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr
                    key={f.id}
                    className={f.admissionNo === admitNo.trim() ? 'prp-row--active' : ''}
                    onClick={() => setAdmitNo(f.admissionNo)}
                    onDoubleClick={() => { setAdmitNo(f.admissionNo); }}
                  >
                    <td>{f.admissionNo}</td>
                    <td>{f.patientName}</td>
                    <td>{f.companyName || '—'}</td>
                    <td>{fmtDate(f.createdAt)}</td>
                    <td className="prp-status">{f.status}</td>
                  </tr>
                ))}
                {!listLoading && !files.length && (
                  <tr><td colSpan={5} className="prp-empty">In tareekhon mein koi panel file nahi</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {viewer && <PanelReportViewer bill={viewer.bill} reports={viewer.reports} onClose={() => setViewer(null)} />}
    </div>
  );
}
