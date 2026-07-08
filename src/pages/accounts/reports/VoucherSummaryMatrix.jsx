import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

const API = 'http://localhost:5001/api/accounts';

const todayStr = () => new Date().toISOString().slice(0, 10);

const getFiscalStart = () => {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  return `${m >= 6 ? y : y - 1}-07-01`;
};

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

const fmt2 = (n) =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MATRIX_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:11px; color:#000; background:#fff; padding:24px 28px; }
  h2 { font-size:15px; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; text-align:center; margin-bottom:4px; }
  .sub { font-size:10px; text-align:center; color:#333; margin-bottom:14px; }
  table { width:100%; border-collapse:collapse; }
  th { padding:5px 8px; font-size:10.5px; font-weight:700; text-transform:uppercase; border-top:2px solid #000; border-bottom:2px solid #000; }
  td { padding:6px 8px; font-size:10.5px; }
  .date-row td { background:#f0f0f0; font-weight:700; font-size:11px; border-top:1.5px solid #555; padding:5px 8px; }
  .gl-row td { padding:5px 8px 5px 20px; border-bottom:1px solid #e5e5e5; }
  .total-row td { font-weight:700; border-top:1px solid #999; border-bottom:2px solid #000; padding:5px 8px; }
  .grand-row td { font-weight:900; font-size:12px; border-top:2.5px solid #000; padding:6px 8px; }
  .r { text-align:right; }
`;

function printMatrix({ rows, dateFrom, dateTo, entityType }) {
  if (!rows || rows.length === 0) { toast.error('No data to print'); return; }

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  const bodyHTML = rows.map((row) => `
    <tr class="date-row">
      <td>${fmtDate(row.date)}</td>
      <td></td>
      <td class="r">${fmt2(row.total)}</td>
    </tr>
    ${row.heads.map((h) => `
      <tr class="gl-row">
        <td>${h.glName}</td>
        <td></td>
        <td class="r">${fmt2(h.amount)}</td>
      </tr>
    `).join('')}
  `).join('');

  const html = `<!DOCTYPE html><html><head><title>Voucher Summary Matrix</title><style>${MATRIX_CSS}</style></head><body>
    <h2>Voucher Summary Matrix</h2>
    <div class="sub">${entityType?.toUpperCase() || ''} &nbsp;|&nbsp; ${fmtDate(dateFrom)} — ${fmtDate(dateTo)}</div>
    <table>
      <thead>
        <tr>
          <th>Date / Main GL</th>
          <th></th>
          <th class="r">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${bodyHTML}
        <tr class="grand-row">
          <td>GRAND TOTAL</td>
          <td></td>
          <td class="r">${fmt2(grandTotal)}</td>
        </tr>
      </tbody>
    </table>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 400);
}

export default function VoucherSummaryMatrix() {
  const { entityType } = useParams();
  const navigate = useNavigate();

  const [dateFrom, setDateFrom] = useState(getFiscalStart());
  const [dateTo, setDateTo]     = useState(todayStr());
  const [loading, setLoading]   = useState(false);

  const handlePrint = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ entityType, dateFrom, dateTo });
      const r = await fetch(`${API}/voucher-summary-matrix?${params}`);
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Failed');
      printMatrix({ rows: j.data?.rows || [], dateFrom, dateTo, entityType });
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
        <span style={{ color: '#1e293b', fontWeight: 600 }}>Voucher Summary Matrix</span>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
        Voucher Summary Matrix
      </div>

      {/* Main box — Crystal Reports style */}
      <div style={{ border: '2px solid #94a3b8', borderRadius: 6, overflow: 'hidden', maxWidth: 620, background: '#fff' }}>

        {/* Header bar */}
        <div style={{ background: '#e2e8f0', borderBottom: '1px solid #94a3b8', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Printer size={14} color="#475569" />
          <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Reports › Voucher Summary Matrix</span>
        </div>

        {/* Form body */}
        <div style={{ padding: '1.25rem 1.5rem 1rem' }}>

          {/* Voucher Date row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', minWidth: 110 }}>Voucher Date</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>From</span>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #94a3b8', borderRadius: 4, fontSize: '0.82rem', color: '#1e293b', background: '#fff' }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>To</span>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #94a3b8', borderRadius: 4, fontSize: '0.82rem', color: '#1e293b', background: '#fff' }}
                />
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
              <Printer size={13} /> {loading ? 'Loading…' : 'Voucher Summary Matrix'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
