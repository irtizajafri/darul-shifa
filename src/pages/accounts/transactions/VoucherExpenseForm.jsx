import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChevronRight } from 'lucide-react';
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

  const mode   = state?.mode   || 'cash';
  const bankId = state?.bankId || null;
  const isCheque = mode === 'cheque';
  const isBank   = mode !== 'cash';

  const [date, setDate]       = useState(todayStr());
  const [entry, setEntry]     = useState(emptyEntry());
  const [entries, setEntries] = useState([]);
  const [saving, setSaving]             = useState(false);
  const [voucherNo, setVoucherNo]       = useState('');
  const [savedVoucherNo, setSavedVoucherNo] = useState(null);

  const [subGLs, setSubGLs]             = useState([]);
  const [mainAccs, setMainAccs]         = useState([]);
  const [subAccs, setSubAccs]           = useState([]);
  const [linkedPayees, setLinkedPayees] = useState([]);
  const [linkedHeadName, setLinkedHeadName] = useState('');
  const [linkedHeadType, setLinkedHeadType] = useState('');
  const [payeeSearch, setPayeeSearch]   = useState('');
  const [salaryModal, setSalaryModal]   = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [grnModal, setGrnModal]         = useState(null);
  const [grnLoading, setGrnLoading]     = useState(false);
  const [checkedGrns, setCheckedGrns]   = useState({});

  const [bankAccounts, setBankAccounts]   = useState([]);
  const [selectedBankId, setSelectedBankId] = useState(bankId ? String(bankId) : '');
  const [cashSerial, setCashSerial]       = useState(1);

  useEffect(() => { fetchMainGLs(entityType); }, [entityType]);

  useEffect(() => {
    if (!isBank) return;
    fetch(`${API}/bank-accounts?entityType=${entityType}`)
      .then((r) => r.json())
      .then((j) => setBankAccounts(Array.isArray(j?.data) ? j.data : []));
  }, [entityType, isBank]);

  const fetchNextVoucherNo = async (d) => {
    try {
      const r = await fetch(`${API}/next-voucher-no?type=expense&entityType=${entityType}&date=${d}`);
      const j = await r.json();
      if (j?.data?.voucherNo) setVoucherNo(j.data.voucherNo);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchNextVoucherNo(date); }, [date, entityType]);

  const handleBankSelect = (id) => {
    setSelectedBankId(id);
    setEntry((e) => ({ ...e, chequeNo: '' }));
  };

  useEffect(() => {
    if (!selectedBankId || !isBank) return;
    fetch(`${API}/cheque-serials/next?bankAccountId=${selectedBankId}`)
      .then((r) => r.json())
      .then((j) => { if (j?.data?.nextSerial) setEntry((e) => ({ ...e, chequeNo: j.data.nextSerial })); });
  }, [selectedBankId]);

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
    const m = now.getMonth();
    const month = String(m === 0 ? 12 : m).padStart(2, '0');
    const year  = String(m === 0 ? now.getFullYear() - 1 : now.getFullYear());
    const monthName = new Date(Number(year), Number(month) - 1, 1)
      .toLocaleString('default', { month: 'long' });
    return { month, year, monthName };
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

  const openGrnModal = async (payee) => {
    setEntry((f) => ({ ...f, payeeName: payee.name }));
    setPayeeSearch(payee.name);
    setCheckedGrns({});
    setGrnModal({ supplierName: payee.name, grns: null });
    setGrnLoading(true);
    try {
      const r = await fetch(`${API}/supplier-grns?supplierId=${payee.id}`);
      const j = await r.json();
      setGrnModal((prev) => ({ ...prev, grns: j?.data || [] }));
    } catch {
      setGrnModal((prev) => ({ ...prev, grns: [] }));
    } finally {
      setGrnLoading(false);
    }
  };

  const grnCheckedTotal = grnModal?.grns
    ? grnModal.grns.filter((g) => checkedGrns[g.id]).reduce((s, g) => s + Number(g.totalAmount), 0)
    : 0;

  const upd = (field) => (ev) => setEntry((e) => ({ ...e, [field]: ev.target.value }));

  const handleAddEntry = () => {
    if (!entry.mainGlId)      { toast.error('Select Main GL'); return; }
    if (!entry.subGlId)       { toast.error('Select Sub GL'); return; }
    if (!entry.mainAccountId) { toast.error('Select Main Account'); return; }
    if (!entry.amount || Number(entry.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (isCheque && !entry.chequeNo.trim()) { toast.error('Enter cheque number'); return; }

    const serial = mode === 'cash'
      ? String(cashSerial).padStart(2, '0')
      : entry.chequeNo;

    setEntries((es) => [...es, { ...entry, chequeNo: serial }]);
    if (mode === 'cash') setCashSerial((s) => s + 1);

    setEntry(emptyEntry());
    if (isBank && selectedBankId) {
      fetch(`${API}/cheque-serials/next?bankAccountId=${selectedBankId}`)
        .then((r) => r.json())
        .then((j) => { if (j?.data?.nextSerial) setEntry((e) => ({ ...e, chequeNo: j.data.nextSerial })); });
    }
    setSubGLs([]); setMainAccs([]); setSubAccs([]);
    setLinkedPayees([]); setLinkedHeadName(''); setLinkedHeadType(''); setPayeeSearch('');
  };

  const total = entries.reduce((s, e) => s + Number(e.amount), 0);

  const handleConfirm = async () => {
    if (entries.length === 0) { toast.error('Add at least one entry'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/voucher-expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, mode, bankId: selectedBankId ? Number(selectedBankId) : null, voucherDate: date, entries }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'Failed to save');
      setSavedVoucherNo(json.data.voucherNo);
      toast.success(`Voucher ${json.data.voucherNo} saved`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const detailTitle = isCheque ? 'Cheque Details' : mode === 'online' ? 'Transfer Details' : 'Cash Details';

  return (
    <div className="ve-form">

      {/* ── Breadcrumb ── */}
      <div className="ve-form__breadcrumb">
        <button className="ve-form__back" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Back
        </button>
        <ChevronRight size={13} className="ve-form__bc-sep" />
        <span>Accounting</span>
        <ChevronRight size={13} className="ve-form__bc-sep" />
        <span>Transaction</span>
        <ChevronRight size={13} className="ve-form__bc-sep" />
        <span className="ve-form__bc-active">Voucher Entry (Expense)</span>
      </div>

      {/* ── Section 1: Voucher Details ── */}
      <div className="ve-form__section">
        <div className="ve-form__section-head">Voucher Details</div>
        <div className="ve-form__section-body">
          <div className="ve-form__row-3">
            <div className="ve-form__field">
              <label>Voucher Type</label>
              <input value={isBank ? 'BANK' : 'CASH'} readOnly className="ve-form__readonly" />
            </div>
            <div className="ve-form__field">
              <label>Voucher Number</label>
              <input value={savedVoucherNo || voucherNo || '…'} readOnly className={`ve-form__readonly${savedVoucherNo ? ' ve-form__readonly--saved' : ''}`} />
            </div>
            <div className="ve-form__field">
              <label>Voucher Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Account Allocation ── */}
      <div className="ve-form__section">
        <div className="ve-form__section-head">Account Allocation</div>
        <div className="ve-form__alloc-list">
          <div className="ve-form__alloc-row">
            <span className="ve-form__alloc-label">Main GL</span>
            <span className="ve-form__alloc-sep">:</span>
            <select
              className="ve-form__alloc-input"
              value={entry.mainGlId}
              onChange={(e) => handleMainGlChange(e.target.value)}
            >
              <option value="">— Select Main GL —</option>
              {mainGLs.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
            </select>
          </div>

          <div className="ve-form__alloc-row">
            <span className="ve-form__alloc-label">SUB GL</span>
            <span className="ve-form__alloc-sep">:</span>
            <select
              className="ve-form__alloc-input"
              value={entry.subGlId}
              onChange={(e) => handleSubGlChange(e.target.value)}
              disabled={!entry.mainGlId}
            >
              <option value="">— Select SUB GL —</option>
              {subGLs.map((g) => <option key={g.id} value={g.id}>{g.code} — {g.name}</option>)}
            </select>
          </div>

          <div className="ve-form__alloc-row">
            <span className="ve-form__alloc-label">Main Account</span>
            <span className="ve-form__alloc-sep">:</span>
            <select
              className="ve-form__alloc-input"
              value={entry.mainAccountId}
              onChange={(e) => handleMainAccChange(e.target.value)}
              disabled={!entry.subGlId}
            >
              <option value="">— Select Main Account —</option>
              {mainAccs.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>

          <div className="ve-form__alloc-row">
            <span className="ve-form__alloc-label">SUB Account</span>
            <span className="ve-form__alloc-sep">:</span>
            <select
              className="ve-form__alloc-input"
              value={entry.subAccountId}
              onChange={(e) => handleSubAccChange(e.target.value)}
              disabled={!entry.mainAccountId || subAccs.length === 0}
            >
              <option value="">None</option>
              {subAccs.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Section 3: Cheque Details + Particulars ── */}
      <div className="ve-form__dual-panels">

        {/* Left: payment details */}
        <div className="ve-form__section ve-form__section--grow">
          <div className="ve-form__section-head">{detailTitle}</div>
          <div className="ve-form__section-body">

            {/* Bank selection (online / cheque) */}
            {isBank && (
              <div className="ve-form__field" style={{ marginBottom: '0.85rem' }}>
                <label>Bank Account</label>
                <select value={selectedBankId} onChange={(e) => handleBankSelect(e.target.value)}>
                  <option value="">— Select Bank —</option>
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>{b.bankName} — {b.accountNumber}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Cash serial display */}
            {!isBank && (
              <div className="ve-form__field" style={{ marginBottom: '0.85rem' }}>
                <label>Cash Serial #</label>
                <input value={String(cashSerial).padStart(2, '0')} readOnly className="ve-form__readonly" />
              </div>
            )}

            {/* Payee + Amount */}
            <div className="ve-form__row-2">
              <div className="ve-form__field">
                <label>
                  Payee
                  {linkedHeadName && <span className="ve-form__head-tag">{linkedHeadName}</span>}
                  {!entry.subAccountId && subAccs.length > 0 && (
                    <span className="ve-form__optional"> (select Sub Account first)</span>
                  )}
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
                              onClick={() => {
                                if (linkedHeadType === 'employee') openSalaryModal(p);
                                else if (linkedHeadType === 'vendor') openGrnModal(p);
                                else { setEntry((f) => ({ ...f, payeeName: p.name })); setPayeeSearch(p.name); }
                              }}
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
                <input
                  type="number" min="0" step="0.01"
                  value={entry.amount}
                  onChange={upd('amount')}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Cheque / Transfer fields */}
            {isBank && (
              <div className="ve-form__row-3">
                <div className="ve-form__field">
                  <label>{isCheque ? 'Cheque #' : 'Reference #'}</label>
                  <input value={entry.chequeNo} onChange={upd('chequeNo')} placeholder={isCheque ? 'e.g. 26848' : 'Transfer ref'} />
                </div>
                <div className="ve-form__field">
                  <label>{isCheque ? 'Cheque Date' : 'Transfer Date'}</label>
                  <input type="date" value={entry.chequeDate} onChange={upd('chequeDate')} />
                </div>
                {isCheque && (
                  <div className="ve-form__field">
                    <label>Cheque Type</label>
                    <select value={entry.chequeType} onChange={upd('chequeType')}>
                      <option value="bearer">Bearer</option>
                      <option value="order">Order</option>
                    </select>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Right: Particulars */}
        <div className="ve-form__section ve-form__section--particulars">
          <div className="ve-form__section-head">Particulars</div>
          <textarea
            className="ve-form__particulars-area"
            value={entry.particulars}
            onChange={upd('particulars')}
            placeholder="Enter description..."
          />
        </div>

      </div>

      {/* ── Action Row ── */}
      <div className="ve-form__action-row">
        {savedVoucherNo ? (
          <div className="ve-form__saved-strip">
            <span className="ve-form__saved-no">✓ Voucher <strong>{savedVoucherNo}</strong> saved</span>
            <button className="ve-form__submit-btn" onClick={() => navigate(`/accounts/${entityType}/transactions`)}>
              Done
            </button>
            <button className="ve-form__add-btn" onClick={() => { setSavedVoucherNo(null); setEntries([]); setEntry(emptyEntry()); }}>
              New Voucher
            </button>
          </div>
        ) : (
          <>
            <button
              className="ve-form__submit-btn"
              onClick={handleConfirm}
              disabled={saving || entries.length === 0}
            >
              {saving ? 'Saving…' : 'Save & Print'}
            </button>
            <button className="ve-form__add-btn" onClick={handleAddEntry}>
              <Plus size={15} /> Confirm
            </button>
          </>
        )}
      </div>

      {/* ── Entries Table ── */}
      {entries.length > 0 && (
        <div className="ve-form__table-wrap">
          <table className="ve-form__table">
            <thead>
              <tr>
                <th>Account Code</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Particulars</th>
                <th>{mode === 'cash' ? 'Cash Serial' : isCheque ? 'Cheque #' : 'Ref #'}</th>
                {isCheque && <th>Cheque Type</th>}
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td className="ve-form__td-code">{e.accountCode}</td>
                  <td>{e.accountName}</td>
                  <td className="ve-form__td-amount">{Number(e.amount).toLocaleString()}</td>
                  <td>{e.particulars || '—'}</td>
                  <td>{e.chequeNo || '—'}</td>
                  {isCheque && <td className="ve-form__td-cap">{e.chequeType}</td>}
                  <td><span className="ve-form__status-badge">Confirm</span></td>
                  <td>
                    <button
                      className="ve-form__del-btn"
                      onClick={() => setEntries((es) => es.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2} className="ve-form__total-label">TOTAL</td>
                <td className="ve-form__total-amount">{total.toLocaleString()}</td>
                <td colSpan={isCheque ? 5 : 4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── GRN Modal ── */}
      {grnModal && (
        <div className="ve-sal-modal__backdrop" onClick={() => setGrnModal(null)}>
          <div className="ve-grn-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ve-sal-modal__header">
              <div>
                <div className="ve-sal-modal__title">GRN Transactions</div>
                <div className="ve-sal-modal__sub">{grnModal.supplierName}</div>
              </div>
              <button className="ve-sal-modal__close" onClick={() => setGrnModal(null)}>✕</button>
            </div>

            {grnLoading ? (
              <div className="ve-sal-modal__loading">Loading transactions…</div>
            ) : !grnModal.grns?.length ? (
              <div className="ve-sal-modal__no-data">No GRN transactions found for this supplier.</div>
            ) : (
              <>
                <div className="ve-grn-modal__table-wrap">
                  <table className="ve-grn-modal__table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              const all = {};
                              if (e.target.checked) grnModal.grns.forEach((g) => { all[g.id] = true; });
                              setCheckedGrns(all);
                            }}
                            checked={grnModal.grns.length > 0 && grnModal.grns.every((g) => checkedGrns[g.id])}
                          />
                        </th>
                        <th>GRN #</th>
                        <th>Item</th>
                        <th>Date</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grnModal.grns.map((g) => (
                        <tr
                          key={g.id}
                          className={checkedGrns[g.id] ? 've-grn-modal__row--checked' : ''}
                          onClick={() => setCheckedGrns((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
                        >
                          <td><input type="checkbox" checked={!!checkedGrns[g.id]} onChange={() => {}} /></td>
                          <td className="ve-grn-modal__code">{g.code}</td>
                          <td>{g.item?.name || '—'}</td>
                          <td>{new Date(g.receivedDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td className="ve-grn-modal__amount">PKR {Number(g.totalAmount).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ve-grn-modal__footer">
                  <div className="ve-grn-modal__total">
                    <span>Selected Total</span>
                    <span className="ve-grn-modal__total-val">PKR {grnCheckedTotal.toLocaleString()}</span>
                  </div>
                  <div className="ve-grn-modal__actions">
                    <button className="ve-sal-modal__cancel" onClick={() => setGrnModal(null)}>Cancel</button>
                    <button
                      className="ve-sal-modal__verify"
                      disabled={grnCheckedTotal === 0}
                      onClick={() => { setEntry((f) => ({ ...f, amount: String(Math.round(grnCheckedTotal)) })); setGrnModal(null); }}
                    >
                      Fill Amount
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Salary Modal ── */}
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
