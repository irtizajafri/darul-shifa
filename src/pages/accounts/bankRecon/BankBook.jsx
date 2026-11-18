import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { API, bankLabel, fmtDay, getJson, itemTypeLabel, money, moneyOrBlank, monthStart, pktToday, printA4, useBanks } from './bankReconUtils';
import './bankRecon.scss';

// Accounts → Transactions → Bank Book (owner, 2026-11-18): one bank account's
// own ledger — opening balance, then every Bank Deposit, bank-mode Voucher
// Income, panel cheque / CC settlement put into this bank (money in) and
// every cheque / online Voucher Expense on it (money out), with the running
// balance. "Cleared" shows the day the bank statement shows it.

export default function BankBook() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const book = entityType === 'corporate' ? 'Panel (Corporate)' : 'Cash GL';
  const banks = useBanks(entityType);
  const today = pktToday();
  const [bankId, setBankId] = useState('');
  const [from, setFrom] = useState(monthStart(today));
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!bankId && banks.length === 1) setBankId(banks[0].id); }, [banks, bankId]);

  const load = useCallback(async () => {
    if (!bankId) { toast.error('Select the bank account'); return; }
    setLoading(true);
    try {
      setData(await getJson(`${API}/bank-book?bankAccountId=${bankId}&from=${from}&to=${to}`));
    } catch (e) {
      toast.error(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [bankId, from, to]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (bankId) load(); }, [bankId]);

  const title = data ? `Bank Book — ${bankLabel(data.bank)}` : 'Bank Book';

  const handlePrint = () => {
    if (!data) return;
    printA4(title, document.getElementById('brc-book-print')?.innerHTML || '');
  };

  const handleExcel = () => {
    if (!data) return;
    const aoa = [
      [title], [`${book} · ${fmtDay(data.from)} to ${fmtDay(data.to)}`], [],
      ['Date', 'Type', 'Ref / Cheque #', 'Voucher #', 'Description', 'Money In', 'Money Out', 'Balance', 'Cleared'],
      [fmtDay(data.from), 'Opening balance', '', '', '', '', '', data.opening, ''],
      ...data.rows.map((r) => [fmtDay(r.date), itemTypeLabel(r), r.ref !== r.voucherNo ? r.ref || '' : '', r.voucherNo || '', r.description || '', r.moneyIn || '', r.moneyOut || '', r.balance, r.clearedDate ? fmtDay(r.clearedDate) : '']),
      ['', 'Total', '', '', '', data.totalIn, data.totalOut, data.closing, ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bank Book');
    XLSX.writeFile(wb, `bank_book_${data.bank.bankName.replace(/\W+/g, '_')}_${data.from}_${data.to}.xlsx`);
  };

  return (
    <div className="brc">
      <div className="brc__bar">
        <button type="button" className="brc__back" onClick={() => navigate(`/accounts/${entityType}/transactions`)}><ArrowLeft size={14} /> Transactions</button>
        <div className="brc__heading">
          <h1>Bank Book</h1>
          <span>{book} · running balance of one bank account</span>
        </div>
        <div className="brc__controls">
          <label className="brc__bank">
            <span>Bank Account</span>
            <SearchableSelect options={banks} value={bankId} onChange={setBankId} placeholder="— Select bank —" getLabel={bankLabel} getKey={(b) => b.id} size="sm" />
          </label>
          <label><span>From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span>To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button type="button" className="brc__btn brc__btn--primary" onClick={load} disabled={loading || !bankId}><RefreshCw size={14} /> Show</button>
          <button type="button" className="brc__btn" onClick={handlePrint} disabled={!data}><Printer size={14} /> Print</button>
          <button type="button" className="brc__btn" onClick={handleExcel} disabled={!data}><FileSpreadsheet size={14} /> Excel</button>
        </div>
      </div>

      {!bankId && <p className="brc__empty">Select a bank account to see its book.</p>}
      {loading && <p className="brc__empty">Loading…</p>}
      {!loading && data && (
        <>
          <div className="brc__kpis">
            <div><span>Opening {fmtDay(data.from)}</span><b>{money(data.opening)}</b></div>
            <div><span>Money in</span><b style={{ color: 'var(--brc-in)' }}>{money(data.totalIn)}</b></div>
            <div><span>Money out</span><b style={{ color: 'var(--brc-out)' }}>{money(data.totalOut)}</b></div>
            <div><span>Closing {fmtDay(data.to)}</span><b>{money(data.closing)}</b></div>
          </div>
          {!data.bank.openingDate && (
            <div className="brc__note">No opening balance set for this bank — set it in Parameters → Bank Accounts so the book starts from the right figure.</div>
          )}
          <div className="brc__card" id="brc-book-print">
            <h1 style={{ margin: 0, fontSize: '1rem' }}>{title}</h1>
            <p className="brc-print-sub" style={{ margin: '2px 0 10px', fontSize: '0.78rem', color: '#64748b' }}>
              {book} · {fmtDay(data.from)} to {fmtDay(data.to)}
              {data.bank.openingDate ? ` · opening balance Rs. ${money(data.bank.openingBalance)} on ${fmtDay(data.bank.openingDate)}` : ''}
            </p>
            <div className="brc__scroll">
              <table className="brc__table">
                <thead>
                  <tr>
                    <th>Date</th><th>Type</th><th>Ref / Cheque #</th><th>Voucher #</th><th>Description</th>
                    <th className="n">Money In</th><th className="n">Money Out</th><th className="n">Balance</th><th>Cleared</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="brc-opening">
                    <td className="d">{fmtDay(data.from)}</td><td colSpan={6}>Opening balance</td><td className="n">{money(data.opening)}</td><td />
                  </tr>
                  {data.rows.map((r) => (
                    <tr key={r.key}>
                      <td className="d">{fmtDay(r.date)}</td>
                      <td className="d">{itemTypeLabel(r)}</td>
                      <td>{r.ref !== r.voucherNo ? r.ref : ''}</td>
                      <td className="muted">{r.voucherNo || ''}</td>
                      <td>{r.description}</td>
                      <td className="n in">{moneyOrBlank(r.moneyIn)}</td>
                      <td className="n out">{moneyOrBlank(r.moneyOut)}</td>
                      <td className="n">{money(r.balance)}</td>
                      <td className="d">{r.clearedDate ? fmtDay(r.clearedDate) : <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                  {!data.rows.length && <tr><td colSpan={9} className="muted">No bank entries in this period.</td></tr>}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5}>Total · closing balance</td>
                    <td className="n">{money(data.totalIn)}</td>
                    <td className="n">{money(data.totalOut)}</td>
                    <td className="n">{money(data.closing)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
