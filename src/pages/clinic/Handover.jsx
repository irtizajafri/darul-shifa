import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ClinicMenuBar from '../../components/clinic/ClinicMenuBar';
import PageHeader from '../../components/shared/PageHeader';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';
import { useClinicStore } from '../../store/useClinicStore';
import { useUserManagementStore } from '../../store/useUserManagementStore';
import './Handover.scss';

const fmt2 = (n) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CONDITIONS = ['working', 'damaged', 'maintenance'];
const DENOMINATIONS = [10, 20, 50, 100, 500, 1000, 5000];

function fmtDateLong(d) {
  return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const HANDOVER_PRINT_CSS = `
  @page { size: A4; margin: 14mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Poppins', Arial, sans-serif; font-size: 9.5pt; color: #111; }
  .hop-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
  .hop-date { font-size: 9pt; color: #555; }
  .hop-name { font-size: 14pt; font-weight: 700; }
  .hop-title { font-weight: 700; font-size: 11pt; letter-spacing: 0.08em; border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 12px; }
  .hop-meta { display: flex; justify-content: space-between; font-size: 9pt; color: #333; padding-bottom: 4px; }
  .hop-slip-range { display: flex; justify-content: space-between; font-size: 8.5pt; color: #555; border-bottom: 1px solid #ccc; padding-bottom: 6px; margin-bottom: 10px; }
  .hop-split { display: flex; gap: 16px; margin-bottom: 14px; }
  .hop-denom-tbl, .hop-summary-tbl, .hop-expense-tbl { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .hop-denom-tbl { flex: 1; }
  .hop-summary-tbl { flex: 1; align-self: flex-start; }
  .hop-denom-tbl th, .hop-expense-tbl th { background: #eee; text-align: left; padding: 3px 6px; border: 1px solid #ccc; }
  .hop-denom-tbl td, .hop-summary-tbl td, .hop-expense-tbl td { padding: 3px 6px; border: 1px solid #ddd; }
  .hop-denom-tbl tfoot td { font-weight: 700; border-top: 2px solid #333; }
  .hop-summary-tbl .hop-net td { font-weight: 700; border-top: 2px solid #333; font-size: 10.5pt; }
  .hop-r { text-align: right; font-variant-numeric: tabular-nums; }
  .hop-expense-title { font-weight: 700; letter-spacing: 0.05em; margin: 6px 0; border-top: 1px solid #333; padding-top: 8px; }
  .hop-sigs { display: flex; justify-content: space-between; margin-top: 50px; }
  .hop-sig { font-size: 9pt; text-align: center; width: 200px; }
  .hop-sig-line { border-top: 1px solid #555; margin-bottom: 4px; }
  .hop-footer { margin-top: 20px; font-size: 7.5pt; color: #999; }
`;

function openPrintWindow(title, html) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Popup blocked');
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${HANDOVER_PRINT_CSS}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.onafterprint = () => win.close();
  }, 400);
}

// Asset Handover — its own separate print: Reception items snapshot
// (name/qty/condition AT handover time) + Petty Cash + Takeover From/To.
function printAssetHandoverSlip({ fromUserName, assetToUserName, businessDate, pettyCash, assets, printBy }) {
  const assetRows = (assets || []).map((a) => `
    <tr><td>${a.name}</td><td>${a.quantity}</td><td style="text-transform:capitalize">${a.condition}</td></tr>
  `).join('');

  const html = `
    <div class="hop-page">
      <div class="hop-header">
        <div class="hop-date">${fmtDateLong(businessDate)}</div>
        <div class="hop-name">${fromUserName}</div>
      </div>
      <div class="hop-title">ASSET HANDOVER</div>

      <table class="hop-expense-tbl">
        <thead><tr><th>Item</th><th>Qty</th><th>Condition</th></tr></thead>
        <tbody>${assetRows || '<tr><td colspan="3" style="text-align:center;color:#888;">No items</td></tr>'}</tbody>
      </table>

      <table class="hop-summary-tbl" style="max-width:260px;margin-top:14px;">
        <tbody>
          <tr class="hop-net"><td>Petty Cash</td><td class="hop-r">Rs ${fmt2(pettyCash)}</td></tr>
        </tbody>
      </table>

      <div class="hop-sigs">
        <div class="hop-sig"><div class="hop-sig-line"></div>Takeover From<br><strong>${fromUserName}</strong></div>
        <div class="hop-sig"><div class="hop-sig-line"></div>Takeover To<br><strong>${assetToUserName || '—'}</strong></div>
      </div>
      <div class="hop-footer">Printed by ${printBy} — ${new Date().toLocaleString('en-PK')}</div>
    </div>
  `;
  openPrintWindow('Asset Handover Slip', html);
}

// Cash Handover — its own separate print: denomination-wise note count, an
// Amount/Exp/Other Exp/Total summary box, a numbered Expense Details list
// (the Voucher Expense drafts), the slip range worked, and Takeover
// From / Takeover To signature lines. Matches the hospital's existing
// paper handover sheet.
function printCashHandoverSlip({ fromUserName, cashToUserName, businessDate, slipCount, firstSlipSerial, firstSlipTime, lastSlipSerial, lastSlipTime, totalCash, draftPaymentsTotal, drafts, otherExpense, netCash, denominations, printBy }) {
  const denomRows = denominations
    .map((d) => `<tr><td>${d.denomination}</td><td>${d.qty}</td><td class="hop-r">${fmt2(d.qty * d.denomination)}</td></tr>`)
    .join('');
  const denomTotal = denominations.reduce((s, d) => s + d.qty * d.denomination, 0);

  const expenseRows = (drafts || []).map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.payeeName || d.mainGlName || '—'}</td>
      <td>${d.particulars || '—'}</td>
      <td class="hop-r">${fmt2(d.amount)}</td>
    </tr>
  `).join('');

  const html = `
    <div class="hop-page">
      <div class="hop-header">
        <div class="hop-date">${fmtDateLong(businessDate)}</div>
        <div class="hop-name">${fromUserName}</div>
      </div>
      <div class="hop-title">CASH HANDOVER</div>
      <div class="hop-meta">
        <span>No of Slips: <strong>${slipCount}</strong></span>
        <span>Date: <strong>${fmtDateLong(businessDate)}</strong></span>
      </div>
      ${slipCount > 0 ? `
      <div class="hop-slip-range">
        <span>From Slip # <strong>${firstSlipSerial || '—'}</strong> (${fmtDateTime(firstSlipTime)})</span>
        <span>To Slip # <strong>${lastSlipSerial || '—'}</strong> (${fmtDateTime(lastSlipTime)})</span>
      </div>` : ''}

      <div class="hop-split">
        <table class="hop-denom-tbl">
          <thead><tr><th>Note</th><th>Qty</th><th class="hop-r">Amount</th></tr></thead>
          <tbody>${denomRows}</tbody>
          <tfoot><tr><td colspan="2">Total</td><td class="hop-r">${fmt2(denomTotal)}</td></tr></tfoot>
        </table>

        <table class="hop-summary-tbl">
          <tbody>
            <tr><td>Amount</td><td class="hop-r">${fmt2(totalCash)}</td></tr>
            <tr><td>Exp</td><td class="hop-r">${fmt2(draftPaymentsTotal)}</td></tr>
            <tr><td>Other Exp</td><td class="hop-r">${fmt2(otherExpense)}</td></tr>
            <tr class="hop-net"><td>Total</td><td class="hop-r">${fmt2(netCash)}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="hop-expense-title">EXPENCE DETAILS</div>
      <table class="hop-expense-tbl">
        <thead><tr><th>#</th><th>Payee</th><th>Particulars</th><th class="hop-r">Amount</th></tr></thead>
        <tbody>${expenseRows || '<tr><td colspan="4" style="text-align:center;color:#888;">No expense drafts</td></tr>'}</tbody>
      </table>

      <div class="hop-sigs">
        <div class="hop-sig"><div class="hop-sig-line"></div>Takeover From<br><strong>${fromUserName}</strong></div>
        <div class="hop-sig"><div class="hop-sig-line"></div>Takeover To<br><strong>${cashToUserName || '—'}</strong></div>
      </div>
      <div class="hop-footer">Printed by ${printBy} — ${new Date().toLocaleString('en-PK')}</div>
    </div>
  `;
  openPrintWindow('Cash Handover Slip', html);
}

// Cashier Handover — Asset section (Reception items reference + petty cash)
// and Cash section (Total Cash from today's own cash slips, minus today's
// own pending Voucher Expense drafts = Net Cash) submitted together to
// whichever employee is receiving the shift. The Reception Assets list
// itself is managed on its own separate page (Clinic → Transactions →
// Reception Assets) — this page only ever reads/snapshots it.
export default function Handover() {
  const { user } = useAuthStore();
  const { fetchHandoverSummary, fetchHandoverStatusToday, createHandover, fetchHandovers } = useClinicStore();
  const { users, fetchUsers } = useUserManagementStore();

  const [activeTab, setActiveTab] = useState('new');
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [statusToday, setStatusToday] = useState(null);
  const [assetToUserId, setAssetToUserId] = useState('');
  const [cashToUserId, setCashToUserId] = useState('');
  // Per-item condition AT HANDOVER TIME (id -> condition) — defaults to
  // whatever the master Reception Assets list currently says, but the
  // cashier can override it right here (e.g. master list says "working"
  // but this particular computer stopped working since). Only affects
  // THIS handover's own snapshot (assetsJson) — never writes back to the
  // master list itself.
  const [assetConditions, setAssetConditions] = useState({});
  const [pettyCash, setPettyCash] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Physical note count (denomination -> qty), entered by the cashier at
  // handover time — printed on the slip, saved into the record, never
  // derived/auto-filled from netCash.
  const [denomQty, setDenomQty] = useState(() => Object.fromEntries(DENOMINATIONS.map((d) => [d, ''])));
  // Manual amount for anything not already tracked as a Voucher Expense
  // draft (the paper sheet's separate "Other Exp" line).
  const [otherExpense, setOtherExpense] = useState('');
  // Slip serial range — pre-filled from the auto-detected first/last cash
  // slip, but editable: the auto-detection can be wrong (e.g. a slip typed
  // in manually with an out-of-sequence serial), so the cashier can correct
  // it here before it goes on the printed/saved record.
  const [firstSlipSerial, setFirstSlipSerial] = useState('');
  const [lastSlipSerial, setLastSlipSerial] = useState('');

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadSummary = async () => {
    if (!user?.id) return;
    setLoadingSummary(true);
    try {
      const [data, status] = await Promise.all([
        fetchHandoverSummary(user.id),
        fetchHandoverStatusToday(user.id),
      ]);
      setSummary(data);
      setStatusToday(status);
      setAssetConditions(Object.fromEntries((data?.assets || []).map((a) => [a.id, a.condition])));
      setFirstSlipSerial(data?.firstSlipSerial || '');
      setLastSlipSerial(data?.lastSlipSerial || '');
    } catch (e) {
      toast.error(e.message || 'Handover summary load nahi hui');
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const rows = await fetchHandovers({ userId: user?.id });
      setHistory(rows || []);
    } catch {
      toast.error('History load nahi hui');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadSummary();
    fetchUsers();
    // eslint-disable-next-line
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
    // eslint-disable-next-line
  }, [activeTab]);

  const otherUsers = (users || []).filter((u) => u.id !== user?.id);

  const denominations = DENOMINATIONS.map((d) => ({ denomination: d, qty: Number(denomQty[d]) || 0, amount: (Number(denomQty[d]) || 0) * d }));
  const denomTotal = denominations.reduce((s, d) => s + d.amount, 0);
  const finalNetCash = (summary?.netCash ?? 0) - (Number(otherExpense) || 0);

  const handleSubmit = async (andPrint = false) => {
    if (!assetToUserId) return toast.error('Asset Handover kis employee ko de rahe hain, select karein');
    if (!cashToUserId) return toast.error('Cash Handover kis employee ko de rahe hain, select karein');
    const assetToUser = otherUsers.find((u) => u.id === assetToUserId);
    const cashToUser = otherUsers.find((u) => u.id === cashToUserId);
    setSubmitting(true);
    try {
      await createHandover({
        fromUserId: user.id,
        fromUserName: user.name || user.username || user.email || 'User',
        assetToUserId, assetToUserName: assetToUser?.name || '',
        cashToUserId, cashToUserName: cashToUser?.name || '',
        pettyCash: pettyCash !== '' ? Number(pettyCash) : null,
        assets: (summary?.assets || []).map((a) => ({ ...a, condition: assetConditions[a.id] ?? a.condition })),
        totalCash: summary?.totalCash ?? 0,
        draftPaymentsTotal: summary?.draftPaymentsTotal ?? 0,
        drafts: summary?.drafts || [],
        otherExpense: otherExpense !== '' ? Number(otherExpense) : null,
        denominations,
        slipCount: summary?.slipCount ?? 0,
        firstSlipSerial: firstSlipSerial || null,
        firstSlipTime: summary?.firstSlipTime ?? null,
        lastSlipSerial: lastSlipSerial || null,
        lastSlipTime: summary?.lastSlipTime ?? null,
        netCash: finalNetCash,
        notes: notes.trim() || null,
      });
      toast.success('Handover submit ho gaya');
      if (andPrint) {
        const printedByName = user.name || user.username || user.email || 'User';
        try {
          printAssetHandoverSlip({
            fromUserName: printedByName,
            assetToUserName: assetToUser?.name || '',
            businessDate: summary?.businessDate,
            pettyCash: pettyCash !== '' ? Number(pettyCash) : 0,
            assets: (summary?.assets || []).map((a) => ({ ...a, condition: assetConditions[a.id] ?? a.condition })),
            printBy: printedByName,
          });
        } catch {
          toast.error('Handover save ho gaya, lekin Asset Handover print popup block ho gaya — browser popup allow karein');
        }
        try {
          printCashHandoverSlip({
            fromUserName: printedByName,
            cashToUserName: cashToUser?.name || '',
            businessDate: summary?.businessDate,
            slipCount: summary?.slipCount ?? 0,
            firstSlipSerial,
            firstSlipTime: summary?.firstSlipTime,
            lastSlipSerial,
            lastSlipTime: summary?.lastSlipTime,
            totalCash: summary?.totalCash ?? 0,
            draftPaymentsTotal: summary?.draftPaymentsTotal ?? 0,
            drafts: summary?.drafts || [],
            otherExpense: Number(otherExpense) || 0,
            netCash: finalNetCash,
            denominations,
            printBy: printedByName,
          });
        } catch {
          toast.error('Handover save ho gaya, lekin Cash Handover print popup block ho gaya — browser popup allow karein');
        }
      }
      setAssetToUserId(''); setCashToUserId(''); setPettyCash(''); setNotes(''); setOtherExpense('');
      setDenomQty(Object.fromEntries(DENOMINATIONS.map((d) => [d, ''])));
      loadSummary();
      if (activeTab === 'history') loadHistory();
    } catch (e) {
      toast.error(e.message || 'Handover submit nahi hua');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ho-page">
      <ClinicMenuBar />
      <div className="ho-body">
        <PageHeader
          breadcrumbs={[
            { label: 'Clinic', link: '/clinic-module' },
            { label: 'Transactions' },
            { label: 'Handover' },
          ]}
          title="Cashier Handover"
        />

        <div className="ho-tabs">
          <button className={activeTab === 'new' ? 'active' : ''} onClick={() => setActiveTab('new')}>New Handover</button>
          <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>History</button>
        </div>

        {activeTab === 'new' && (
          loadingSummary ? <p className="ho-empty">Loading...</p> : (
            <>
              {statusToday && (
                <div className={`ho-status-banner ${statusToday.done ? 'done' : 'pending'}`}>
                  {statusToday.done
                    ? `Aaj (${statusToday.businessDate}) ka Handover already submit ho chuka hai — dobara submit karna zaroori nahi, lekin kar sakte hain.`
                    : `Aaj (${statusToday.businessDate}) ka Handover abhi submit nahi hua.`}
                </div>
              )}

              <div className="ho-grid">
                <div className="ho-card">
                  <h3>Asset Handover — Reception Items</h3>
                  <table className="ho-table">
                    <thead>
                      <tr><th>Item</th><th>Qty</th><th>Condition (abhi ke hisab se)</th></tr>
                    </thead>
                    <tbody>
                      {(summary?.assets || []).length === 0 ? (
                        <tr><td colSpan={3} className="ho-empty-row">Koi Reception item nahi mila — pehle "Reception Assets" mein add karein.</td></tr>
                      ) : summary.assets.map((a) => (
                        <tr key={a.id}>
                          <td>{a.name}</td>
                          <td>{a.quantity}</td>
                          <td>
                            <select
                              className="ho-condition-select"
                              value={assetConditions[a.id] ?? a.condition}
                              onChange={(e) => setAssetConditions((prev) => ({ ...prev, [a.id]: e.target.value }))}
                            >
                              {CONDITIONS.map((c) => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="ho-hint">Master list ka condition abhi bhi wahi rahega jab tak "Reception Assets" page se khud update na karein — yeh sirf is handover ke record mein save hoga.</p>
                  <div className="ho-field">
                    <label>Petty Cash (Rs)</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={pettyCash}
                      onChange={(e) => setPettyCash(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="ho-field">
                    <label>Asset Handover To</label>
                    <select value={assetToUserId} onChange={(e) => setAssetToUserId(e.target.value)}>
                      <option value="">— Select Employee —</option>
                      {otherUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}{u.role ? ` (${u.role})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="ho-card">
                  <h3>Cash Handover</h3>
                  <div className="ho-summary-row">
                    <span>Total Cash ({summary?.slipCount || 0} slip{summary?.slipCount === 1 ? '' : 's'})</span>
                    <span>Rs {fmt2(summary?.totalCash)}</span>
                  </div>
                  {(summary?.slipCount || 0) > 0 && (
                    <div className="ho-field ho-field--split">
                      <div>
                        <label>From Slip #</label>
                        <input type="text" value={firstSlipSerial} onChange={(e) => setFirstSlipSerial(e.target.value)} />
                      </div>
                      <div>
                        <label>To Slip #</label>
                        <input type="text" value={lastSlipSerial} onChange={(e) => setLastSlipSerial(e.target.value)} />
                      </div>
                    </div>
                  )}
                  <div className="ho-summary-row">
                    <span>Draft Payments (General Payment)</span>
                    <span>− Rs {fmt2(summary?.draftPaymentsTotal)}</span>
                  </div>
                  {(summary?.drafts || []).length > 0 && (
                    <ul className="ho-draft-list">
                      {summary.drafts.map((d) => (
                        <li key={d.id}>{d.payeeName || d.mainGlName || 'Payment'} — Rs {fmt2(d.amount)}</li>
                      ))}
                    </ul>
                  )}
                  <div className="ho-field">
                    <label>Other Expense (Rs) — kuch aur jo draft mein nahi hai</label>
                    <input
                      type="number" min="0" step="0.01"
                      value={otherExpense}
                      onChange={(e) => setOtherExpense(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="ho-summary-row ho-net">
                    <span>Net Cash to Head Cashier</span>
                    <span>Rs {fmt2(finalNetCash)}</span>
                  </div>
                  <div className="ho-field">
                    <label>Cash Handover To</label>
                    <select value={cashToUserId} onChange={(e) => setCashToUserId(e.target.value)}>
                      <option value="">— Select Employee —</option>
                      {otherUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}{u.role ? ` (${u.role})` : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="ho-card ho-card--full">
                  <h3>Cash Denomination Count</h3>
                  <table className="ho-table ho-denom-table">
                    <thead>
                      <tr><th>Note</th><th>Qty</th><th>Amount</th></tr>
                    </thead>
                    <tbody>
                      {DENOMINATIONS.map((d) => (
                        <tr key={d}>
                          <td>Rs {d}</td>
                          <td>
                            <input
                              type="number" min="0" step="1"
                              value={denomQty[d]}
                              onChange={(e) => setDenomQty((prev) => ({ ...prev, [d]: e.target.value }))}
                              placeholder="0"
                            />
                          </td>
                          <td>Rs {fmt2((Number(denomQty[d]) || 0) * d)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="ho-summary-row ho-net">
                    <span>Counted Total</span>
                    <span>Rs {fmt2(denomTotal)}</span>
                  </div>
                  {denomTotal !== finalNetCash && (denomQty[DENOMINATIONS[0]] !== '' || Object.values(denomQty).some((v) => v !== '')) && (
                    <p className="ho-hint">⚠️ Counted total Net Cash (Rs {fmt2(finalNetCash)}) se match nahi kar raha — dobara ginein.</p>
                  )}
                </div>

                <div className="ho-card ho-card--full">
                  <h3>Notes &amp; Submit</h3>
                  <div className="ho-field">
                    <label>Notes</label>
                    <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                  </div>
                  <div style={{ marginTop: '1rem' }}>
                    <Button label={submitting ? 'Submitting…' : 'Save'} onClick={() => handleSubmit(true)} loading={submitting} />
                  </div>
                </div>
              </div>
            </>
          )
        )}

        {activeTab === 'history' && (
          <div className="ho-table-wrap">
            {loadingHistory ? (
              <p className="ho-empty">Loading...</p>
            ) : history.length === 0 ? (
              <p className="ho-empty">Koi handover record nahi mila.</p>
            ) : (
              <table className="ho-table">
                <thead>
                  <tr>
                    <th>Date</th><th>From</th><th>Asset To</th><th>Cash To</th>
                    <th>Petty Cash</th><th>Total Cash</th><th>Draft Payments</th><th>Net Cash</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td>{h.businessDate}</td>
                      <td>{h.fromUserName}</td>
                      <td>{h.assetToUserName || '—'}</td>
                      <td>{h.cashToUserName || '—'}</td>
                      <td>{h.pettyCash != null ? fmt2(h.pettyCash) : '—'}</td>
                      <td>{h.totalCash != null ? fmt2(h.totalCash) : '—'}</td>
                      <td>{h.draftPaymentsTotal != null ? fmt2(h.draftPaymentsTotal) : '—'}</td>
                      <td>{h.netCash != null ? fmt2(h.netCash) : '—'}</td>
                      <td style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="ho-reprint-btn"
                          onClick={() => printAssetHandoverSlip({
                            fromUserName: h.fromUserName,
                            assetToUserName: h.assetToUserName,
                            businessDate: h.businessDate,
                            pettyCash: h.pettyCash ?? 0,
                            assets: h.assetsJson || [],
                            printBy: user.name || 'Cashier',
                          })}
                        >
                          Print Asset
                        </button>
                        <button
                          className="ho-reprint-btn"
                          onClick={() => printCashHandoverSlip({
                            fromUserName: h.fromUserName,
                            cashToUserName: h.cashToUserName,
                            businessDate: h.businessDate,
                            slipCount: h.slipCount ?? 0,
                            firstSlipSerial: h.firstSlipSerial,
                            firstSlipTime: h.firstSlipTime,
                            lastSlipSerial: h.lastSlipSerial,
                            lastSlipTime: h.lastSlipTime,
                            totalCash: h.totalCash ?? 0,
                            draftPaymentsTotal: h.draftPaymentsTotal ?? 0,
                            drafts: h.draftsJson || [],
                            otherExpense: h.otherExpense ?? 0,
                            netCash: h.netCash ?? 0,
                            denominations: h.denominationsJson || [],
                            printBy: user.name || 'Cashier',
                          })}
                        >
                          Print Cash
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
