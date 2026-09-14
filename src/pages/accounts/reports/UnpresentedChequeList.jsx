import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const API = 'http://localhost:5001/api/accounts';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const fmt2 = (n) =>
  Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const th = { padding: '0.6rem 0.9rem', textAlign: 'left', fontWeight: 700, color: '#1e293b', borderBottom: '1px solid #d8e2ea', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em' };
const td = { padding: '0.55rem 0.9rem', fontSize: '0.85rem', color: '#1e293b' };

export default function UnpresentedChequeList() {
  const { entityType } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState({ unpresented: [], needsReview: [] });
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(null); // `${entryId}-${lineId}` while a confirm is in flight

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/un-presented-cheques?entityType=${entityType}`);
      const j = await r.json();
      setData(j.data || { unpresented: [], needsReview: [] });
    } catch {
      toast.error('List load nahi hui');
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => { load(); }, [load]);

  const handleConfirm = async (entryId, lineId) => {
    setConfirming(`${entryId}-${lineId}`);
    try {
      const r = await fetch(`${API}/un-presented-cheques/confirm-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherExpenseEntryId: entryId, statementLineId: lineId }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Failed');
      toast.success('Presented mark ho gaya');
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirming(null);
    }
  };

  const totalUnpresented = data.unpresented.reduce((s, e) => s + e.amount, 0);

  return (
    <div style={{ padding: '2rem' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#64748b', marginBottom: '1.25rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}>
          <ArrowLeft size={13} /> Reports
        </button>
        <span>›</span>
        <span style={{ color: '#1e293b', fontWeight: 600 }}>Un-Presented Cheque List</span>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Un-Presented Cheque List
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fff', color: '#334155', border: '1px solid #94a3b8', borderRadius: 5, padding: '0.4rem 0.9rem', fontWeight: 600, fontSize: '0.78rem', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Needs Review — ambiguous matches (same amount + same cheque date, more than one candidate) */}
      {data.needsReview.length > 0 && (
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b45309', fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.6rem' }}>
            <AlertCircle size={16} /> Needs Confirmation ({data.needsReview.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {data.needsReview.map((g) => (
              <div key={g.key} style={{ border: '1px solid #fbbf24', background: '#fffbeb', borderRadius: 6, padding: '0.9rem 1.1rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#92400e', marginBottom: '0.6rem' }}>
                  Amount <b>{fmt2(g.candidateEntries[0]?.amount)}</b> par <b>{g.candidateEntries.length}</b> cheque(s) hain,
                  bank statement mein <b>{g.candidateLines.length}</b> matching debit line — kaunsa cheque presented hua, confirm karo:
                </div>
                {g.candidateLines.map((line) => (
                  <div key={line.id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 5, padding: '0.5rem 0.75rem', marginBottom: '0.5rem', fontSize: '0.8rem', color: '#334155' }}>
                    Bank: {fmtDate(line.date)} · Instrument #{line.instrumentNo || '—'} · Debit {fmt2(line.debit)} · {line.particulars || ''}
                  </div>
                ))}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.4rem' }}>
                  {g.candidateEntries.map((e) => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 5, padding: '0.4rem 0.7rem' }}>
                      <span style={{ fontSize: '0.8rem' }}>{e.voucherNo} · Cheque #{e.chequeNo} · {e.payeeName || '—'}</span>
                      {g.candidateLines.map((line) => (
                        <button
                          key={line.id}
                          onClick={() => handleConfirm(e.id, line.id)}
                          disabled={confirming === `${e.id}-${line.id}`}
                          style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: 4, padding: '0.3rem 0.6rem', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          {confirming === `${e.id}-${line.id}` ? '…' : `Confirm — this cheque`}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Un-Presented list */}
      <div style={{ overflowX: 'auto', border: '1px solid #d8e2ea', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={th}>Voucher #</th>
              <th style={th}>Voucher Date</th>
              <th style={th}>Cheque #</th>
              <th style={th}>Cheque Date</th>
              <th style={th}>Payee</th>
              <th style={{ ...th, textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#64748b' }}>Loading…</td></tr>
            )}
            {!loading && !data.unpresented.length && (
              <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#64748b' }}>Koi cheque un-presented nahi hai</td></tr>
            )}
            {data.unpresented.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid #eef2f6' }}>
                <td style={td}>{e.voucherNo}</td>
                <td style={td}>{fmtDate(e.voucherDate)}</td>
                <td style={td}>{e.chequeNo}</td>
                <td style={td}>{e.chequeDate ? fmtDate(e.chequeDate) : '—'}</td>
                <td style={td}>{e.payeeName || '—'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{fmt2(e.amount)}</td>
              </tr>
            ))}
          </tbody>
          {data.unpresented.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: '2px solid #1e293b' }}>
                <td colSpan={5} style={{ ...td, fontWeight: 700 }}>Total</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt2(totalUnpresented)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
