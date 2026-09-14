import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import SearchableSelect from '../../../components/ui/SearchableSelect';

const API = 'http://localhost:5001/api/accounts';

const todayStr = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => `${todayStr().slice(0, 8)}01`;

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

const fmt2 = (n) =>
  Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

function printMatrix({ data, categoryFromName, categoryToName, dateFrom, dateTo, entityType, printBy }) {
  if (!data || !data.rows.length) { toast.error('No data to print'); return; }
  const { categories, rows, columnTotals, grandTotal } = data;

  const colHeadHTML = categories.map((c) => `<th>${c.name}</th>`).join('');
  const bodyHTML = rows.map((r) => `
    <tr>
      <td class="date-cell">${fmtDate(r.date)}</td>
      ${categories.map((c) => `<td>${fmt2(r.amounts[c.id] || 0)}</td>`).join('')}
      <td class="grand-cell">${fmt2(r.total)}</td>
    </tr>
  `).join('');
  const totalRowHTML = `
    <tr class="total-row">
      <td class="date-cell">TOTAL</td>
      ${categories.map((c) => `<td>${fmt2(columnTotals[c.id] || 0)}</td>`).join('')}
      <td class="grand-cell">${fmt2(grandTotal)}</td>
    </tr>
  `;

  const html = `<!DOCTYPE html><html><head><title>Income Summary</title><style>${MATRIX_CSS}</style></head><body>
    <div class="hdr">
      <div class="hdr-left">
        <b>DARUL SHIFA HOSPITAL</b> (${entityType === 'corporate' ? 'Corporate' : 'Non-Corporate'})
        <div class="period">${fmtDate(dateFrom)} — ${fmtDate(dateTo)} &nbsp;|&nbsp; Category: ${categoryFromName || 'First'} — ${categoryToName || 'Last'}</div>
      </div>
      <div class="hdr-right">${printBy || ''}</div>
    </div>
    <h2>Income Summary</h2>
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

// Import Excel — same layout this report prints: first column is Voucher
// Date, every other column (except a trailing "Total" column, if the file
// has one) is an Account Category by name. Category names don't need to
// already exist — the backend creates any it doesn't recognise.
function parseIncomeExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!raw.length) { resolve([]); return; }

        const header = raw[0];
        const categoryCols = header
          .map((h, i) => ({ name: String(h || '').trim(), col: i }))
          .filter((c) => c.col > 0 && c.name && !/^total$/i.test(c.name));

        const rows = [];
        for (let i = 1; i < raw.length; i++) {
          const r = raw[i];
          const rawDate = r[0];
          if (!rawDate || /^total$/i.test(String(rawDate).trim())) continue; // skip blank/footer TOTAL row
          const parsed = rawDate instanceof Date ? rawDate : new Date(rawDate);
          if (isNaN(parsed.getTime())) continue;
          const dateStr = parsed.toISOString().slice(0, 10);

          const amounts = {};
          categoryCols.forEach((c) => {
            const v = Number(r[c.col]);
            if (v) amounts[c.name] = v;
          });
          rows.push({ date: dateStr, amounts });
        }
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function IncomeSummaryMatrix() {
  const { entityType } = useParams();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [categoryFromId, setCategoryFromId] = useState('');
  const [categoryToId, setCategoryToId] = useState('');
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/income-categories?entityType=${entityType}`)
      .then((r) => r.json())
      .then((j) => {
        const sorted = [...(j.data || [])].sort((a, b) => a.name.localeCompare(b.name));
        setCategories(sorted);
      })
      .catch(() => {});
  }, [entityType]);

  const handlePrint = async () => {
    setLoading(true);
    try {
      const catFrom = categories.find((c) => String(c.id) === String(categoryFromId));
      const catTo = categories.find((c) => String(c.id) === String(categoryToId));
      const params = new URLSearchParams({
        entityType, dateFrom, dateTo,
        ...(catFrom ? { categoryFrom: catFrom.name } : {}),
        ...(catTo ? { categoryTo: catTo.name } : {}),
      });
      const r = await fetch(`${API}/income-summary-matrix?${params}`);
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Failed');
      printMatrix({
        data: j.data, categoryFromName: catFrom?.name, categoryToName: catTo?.name,
        dateFrom, dateTo, entityType,
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      toast.error('Sirf Excel file upload karo (.xlsx / .xls)');
      e.target.value = ''; return;
    }
    setUploading(true);
    try {
      const rows = await parseIncomeExcel(file);
      if (!rows.length) { toast.error('File mein valid data nahi mila'); return; }
      const res = await fetch(`${API}/income-summary-matrix/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, rows }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'Failed');
      const { imported, skipped } = json.data;
      if (skipped.length) {
        toast(`${imported} date(s) imported, ${skipped.length} skipped (already had a voucher)`, { icon: '⚠️' });
      } else {
        toast.success(`${imported} date(s) imported`);
      }
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
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
        <span style={{ color: '#1e293b', fontWeight: 600 }}>Income Summary Matrix</span>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
        Income Summary Matrix
      </div>

      {/* Main box — Crystal Reports style, mirrors Voucher Summary Matrix */}
      <div style={{ border: '2px solid #94a3b8', borderRadius: 6, overflow: 'hidden', maxWidth: 620, background: '#fff' }}>

        <div style={{ background: '#e2e8f0', borderBottom: '1px solid #94a3b8', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Printer size={14} color="#475569" />
          <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Reports › Income Summary Matrix</span>
        </div>

        <div style={{ padding: '1.25rem 1.5rem 1rem' }}>

          {/* Account Category row — picks the range straight from AccIncomeCategory,
              i.e. exactly whatever categories Day Close / manual Income Vouchers use.
              Left blank = no restriction on that end (full range). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', minWidth: 110 }}>Acc. Category</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>From</span>
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  options={categories}
                  value={categoryFromId}
                  onChange={setCategoryFromId}
                  placeholder="(first)"
                  getLabel={(c) => c.name}
                  getKey={(c) => c.id}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>To</span>
              <div style={{ flex: 1 }}>
                <SearchableSelect
                  options={categories}
                  value={categoryToId}
                  onChange={setCategoryToId}
                  placeholder="(last)"
                  getLabel={(c) => c.name}
                  getKey={(c) => c.id}
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem', marginTop: '0.5rem' }}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Excel file se bulk data import karo — pehla column Voucher Date, baaki columns Account Category names"
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: '#fff', color: '#334155', border: '1px solid #94a3b8', borderRadius: 5, padding: '0.45rem 1.1rem', fontWeight: 700, fontSize: '0.8rem', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1, letterSpacing: '0.03em' }}
            >
              <Upload size={13} /> {uploading ? 'Importing…' : 'Import Excel'}
            </button>
            <button
              onClick={handlePrint}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: '#334155', color: '#fff', border: 'none', borderRadius: 5, padding: '0.45rem 1.1rem', fontWeight: 700, fontSize: '0.8rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, letterSpacing: '0.03em' }}
            >
              <Printer size={13} /> {loading ? 'Loading…' : 'Income Summary Matrix'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
