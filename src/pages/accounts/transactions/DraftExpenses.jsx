import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Trash2, RefreshCw, Clock, FileText, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import './DraftExpenses.scss';

const API = 'http://localhost:5001/api/accounts';

const fmtAmt = (n) =>
  Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

export default function DraftExpenses() {
  const { entityType } = useParams();
  const navigate       = useNavigate();

  const [drafts,   setDrafts]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [deleting, setDeleting] = useState({});
  const [posting,  setPosting]  = useState(false);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/expense-drafts?entityType=${entityType}`);
      const j = await r.json();
      setDrafts(Array.isArray(j?.data) ? j.data : []);
    } catch {
      toast.error('Drafts load nahi hue');
    } finally {
      setLoading(false);
    }
  }, [entityType]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const handleFlashNow = async () => {
    if (!drafts.length) { toast.error('Koi pending draft nahi hai'); return; }
    if (!window.confirm(`Abhi ${drafts.length} draft(s) post karna chahte hain? Yeh action immediate hai.`)) return;
    setPosting(true);
    try {
      const r = await fetch(`${API}/expense-drafts/flash-now?entityType=${entityType}`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || 'Flash failed');
      const v = j?.data?.vouchersCreated ?? 0;
      if (v > 0) {
        const list = j.data.vouchers.map((x) => `• ${x.voucherNo} — ${x.mainGlName} (${x.entriesCount} entries, PKR ${Number(x.totalAmount).toLocaleString()})`).join('\n');
        toast.success(`${v} voucher${v > 1 ? 's' : ''} create ho gaye!\n\n${list}`, { duration: 6000 });
      } else {
        toast('Koi pending draft nahi tha', { icon: 'ℹ️' });
      }
      fetchDrafts();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id) => {
    setDeleting((p) => ({ ...p, [id]: true }));
    try {
      const r = await fetch(`${API}/expense-drafts/${id}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || 'Delete failed');
      toast.success('Draft deleted');
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting((p) => ({ ...p, [id]: false }));
    }
  };

  // Group drafts by Main GL
  const groups = drafts.reduce((acc, d) => {
    const key = d.mainGlName || `GL-${d.mainGlId}`;
    if (!acc[key]) acc[key] = { mainGlName: key, items: [], total: 0 };
    acc[key].items.push(d);
    acc[key].total += Number(d.amount);
    return acc;
  }, {});

  const grandTotal = drafts.reduce((s, d) => s + Number(d.amount), 0);

  // Next 8 AM countdown
  const now       = new Date();
  const next8     = new Date(now);
  next8.setHours(8, 0, 0, 0);
  if (next8 <= now) next8.setDate(next8.getDate() + 1);
  const hoursLeft = Math.floor((next8 - now) / 3600000);
  const minsLeft  = Math.floor(((next8 - now) % 3600000) / 60000);

  return (
    <div className="drafts">
      {/* ── Breadcrumb ── */}
      <div className="drafts__breadcrumb">
        <button className="drafts__back" onClick={() => navigate(`/accounts/${entityType}/transactions`)}>
          <ArrowLeft size={14} /> Back
        </button>
        <ChevronRight size={13} className="drafts__bc-sep" />
        <span>Transactions</span>
        <ChevronRight size={13} className="drafts__bc-sep" />
        <span className="drafts__bc-active">Pending Drafts</span>
      </div>

      {/* ── Header ── */}
      <div className="drafts__header">
        <div className="drafts__header-left">
          <h2 className="drafts__title">
            <FileText size={18} />
            Pending Expense Drafts
          </h2>
          <p className="drafts__sub">
            Today's drafts — auto-post hogi subah 8:00 AM pe (Main GL wise grouping)
          </p>
        </div>
        <div className="drafts__header-right">
          <div className="drafts__countdown">
            <Clock size={14} />
            <span>Post in <strong>{hoursLeft}h {minsLeft}m</strong></span>
          </div>
          {drafts.length > 0 && (
            <button
              className="drafts__flash-btn"
              onClick={handleFlashNow}
              disabled={posting}
              title="Abhi post karo (testing)"
            >
              <Zap size={14} />
              {posting ? 'Posting…' : 'Post Now'}
            </button>
          )}
          <button className="drafts__refresh" onClick={fetchDrafts} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Summary bar ── */}
      {!loading && drafts.length > 0 && (
        <div className="drafts__summary">
          <div className="drafts__summary-item">
            <span className="drafts__summary-label">Total Entries</span>
            <span className="drafts__summary-val">{drafts.length}</span>
          </div>
          <div className="drafts__summary-item">
            <span className="drafts__summary-label">Main GL Groups</span>
            <span className="drafts__summary-val">{Object.keys(groups).length}</span>
          </div>
          <div className="drafts__summary-item">
            <span className="drafts__summary-label">Vouchers will create</span>
            <span className="drafts__summary-val">{Object.keys(groups).length}</span>
          </div>
          <div className="drafts__summary-item drafts__summary-item--total">
            <span className="drafts__summary-label">Grand Total</span>
            <span className="drafts__summary-val">PKR {fmtAmt(grandTotal)}</span>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="drafts__loading">Loading drafts…</div>
      ) : drafts.length === 0 ? (
        <div className="drafts__empty">
          <FileText size={36} />
          <p>Aaj koi pending draft nahi hai</p>
          <span>Voucher Expense form mein "Save as Draft" use karein</span>
        </div>
      ) : (
        <div className="drafts__groups">
          {Object.values(groups).map((group) => (
            <div key={group.mainGlName} className="drafts__group">
              {/* Group header */}
              <div className="drafts__group-head">
                <div className="drafts__group-title">
                  <span className="drafts__group-badge">GL</span>
                  {group.mainGlName}
                </div>
                <div className="drafts__group-meta">
                  <span>{group.items.length} entr{group.items.length > 1 ? 'ies' : 'y'}</span>
                  <span className="drafts__group-total">PKR {fmtAmt(group.total)}</span>
                  <span className="drafts__group-voucher-hint">→ 1 Voucher</span>
                </div>
              </div>

              {/* Entries table */}
              <div className="drafts__table-wrap">
                <table className="drafts__table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Sub GL</th>
                      <th>Account</th>
                      <th>Sub Account</th>
                      <th>Payee</th>
                      <th>Particulars</th>
                      <th className="drafts__th-r">Amount</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((d) => (
                      <tr key={d.id}>
                        <td className="drafts__td-time">{fmtTime(d.createdAt)}</td>
                        <td>{d.subGlName || '—'}</td>
                        <td>{d.accountName || '—'}</td>
                        <td>{d.subAccountName || '—'}</td>
                        <td>{d.payeeName || '—'}</td>
                        <td className="drafts__td-particulars">{d.particulars || '—'}</td>
                        <td className="drafts__td-amt">PKR {fmtAmt(d.amount)}</td>
                        <td>
                          <button
                            className="drafts__del"
                            onClick={() => handleDelete(d.id)}
                            disabled={deleting[d.id]}
                            title="Delete draft"
                          >
                            {deleting[d.id] ? '…' : <Trash2 size={13} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} className="drafts__tfoot-label">Group Total</td>
                      <td className="drafts__tfoot-amt">PKR {fmtAmt(group.total)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
