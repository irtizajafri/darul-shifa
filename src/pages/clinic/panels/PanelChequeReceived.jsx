import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, X } from 'lucide-react';
import ClinicMenuBar from '../../../components/clinic/ClinicMenuBar';
import { useClinicStore } from '../../../store/useClinicStore';
import { useAuthStore } from '../../../store/useAuthStore';
import './PanelChequeReceived.scss';

const todayIso = () => new Date().toISOString().slice(0, 10);
const firstOfMonthIso = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const fmt = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SUM_KEYS = ['ipdAmt', 'opdAmt', 'total', 'received', 'deduction', 'balance'];

const MONTH_COLS = [
  { key: 'monthName', label: 'MonthName', align: 'l' },
  { key: 'year',      label: 'Year',      align: 'l' },
  { key: 'ipdAmt',    label: 'IPD AMT',   align: 'r' },
  { key: 'opdAmt',    label: 'OPD AMT',   align: 'r' },
  { key: 'total',     label: 'Total',     align: 'r' },
  { key: 'received',  label: 'Received',  align: 'r' },
  { key: 'deduction', label: 'Dedection', align: 'r' },
  { key: 'balance',   label: 'Balance',   align: 'r' },
];

const COMPANY_COLS = [
  { key: 'monthName', label: 'MonthName', align: 'l' },
  { key: 'year',      label: 'Year',      align: 'l' },
  { key: 'company',   label: 'Company',   align: 'l' },
  { key: 'ipdAmt',    label: 'IPD AMT',   align: 'r' },
  { key: 'opdAmt',    label: 'OPD AMT',   align: 'r' },
  { key: 'total',     label: 'Total',     align: 'r' },
  { key: 'received',  label: 'Received',  align: 'r' },
  { key: 'deduction', label: 'Dedection', align: 'r' },
  { key: 'balance',   label: 'Balance',   align: 'r' },
];

function sumRows(rows) {
  return rows.reduce((acc, r) => {
    SUM_KEYS.forEach((k) => { acc[k] = (acc[k] || 0) + Number(r[k] || 0); });
    return acc;
  }, {});
}

// Panels > Panel Cheque Transaction — Month/Year summary of every "posted"
// (File Closed — see PanelBilling's own Save button) Panel admission's
// Billing amount, grouped by the Billing's own Discharge Date (independent
// of the real Admission dates). Double-click a month → its Company-wise
// breakdown opens below; double-click a company → the actual cheque-receive
// modal opens (checklist of that company's still-unpaid posted bills for
// that Billing Month).
export default function PanelChequeReceived() {
  const { fetchPanelChequeSummary } = useClinicStore();
  const [fromDate, setFromDate] = useState(firstOfMonthIso());
  const [toDate, setToDate] = useState(todayIso());
  const [monthRows, setMonthRows] = useState([]);
  const [companyRows, setCompanyRows] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null); // { month, year, monthName } | null
  const [chequeTarget, setChequeTarget] = useState(null); // { panelCompanyId, company, month, year, monthName } | null

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPanelChequeSummary({ from: fromDate || undefined, to: toDate || undefined });
      setMonthRows(res.monthRows || []);
      setCompanyRows(res.companyRows || []);
      setSearched(true);
      setSelectedMonth(null);
    } catch (e) {
      toast.error(e.message || 'Load nahi hua');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, fetchPanelChequeSummary]);

  useEffect(() => { runSearch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    setFromDate(firstOfMonthIso());
    setToDate(todayIso());
    setMonthRows([]);
    setCompanyRows([]);
    setSearched(false);
    setSelectedMonth(null);
  }

  function handleMonthDoubleClick(row) {
    setSelectedMonth({ month: row.month, year: row.year, monthName: row.monthName });
  }

  function handleCompanyDoubleClick(row) {
    if (!row.panelCompanyId) { toast.error('Is row ki company set nahi hai'); return; }
    setChequeTarget({ panelCompanyId: row.panelCompanyId, company: row.company, month: row.month, year: row.year, monthName: row.monthName });
  }

  const visibleCompanyRows = selectedMonth
    ? companyRows.filter((r) => r.month === selectedMonth.month && r.year === selectedMonth.year)
    : [];

  const monthTotals = sumRows(monthRows);
  const companyTotals = sumRows(visibleCompanyRows);

  return (
    <div className="pcr-page">
      <ClinicMenuBar />

      <div className="pcr-body">
        <div className="pcr-titlebar">Panel Cheque Transaction</div>

        <div className="pcr-filter">
          <div className="pcr-fg">
            <label>From :</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="pcr-fg">
            <label>To :</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="pcr-filter-actions">
            <button className="pcr-btn pcr-btn--search" onClick={runSearch} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'pcr-spin' : ''} /> Search
            </button>
            <button className="pcr-btn pcr-btn--close" onClick={handleClose}>
              <X size={14} /> Close
            </button>
          </div>
        </div>

        {/* ── Grid 1 — Month-wise totals (all companies) ── */}
        <div className="pcr-grid-wrap">
          <table className="pcr-table">
            <thead>
              <tr>{MONTH_COLS.map((c) => <th key={c.key} className={`pcr-${c.align}`}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {!searched ? (
                <tr><td className="pcr-empty" colSpan={MONTH_COLS.length}>From / To date select karke <b>Search</b> dabao.</td></tr>
              ) : !monthRows.length ? (
                <tr><td className="pcr-empty" colSpan={MONTH_COLS.length}>Is date range mein koi posted bill nahi mila.</td></tr>
              ) : monthRows.map((r, i) => (
                <tr key={i}
                  className={`pcr-row-clickable ${selectedMonth?.month === r.month && selectedMonth?.year === r.year ? 'pcr-row-selected' : ''}`}
                  onDoubleClick={() => handleMonthDoubleClick(r)}
                  title="Double-click — company-wise breakdown dekhein">
                  <td className="pcr-l">{r.monthName}</td>
                  <td className="pcr-l">{r.year}</td>
                  <td className="pcr-r">{fmt(r.ipdAmt)}</td>
                  <td className="pcr-r">{fmt(r.opdAmt)}</td>
                  <td className="pcr-r">{fmt(r.total)}</td>
                  <td className="pcr-r">{fmt(r.received)}</td>
                  <td className="pcr-r">{fmt(r.deduction)}</td>
                  <td className="pcr-r">{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            {searched && monthRows.length > 0 && (
              <tfoot>
                <tr className="pcr-totals">
                  <td className="pcr-l" colSpan={2}>TOTAL</td>
                  <td className="pcr-r">{fmt(monthTotals.ipdAmt)}</td>
                  <td className="pcr-r">{fmt(monthTotals.opdAmt)}</td>
                  <td className="pcr-r">{fmt(monthTotals.total)}</td>
                  <td className="pcr-r">{fmt(monthTotals.received)}</td>
                  <td className="pcr-r">{fmt(monthTotals.deduction)}</td>
                  <td className="pcr-r">{fmt(monthTotals.balance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── Grid 2 — Month + Company-wise breakdown (only after a month is picked above) ── */}
        <div className="pcr-grid-wrap pcr-grid-wrap--company">
          <table className="pcr-table">
            <thead>
              <tr>{COMPANY_COLS.map((c) => <th key={c.key} className={`pcr-${c.align}`}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {!selectedMonth ? (
                <tr><td className="pcr-empty" colSpan={COMPANY_COLS.length}>Upar wale grid mein kisi month ki row <b>double-click</b> karo — us month ki company-wise breakdown yahan aayegi.</td></tr>
              ) : !visibleCompanyRows.length ? (
                <tr><td className="pcr-empty" colSpan={COMPANY_COLS.length}>{selectedMonth.monthName} {selectedMonth.year} ke liye koi company record nahi mila.</td></tr>
              ) : visibleCompanyRows.map((r, i) => (
                <tr key={i} className="pcr-row-clickable" onDoubleClick={() => handleCompanyDoubleClick(r)}
                  title="Double-click — cheque receive karein">
                  <td className="pcr-l">{r.monthName}</td>
                  <td className="pcr-l">{r.year}</td>
                  <td className="pcr-l">{r.company}</td>
                  <td className="pcr-r">{fmt(r.ipdAmt)}</td>
                  <td className="pcr-r">{fmt(r.opdAmt)}</td>
                  <td className="pcr-r">{fmt(r.total)}</td>
                  <td className="pcr-r">{fmt(r.received)}</td>
                  <td className="pcr-r">{fmt(r.deduction)}</td>
                  <td className="pcr-r">{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            {selectedMonth && visibleCompanyRows.length > 0 && (
              <tfoot>
                <tr className="pcr-totals">
                  <td className="pcr-l" colSpan={3}>TOTAL</td>
                  <td className="pcr-r">{fmt(companyTotals.ipdAmt)}</td>
                  <td className="pcr-r">{fmt(companyTotals.opdAmt)}</td>
                  <td className="pcr-r">{fmt(companyTotals.total)}</td>
                  <td className="pcr-r">{fmt(companyTotals.received)}</td>
                  <td className="pcr-r">{fmt(companyTotals.deduction)}</td>
                  <td className="pcr-r">{fmt(companyTotals.balance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {chequeTarget && (
        <ChequeReceiveModal
          target={chequeTarget}
          onClose={() => setChequeTarget(null)}
          onSaved={() => { setChequeTarget(null); runSearch(); }}
        />
      )}
    </div>
  );
}

// Cheque-receive checklist — every still-unpaid posted bill for this
// Company + Billing Month. Check the ones this cheque covers, type the
// actual Cheque amount — Dedection is always auto = (checked bills' Total)
// − (typed Amuont), matching what the company actually paid vs billed.
function ChequeReceiveModal({ target, onClose, onSaved }) {
  const { fetchUnpaidPanelAdmissions, receivePanelCheque } = useClinicStore();
  const { user } = useAuthStore();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(() => new Set());
  const [chequeNo, setChequeNo] = useState('');
  const [chequeDate, setChequeDate] = useState(todayIso());
  const [amuont, setAmuont] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUnpaidPanelAdmissions({ panelCompanyId: target.panelCompanyId, month: target.month, year: target.year })
      .then((data) => { if (!cancelled) setRows(data || []); })
      .catch((e) => { if (!cancelled) toast.error(e.message || 'Load nahi hua'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [target, fetchUnpaidPanelAdmissions]);

  // `checked` keys off each row's own `id` (prefixed "adm-<id>"/"opd-<id>" —
  // see getUnpaidPanelAdmissions) rather than the raw admissionId, since a
  // Company/Month batch can now mix real Admissions and panel OPD Slips
  // together and their numeric ids aren't otherwise distinguishable.
  function toggle(id) {
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function uncheckAll() {
    setChecked(new Set());
  }

  const checkedRows = rows.filter((r) => checked.has(r.id));
  const totalAmount = checkedRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const receivedAmount = Number(amuont) || 0;
  const deduction = totalAmount - receivedAmount;

  async function handleSave() {
    if (!checkedRows.length) return toast.error('Kam az kam ek bill select karo');
    if (!chequeNo.trim()) return toast.error('Cheque # zaroori hai');
    if (!chequeDate) return toast.error('Cheque Date zaroori hai');
    if (amuont === '' || Number.isNaN(receivedAmount) || receivedAmount < 0) return toast.error('Amuont valid number honi chahiye');
    setSaving(true);
    try {
      await receivePanelCheque({
        panelCompanyId: target.panelCompanyId,
        billingMonth: target.month,
        billingYear: target.year,
        chequeNo: chequeNo.trim(),
        chequeDate,
        receivedAmount,
        admissionIds: checkedRows.filter((r) => r.admissionId != null).map((r) => r.admissionId),
        opdVisitIds: checkedRows.filter((r) => r.opdVisitId != null).map((r) => r.opdVisitId),
        createdByUserId: user?.id != null ? String(user.id) : null,
        createdByName: user?.name || user?.username || user?.email || null,
      });
      toast.success('Cheque receive ho gaya');
      onSaved();
    } catch (e) {
      toast.error(e.message || 'Save nahi hua');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pcr-modal-overlay" onMouseDown={onClose}>
      <div className="pcr-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="pcr-modal-head">{target.company}</div>
        <div className="pcr-modal-sub">Billing Month of : {target.monthName}-{target.year}</div>

        <label className="pcr-uncheck-all">
          <input type="checkbox" checked={false} onChange={(e) => { if (e.target.checked) uncheckAll(); }} />
          Uncheck All
        </label>

        <div className="pcr-modal-table-wrap">
          <table className="pcr-modal-table">
            <thead>
              <tr><th></th><th>Bill Type</th><th>Number</th><th>PatName</th><th className="pcr-r">Amount</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="pcr-empty" colSpan={5}>Loading…</td></tr>
              ) : !rows.length ? (
                <tr><td className="pcr-empty" colSpan={5}>Is company/month ke liye koi unpaid bill nahi mila.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className={checked.has(r.id) ? 'pcr-modal-row-checked' : ''}>
                  <td><input type="checkbox" checked={checked.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td>{r.billType}</td>
                  <td>{r.number}</td>
                  <td>{r.patName}</td>
                  <td className="pcr-r">{fmt(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pcr-modal-footer">
          <div className="pcr-modal-fields">
            <div className="pcr-modal-fg">
              <label>Chaque # :</label>
              <input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
            </div>
            <div className="pcr-modal-fg">
              <label>Chq Date :</label>
              <input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
            </div>
            <div className="pcr-modal-fg">
              <label>Amuont :</label>
              <input type="number" min="0" value={amuont} onChange={(e) => setAmuont(e.target.value)} />
            </div>
          </div>
          <div className="pcr-modal-summary">
            <div><span>Total Amount :</span><b>{fmt(totalAmount)}</b></div>
            <div><span>Dedection :</span><b>{fmt(deduction)}</b></div>
            <div><span>Received :</span><b>{fmt(receivedAmount)}</b></div>
          </div>
          <div className="pcr-modal-actions">
            <button className="pcr-btn pcr-btn--save" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button className="pcr-btn pcr-btn--close" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
