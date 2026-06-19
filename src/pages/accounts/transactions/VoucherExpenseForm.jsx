import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import toast from 'react-hot-toast';
import './VoucherExpenseForm.scss';

const API = 'http://localhost:5001/api/accounts';

const todayStr = () => new Date().toISOString().slice(0, 10);

const emptyEntry = () => ({
  mainGlId: '', subGlId: '', mainAccountId: '', subAccountId: '',
  accountCode: '', accountName: '',
  payeeName: '', amount: '',
  chequeNo: '', chequeDate: todayStr(), chequeType: 'bearer',
  particulars: '',
});

export default function VoucherExpenseForm() {
  const { entityType } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const { mainGLs, fetchMainGLs } = useAccountsStore();

  const mode = state?.mode || 'cash';
  const bankId = state?.bankId || null;
  const isCheque = mode === 'cheque';
  const isBank = mode !== 'cash';

  const [date, setDate] = useState(todayStr());
  const [entry, setEntry] = useState(emptyEntry());
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState(false);

  const [subGLs, setSubGLs] = useState([]);
  const [mainAccs, setMainAccs] = useState([]);
  const [subAccs, setSubAccs] = useState([]);
  const [linkedPayees, setLinkedPayees] = useState([]);
  const [linkedHeadName, setLinkedHeadName] = useState('');
  const [linkedHeadType, setLinkedHeadType] = useState('');
  const [payeeSearch, setPayeeSearch] = useState('');
  const [salaryModal, setSalaryModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchMainGLs(entityType);
  }, [entityType]);

  const handleMainGlChange = async (v) => {
    setEntry((e) => ({ ...e, mainGlId: v, subGlId: '', mainAccountId: '', subAccountId: '', accountCode: '', accountName: '' }));
    setSubGLs([]); setMainAccs([]); setSubAccs([]);
    if (!v) return;
    const r = await fetch(`${API}/sub-gl?entityType=${entityType}&mainGlId=${v}`);
    const j = await r.json();
    setSubGLs(Array.isArray(j?.data) ? j.data : []);
  };

  const handleSubGlChange = async (v) => {
    setEntry((e) => ({ ...e, subGlId: v, mainAccountId: '', subAccountId: '', accountCode: '', accountName: '' }));
    setMainAccs([]); setSubAccs([]);
    if (!v) return;
    const r = await fetch(`${API}/main-account?entityType=${entityType}&subGlId=${v}`);
    const j = await r.json();
    setMainAccs(Array.isArray(j?.data) ? j.data : []);
  };

  const handleMainAccChange = async (v) => {
    setMainAccs((prev) => prev);
    setSubAccs([]);
    if (!v) { setEntry((e) => ({ ...e, mainAccountId: '', subAccountId: '', accountCode: '', accountName: '' })); return; }
    const acc = mainAccs.find((a) => String(a.id) === v);
    setEntry((e) => ({ ...e, mainAccountId: v, subAccountId: '', accountCode: acc?.code || '', accountName: acc?.name || '' }));
    const r = await fetch(`${API}/sub-account?entityType=${entityType}&mainAccountId=${v}`);
    const j = await r.json();
    setSubAccs(Array.isArray(j?.data) ? j.data : []);
  };

  const handleSubAccChange = async (v) => {
    const sub = subAccs.find((s) => String(s.id) === v);
    setEntry((e) => ({
      ...e,
      subAccountId: v,
      accountCode: sub?.code || e.accountCode,
      accountName: sub?.name || e.accountName,
      payeeName: '',
    }));
    setLinkedPayees([]);
    setLinkedHeadName('');
    setLinkedHeadType('');
    setPayeeSearch('');
    if (!v) return;
    const r = await fetch(`${API}/payee-entries/by-sub-account?subAccountId=${v}&entityType=${entityType}`);
    const j = await r.json();
    if (j?.data) {
      setLinkedPayees(j.data.entries || []);
      setLinkedHeadName(j.data.headName || '');
      setLinkedHeadType(j.data.type || '');
    }
  };

  const prevMonthInfo = () => {
    const now = new Date();
    const m = now.getMonth(); // 0-indexed; June=5 → prev=4=May(1-indexed=5)
    const month = String(m === 0 ? 12 : m).padStart(2, '0');
    const year  = String(m === 0 ? now.getFullYear() - 1 : now.getFullYear());
    const monthName = new Date(Number(year), Number(month) - 1, 1)
      .toLocaleString('default', { month: 'long' });
    return { month, year, monthName };
  };

  const calcSalary = (rows) => {
    if (!rows?.length) return { gross: 0, ded: 0, net: 0 };
    const toN = (v) => Math.max(0, Math.round(Number(v) || 0));
    const live = rows.filter((r) => r.status !== 'Future');
    return {
      gross: live.reduce((s, r) => s + toN(r.salary), 0),
      ded:   live.reduce((s, r) => s + toN(r.ded),    0),
      net:   live.reduce((s, r) => s + toN(r.total),  0),
    };
  };

  const openSalaryModal = async (payee) => {
    setEntry((f) => ({ ...f, payeeName: payee.name }));
    setPayeeSearch(payee.name);
    const { month, year, monthName } = prevMonthInfo();
    setSalaryModal({ empName: payee.name, empCode: payee.code, month, year, monthName, rows: null, savedAt: null });
    setModalLoading(true);
    try {
      const r = await fetch(
        `http://localhost:5001/api/payslip-snapshot?empCode=${encodeURIComponent(payee.code)}&month=${month}&year=${year}`
      );
      const j = await r.json();
      setSalaryModal((prev) => ({ ...prev, rows: j?.data?.rows || null, netSalary: j?.data?.netSalary ?? null, savedAt: j?.data?.savedAt || null }));
    } catch {
      setSalaryModal((prev) => ({ ...prev, rows: null }));
    } finally {
      setModalLoading(false);
    }
  };

  const upd = (field) => (ev) => setEntry((e) => ({ ...e, [field]: ev.target.value }));

  const handleAddEntry = () => {
    if (!entry.mainGlId) { toast.error('Select Main GL'); return; }
    if (!entry.subGlId) { toast.error('Select Sub GL'); return; }
    if (!entry.mainAccountId) { toast.error('Select Main Account'); return; }
    if (!entry.amount || Number(entry.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (isCheque && !entry.chequeNo.trim()) { toast.error('Enter cheque number'); return; }
    setEntries((es) => [...es, { ...entry }]);
    setEntry(emptyEntry());
    setSubGLs([]); setMainAccs([]); setSubAccs([]);
  };

  const total = entries.reduce((s, e) => s + Number(e.amount), 0);

  const handleConfirm = async () => {
    if (entries.length === 0) { toast.error('Add at least one entry'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/voucher-expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, mode, bankId, voucherDate: date, entries }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'Failed to save');
      toast.success(`Voucher ${json.data.voucherNo} saved`);
      navigate(`/accounts/${entityType}/transactions`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const modeLabel = mode === 'cheque' ? 'Expense by Cheque' : mode === 'online' ? 'Expense Online' : 'Expense by Cash';

  return (
    <div className="ve-form">
      <div className="ve-form__header">
        <button className="ve-form__back" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h2>Voucher Entry — Expense</h2>
          <p>{modeLabel}</p>
        </div>
      </div>

      <div className="ve-form__card">
        {/* Meta row */}
        <div className="ve-form__meta-row">
          <div className="ve-form__meta-field">
            <label>Voucher Type</label>
            <input value={isBank ? 'BANK' : 'CASH'} readOnly className="ve-form__readonly" />
          </div>
          <div className="ve-form__meta-field">
            <label>Voucher Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="ve-form__section-title">ENTRY DETAILS</div>

        {/* GL cascade */}
        <div className="ve-form__grid-4">
          <div className="ve-form__field">
            <label>Main GL</label>
            <select value={entry.mainGlId} onChange={(e) => handleMainGlChange(e.target.value)}>
              <option value="">Select Main GL</option>
              {mainGLs.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
            </select>
          </div>
          <div className="ve-form__field">
            <label>Sub GL</label>
            <select value={entry.subGlId} onChange={(e) => handleSubGlChange(e.target.value)} disabled={!entry.mainGlId}>
              <option value="">Select Sub GL</option>
              {subGLs.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
            </select>
          </div>
          <div className="ve-form__field">
            <label>Main Account</label>
            <select value={entry.mainAccountId} onChange={(e) => handleMainAccChange(e.target.value)} disabled={!entry.subGlId}>
              <option value="">Select Main Account</option>
              {mainAccs.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div className="ve-form__field">
            <label>Sub Account <span className="ve-form__optional">(optional)</span></label>
            <select value={entry.subAccountId} onChange={(e) => handleSubAccChange(e.target.value)} disabled={!entry.mainAccountId || subAccs.length === 0}>
              <option value="">None</option>
              {subAccs.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
        </div>

        {/* Payee + Amount + Particulars */}
        <div className="ve-form__grid-3">
          <div className="ve-form__field">
            <label>
              Payee
              {linkedHeadName && <span className="ve-form__head-tag">{linkedHeadName}</span>}
              {!entry.subAccountId && <span className="ve-form__optional"> (select Sub Account first)</span>}
            </label>
            {linkedPayees.length > 0 ? (
              <div className="ve-form__payee-picker">
                <input
                  className="ve-form__payee-search"
                  placeholder="Search by name or code…"
                  value={payeeSearch}
                  onChange={(e) => { setPayeeSearch(e.target.value); setEntry((f) => ({ ...f, payeeName: '' })); }}
                />
                {(payeeSearch || !entry.payeeName) && (
                  <div className="ve-form__payee-list">
                    {linkedPayees
                      .filter((p) => {
                        const q = payeeSearch.toLowerCase();
                        return p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
                      })
                      .slice(0, 8)
                      .map((p) => (
                        <div
                          key={p.id}
                          className={`ve-form__payee-item ${entry.payeeName === p.name ? 'active' : ''}`}
                          onClick={() => linkedHeadType === 'employee' ? openSalaryModal(p) : (setEntry((f) => ({ ...f, payeeName: p.name })), setPayeeSearch(p.name))}
                        >
                          {p.code && <span className="ve-form__payee-code">{p.code}</span>}
                          <span>{p.name}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              <input
                value={entry.payeeName}
                onChange={upd('payeeName')}
                placeholder={entry.subAccountId ? 'No list linked — type manually' : 'Select Sub Account first'}
                disabled={!entry.subAccountId}
              />
            )}
          </div>
          <div className="ve-form__field">
            <label>Amount</label>
            <input type="number" min="0" step="0.01" value={entry.amount} onChange={upd('amount')} placeholder="0.00" />
          </div>
          <div className="ve-form__field">
            <label>Particulars <span className="ve-form__optional">(optional)</span></label>
            <input value={entry.particulars} onChange={upd('particulars')} placeholder="Description..." />
          </div>
        </div>

        {/* Cheque fields */}
        {isCheque && (
          <div className="ve-form__grid-3">
            <div className="ve-form__field">
              <label>Cheque #</label>
              <input value={entry.chequeNo} onChange={upd('chequeNo')} placeholder="e.g. 26848" />
            </div>
            <div className="ve-form__field">
              <label>Cheque Date</label>
              <input type="date" value={entry.chequeDate} onChange={upd('chequeDate')} />
            </div>
            <div className="ve-form__field">
              <label>Cheque Type</label>
              <select value={entry.chequeType} onChange={upd('chequeType')}>
                <option value="bearer">Bearer</option>
                <option value="order">Order</option>
              </select>
            </div>
          </div>
        )}

        <div className="ve-form__add-row">
          <button className="ve-form__add-btn" onClick={handleAddEntry}>
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        </div>

        {/* Entries table */}
        {entries.length > 0 && (
          <div className="ve-form__table-wrap">
            <table className="ve-form__table">
              <thead>
                <tr>
                  <th>Account Code</th>
                  <th>Account</th>
                  <th>Payee</th>
                  <th>Amount</th>
                  <th>Particulars</th>
                  {isCheque && <><th>Cheque #</th><th>Cheque Date</th><th>Type</th></>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i}>
                    <td className="ve-form__td-code">{e.accountCode}</td>
                    <td>{e.accountName}</td>
                    <td>{e.payeeName || '—'}</td>
                    <td className="ve-form__td-amount">{Number(e.amount).toLocaleString()}</td>
                    <td>{e.particulars || '—'}</td>
                    {isCheque && (
                      <>
                        <td>{e.chequeNo}</td>
                        <td>{e.chequeDate}</td>
                        <td className="ve-form__td-cap">{e.chequeType}</td>
                      </>
                    )}
                    <td>
                      <button className="ve-form__del-btn" onClick={() => setEntries((es) => es.filter((_, idx) => idx !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={isCheque ? 3 : 3} className="ve-form__total-label">TOTAL</td>
                  <td className="ve-form__total-amount">{total.toLocaleString()}</td>
                  <td colSpan={isCheque ? 5 : 2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="ve-form__confirm-row">
          <button
            className="ve-form__confirm-btn"
            onClick={handleConfirm}
            disabled={saving || entries.length === 0}
          >
            {saving ? 'Saving…' : 'Confirm Voucher'}
          </button>
        </div>
      </div>
      {salaryModal && (
        <div className="ve-sal-modal__backdrop" onClick={() => setSalaryModal(null)}>
          <div className="ve-sal-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ve-sal-modal__header">
              <div>
                <div className="ve-sal-modal__title">Salary Verification</div>
                <div className="ve-sal-modal__sub">{salaryModal.empName} · {salaryModal.empCode}</div>
              </div>
              <button className="ve-sal-modal__close" onClick={() => setSalaryModal(null)}>✕</button>
            </div>

            <div className="ve-sal-modal__month-badge">
              {salaryModal.monthName} {salaryModal.year}
            </div>

            {modalLoading ? (
              <div className="ve-sal-modal__loading">Loading payslip…</div>
            ) : salaryModal.rows ? (
              <>
                {salaryModal.savedAt && (
                  <div className="ve-sal-modal__saved-at">
                    Saved: {new Date(salaryModal.savedAt).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}
                <div className="ve-sal-modal__rows">
                  <div className="ve-sal-modal__row ve-sal-modal__row--net">
                    <span>Net Payable</span>
                    <span>PKR {(salaryModal.netSalary ?? 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="ve-sal-modal__footer">
                  <button className="ve-sal-modal__cancel" onClick={() => setSalaryModal(null)}>Cancel</button>
                  <button
                    className="ve-sal-modal__verify"
                    onClick={() => { setEntry((f) => ({ ...f, amount: String(Math.round(salaryModal.netSalary ?? 0)) })); setSalaryModal(null); }}
                  >
                    Verify &amp; Fill Amount
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="ve-sal-modal__no-data">
                  No payslip snapshot found for {salaryModal.monthName} {salaryModal.year}.<br />
                  Please save the payslip from Reports first, or enter amount manually.
                </div>
                <div className="ve-sal-modal__footer">
                  <button className="ve-sal-modal__cancel" onClick={() => setSalaryModal(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
