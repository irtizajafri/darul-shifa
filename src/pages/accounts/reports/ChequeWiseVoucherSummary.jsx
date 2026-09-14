import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const API = 'http://localhost:5001/api/accounts';

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${todayStr().slice(0, 8)}01`;

const MODES = [
  { key: 'cash', label: 'Cash' },
  { key: 'online', label: 'Online' },
  { key: 'cheque', label: 'Cheque' },
];

const fieldLabelStyle = { fontSize: '0.82rem', fontWeight: 600, color: '#334155', minWidth: 110 };
const rowStyle = { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' };
const dateInputStyle = { width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #94a3b8', borderRadius: 4, fontSize: '0.82rem', color: '#1e293b', background: '#fff' };

const fmtDateLong = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
const fmt2 = (n) =>
  Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CWV_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:10px; color:#000; background:#fff; padding:20px 24px; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2px; }
  .hdr-left { font-size:11px; }
  .hdr-center { text-align:center; flex:1; }
  .hdr-center h2 { font-size:14px; font-weight:800; text-decoration:underline; }
  .hdr-center .period { font-size:10px; margin-top:2px; }
  .hdr-right { font-size:8.5px; color:#333; text-align:right; }
  table { width:100%; border-collapse:collapse; margin-top:10px; }
  th { text-align:left; font-size:9px; font-weight:800; padding:4px 5px; border-bottom:1.5px solid #000; text-transform:uppercase; }
  th.amt, td.amt { text-align:right; }
  td { padding:3px 5px; font-size:9px; border-bottom:1px solid #eee; }
  tr.grand-row td { font-weight:800; border-top:2px solid #000; border-bottom:none; padding-top:6px; }
`;

function printChequeWiseVoucherSummary({ data, dateFrom, dateTo, printBy }) {
  if (!data || !data.rows.length) { toast.error('No data to print'); return; }
  const { rows, grandTotal } = data;

  const bodyHTML = rows.map((r) => `
    <tr>
      <td>${fmtDateLong(r.voucherDate)}</td>
      <td>${r.voucherNo}</td>
      <td>${r.chequeNo}</td>
      <td>${r.chequeDate ? fmtDateLong(r.chequeDate) : ''}</td>
      <td>${r.bankAccount}</td>
      <td>${r.accountCode}</td>
      <td>${r.description}</td>
      <td class="amt">${fmt2(r.amount)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head><title>Cheque Detail Report</title><style>${CWV_CSS}</style></head><body>
    <div class="hdr">
      <div class="hdr-left">Darul Shifa Hospital</div>
      <div class="hdr-center">
        <h2>Cheque Detail Report</h2>
        <div class="period">From : ${fmtDateLong(dateFrom)} To : ${fmtDateLong(dateTo)}</div>
      </div>
      <div class="hdr-right">${printBy || ''}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>CheDate</th><th>Vouno</th><th>Cheque No</th><th>Cheque Dt</th>
          <th>Bank Account</th><th>Acc Of</th><th>Description</th><th class="amt">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${bodyHTML}
        <tr class="grand-row"><td colspan="7">Grand Total</td><td class="amt">${fmt2(grandTotal)}</td></tr>
      </tbody>
    </table>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { toast.error('Popup blocked'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 400);
}

export default function ChequeWiseVoucherSummary() {
  const { entityType } = useParams();
  const navigate = useNavigate();

  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayStr());
  const [selectedModes, setSelectedModes] = useState(['cash', 'online', 'cheque']);
  const [loading, setLoading] = useState(false);

  const toggleMode = (key) => {
    setSelectedModes((prev) => prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]);
  };

  const handlePrint = async () => {
    if (!selectedModes.length) { toast.error('Kam se kam ek Mode select karo'); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ entityType, dateFrom, dateTo, modes: selectedModes.join(',') });
      const r = await fetch(`${API}/cheque-wise-voucher-summary?${params}`);
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Failed');
      printChequeWiseVoucherSummary({ data: j.data, dateFrom, dateTo });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#64748b', marginBottom: '1.25rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}>
          <ArrowLeft size={13} /> Reports
        </button>
        <span>›</span>
        <span style={{ color: '#1e293b', fontWeight: 600 }}>Cheque Wise Voucher Summary</span>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
        Cheque Wise Voucher Summary
      </div>

      {/* Main box — Crystal Reports style */}
      <div style={{ border: '2px solid #94a3b8', borderRadius: 6, overflow: 'hidden', maxWidth: 620, background: '#fff' }}>

        <div style={{ background: '#e2e8f0', borderBottom: '1px solid #94a3b8', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckSquare size={14} color="#475569" />
          <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Reports › Cheque Detail Report</span>
        </div>

        <div style={{ padding: '1.25rem 1.5rem 1rem' }}>

          {/* Mode filter */}
          <div style={rowStyle}>
            <span style={fieldLabelStyle}>Mode</span>
            <div style={{ display: 'flex', gap: '1.2rem', flex: 1 }}>
              {MODES.map((m) => (
                <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedModes.includes(m.key)} onChange={() => toggleMode(m.key)} />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          {/* Voucher Date row */}
          <div style={rowStyle}>
            <span style={fieldLabelStyle}>Voucher Date</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>From</span>
              <div style={{ flex: 1 }}>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={dateInputStyle} />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>To</span>
              <div style={{ flex: 1 }}>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={dateInputStyle} />
              </div>
            </div>
          </div>

          {/* Footer row — button right-aligned */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem', marginTop: '0.5rem' }}>
            <button
              onClick={handlePrint}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: '#334155', color: '#fff', border: 'none', borderRadius: 5, padding: '0.45rem 1.1rem', fontWeight: 700, fontSize: '0.8rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, letterSpacing: '0.03em' }}
            >
              <CheckSquare size={13} /> {loading ? 'Loading…' : 'Cheque Wise Voucher Summary'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
