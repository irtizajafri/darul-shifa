import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Printer, RefreshCw, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { API, fmtDay, getJson, money, pktToday, printA4 } from '../bankRecon/bankReconUtils';
import '../bankRecon/bankRecon.scss';

// Accounts → Reports → Slip & Admission Refund Statement (owner, 2026-11-21):
// every refund the Clinic gave — slip refunds and admission refunds — with
// the voucher it went out on (or "Pending" until Day Close posts it).
// Filters: dates, type, voucher, and a search over slip / admission #,
// patient, voucher # and user.

const KIND = { slip: 'Slip', admission: 'Admission' };
const VOUCHER = { posted: 'Voucher bana', pending: 'Pending (Day Close)', none: 'Voucher nahi' };

export default function RefundStatement() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const book = entityType === 'corporate' ? 'Panel (Corporate)' : 'Cash GL';
  const today = pktToday();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [kind, setKind] = useState('all');
  const [voucher, setVoucher] = useState('all');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (f, t) => {
    if (!f || !t || f > t) { toast.error('From aur To date sahi chunein'); return; }
    setLoading(true);
    try {
      setData(await getJson(`${API}/refund-statement?entityType=${entityType}&from=${f}&to=${t}`));
    } catch (e) {
      toast.error(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [entityType]);
  useEffect(() => { load(from, to); /* first load only; Show reloads */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.rows || []).filter((r) => (kind === 'all' || r.kind === kind)
      && (voucher === 'all' || r.voucherStatus === voucher)
      && (!t || [r.ref, r.patientName, r.voucherNo, r.refundedBy, r.department, r.reason].some((v) => String(v || '').toLowerCase().includes(t))));
  }, [data, kind, voucher, q]);
  const sum = (list) => list.reduce((s, r) => s + r.amount, 0);
  const totals = {
    amount: sum(rows),
    slip: sum(rows.filter((r) => r.kind === 'slip')),
    admission: sum(rows.filter((r) => r.kind === 'admission')),
    pending: sum(rows.filter((r) => r.voucherStatus === 'pending')),
  };
  const filterText = [
    `${fmtDay(data?.from || from)} to ${fmtDay(data?.to || to)}`,
    kind !== 'all' ? KIND[kind] : null,
    voucher !== 'all' ? VOUCHER[voucher] : null,
    q.trim() ? `"${q.trim()}"` : null,
  ].filter(Boolean).join(' · ');
  const title = 'Slip & Admission Refund Statement';

  const handlePrint = () => {
    if (!data) return;
    printA4(title, `<h1>${title}</h1>${document.getElementById('rfs-print')?.innerHTML || ''}`, '@page { size: A4 landscape; margin: 8mm; }');
  };
  const handleExcel = () => {
    if (!data) return;
    const aoa = [[title], [`${book} · ${filterText}`], [],
      ['Date', 'Type', 'Slip / Admission #', 'Patient', 'Department', 'Reason', 'Refunded By', 'Amount', 'Voucher #', 'Voucher Date']];
    rows.forEach((r) => aoa.push([fmtDay(r.date), KIND[r.kind], r.ref, r.patientName, r.department, r.reason, r.refundedBy, r.amount,
      r.voucherNo || (r.voucherStatus === 'pending' ? 'Pending' : ''), r.voucherDate ? fmtDay(r.voucherDate) : '']));
    aoa.push(['Total', `${rows.length} refund(s)`, '', '', '', '', '', totals.amount, '', '']);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Refunds');
    XLSX.writeFile(wb, `refund_statement_${data.from}_${data.to}_${entityType}.xlsx`);
  };

  return (
    <div className="brc">
      <div className="brc__bar">
        <button type="button" className="brc__back" onClick={() => navigate(`/accounts/${entityType}/reports`)}><ArrowLeft size={14} /> Reports</button>
        <div className="brc__heading">
          <h1>{title}</h1>
          <span>{book}</span>
        </div>
        <div className="brc__controls">
          <label><span>From</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span>To</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
          <button type="button" className="brc__btn brc__btn--primary" onClick={() => load(from, to)} disabled={loading}><RefreshCw size={14} /> Show</button>
          <button type="button" className="brc__btn" onClick={handlePrint} disabled={!data}><Printer size={14} /> Print</button>
          <button type="button" className="brc__btn" onClick={handleExcel} disabled={!data}><FileSpreadsheet size={14} /> Excel</button>
        </div>
      </div>

      {loading && <p className="brc__empty">Loading…</p>}
      {!loading && data && (
        <>
          <div className="brc__kpis rfs-kpis">
            <div><span>Refunds</span><b>{rows.length}</b></div>
            <div><span>Total refund</span><b>{money(totals.amount)}</b></div>
            <div><span>Slip</span><b>{money(totals.slip)}</b></div>
            <div><span>Admission</span><b>{money(totals.admission)}</b></div>
            <div><span>Pending (Day Close)</span><b style={{ color: totals.pending ? 'var(--brc-warn)' : undefined }}>{money(totals.pending)}</b></div>
          </div>

          <div className="brc__card">
            <div className="rfs-filters">
              <label><span>Type</span>
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="all">Slip + Admission</option>
                  <option value="slip">Sirf Slip</option>
                  <option value="admission">Sirf Admission</option>
                </select>
              </label>
              <label><span>Voucher</span>
                <select value={voucher} onChange={(e) => setVoucher(e.target.value)}>
                  <option value="all">Sab</option>
                  <option value="posted">Voucher bana</option>
                  <option value="pending">Pending (Day Close)</option>
                  <option value="none">Voucher nahi</option>
                </select>
              </label>
              <label className="rfs-search"><span>Search</span>
                <span className="rfs-search__box">
                  <Search size={14} aria-hidden="true" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Slip / Admission #, patient, voucher #, user" aria-label="Search refunds" />
                </span>
              </label>
            </div>

            <div id="rfs-print">
              <p className="brc-print-sub rfs-sub">{book} · {filterText}</p>
              <div className="table-wrap">
                <table className="brc__table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Type</th><th>Slip / Admission #</th><th>Patient</th><th>Department</th><th>Reason</th>
                      <th>Refunded By</th><th className="n">Amount</th><th>Voucher #</th><th>Voucher Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!rows.length && <tr><td colSpan={10} className="muted">Is filter me koi refund nahi.</td></tr>}
                    {rows.map((r) => (
                      <tr key={r.key}>
                        <td className="d">{fmtDay(r.date)}</td>
                        <td><span className={`brc__tag ${r.kind === 'admission' ? 'brc__tag--lock' : 'brc__tag--ok'}`}>{KIND[r.kind]}</span></td>
                        <td className="d"><b>{r.ref}</b></td>
                        <td>{r.patientName}</td>
                        <td>{r.department}</td>
                        <td>{r.reason}</td>
                        <td>{r.refundedBy}</td>
                        <td className="n">{money(r.amount)}</td>
                        <td className="d">
                          {r.voucherNo
                            ? <b>{r.voucherNo}</b>
                            : r.voucherStatus === 'pending' ? <span className="brc__tag brc__tag--warn">Pending</span> : <span className="muted">—</span>}
                        </td>
                        <td className="d">{r.voucherDate ? fmtDay(r.voucherDate) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                  {rows.length > 0 && (
                    <tfoot>
                      <tr><td colSpan={7}>Total · {rows.length} refund(s) · Slip {money(totals.slip)} · Admission {money(totals.admission)}</td><td className="n">{money(totals.amount)}</td><td colSpan={2} /></tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
            <p className="brc__note rfs-note">
              20 Oct 2026 se har refund Pending Draft banta hai aur Day Close pe voucher — us se pehle ke refunds slip / admission pe likhi raqam se (slip pe ek se zyada refund ho to un ka jor ek row me). Cancel Slip (paise wapas nahi) is me nahi.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
