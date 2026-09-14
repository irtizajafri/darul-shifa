import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import SearchableSelect from '../../../components/ui/SearchableSelect';

const API = 'http://localhost:5001/api/accounts';

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${todayStr().slice(0, 8)}01`;

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

const fmt2 = (n) =>
  Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Same ledger-style crosstab as Income Summary Matrix — one design for both
// (Expense's columns are Main GL instead of Account Category).
const MATRIX_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:10px; color:#000; background:#fff; padding:20px 24px; }
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2px; }
  .hdr-left b { font-size:13px; }
  .hdr-left .period { font-size:10.5px; }
  .hdr-right { font-size:10.5px; }
  h2 { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:0.04em; margin:8px 0 10px; }
  table { width:100%; border-collapse:collapse; }
  th, td { border:1px solid #999; padding:4px 6px; white-space:nowrap; }
  th { font-size:9.5px; font-weight:700; text-transform:uppercase; text-align:center; background:#f2f2f2; }
  td { font-size:9.5px; text-align:right; }
  td.date-cell { text-align:left; font-weight:600; }
  tr.total-row td { font-weight:800; background:#f2f2f2; border-top:2px solid #000; }
  td.grand-cell { font-weight:800; }
`;

function printMatrix({ data, glFromLabel, glToLabel, dateFrom, dateTo, entityType }) {
  if (!data || !data.rows.length) { toast.error('No data to print'); return; }
  const { mainGLs, rows, columnTotals, grandTotal } = data;

  const colHeadHTML = mainGLs.map((g) => `<th>${g.name}</th>`).join('');
  const bodyHTML = rows.map((r) => `
    <tr>
      <td class="date-cell">${fmtDate(r.date)}</td>
      ${mainGLs.map((g) => `<td>${fmt2(r.amounts[g.id] || 0)}</td>`).join('')}
      <td class="grand-cell">${fmt2(r.total)}</td>
    </tr>
  `).join('');
  const totalRowHTML = `
    <tr class="total-row">
      <td class="date-cell">TOTAL</td>
      ${mainGLs.map((g) => `<td>${fmt2(columnTotals[g.id] || 0)}</td>`).join('')}
      <td class="grand-cell">${fmt2(grandTotal)}</td>
    </tr>
  `;

  const html = `<!DOCTYPE html><html><head><title>Expense Summary</title><style>${MATRIX_CSS}</style></head><body>
    <div class="hdr">
      <div class="hdr-left">
        <b>DARUL SHIFA HOSPITAL</b> (${entityType === 'corporate' ? 'Corporate' : 'Non-Corporate'})
        <div class="period">${fmtDate(dateFrom)} — ${fmtDate(dateTo)} &nbsp;|&nbsp; Main GL: ${glFromLabel || 'First'} — ${glToLabel || 'Last'}</div>
      </div>
    </div>
    <h2>Expense Summary</h2>
    <table>
      <thead><tr><th>Voucher Date</th>${colHeadHTML}<th>Total</th></tr></thead>
      <tbody>${bodyHTML}${totalRowHTML}</tbody>
    </table>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { toast.error('Popup blocked'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.onafterprint = () => win.close(); }, 400);
}

export default function VoucherSummaryMatrix() {
  const { entityType } = useParams();
  const navigate = useNavigate();

  const [mainGLs, setMainGLs] = useState([]);
  const [glFromId, setGlFromId] = useState('');
  const [glToId, setGlToId] = useState('');
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo]     = useState(todayStr());
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    fetch(`${API}/main-gl?entityType=${entityType}`)
      .then((r) => r.json())
      .then((j) => {
        const sorted = [...(j.data || [])].sort((a, b) => a.code.localeCompare(b.code));
        setMainGLs(sorted);
      })
      .catch(() => {});
  }, [entityType]);

  const handlePrint = async () => {
    setLoading(true);
    try {
      const glFrom = mainGLs.find((g) => String(g.id) === String(glFromId));
      const glTo = mainGLs.find((g) => String(g.id) === String(glToId));
      const params = new URLSearchParams({
        entityType, dateFrom, dateTo,
        ...(glFrom ? { mainGlFrom: glFrom.code } : {}),
        ...(glTo ? { mainGlTo: glTo.code } : {}),
      });
      const r = await fetch(`${API}/voucher-summary-matrix?${params}`);
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Failed');
      printMatrix({
        data: j.data, glFromLabel: glFrom?.name, glToLabel: glTo?.name,
        dateFrom, dateTo, entityType,
      });
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
        <span style={{ color: '#1e293b', fontWeight: 600 }}>Expense Summary Matrix</span>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
        Expense Summary Matrix
      </div>

      {/* Main box — Crystal Reports style, mirrors Income Summary Matrix */}
      <div style={{ border: '2px solid #94a3b8', borderRadius: 6, overflow: 'hidden', maxWidth: 620, background: '#fff' }}>

        <div style={{ background: '#e2e8f0', borderBottom: '1px solid #94a3b8', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Printer size={14} color="#475569" />
          <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Reports › Expense Summary Matrix</span>
        </div>

        <div style={{ padding: '1.25rem 1.5rem 1rem' }}>

          {/* Main GL row — picks the range straight from AccMainGL. Left
              blank = no restriction on that end (full range). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', minWidth: 110 }}>Main GL</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>From</span>
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  options={mainGLs}
                  value={glFromId}
                  onChange={setGlFromId}
                  placeholder="(first)"
                  getLabel={(g) => `${g.code} — ${g.name}`}
                  getKey={(g) => g.id}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>To</span>
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  options={mainGLs}
                  value={glToId}
                  onChange={setGlToId}
                  placeholder="(last)"
                  getLabel={(g) => `${g.code} — ${g.name}`}
                  getKey={(g) => g.id}
                />
              </div>
            </div>
          </div>

          {/* Voucher Date row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', minWidth: 110 }}>Voucher Date</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>From</span>
              <div style={{ flex: 1 }}>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #94a3b8', borderRadius: 4, fontSize: '0.82rem', color: '#1e293b', background: '#fff' }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>To</span>
              <div style={{ flex: 1 }}>
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
              <Printer size={13} /> {loading ? 'Loading…' : 'Expense Summary Matrix'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
