import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Landmark, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAccountsStore } from '../../../store/useAccountsStore';
import './BankDeposit.scss';

const API = 'http://localhost:5001/api/accounts';

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtA = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyForm = () => ({
  bankAccountId: '',
  depositOf:     todayStr(),
  depositDate:   todayStr(),
  depositSlipNo: '',
  depositedBy:   '',
  amount:        '',
});

export default function BankDeposit() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { bankAccounts, fetchBankAccounts, linkedEmployees, fetchLinkedEmployees } = useAccountsStore();

  const [form, setForm]       = useState(emptyForm());
  const [saving, setSaving]   = useState(false);
  const [empSearch, setEmpSearch]   = useState('');
  const [empDropOpen, setEmpDropOpen] = useState(false);
  const empRef = useRef();

  const [diffLoading, setDiffLoading] = useState(false);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  useEffect(() => {
    fetchBankAccounts(entityType);
    fetchLinkedEmployees();
  }, [entityType]);

  // AMOUNT is auto-filled from the Accounts Revenue Dashboard's Income − Expense
  // diff for the selected "Deposit Of" date, and is uneditable.
  useEffect(() => {
    if (!form.depositOf) { set('amount', ''); return; }
    setDiffLoading(true);
    fetch(`${API}/inquiry/daily-diff?date=${form.depositOf}&entityType=${entityType}`)
      .then((r) => r.json())
      .then((j) => set('amount', j?.data ? j.data.diff : ''))
      .catch(() => set('amount', ''))
      .finally(() => setDiffLoading(false));
  }, [form.depositOf, entityType]);

  const filteredEmps = linkedEmployees.filter((e) => {
    const full = `${e.firstName} ${e.lastName}`.toLowerCase();
    return full.includes(empSearch.toLowerCase());
  });

  const selectEmp = (emp) => {
    const name = `${emp.firstName} ${emp.lastName}`;
    set('depositedBy', name);
    setEmpSearch(name);
    setEmpDropOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (empRef.current && !empRef.current.contains(e.target)) setEmpDropOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSave = async () => {
    if (!form.bankAccountId) return toast.error('Please select a bank');
    if (!form.depositOf)     return toast.error('Deposit Of date is required');
    if (!form.depositDate)   return toast.error('Deposit Date is required');
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Amount must be greater than zero');

    setSaving(true);
    try {
      const r = await fetch(`${API}/bank-deposits?entityType=${entityType}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: Number(form.bankAccountId),
          depositOf:     form.depositOf,
          depositDate:   form.depositDate,
          depositSlipNo: form.depositSlipNo || null,
          depositedBy:   form.depositedBy   || null,
          amount:        Number(form.amount),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || 'Save failed');
      toast.success('Bank deposit saved');
      setForm(emptyForm());
      setEmpSearch('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedBank = bankAccounts.find((b) => String(b.id) === String(form.bankAccountId));

  return (
    <div className="bd-page">

      {/* Breadcrumb */}
      <div className="bd-breadcrumb">
        <button className="bd-back" onClick={() => navigate(`/accounts/${entityType}/transactions`)}>
          <ArrowLeft size={14} /> Back
        </button>
        <ChevronRight size={13} className="bd-bc-sep" />
        <span>Transactions</span>
        <ChevronRight size={13} className="bd-bc-sep" />
        <span className="bd-bc-active">Bank Deposit</span>
      </div>

      {/* Card */}
      <div className="bd-card">
        <div className="bd-card-header">
          <Landmark size={18} className="bd-card-icon" />
          <div>
            <div className="bd-card-title">Bank Deposit</div>
            <div className="bd-card-sub">Record cash or cheque deposit into a bank account</div>
          </div>
        </div>

        <div className="bd-form">

          {/* SELECT BANK */}
          <div className="bd-field bd-field--full">
            <label className="bd-label">SELECT BANK</label>
            <select
              className="bd-select"
              value={form.bankAccountId}
              onChange={(e) => set('bankAccountId', e.target.value)}
            >
              <option value="">— Select Bank Account —</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName}  ({b.accountNumber})
                </option>
              ))}
            </select>
            {selectedBank && (
              <div className="bd-bank-badge">
                <Landmark size={11} /> {selectedBank.bankName} · {selectedBank.accountNumber}
              </div>
            )}
          </div>

          <div className="bd-row">
            {/* DEPOSIT OF */}
            <div className="bd-field">
              <label className="bd-label">DEPOSIT OF</label>
              <input
                type="date"
                className="bd-input"
                value={form.depositOf}
                onChange={(e) => set('depositOf', e.target.value)}
              />
            </div>

            {/* DEPOSIT DATE */}
            <div className="bd-field">
              <label className="bd-label">DEPOSIT DATE</label>
              <input
                type="date"
                className="bd-input"
                value={form.depositDate}
                onChange={(e) => set('depositDate', e.target.value)}
              />
            </div>
          </div>

          <div className="bd-row">
            {/* DEPOSIT SLIP NUMBER */}
            <div className="bd-field">
              <label className="bd-label">DEPOSIT SLIP NUMBER</label>
              <input
                type="text"
                className="bd-input"
                placeholder="e.g. DS-001234"
                value={form.depositSlipNo}
                onChange={(e) => set('depositSlipNo', e.target.value)}
              />
            </div>

            {/* DEPOSITED BY */}
            <div className="bd-field" ref={empRef} style={{ position: 'relative' }}>
              <label className="bd-label">DEPOSITED BY</label>
              <div className="bd-search-wrap">
                <Search size={13} className="bd-search-icon" />
                <input
                  type="text"
                  className="bd-input bd-input--search"
                  placeholder="Search employee…"
                  value={empSearch}
                  onChange={(e) => { const v = e.target.value; setEmpSearch(v); setEmpDropOpen(true); set('depositedBy', v); }}
                  onFocus={() => setEmpDropOpen(true)}
                />
              </div>
              {empDropOpen && (
                <div className="bd-emp-drop">
                  {filteredEmps.length === 0
                    ? <div className="bd-emp-empty">No employees found</div>
                    : filteredEmps.map((e) => (
                        <div
                          key={e.id}
                          className="bd-emp-item"
                          onMouseDown={() => selectEmp(e)}
                        >
                          {e.firstName} {e.lastName}
                        </div>
                      ))
                  }
                </div>
              )}
            </div>
          </div>

          {/* AMOUNT — auto-filled (Income − Expense for the selected Deposit Of date), uneditable */}
          <div className="bd-field bd-field--amount">
            <label className="bd-label">AMOUNT (PKR)</label>
            <input
              type="text"
              className="bd-input bd-input--amount"
              placeholder={diffLoading ? 'Loading…' : '0.00'}
              value={form.amount === '' ? '' : fmtA(form.amount)}
              readOnly
              disabled
            />
          </div>

          {/* Actions */}
          <div className="bd-actions">
            <button className="bd-btn-cancel" onClick={() => { setForm(emptyForm()); setEmpSearch(''); }}>
              Clear
            </button>
            <button className="bd-btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'SAVE'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
