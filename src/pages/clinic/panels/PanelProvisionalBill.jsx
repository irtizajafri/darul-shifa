import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Search, Plus, Printer } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import './PanelProvisionalBill.scss';

const API = 'http://localhost:5001/api/clinic';

// Map each bill-head field to the Ward "Heads" label shown in the Provisional Bill tab
const HEAD_LABELS = {
  constFee: 'Consultation Fee', followUp: 'Follow-up', anesthesia: 'Anesthesia',
  medicine: 'Medicine', laboratory: 'Laboratory', costOfBlood: 'Cost of Blood',
  echocardiograph: 'Echocardiograph', ultrasound: 'Ultrasound', xRay: 'X-Ray',
  physiotherapy: 'Physiotherapy', ctScan: 'C.T. Scan', surgeonFee: 'Surgeon Fee',
};
const HEAD_KEYS = Object.keys(HEAD_LABELS);

const TABS = ['Provisional Bill', 'Diagnostic Bill', 'Pharmacy Bill', 'MESS'];

const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function PanelProvisionalBill() {
  const [searchParams] = useSearchParams();
  const [admitNo, setAdmitNo] = useState('');
  const [bill, setBill] = useState(null);          // looked-up billing detail
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('Provisional Bill');
  const [reprintReady, setReprintReady] = useState(false);

  const [billHeads, setBillHeads] = useState([]);   // for the Heads dropdown (manual add)

  // Provisional Bill rows (auto from data + manual additions)
  const [provRows, setProvRows] = useState([]);
  const [manual, setManual] = useState({ ward: '', head: '', qty: '1', rate: '', remarks: '' });

  useEffect(() => {
    fetch(`${API}/bill-heads`).then((r) => r.json()).then((j) => setBillHeads(j.data || [])).catch(() => {});
  }, []);

  async function lookup(overrideNo) {
    const no = (overrideNo ?? admitNo).trim();
    if (!no) return toast.error('Admission # daalo');
    setLoading(true);
    try {
      const res = await fetch(`${API}/panel-billing/by-admit/${encodeURIComponent(no)}`);
      const json = await res.json();
      if (!json.data) { setBill(null); setProvRows([]); toast.error('Is admission # ka koi panel bill nahi mila'); return; }
      const b = json.data;
      setAdmitNo(no);
      setBill(b);
      // build Provisional Bill rows from non-zero bill-heads
      const rows = HEAD_KEYS
        .filter((k) => Number(b[k]) > 0)
        .map((k, i) => ({ id: `d${i}`, ward: '', head: HEAD_LABELS[k], qty: 1, rate: Number(b[k]), amount: Number(b[k]), remarks: '', auto: true }));
      setProvRows(rows);
      setTab('Provisional Bill');
      return rows;
    } catch {
      toast.error('Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  // Reprint (Report > Reprint > Provisional Bill): auto-lookup + auto-print when
  // opened via ?admissionNo=...&autoprint=1
  useEffect(() => {
    const no = searchParams.get('admissionNo');
    const autoprint = searchParams.get('autoprint');
    if (!no) return;
    (async () => {
      const rows = await lookup(no);
      if (autoprint && rows?.length) setReprintReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!reprintReady) return;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [reprintReady]);

  function addManualRow() {
    if (!manual.head) return toast.error('Head select karo');
    const qty = Number(manual.qty) || 1;
    const rate = Number(manual.rate) || 0;
    setProvRows((rows) => [...rows, {
      id: `m${Date.now()}`, ward: manual.ward, head: manual.head, qty, rate, amount: qty * rate, remarks: manual.remarks, auto: false,
    }]);
    setManual({ ward: '', head: '', qty: '1', rate: '', remarks: '' });
  }

  function removeRow(id) { setProvRows((rows) => rows.filter((r) => r.id !== id)); }

  const billAmount = provRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="ppb-page">
      <ClinicMenuBar />

      <div className="ppb-body">
        <div className="ppb-window">
          <div className="ppb-titlebar">
            <span>Transaction — Panel Provisional Bill</span>
            <span className="ppb-title-right">Panel Provisional Bill</span>
          </div>

          {/* ── Header ── */}
          <div className="ppb-header">
            <div className="ppb-hg">
              <label>Admission #</label>
              <div className="ppb-lookup">
                <input value={admitNo} onChange={(e) => setAdmitNo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookup()} placeholder="e.g. 142605" />
                <button onClick={lookup} disabled={loading}><Search size={14} /></button>
              </div>
            </div>
            <div className="ppb-hg">
              <label>Patient</label>
              <div className="ppb-val">{bill?.patientName || '—'}</div>
            </div>
            <div className="ppb-hg">
              <label>Company</label>
              <div className="ppb-val ppb-val--blue">{bill?.companyName || '—'}</div>
            </div>
            <div className="ppb-hg">
              <label>Consultant</label>
              <div className="ppb-val">{bill?.consCode || '—'}</div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="ppb-tabs">
            {TABS.map((t) => (
              <button key={t} className={`ppb-tab ${tab === t ? 'ppb-tab--active' : ''}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>

          {/* ── Tab content ── */}
          <div className="ppb-tab-body">
            {tab === 'Provisional Bill' && (
              <>
                <div className="ppb-add-row">
                  <div className="ppb-fg"><label>Ward</label>
                    <input value={manual.ward} onChange={(e) => setManual((m) => ({ ...m, ward: e.target.value }))} placeholder="Ward (optional)" />
                  </div>
                  <div className="ppb-fg"><label>Heads</label>
                    <select value={manual.head} onChange={(e) => setManual((m) => ({ ...m, head: e.target.value }))}>
                      <option value="">— Select —</option>
                      {billHeads.map((b) => <option key={b.id} value={b.description || b.headCode}>{b.description || b.headCode}</option>)}
                    </select>
                  </div>
                  <div className="ppb-fg ppb-fg--sm"><label>Qty</label>
                    <input value={manual.qty} onChange={(e) => setManual((m) => ({ ...m, qty: e.target.value }))} />
                  </div>
                  <div className="ppb-fg ppb-fg--sm"><label>Rate</label>
                    <input value={manual.rate} onChange={(e) => setManual((m) => ({ ...m, rate: e.target.value }))} />
                  </div>
                  <div className="ppb-fg"><label>Remarks</label>
                    <input value={manual.remarks} onChange={(e) => setManual((m) => ({ ...m, remarks: e.target.value }))} />
                  </div>
                  <button className="ppb-add-btn" onClick={addManualRow}><Plus size={14} /> Add</button>
                </div>

                <table className="ppb-table">
                  <thead>
                    <tr><th>Ward Name</th><th>Heads</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th><th>Remarks</th><th></th></tr>
                  </thead>
                  <tbody>
                    {provRows.length === 0 ? (
                      <tr><td colSpan={7} className="ppb-empty">Admission # lookup karo — bill-head wise data yahan aayega.</td></tr>
                    ) : provRows.map((r) => (
                      <tr key={r.id} className={r.auto ? 'ppb-auto' : ''}>
                        <td>{r.ward || '—'}</td>
                        <td>{r.head}</td>
                        <td className="r">{r.qty}</td>
                        <td className="r">{fmt(r.rate)}</td>
                        <td className="r">{fmt(r.amount)}</td>
                        <td>{r.remarks || ''}</td>
                        <td><button className="ppb-del" onClick={() => removeRow(r.id)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {tab !== 'Provisional Bill' && (
              <div className="ppb-placeholder">
                <b>{tab}</b> — itemized detail manually enter hoga (ye data uploaded file mein nahi hota).
                <br />Uploaded panel bill ka total <b>{tab === 'Diagnostic Bill' ? 'Laboratory / X-Ray / Ultrasound' : tab === 'Pharmacy Bill' ? 'Medicine' : ''}</b> head Provisional Bill tab mein aa jaata hai.
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="ppb-footer">
            <button className="ppb-print" onClick={() => window.print()} disabled={!provRows.length}><Printer size={14} /> Print</button>
            <div className="ppb-total">Bill Amount <span>{fmt(billAmount)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
