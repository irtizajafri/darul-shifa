import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload, RefreshCw, Printer } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './PanelBillingDetailReport.scss';

const API = 'http://localhost:5001/api/clinic';

// Bill-head columns (order = report columns)
const HEADS = [
  { key: 'constFee',        label: 'Const Fee' },
  { key: 'followUp',        label: 'Follow-up' },
  { key: 'anesthesia',      label: 'Anesthesia' },
  { key: 'medicine',        label: 'Medicine' },
  { key: 'laboratory',      label: 'Laboratory' },
  { key: 'costOfBlood',     label: 'Cost of Blood' },
  { key: 'echocardiograph', label: 'Echocardiograph' },
  { key: 'ultrasound',      label: 'Ultrasound' },
  { key: 'xRay',            label: 'X-Ray' },
  { key: 'physiotherapy',   label: 'Physiotherapy' },
  { key: 'ctScan',          label: 'C.T. Scan' },
  { key: 'surgeonFee',      label: 'Surgeon Fee' },
];

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

// Header-name → field mapping (robust: matches by header text, not fixed column index)
const HEAD_MATCH = [
  ['const fee', 'constFee'], ['follow-up', 'followUp'], ['followup', 'followUp'],
  ['anesthesia', 'anesthesia'], ['medicine', 'medicine'], ['laboratory', 'laboratory'],
  ['cost of blood', 'costOfBlood'], ['echocardiograph', 'echocardiograph'], ['ultrasound', 'ultrasound'],
  ['x-ray', 'xRay'], ['xray', 'xRay'], ['physiotherapy', 'physiotherapy'],
  ['c.t. scan', 'ctScan'], ['ct scan', 'ctScan'], ['surgon fee', 'surgeonFee'],
  ['surgeon fee', 'surgeonFee'], ['total amount', 'totalAmount'],
];

function parseBillingExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb  = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

        // period from "From : dd-mm-yyyy   To : dd-mm-yyyy"
        let periodFrom = null, periodTo = null;
        for (let i = 0; i < 8; i++) {
          const line = (raw[i] || []).map((c) => String(c)).join(' ');
          const m = line.match(/From\s*:\s*(\d{2}-\d{2}-\d{4})\s*To\s*:\s*(\d{2}-\d{2}-\d{4})/i);
          if (m) {
            const iso = (s) => { const [d, mo, y] = s.split('-'); return `${y}-${mo}-${d}`; };
            periodFrom = iso(m[1]); periodTo = iso(m[2]); break;
          }
        }

        // header row = the row whose first cell contains "admit"
        let hIdx = -1;
        for (let i = 0; i < 15; i++) { if (norm((raw[i] || [])[0]).includes('admit')) { hIdx = i; break; } }
        if (hIdx === -1) { reject(new Error('Header row (Admit #) nahi mila')); return; }

        const col = {};
        (raw[hIdx] || []).forEach((c, idx) => {
          const n = norm(c);
          if (!n) return;
          if (n.includes('admit')) col.admitNo = idx;
          else if (n.includes('pataint') || n.includes('patient')) col.patientName = idx;
          else if (n.includes('conscode') || n === 'cons code') col.consCode = idx;
          else if (n.includes('compname') || n === 'company') col.companyName = idx;
          else { const hit = HEAD_MATCH.find(([k]) => n === k); if (hit && col[hit[1]] == null) col[hit[1]] = idx; }
        });

        const rows = [];
        for (let i = hIdx + 1; i < raw.length; i++) {
          const r = raw[i];
          const a = r[col.admitNo];
          if (typeof a !== 'number' || a <= 0) continue;
          const g = (k) => (col[k] != null ? Number(r[col[k]]) || 0 : 0);
          rows.push({
            admitNo: String(a),
            patientName: String(r[col.patientName] || '').trim(),
            consCode:    String(r[col.consCode] || '').trim(),
            companyName: String(r[col.companyName] || '').trim(),
            constFee: g('constFee'), followUp: g('followUp'), anesthesia: g('anesthesia'),
            medicine: g('medicine'), laboratory: g('laboratory'), costOfBlood: g('costOfBlood'),
            echocardiograph: g('echocardiograph'), ultrasound: g('ultrasound'), xRay: g('xRay'),
            physiotherapy: g('physiotherapy'), ctScan: g('ctScan'), surgeonFee: g('surgeonFee'),
            totalAmount: g('totalAmount'),
          });
        }
        resolve({ rows, periodFrom, periodTo });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getUTCDate()).padStart(2, '0')}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${dt.getUTCFullYear()}`;
};

export default function PanelBillingDetailReport() {
  const fileRef = useRef(null);

  const [companies, setCompanies] = useState([]);
  const [organisation, setOrganisation] = useState('ALL');
  const [person, setPerson] = useState('');
  const [consultant, setConsultant] = useState('');

  const [data, setData] = useState({ rows: [], totals: {}, period: null, count: 0 });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    fetch(`${API}/panel-companies`).then((r) => r.json()).then((j) => setCompanies(j.data || [])).catch(() => {});
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ organisation });
      if (person.trim()) q.set('person', person.trim());
      if (consultant.trim()) q.set('consultant', consultant.trim());
      const res = await fetch(`${API}/panel-billing?${q}`);
      const json = await res.json();
      setData(json.data || { rows: [], totals: {}, period: null, count: 0 });
      setShown(true);
    } catch {
      toast.error('Report load nahi hui');
    } finally {
      setLoading(false);
    }
  }, [organisation, person, consultant]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!['xlsx', 'xls'].includes(file.name.split('.').pop().toLowerCase())) {
      toast.error('Sirf Excel file (.xlsx / .xls)'); e.target.value = ''; return;
    }
    setUploading(true);
    try {
      const { rows, periodFrom, periodTo } = await parseBillingExcel(file);
      if (!rows.length) { toast.error('Excel mein valid data nahi mila'); return; }
      const res = await fetch(`${API}/panel-billing/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, periodFrom, periodTo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      toast.success(json.message || `${rows.length} bills imported`);
      fetch(`${API}/panel-companies`).then((r) => r.json()).then((j) => setCompanies(j.data || [])).catch(() => {});
      fetchReport();
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  const { rows, totals, period } = data;

  return (
    <div className="pbd-page">
      <ClinicMenuBar />

      <div className="pbd-body">
        {/* ── Filter bar ── */}
        <div className="pbd-filter no-print">
          <div className="pbd-filter-title">Billing Detail Report — Filter</div>
          <div className="pbd-filter-row">
            <div className="pbd-fg">
              <label>Organisation</label>
              <select value={organisation} onChange={(e) => setOrganisation(e.target.value)}>
                <option value="ALL">ALL</option>
                {companies.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="pbd-fg">
              <label>Person / Emp.</label>
              <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Patient / employee naam" />
            </div>
            <div className="pbd-fg">
              <label>Consultant</label>
              <input value={consultant} onChange={(e) => setConsultant(e.target.value)} placeholder="Doctor naam" />
            </div>
            <div className="pbd-filter-actions">
              <button className="pbd-btn pbd-btn--ok" onClick={fetchReport} disabled={loading}>
                <RefreshCw size={14} className={loading ? 'pbd-spin' : ''} /> Show Report
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleUpload} />
              <button className="pbd-btn pbd-btn--upload" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload size={14} /> {uploading ? 'Uploading…' : 'Upload Excel'}
              </button>
              <button className="pbd-btn pbd-btn--print" onClick={() => window.print()} disabled={!shown || !rows.length}>
                <Printer size={14} /> Print
              </button>
            </div>
          </div>
        </div>

        {/* ── Report ── */}
        <div className="pbd-report">
          <div className="pbd-rpt-head">
            <div className="pbd-rpt-title">PANEL BILLING REPORT</div>
            <div className="pbd-rpt-sub">Darul Shifa Hospital</div>
            <div className="pbd-rpt-meta">
              <span>From : {fmtDate(period?.from)}　To : {fmtDate(period?.to)}</span>
              <span>Produced On : {new Date().toLocaleString('en-GB')}</span>
            </div>
          </div>

          {!shown ? (
            <div className="pbd-empty">Filter set karke <b>Show Report</b> dabao, ya <b>Upload Excel</b> se data laao.</div>
          ) : !rows.length ? (
            <div className="pbd-empty">Is filter par koi bill nahi mila.</div>
          ) : (
            <div className="pbd-table-wrap">
              <table className="pbd-table">
                <thead>
                  <tr>
                    <th className="pbd-l">Admit #</th>
                    <th className="pbd-l">Patient Name</th>
                    <th className="pbd-l">ConsCode</th>
                    <th className="pbd-l">CompName</th>
                    {HEADS.map((h) => <th key={h.key} className="pbd-r">{h.label}</th>)}
                    <th className="pbd-r pbd-total-col">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="pbd-l">{r.admitNo}</td>
                      <td className="pbd-l">{r.patientName}</td>
                      <td className="pbd-l">{r.consCode || '—'}</td>
                      <td className="pbd-l">{r.companyName || '—'}</td>
                      {HEADS.map((h) => <td key={h.key} className="pbd-r">{r[h.key] ? fmt(r[h.key]) : '-'}</td>)}
                      <td className="pbd-r pbd-total-col">{fmt(r.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="pbd-totals">
                    <td className="pbd-l" colSpan={4}>TOTAL — {rows.length} bills</td>
                    {HEADS.map((h) => <td key={h.key} className="pbd-r">{fmt(totals[h.key])}</td>)}
                    <td className="pbd-r pbd-total-col">{fmt(totals.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
