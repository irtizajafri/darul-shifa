import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Printer, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { openPrintWindow } from '../../../utils/printRelay';
import { API, fmtDay, getJson, money, moneyOrBlank, pktToday, useAllBanks } from './bankReconUtils';
import './bankRecon.scss';

// Accounts → Reports → Bank Balance Statement (owner, 2026-11-21), laid out
// like the hospital's "BANK balance STATEMENT" Excel: one bank (picked in the
// filter), one month — the opening balance, then every entry on the day the
// bank booked it with Dr / Cr / running balance, each amount in its colour
// category, and the category totals on top. Cheques not cleared by the
// month's end are listed under Un-presented. Read-only.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// [background, text] — the Excel sheet's colours.
const CAT_COLOR = {
  unkDep: ['#f9d77e', '#1f2937'],
  unkChq: ['#f9d77e', '#1f2937'],
  online: ['#fef36b', '#1f2937'],
  depPrev: ['#c9ccd1', '#111827'],
  chqPrev: ['#c9ccd1', '#111827'],
  depOld: ['#a5d36b', '#14290a'],
  chqOld: ['#a5d36b', '#14290a'],
  depCur: ['#a9c5e8', '#0f2742'],
  chqCur: ['#a9c5e8', '#0f2742'],
  corpDep: ['#efb388', '#3b1a06'],
  corpChq: ['#efb388', '#3b1a06'],
  cc: ['#5d7d2a', '#fff200'],
  bank: ['#dc2626', '#ffffff'],
};
const cellStyle = (cat) => {
  const c = CAT_COLOR[cat];
  return c ? { background: c[0], color: c[1], fontWeight: cat === 'cc' ? 700 : undefined } : undefined;
};

export default function BankBalanceStatement() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const banks = useAllBanks();
  const today = pktToday();
  const [bankId, setBankId] = useState('');
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Start on this book's first bank.
  useEffect(() => {
    if (bankId || !banks.length) return;
    const mine = banks.find((b) => b.entityType === entityType) || banks[0];
    setBankId(String(mine.id));
  }, [banks, bankId, entityType]);

  const load = useCallback(async (id, y, m) => {
    if (!id) return;
    setLoading(true);
    try {
      setData(await getJson(`${API}/bank-month-statement?bankAccountId=${id}&year=${y}&month=${m}`));
    } catch (e) {
      toast.error(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);
  // First load once the bank is known; Show reloads after that.
  useEffect(() => {
    if (bankId) load(bankId, year, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankId]);

  const catLabel = useMemo(() => Object.fromEntries((data?.categories || []).map((c) => [c.key, c.label])), [data]);
  const bankName = data ? `${data.bank.bankName} — ${data.bank.accountNumber}` : '';
  const title = data ? `Bank Balance Statement - ${data.bank.bankName} - ${MONTHS[data.month - 1]} ${data.year}` : 'Bank Balance Statement';

  const handlePrint = () => {
    if (!data) return;
    const win = openPrintWindow();
    const content = document.getElementById('bbs-print')?.innerHTML || '';
    // body#rpt-bw keeps the colours (the shared report print turns pages black & white).
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      @page { size: A4 portrait; margin: 8mm; }
      * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { margin: 0; font-size: 8pt; color: #000; }
      h1 { font-size: 11pt; margin: 0 0 1mm; }
      .bbs-sub { font-size: 8pt; margin: 0 0 2mm; }
      .bbs-cats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2px; margin: 0 0 3mm; }
      .bbs-cat { border: 1px solid #888; padding: 2px 4px; font-size: 7pt; }
      .bbs-cat b { display: block; font-size: 8pt; text-align: right; }
      h2 { font-size: 9.5pt; margin: 4mm 0 1mm; }
      table { width: 100%; border-collapse: collapse; }
      th, td { font-size: 7.5pt !important; padding: 1px 3px; border: 1px solid #888; vertical-align: top; }
      th { text-align: left; background: #e5e7eb; }
      .n { text-align: right; white-space: nowrap; }
      .d { white-space: nowrap; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      .bbs-note, button { display: none !important; }
    </style></head><body id="rpt-bw">${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const handleExcel = () => {
    if (!data) return;
    const aoa = [[title], [bankName], []];
    aoa.push(['Category', 'Total']);
    data.categories.forEach((c) => aoa.push([c.label, c.total]));
    aoa.push([]);
    aoa.push(['Booking Date', 'Description', 'Chq / Ref', 'Dr Amount', 'Cr Amount', 'Balance', 'Category']);
    aoa.push(['', 'Opening Balance', '', '', '', data.opening, '']);
    data.rows.forEach((r) => aoa.push([fmtDay(r.date), r.description, r.ref, r.dr || '', r.cr || '', r.balance, catLabel[r.category] || '']));
    aoa.push(['', 'Total', '', data.totalDr, data.totalCr, data.closing, '']);
    if (data.unpresented.length) {
      aoa.push([], ['Un-presented cheques (not cleared by the month end)']);
      aoa.push(['Cheque Date', 'Description', 'Cheque #', 'Voucher #', 'Amount', '', 'Category']);
      data.unpresented.forEach((u) => aoa.push([fmtDay(u.chequeDate), u.description, u.chequeNo, u.voucherNo, u.amount, '', catLabel[u.category] || '']));
      aoa.push(['', 'Total', '', '', data.unpresentedTotal]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 13 }, { wch: 38 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bank Statement');
    XLSX.writeFile(wb, `bank_statement_${data.bank.bankName.replace(/\W+/g, '_')}_${data.year}_${String(data.month).padStart(2, '0')}.xlsx`);
  };

  const years = [];
  for (let y = Number(today.slice(0, 4)) + 1; y >= 2020; y -= 1) years.push(y);

  return (
    <div className="brc">
      <div className="brc__bar">
        <button type="button" className="brc__back" onClick={() => navigate(`/accounts/${entityType}/reports`)}><ArrowLeft size={14} /> Reports</button>
        <div className="brc__heading">
          <h1>Bank Balance Statement</h1>
          <span>{bankName || 'Pick the bank'}</span>
        </div>
        <div className="brc__controls">
          <label>
            <span>Bank</span>
            <select className="brc__bank" value={bankId} onChange={(e) => setBankId(e.target.value)}>
              {!banks.length && <option value="">No bank accounts</option>}
              {banks.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </label>
          <label>
            <span>Month</span>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <label>
            <span>Year</span>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button type="button" className="brc__btn brc__btn--primary" onClick={() => load(bankId, year, month)} disabled={loading || !bankId}><RefreshCw size={14} /> Show</button>
          <button type="button" className="brc__btn" onClick={handlePrint} disabled={!data}><Printer size={14} /> Print</button>
          <button type="button" className="brc__btn" onClick={handleExcel} disabled={!data}><FileSpreadsheet size={14} /> Excel</button>
        </div>
      </div>

      {loading && <p className="brc__empty">Loading…</p>}
      {!loading && data && (
        <div className="brc__card" id="bbs-print">
          <h1 style={{ margin: 0, fontSize: '1rem' }}>{title}</h1>
          <p className="bbs-sub" style={{ margin: '2px 0 10px', fontSize: '0.78rem', color: '#64748b' }}>
            {bankName} · {data.bank.entityType === 'corporate' ? 'Panel (Corporate)' : 'Cash GL'} · {fmtDay(data.from)} to {fmtDay(data.to)}
          </p>

          <div className="bbs-cats">
            {data.categories.map((c) => (
              <div key={c.key} className="bbs-cat" style={cellStyle(c.key)} title={c.side === 'in' ? 'Money in (Cr)' : 'Money out (Dr)'}>
                <span>{c.label}</span>
                <b>{c.total ? money(c.total) : '—'}</b>
              </div>
            ))}
          </div>

          <div className="table-wrap">
            <table className="brc__table">
              <thead>
                <tr><th>Booking Date</th><th>Description</th><th>Chq / Ref</th><th className="n">Dr Amount</th><th className="n">Cr Amount</th><th className="n">Balance</th></tr>
              </thead>
              <tbody>
                <tr className="bbs-opening">
                  <td className="d">{fmtDay(data.from)}</td>
                  <td colSpan={4}><b>Opening Balance</b></td>
                  <td className="n"><b>{money(data.opening)}</b></td>
                </tr>
                {!data.rows.length && <tr><td colSpan={6} className="muted">No entries on this bank in {MONTHS[data.month - 1]} {data.year}.</td></tr>}
                {data.rows.map((r) => (
                  <tr key={r.key}>
                    <td className="d">{fmtDay(r.date)}</td>
                    <td>{r.description}{r.type === 'statement' ? <span className="muted"> (bank statement)</span> : null}</td>
                    <td className="d">{r.ref}</td>
                    <td className="n" style={r.dr ? cellStyle(r.category) : undefined} title={r.dr ? catLabel[r.category] : undefined}>{moneyOrBlank(r.dr)}</td>
                    <td className="n" style={r.cr ? cellStyle(r.category) : undefined} title={r.cr ? catLabel[r.category] : undefined}>{moneyOrBlank(r.cr)}</td>
                    <td className="n"><b>{money(r.balance)}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>Total · Closing Balance</td><td className="n">{money(data.totalDr)}</td><td className="n">{money(data.totalCr)}</td><td className="n">{money(data.closing)}</td></tr>
              </tfoot>
            </table>
          </div>

          {data.unpresented.length > 0 && (
            <>
              <h2 className="bbs-h2">Un-presented cheques <span className="muted">— not cleared by {fmtDay(data.to)}, so not in the balance above</span></h2>
              <div className="table-wrap">
                <table className="brc__table">
                  <thead><tr><th>Cheque Date</th><th>Description</th><th>Cheque #</th><th>Voucher #</th><th className="n">Amount</th></tr></thead>
                  <tbody>
                    {data.unpresented.map((u) => (
                      <tr key={u.key}>
                        <td className="d">{fmtDay(u.chequeDate)}</td>
                        <td>{u.description}</td>
                        <td className="d">{u.chequeNo}</td>
                        <td className="d">{u.voucherNo}</td>
                        <td className="n" style={cellStyle(u.category)} title={catLabel[u.category]}>{money(u.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td colSpan={4}>Total un-presented</td><td className="n">{money(data.unpresentedTotal)}</td></tr></tfoot>
                </table>
              </div>
            </>
          )}

          <p className="bbs-note">
            A cheque shows on the day the bank cleared it (statement match or ticked presented). Colours by the entry&apos;s own month: this month, last month, older (Old).
            Deposits by their &quot;Deposit Of&quot; day. Unknown = uploaded bank-statement lines not matched to any entry in the books.
          </p>
        </div>
      )}
    </div>
  );
}
