import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, Landmark, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
import { API_BASE_URL } from '../../../config';

const API = `${API_BASE_URL}/api/accounts`;

// Stored statement dates are a calendar day (00:00 UTC, older uploads PKT
// midnight); +5h reads both as that day.
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayIso = (d) => new Date(new Date(d).getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const fmtIso = (iso) => (iso ? `${iso.slice(8, 10)} ${SHORT[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : '');
const fmtDate = (d) => fmtIso(dayIso(d));
const fmt2 = (n) =>
  n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Upload Bank Statement — the bank's own statement, exactly as exported from
// online banking: Date | Value Date | Instrument No. | Particulars | Debit |
// Credit | Balance. First row is the header (skipped); every other row with
// a parseable Date becomes one line.
//
// Dates are read as the calendar day the sheet shows (Bank Reconciliation,
// 2026-11-18): Excel date cells by their serial number, text dates as
// DD/MM/YYYY, DD-MM-YYYY, DD-Mon-YYYY or YYYY-MM-DD — never through the
// browser clock, which used to move a day back. Amounts may carry commas.
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (y, m, d) => {
  if (y < 100) y += 2000;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100)) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 ? `${y}-${pad2(m)}-${pad2(d)}` : null;
};
// Excel day serial → calendar day, in UTC so the browser's zone can't shift
// it (1900 system; a 1904-system workbook adds 1462 days).
function statementCellDate(v, date1904 = false) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return null; // not a date serial
    const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(v + (date1904 ? 1462 : 0)) * 86400000);
    return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  if (v instanceof Date) return isNaN(v.getTime()) ? null : isoOf(v.getFullYear(), v.getMonth() + 1, v.getDate());
  const t = String(v).trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return isoOf(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/);
  if (m) return isoOf(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ,]+(\d{2,4})$/);
  if (m && MON[m[2].toLowerCase()]) return isoOf(+m[3], MON[m[2].toLowerCase()], +m[1]);
  return null;
}
function statementCellAmount(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v).trim();
  if (!t || t === '-') return null;
  const n = Number(t.replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return /^\(.*\)$/.test(t) || /\bdr\b/i.test(t) ? -Math.abs(n) : n;
}

function parseBankStatementExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const date1904 = !!wb.Workbook?.WBProps?.date1904;
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        if (!raw.length) { resolve([]); return; }

        const rows = [];
        for (let i = 1; i < raw.length; i++) {
          const r = raw[i];
          const date = statementCellDate(r[0], date1904);
          if (!date) continue;
          const debit = Math.abs(statementCellAmount(r[4]) || 0);
          const credit = Math.abs(statementCellAmount(r[5]) || 0);
          if (!debit && !credit) continue; // opening / closing balance rows
          rows.push({
            date,
            valueDate: statementCellDate(r[1], date1904),
            instrumentNo: String(r[2] ?? '').trim() || null,
            particulars: String(r[3] ?? '').trim() || null,
            debit,
            credit,
            balance: statementCellAmount(r[6]),
          });
        }
        resolve(rows);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function BankStatementUpload() {
  const { entityType } = useParams();
  const navigate = useNavigate();

  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankAccountId, setBankAccountId] = useState('');
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/bank-accounts?entityType=${entityType}`)
      .then((r) => r.json())
      .then((j) => setBankAccounts(j.data || []))
      .catch((err) => toast.error(err?.message || 'Failed to load bank accounts'));
  }, [entityType]);

  const fetchLines = useCallback(async (accId) => {
    if (!accId) { setLines([]); setBatches([]); return; }
    setLoading(true);
    try {
      const [r, b] = await Promise.all([
        fetch(`${API}/bank-statement?entityType=${entityType}&bankAccountId=${accId}`).then((x) => x.json()),
        fetch(`${API}/bank-statement/batches?bankAccountId=${accId}`).then((x) => x.json()).catch(() => ({})),
      ]);
      setLines(r.data || []);
      setBatches(b.data || []);
    } catch {
      toast.error('Statement load nahi hui');
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => { fetchLines(bankAccountId); }, [bankAccountId, fetchLines]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!bankAccountId) {
      toast.error('Pehle Bank Account select karo');
      e.target.value = ''; return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      toast.error('Sirf Excel file upload karo (.xlsx / .xls)');
      e.target.value = ''; return;
    }
    setUploading(true);
    try {
      const rows = await parseBankStatementExcel(file);
      if (!rows.length) { toast.error('File mein valid data nahi mila'); return; }
      const res = await fetch(`${API}/bank-statement/bulk-import?entityType=${entityType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId, rows }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'Failed');
      const d = json.data;
      setLastResult({ ...d, file: file.name, rows: rows.length });
      // Matched on upload: Instrument No = cheque # / deposit slip # first, then amount + cheque date.
      if (d.imported) {
        toast.success(`${d.imported} line(s) imported${d.skipped ? ` · ${d.skipped} already there, skipped` : ''}`
          + `${d.autoMatched ? ` · ${d.autoMatched} matched${d.matchedByInstrument ? ` (${d.matchedByInstrument} by Instrument No)` : ''}` : ''}`, { duration: 6000 });
      }
      else toast(`All ${d.skipped} line(s) were already uploaded — nothing added`, { icon: 'ℹ️' });
      await fetchLines(bankAccountId);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const deleteBatch = async (b) => {
    const ok = await confirmDialog({
      title: 'Delete this upload?',
      message: `${b.count} statement line(s) from ${fmtIso(b.from)} to ${fmtIso(b.to)} will be removed${b.matched ? `, and ${b.matched} match(es) with the books undone` : ''}. Vouchers and deposits are not touched.`,
      confirmLabel: 'Delete upload', danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`${API}/bank-statement/batches?bankAccountId=${bankAccountId}&batch=${encodeURIComponent(b.batch)}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Not deleted');
      toast.success(`${j.data.deleted} line(s) deleted`);
      setLastResult(null);
      fetchLines(bankAccountId);
    } catch (err) { toast.error(err.message); }
  };

  return (
    <div style={{ padding: '2rem' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#64748b', marginBottom: '1.25rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}>
          <ArrowLeft size={13} /> Transactions
        </button>
        <span>›</span>
        <span style={{ color: '#1e293b', fontWeight: 600 }}>Upload Bank Statement</span>
      </div>

      {/* Title */}
      <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.5rem' }}>
        Upload Bank Statement
      </div>

      {/* Controls box */}
      <div style={{ border: '2px solid #94a3b8', borderRadius: 6, overflow: 'hidden', maxWidth: 640, background: '#fff', marginBottom: '1.5rem' }}>
        <div style={{ background: '#e2e8f0', borderBottom: '1px solid #94a3b8', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Landmark size={14} color="#475569" />
          <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>Transactions › Upload Bank Statement</span>
        </div>
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', minWidth: 110 }}>Bank Account</span>
            <div style={{ flex: 1 }}>
              <SearchableSelect
                options={bankAccounts} value={bankAccountId} onChange={setBankAccountId}
                placeholder="— Select Bank Account —"
                getLabel={(b) => `${b.bankName} — ${b.accountNumber}`} getKey={(b) => b.id}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleUpload} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !bankAccountId}
              title={!bankAccountId ? 'Pehle Bank Account select karo' : ''}
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: '#334155', color: '#fff', border: 'none', borderRadius: 5, padding: '0.45rem 1.1rem', fontWeight: 700, fontSize: '0.8rem', cursor: (uploading || !bankAccountId) ? 'not-allowed' : 'pointer', opacity: (uploading || !bankAccountId) ? 0.6 : 1, letterSpacing: '0.03em' }}
            >
              <Upload size={13} /> {uploading ? 'Importing…' : 'Import Excel'}
            </button>
          </div>
        </div>
      </div>

      {lastResult && (
        <div style={{ maxWidth: 640, marginBottom: '1rem', padding: '0.7rem 1rem', border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: 6, fontSize: '0.8rem', color: '#1e3a5f' }}>
          <b>{lastResult.file}</b> — {lastResult.rows} line(s) read · <b>{lastResult.imported}</b> added · {lastResult.skipped} already there (skipped)
          {lastResult.closingBalance !== null && lastResult.closingBalance !== undefined && <> · closing balance <b>{fmt2(lastResult.closingBalance)}</b> on {fmtIso(lastResult.closingDate)}</>}
        </div>
      )}

      {bankAccountId && batches.length > 0 && (
        <div style={{ maxWidth: 900, marginBottom: '1.25rem', border: '1px solid #d8e2ea', borderRadius: 6, background: '#fff', overflowX: 'auto' }}>
          <div style={{ padding: '0.5rem 0.9rem', fontWeight: 700, fontSize: '0.8rem', color: '#334155', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>Uploads</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ color: '#475569', textAlign: 'left' }}>
                {['Uploaded', 'Period', 'Lines', 'Matched', 'Debit', 'Credit', 'Closing Balance', ''].map((h, i) => (
                  <th key={h || i} style={{ padding: '0.45rem 0.9rem', textAlign: i >= 2 && i <= 6 ? 'right' : 'left', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.batch} style={{ borderTop: '1px solid #eef2f6' }}>
                  <td style={{ padding: '0.45rem 0.9rem' }}>{b.uploadedAt ? new Date(b.uploadedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td style={{ padding: '0.45rem 0.9rem', whiteSpace: 'nowrap' }}>{fmtIso(b.from)} – {fmtIso(b.to)}</td>
                  <td style={{ padding: '0.45rem 0.9rem', textAlign: 'right' }}>{b.count}</td>
                  <td style={{ padding: '0.45rem 0.9rem', textAlign: 'right' }}>{b.matched}</td>
                  <td style={{ padding: '0.45rem 0.9rem', textAlign: 'right' }}>{fmt2(b.debit)}</td>
                  <td style={{ padding: '0.45rem 0.9rem', textAlign: 'right' }}>{fmt2(b.credit)}</td>
                  <td style={{ padding: '0.45rem 0.9rem', textAlign: 'right' }}>{fmt2(b.closing)}</td>
                  <td style={{ padding: '0.45rem 0.9rem', textAlign: 'right' }}>
                    {b.batch !== '(no batch)' && (
                      <button type="button" onClick={() => deleteBatch(b)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 5, padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                        <Trash2 size={12} /> Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Statement preview — same look as the bank's own exported statement */}
      {bankAccountId && (
        <div style={{ overflowX: 'auto', border: '1px solid #d8e2ea', borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#bfe3f5' }}>
                {['Date', 'Value Date', 'Instrument No.', 'Particulars', 'Debit', 'Credit', 'Balance'].map((h, i) => (
                  <th key={h} style={{ padding: '0.65rem 0.9rem', textAlign: i >= 4 ? 'right' : 'left', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #d8e2ea' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Loading…</td></tr>
              )}
              {!loading && !lines.length && (
                <tr><td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: '#64748b' }}>Is Bank Account ke liye koi statement upload nahi hui</td></tr>
              )}
              {lines.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #eef2f6' }}>
                  <td style={{ padding: '0.6rem 0.9rem' }}>{fmtDate(l.date)}</td>
                  <td style={{ padding: '0.6rem 0.9rem' }}>{l.valueDate ? fmtDate(l.valueDate) : ''}</td>
                  <td style={{ padding: '0.6rem 0.9rem' }}>{l.instrumentNo || ''}</td>
                  <td style={{ padding: '0.6rem 0.9rem' }}>{l.particulars || ''}</td>
                  <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{Number(l.debit) ? fmt2(l.debit) : ''}</td>
                  <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{Number(l.credit) ? fmt2(l.credit) : ''}</td>
                  <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{fmt2(l.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
