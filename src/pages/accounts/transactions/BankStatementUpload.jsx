import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Upload, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import SearchableSelect from '../../../components/ui/SearchableSelect';

const API = 'http://localhost:5001/api/accounts';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmt2 = (n) =>
  n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Upload Bank Statement — the bank's own statement, exactly as exported from
// online banking: Date | Value Date | Instrument No. | Particulars | Debit |
// Credit | Balance. First row is the header (skipped); every other row with
// a parseable Date becomes one line.
function parseBankStatementExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!raw.length) { resolve([]); return; }

        const rows = [];
        for (let i = 1; i < raw.length; i++) {
          const r = raw[i];
          const rawDate = r[0];
          if (!rawDate) continue;
          const parsedDate = rawDate instanceof Date ? rawDate : new Date(rawDate);
          if (isNaN(parsedDate.getTime())) continue;

          const rawValueDate = r[1];
          const parsedValueDate = rawValueDate instanceof Date ? rawValueDate
            : rawValueDate ? new Date(rawValueDate) : null;

          rows.push({
            date: parsedDate.toISOString().slice(0, 10),
            valueDate: parsedValueDate && !isNaN(parsedValueDate.getTime()) ? parsedValueDate.toISOString().slice(0, 10) : null,
            instrumentNo: String(r[2] || '').trim() || null,
            particulars: String(r[3] || '').trim() || null,
            debit: Number(r[4]) || 0,
            credit: Number(r[5]) || 0,
            balance: r[6] !== '' && r[6] !== undefined ? Number(r[6]) : null,
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
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/bank-accounts?entityType=${entityType}`)
      .then((r) => r.json())
      .then((j) => setBankAccounts(j.data || []))
      .catch(() => {});
  }, [entityType]);

  const fetchLines = useCallback(async (accId) => {
    if (!accId) { setLines([]); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/bank-statement?entityType=${entityType}&bankAccountId=${accId}`);
      const j = await r.json();
      setLines(j.data || []);
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
      toast.success(`${json.data.imported} line(s) imported`);
      await fetchLines(bankAccountId);
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
