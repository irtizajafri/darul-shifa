import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChevronRight, Pencil } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import toast from 'react-hot-toast';
import './VoucherExpenseForm.scss';

const API = 'http://localhost:5001/api/accounts';

const todayStr = () => new Date().toISOString().slice(0, 10);

const emptyEntry = () => ({
  incomeCategoryId:   '',
  incomeCategoryName: '',
  payeeName:  '',
  amount:     '',
  particulars:'',
});

export default function VoucherIncomeForm() {
  const { entityType } = useParams();
  const { state }      = useLocation();
  const navigate       = useNavigate();
  const { incomeCategories, fetchIncomeCategories } = useAccountsStore();

  const editingVoucher = state?.editVoucher || null;
  const isEditMode = Boolean(editingVoucher);

  const mode   = state?.mode   || 'cash';
  const bankId = state?.bankId || null;
  const isBank = mode === 'bank';

  const [date, setDate]       = useState(() => editingVoucher ? editingVoucher.voucherDate.slice(0, 10) : todayStr());
  const [entry, setEntry]     = useState(emptyEntry());
  const [entries, setEntries] = useState(() => editingVoucher ? editingVoucher.entries.map((e) => ({ ...e })) : []);
  const [saving, setSaving]                 = useState(false);
  const [voucherNo, setVoucherNo]           = useState(editingVoucher?.voucherNo || '');
  const [savedVoucherNo, setSavedVoucherNo] = useState(null);

  useEffect(() => { fetchIncomeCategories(entityType); }, [entityType]);

  const fetchNextVoucherNo = async (d) => {
    try {
      const r = await fetch(`${API}/next-voucher-no?type=income&entityType=${entityType}&date=${d}`);
      const j = await r.json();
      if (j?.data?.voucherNo) setVoucherNo(j.data.voucherNo);
    } catch { /* ignore */ }
  };

  // Editing an existing voucher keeps its original number — never reassign it.
  useEffect(() => { if (!isEditMode) fetchNextVoucherNo(date); }, [date, entityType]);

  const upd = (field) => (ev) => setEntry((e) => ({ ...e, [field]: ev.target.value }));

  const handleCategoryChange = (v) => {
    const cat = incomeCategories.find((c) => String(c.id) === v);
    setEntry((e) => ({ ...e, incomeCategoryId: v, incomeCategoryName: cat?.name || '' }));
  };

  const handleAddEntry = () => {
    if (!entry.incomeCategoryId) { toast.error('Select an Account (Income Category)'); return; }
    if (!entry.amount || Number(entry.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setEntries((es) => [...es, { ...entry }]);
    setEntry(emptyEntry());
  };

  // Entries already added have no inline-edit — load one back into the draft
  // form and remove it from the list; the user corrects it and hits Confirm
  // to re-add, same as adding any other entry.
  const handleEditEntry = (idx) => {
    setEntry({ ...entries[idx] });
    setEntries((es) => es.filter((_, i) => i !== idx));
  };

  const total = entries.reduce((s, e) => s + Number(e.amount), 0);

  const handleConfirm = async () => {
    if (entries.length === 0) { toast.error('Add at least one entry'); return; }
    setSaving(true);
    try {
      const url    = isEditMode ? `${API}/voucher-income/${editingVoucher.id}` : `${API}/voucher-income`;
      const method = isEditMode ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, mode, bankId, voucherDate: date, entries }),
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) throw new Error(json?.message || 'Failed to save');
      const savedNo = json.data?.voucherNo || '';
      setSavedVoucherNo(savedNo);
      toast.success(isEditMode ? `Voucher ${savedNo} updated` : `Voucher ${savedNo} saved`);
      if (isEditMode) navigate(-1);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const modeLabel = mode === 'bank' ? 'Bank Receipt' : mode === 'card' ? 'Credit Card Receipt' : 'Cash Receipt';
  const voucherType = isBank ? 'BANK' : mode === 'card' ? 'CARD' : 'CASH';

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
        <span className="ve-form__bc-active">{isEditMode ? `Edit Voucher (${editingVoucher.voucherNo})` : 'Voucher Entry (Income)'}</span>
      </div>

      {/* ── Section 1: Voucher Details ── */}
      <div className="ve-form__section">
        <div className="ve-form__section-head">Voucher Details</div>
        <div className="ve-form__section-body">
          <div className="ve-form__row-3">
            <div className="ve-form__field">
              <label>Voucher Type</label>
              <input value={voucherType} readOnly className="ve-form__readonly" />
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

      {/* ── Section 2: Account (Income Category) ── */}
      <div className="ve-form__section">
        <div className="ve-form__section-head">Account Allocation</div>
        <div className="ve-form__alloc-list">
          <div className="ve-form__alloc-row">
            <span className="ve-form__alloc-label">Account</span>
            <span className="ve-form__alloc-sep">:</span>
            <select
              className="ve-form__alloc-input"
              value={entry.incomeCategoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="">— Select Income Account —</option>
              {incomeCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Section 3: Receipt Details + Particulars ── */}
      <div className="ve-form__dual-panels">

        <div className="ve-form__section ve-form__section--grow">
          <div className="ve-form__section-head">{modeLabel}</div>
          <div className="ve-form__section-body">
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
        </div>

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
              {saving ? 'Saving…' : isEditMode ? 'Update' : 'Save & Print'}
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
                <th>Account (Income Category)</th>
                <th>Amount</th>
                <th>Particulars</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i}>
                  <td className="ve-form__td-code">{e.incomeCategoryName}</td>
                  <td className="ve-form__td-amount">{Number(e.amount).toLocaleString()}</td>
                  <td>{e.particulars || '—'}</td>
                  <td><span className="ve-form__status-badge">Confirm</span></td>
                  <td style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="ve-form__del-btn" title="Edit" onClick={() => handleEditEntry(i)}>
                      <Pencil size={14} />
                    </button>
                    <button
                      className="ve-form__del-btn"
                      title="Remove"
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
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

    </div>
  );
}
