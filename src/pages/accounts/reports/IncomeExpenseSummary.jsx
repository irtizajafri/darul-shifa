import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Printer, RefreshCw, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../../config';
import { openPrintWindow } from '../../../utils/printRelay';
import './IncomeExpenseSummary.scss';

// Accounts → Reports → Income & Expense Summary (owner, 2026-11-21), laid out
// like the hospital's "INCOME & EXPENDITURE SUMMARY" sheet: Receipts and
// Payments side by side, then Closing and Reconciliation. One book, one
// month. Income heads = Income Summary Matrix; expense heads = Main GL. The
// figures the system can't know (opening the first time, petty cash, extra
// deposit, cheq W/O, out-dated cheques, A/c receivable) are typed here and
// saved with the month.

const API = `${API_BASE_URL}/api/accounts`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pktToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const money = (n) => (n === null || n === undefined ? '' : Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const moneyOrBlank = (n) => (Number(n) ? money(n) : '');
const TYPED = ['openingBalance', 'extraDeposit', 'chequeWriteOff', 'outDatedCheques', 'receivableBF', 'pettyCash', 'jazzCash'];
const toForm = (inputs) => Object.fromEntries(TYPED.map((k) => [k, inputs?.[k] === null || inputs?.[k] === undefined ? '' : String(inputs[k])]));

async function call(url, opts) {
  const res = await fetch(url, opts);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j?.ok === false) throw new Error(j?.message || 'Request failed');
  return j.data;
}

export default function IncomeExpenseSummary() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const book = entityType === 'corporate' ? 'Panel (Corporate)' : 'Cash GL';
  const today = pktToday();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [data, setData] = useState(null);
  const [form, setForm] = useState(toForm(null));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const show = useCallback((d) => { setData(d); setForm(toForm(d?.inputs)); }, []);
  const load = useCallback(async (y, m) => {
    setLoading(true);
    try {
      show(await call(`${API}/income-expense-summary?entityType=${entityType}&year=${y}&month=${m}`));
    } catch (e) {
      toast.error(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [entityType, show]);
  useEffect(() => { load(year, month); /* first load only; Show reloads */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const dirty = useMemo(() => data && TYPED.some((k) => form[k] !== toForm(data.inputs)[k]), [data, form]);
  const save = async () => {
    for (const k of TYPED) {
      if (form[k] !== '' && !Number.isFinite(Number(String(form[k]).replace(/,/g, '')))) { toast.error('Sirf number likhein'); return; }
    }
    setSaving(true);
    try {
      show(await call(`${API}/income-expense-summary/inputs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, year: data.year, month: data.month, values: form }),
      }));
      toast.success('Save ho gaya');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const title = data ? `Income & Expense Summary - ${MONTHS[data.month - 1]} ${data.year}` : 'Income & Expense Summary';
  const typed = (key, label) => (
    <>
      <input
        className="ies-input"
        inputMode="decimal"
        value={form[key]}
        placeholder="0.00"
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        aria-label={label}
      />
      <span className="ies-printval">{moneyOrBlank(form[key])}</span>
    </>
  );

  const handlePrint = () => {
    if (!data) return;
    const win = openPrintWindow();
    const content = document.getElementById('ies-print')?.innerHTML || '';
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      @page { size: A4 portrait; margin: 8mm; }
      * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif !important; }
      body { margin: 0; font-size: 8pt; color: #000; }
      h1 { font-size: 11pt; margin: 0 0 1mm; }
      .ies-sub { font-size: 8pt; margin: 0 0 3mm; }
      .ies-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-bottom: 3mm; }
      table { width: 100%; border-collapse: collapse; }
      th, td { font-size: 7.5pt; padding: 1px 3px; border: 1px solid #777; }
      th { background: #eee; text-align: center; }
      .n { text-align: right; white-space: nowrap; }
      tr.is-strong td, tr.is-total td { font-weight: 700; }
      tr.is-head td { font-weight: 700; background: #f3f3f3; }
      .ies-input, .ies-note, .ies-hint { display: none !important; }
      .ies-printval { display: inline !important; }
      .ies-sign { display: flex !important; justify-content: space-between; margin-top: 14mm; }
      .ies-sign div { width: 30%; border-top: 1px solid #000; text-align: center; padding-top: 1mm; font-weight: 700; }
    </style></head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const handleExcel = () => {
    if (!data) return;
    const n = (v) => (v === null || v === undefined ? '' : v);
    const aoa = [[title], [book], [], ['RECEIPTS', '', '']];
    aoa.push(['Opening Balance', data.opening.amount, '']);
    data.receipts.lines.forEach((l) => aoa.push([l.name, l.amount, '']));
    aoa.push(['Receipts', '', data.receipts.total], ['Other Deposits', '', '']);
    data.otherDeposits.lines.forEach((l) => aoa.push([l.name, l.amount, '']));
    aoa.push(['Other Deposits total', '', data.otherDeposits.total], [], ['PAYMENTS', '', '']);
    data.payments.lines.forEach((l) => aoa.push([l.name, l.amount, '']));
    data.payments.bankLines.forEach((l) => aoa.push([l.name, l.amount, '']));
    aoa.push(['Total Payments', '', data.payments.total]);
    const cb = data.closingBalances;
    aoa.push(['Un-presented Cheques', -cb.unpresented, ''], ['Closing Balances', '', ''], ['Petty Cash', cb.pettyCash, '']);
    cb.banks.forEach((b) => aoa.push([`Cash at Bank (closing) — ${b.name}`, b.closing, '']));
    aoa.push(['Cash at JazzCash', cb.jazzCash, ''], ['Cash in Hand', n(cb.cashInHand), ''], ['Closing Balances total', '', cb.total], ['TOTAL', '', data.totals.payments]);
    aoa.push([], ['Receipts TOTAL', '', data.totals.receipts], ['Payments TOTAL', '', data.totals.payments], ['Farq', '', data.totals.difference]);
    if (data.creditCard) aoa.push(['Credit Card Slip Amount (info)', data.creditCard.slips, ''], ['Received Amount (info)', data.creditCard.received, '']);
    aoa.push([], ['CLOSING', '', '']);
    const c = data.closing;
    aoa.push(['Opening Balance', c.opening, ''], ['Receipts', c.receipts, ''], ['Other Deposits', c.otherDeposits, ''], ['Payments', -c.payments, ''], ['Out Dated Cheques', -c.outDatedCheques, ''], ['A/c Receivable B/F', -c.receivableBF, ''], ['Closing', '', c.amount], [], ['RECONCILIATION', '', '']);
    const r = data.reconciliation;
    aoa.push(['Cash in Hand', n(r.cashInHand), ''], ['Petty Cash', r.pettyCash, ''], ['Cash at JazzCash', r.jazzCash, ''], ['A/c Receivable B/F', r.receivableBF, '']);
    r.banks.forEach((b) => aoa.push([`Cash at Bank — ${b.name}`, b.closing, '']));
    aoa.push(['Un-presented Cheques', -r.unpresented, ''], ['Total', '', r.total], ['Difference from Closing', '', r.difference]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 44 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Income & Expense');
    XLSX.writeFile(wb, `income_expense_summary_${data.year}_${String(data.month).padStart(2, '0')}_${entityType}.xlsx`);
  };

  const years = [];
  for (let y = Number(today.slice(0, 4)) + 1; y >= 2020; y -= 1) years.push(y);
  const neg = (v) => (Number(v) < 0 ? ' is-neg' : '');

  return (
    <div className="ies">
      <div className="ies__bar">
        <button type="button" className="ies__back" onClick={() => navigate(`/accounts/${entityType}/reports`)}><ArrowLeft size={14} /> Reports</button>
        <div className="ies__heading">
          <h1>Income &amp; Expense Summary</h1>
          <span>{book}</span>
        </div>
        <div className="ies__controls">
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
          <button type="button" className="ies__btn ies__btn--primary" onClick={() => load(year, month)} disabled={loading}><RefreshCw size={14} /> Show</button>
          <button type="button" className="ies__btn ies__btn--save" onClick={save} disabled={!dirty || saving}><Save size={14} /> {saving ? 'Saving…' : 'Save'}</button>
          <button type="button" className="ies__btn" onClick={handlePrint} disabled={!data}><Printer size={14} /> Print</button>
          <button type="button" className="ies__btn" onClick={handleExcel} disabled={!data}><FileSpreadsheet size={14} /> Excel</button>
        </div>
      </div>

      {loading && <p className="ies__empty">Loading…</p>}
      {!loading && data && (
        <div className="ies__sheet" id="ies-print">
          <h1>{title}</h1>
          <p className="ies-sub">{book}</p>
          {data.opening.source === 'missing' && (
            <p className="ies-hint">Opening Balance abhi set nahi — pehle mahine ka Opening Balance neeche likh ke Save karein. Us ke baad har mahine pichle mahine ka Closing khud aayega.</p>
          )}
          {dirty && <p className="ies-hint">Likhe hue figures abhi save nahi hue — Save dabayein.</p>}

          <div className="ies-grid">
            <table className="ies-table">
              <thead><tr><th colSpan={3}>RECEIPTS</th></tr></thead>
              <tbody>
                <tr className="is-strong">
                  <td>
                    Opening Balance
                    <div className="ies-note">
                      {data.opening.source === 'typed' && 'is mahine ke liye likha gaya (khali kar ke Save karein to pichle mahine ka Closing aayega)'}
                      {data.opening.source === 'carried' && `pichle mahine ka Closing — ${money(data.opening.amount)}; badalna ho to likhein`}
                      {data.opening.source === 'missing' && 'pehli dafa likhein'}
                    </div>
                  </td>
                  <td className="n">
                    <input
                      className="ies-input"
                      inputMode="decimal"
                      value={form.openingBalance}
                      placeholder={data.opening.source === 'carried' ? money(data.opening.amount) : '0.00'}
                      onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
                      aria-label="Opening Balance"
                    />
                    <span className="ies-printval">{money(data.opening.amount)}</span>
                  </td>
                  <td className={`n${neg(data.opening.amount)}`}>{money(data.opening.amount)}</td>
                </tr>
                {!data.receipts.lines.length && <tr><td colSpan={3} className="ies-muted">Is mahine koi posted Voucher Income nahi.</td></tr>}
                {data.receipts.lines.map((l) => <tr key={l.name}><td>{l.name}</td><td className="n">{money(l.amount)}</td><td /></tr>)}
                <tr className="is-total"><td>Receipts</td><td /><td className="n">{money(data.receipts.total)}</td></tr>
                <tr className="is-head"><td colSpan={3}>Other Deposits</td></tr>
                {data.otherDeposits.lines.map((l) => (
                  <tr key={l.key}>
                    <td>{l.name}</td>
                    <td className="n">{l.typed ? typed(l.key, l.name) : moneyOrBlank(l.amount)}</td>
                    <td />
                  </tr>
                ))}
                <tr className="is-total"><td>Other Deposits</td><td /><td className="n">{money(data.otherDeposits.total)}</td></tr>
                {data.creditCard && (
                  <>
                    <tr className="is-head"><td colSpan={3}>Credit Card <span className="ies-note-inline">(sirf jaankari — total me nahi)</span></td></tr>
                    <tr className="is-info"><td>Credit Card Slip Amount <div className="ies-note">is mahine bani CC slips</div></td><td className="n">{money(data.creditCard.slips)}</td><td /></tr>
                    <tr className="is-info"><td>Received Amount <div className="ies-note">bank se aaya (CC settlements)</div></td><td className="n">{money(data.creditCard.received)}</td><td /></tr>
                    <tr className="is-info"><td>Farq <div className="ies-note">abhi bank ke paas / pichle mahine ki slips ka aaya</div></td><td className={`n${neg(data.creditCard.difference)}`}>{money(data.creditCard.difference)}</td><td /></tr>
                  </>
                )}
                <tr className="is-grand"><td>TOTAL</td><td /><td className={`n${neg(data.totals.receipts)}`}>{money(data.totals.receipts)}</td></tr>
              </tbody>
            </table>

            <table className="ies-table">
              <thead><tr><th colSpan={3}>PAYMENTS</th></tr></thead>
              <tbody>
                {!data.payments.lines.length && <tr><td colSpan={3} className="ies-muted">Is mahine koi Voucher Expense nahi.</td></tr>}
                {data.payments.lines.map((l) => <tr key={l.id}><td>{l.name}</td><td className="n">{money(l.amount)}</td><td /></tr>)}
                <tr className="is-head"><td colSpan={3}>Bank (not in books)</td></tr>
                {data.payments.bankLines.map((l) => <tr key={l.key}><td>{l.name}</td><td className="n">{moneyOrBlank(l.amount)}</td><td /></tr>)}
                <tr className="is-total"><td>Total Payments</td><td /><td className="n">{money(data.payments.total)}</td></tr>
                <tr>
                  <td>Un-presented Cheques <div className="ies-note">{data.closingBalances.unpresentedCheques} cheque(s), mahine ke aakhir tak clear nahi hue — minus</div></td>
                  <td className="n">{money(-data.closingBalances.unpresented)}</td><td />
                </tr>
                <tr className="is-head"><td colSpan={3}>Closing Balances</td></tr>
                <tr><td>Petty Cash</td><td className="n">{typed('pettyCash', 'Petty Cash')}</td><td /></tr>
                {data.closingBalances.banks.map((b) => (
                  <tr key={b.id}><td>Cash at Bank (closing) — {b.name}</td><td className={`n${neg(b.closing)}`}>{money(b.closing)}</td><td /></tr>
                ))}
                <tr><td>Cash at JazzCash</td><td className="n">{typed('jazzCash', 'Cash at JazzCash')}</td><td /></tr>
                <tr><td>Cash in Hand</td><td className="n">{data.closingBalances.cashInHand === null ? '—' : money(data.closingBalances.cashInHand)}</td><td /></tr>
                <tr className="is-balance"><td>Closing Balances</td><td /><td className={`n${neg(data.closingBalances.total)}`}>{money(data.closingBalances.total)}</td></tr>
                <tr className="is-grand"><td>TOTAL</td><td /><td className={`n${neg(data.totals.payments)}`}>{money(data.totals.payments)}</td></tr>
              </tbody>
            </table>
          </div>

          <div className={`ies-diffbar${Math.abs(data.totals.difference) > 0.005 ? ' is-off' : ''}`}>
            <span>Receipts TOTAL {money(data.totals.receipts)} − Payments TOTAL {money(data.totals.payments)}</span>
            <b>Farq: {money(data.totals.difference)}</b>
          </div>

          <div className="ies-grid">
            <table className="ies-table">
              <thead><tr><th colSpan={3}>CLOSING</th></tr></thead>
              <tbody>
                <tr><td>Opening Balance</td><td className={`n${neg(data.closing.opening)}`}>{money(data.closing.opening)}</td><td /></tr>
                <tr><td>Receipts</td><td className="n">{money(data.closing.receipts)}</td><td /></tr>
                <tr><td>Other Deposits</td><td className="n">{money(data.closing.otherDeposits)}</td><td /></tr>
                <tr className="is-total"><td>Sub Total</td><td /><td className={`n${neg(data.closing.opening + data.closing.receipts + data.closing.otherDeposits)}`}>{money(data.closing.opening + data.closing.receipts + data.closing.otherDeposits)}</td></tr>
                <tr><td>Payments</td><td className="n">{money(data.closing.payments)}</td><td /></tr>
                <tr><td>Out Dated Cheques</td><td className="n">{typed('outDatedCheques', 'Out Dated Cheques')}</td><td /></tr>
                <tr><td>A/c Receivable B/F</td><td className="n">{typed('receivableBF', 'A/c Receivable B/F')}</td><td /></tr>
                <tr className="is-total"><td>Less</td><td /><td className="n is-neg">{money(-(data.closing.payments + data.closing.outDatedCheques + data.closing.receivableBF))}</td></tr>
                <tr className="is-grand"><td>CLOSING</td><td /><td className={`n${neg(data.closing.amount)}`}>{money(data.closing.amount)}</td></tr>
              </tbody>
            </table>

            <table className="ies-table">
              <thead><tr><th colSpan={3}>RECONCILIATION</th></tr></thead>
              <tbody>
                <tr><td>Cash in Hand</td><td className="n">{data.reconciliation.cashInHand === null ? '—' : money(data.reconciliation.cashInHand)}</td><td /></tr>
                <tr><td>Petty Cash</td><td className="n">{moneyOrBlank(data.reconciliation.pettyCash)}</td><td /></tr>
                <tr><td>Cash at JazzCash</td><td className="n">{moneyOrBlank(data.reconciliation.jazzCash)}</td><td /></tr>
                <tr><td>A/c Receivable B/F</td><td className="n">{moneyOrBlank(data.reconciliation.receivableBF)}</td><td /></tr>
                {data.reconciliation.banks.map((b) => (
                  <tr key={b.id}><td>Cash at Bank (closing) — {b.name}</td><td className={`n${neg(b.closing)}`}>{money(b.closing)}</td><td /></tr>
                ))}
                <tr className="is-total"><td>Sub Total</td><td /><td className="n">{money(data.reconciliation.total + data.reconciliation.unpresented)}</td></tr>
                <tr><td>Un-presented Cheques</td><td className="n">{money(data.reconciliation.unpresented)}</td><td /></tr>
                <tr className="is-grand"><td>TOTAL</td><td /><td className={`n${neg(data.reconciliation.total)}`}>{money(data.reconciliation.total)}</td></tr>
                <tr className={`is-diff${Math.abs(data.reconciliation.difference) > 0.005 ? ' is-off' : ''}`}>
                  <td>Difference (Closing − Total)</td><td /><td className="n">{money(data.reconciliation.difference)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="ies-note">
            Receipts = posted Voucher Income by Income Category (Income Summary Matrix). Payments = Voucher Expense by Main GL. Bank figures from the Bank Balance Statement
            (uploaded statement lines not matched to the books count as &quot;not in books&quot;). Cash in Hand = Bank Deposit's undeposited cash as it stands now — the same in every month. White boxes are typed by hand and saved with the month.
          </p>
          <div className="ies-sign"><div>Accountant</div><div>Administrator</div><div>CEO</div></div>
        </div>
      )}
    </div>
  );
}
