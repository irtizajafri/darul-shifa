import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { API, fmtDay, getJson, money, pktToday, printA4 } from './bankReconUtils';
import './bankRecon.scss';

// Accounts → Reports → Bank Balance Statement (owner, 2026-11-18): every bank
// account of this book on one date — its Bank Book balance, the last
// uploaded statement balance on or before that date, and the gap between
// them (explained line by line on the Bank Reconciliation Statement).

export default function BankBalanceStatement() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const book = entityType === 'corporate' ? 'Panel (Corporate)' : 'Cash GL';
  const [asOf, setAsOf] = useState(pktToday());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getJson(`${API}/bank-balances?entityType=${entityType}&asOf=${asOf}`));
    } catch (e) {
      toast.error(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [entityType, asOf]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [entityType]);

  // An inactive bank with nothing in it is left out.
  const rows = (data?.rows || []).filter((r) => r.isActive || Math.abs(r.bookBalance) > 0.005 || r.statementBalance);
  const totalStatement = rows.reduce((s, r) => s + (r.statementBalance || 0), 0);
  const title = 'Bank Balance Statement';

  const handlePrint = () => {
    if (!data) return;
    printA4(`${title} — ${fmtDay(data.asOf)}`, document.getElementById('bbs-print')?.innerHTML || '');
  };
  const handleExcel = () => {
    if (!data) return;
    const aoa = [
      [title], [`${book} · as on ${fmtDay(data.asOf)}`], [],
      ['Bank', 'Account No.', 'Bank Book Balance', 'Statement Balance', 'Statement Date', 'Difference'],
      ...rows.map((r) => [r.bankName, r.accountNumber, r.bookBalance, r.statementBalance ?? '', r.statementDate ? fmtDay(r.statementDate) : '', r.difference ?? '']),
      ['Total', '', data.totalBook, totalStatement, '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bank Balances');
    XLSX.writeFile(wb, `bank_balances_${data.asOf}_${entityType}.xlsx`);
  };

  return (
    <div className="brc">
      <div className="brc__bar">
        <button type="button" className="brc__back" onClick={() => navigate(`/accounts/${entityType}/reports`)}><ArrowLeft size={14} /> Reports</button>
        <div className="brc__heading">
          <h1>Bank Balance Statement</h1>
          <span>{book}</span>
        </div>
        <div className="brc__controls">
          <label><span>As on</span><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></label>
          <button type="button" className="brc__btn brc__btn--primary" onClick={load} disabled={loading}><RefreshCw size={14} /> Show</button>
          <button type="button" className="brc__btn" onClick={handlePrint} disabled={!data}><Printer size={14} /> Print</button>
          <button type="button" className="brc__btn" onClick={handleExcel} disabled={!data}><FileSpreadsheet size={14} /> Excel</button>
        </div>
      </div>

      {loading && <p className="brc__empty">Loading…</p>}
      {!loading && data && (
        <div className="brc__card" id="bbs-print" style={{ maxWidth: 1000 }}>
          <h1 style={{ margin: 0, fontSize: '1rem' }}>{title}</h1>
          <p className="brc-print-sub" style={{ margin: '2px 0 10px', fontSize: '0.78rem', color: '#64748b' }}>{book} · as on {fmtDay(data.asOf)}</p>
          <div className="table-wrap">
            <table className="brc__table">
              <thead>
                <tr><th>Bank</th><th>Account No.</th><th className="n">Bank Book Balance</th><th className="n">Statement Balance</th><th>Statement Date</th><th className="n">Difference</th></tr>
              </thead>
              <tbody>
                {!rows.length && <tr><td colSpan={6} className="muted">No bank accounts in this book.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.bankAccountId}>
                    <td><b>{r.bankName}</b>{!r.isActive && <span className="muted"> (inactive)</span>}</td>
                    <td>{r.accountNumber}</td>
                    <td className="n">{money(r.bookBalance)}</td>
                    <td className="n">{r.statementBalance === null ? <span className="muted">no statement</span> : money(r.statementBalance)}</td>
                    <td className="d">{r.statementDate ? fmtDay(r.statementDate) : ''}</td>
                    <td className="n" style={{ color: r.difference && Math.abs(r.difference) > 0.005 ? 'var(--brc-warn)' : undefined }}>{r.difference === null ? '' : money(r.difference)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={2}>Total</td><td className="n">{money(data.totalBook)}</td><td className="n">{money(totalStatement)}</td><td /><td /></tr>
              </tfoot>
            </table>
          </div>
          <p className="muted" style={{ fontSize: '0.74rem', color: '#64748b', margin: '8px 0 0' }}>A difference is explained item by item on the Bank Reconciliation Statement (deposits in transit, unpresented cheques, bank-only entries).</p>
        </div>
      )}
    </div>
  );
}
