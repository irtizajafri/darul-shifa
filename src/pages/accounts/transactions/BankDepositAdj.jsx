import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, SlidersHorizontal, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAccountsStore } from '../../../store/useAccountsStore';
import './BankDepositAdj.scss';

const API = 'http://localhost:5001/api/accounts';
const todayStr = () => new Date().toISOString().slice(0, 10);
const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const fmtA = (n) => Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyForm = () => ({
  bankAccountId:      '',
  postedDepositOf:    todayStr(),
  postedDepositDate:  todayStr(),
  postedDepositSlipNo:'',
  postedDepositedBy:  '',
  postedAmount:       '',
  adjDepositDate:     todayStr(),
  adjDepositSlipNo:   '',
  adjDepositedBy:     '',
  adjAmount:          '',
  adjustedBy:         '',
});

function EmpSearch({ value, employees, onChange }) {
  const [search, setSearch]     = useState(value || '');
  const [open, setOpen]         = useState(false);
  const ref                     = useRef();

  useEffect(() => { setSearch(value || ''); }, [value]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filtered = employees.filter((e) =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="bda-search-wrap">
        <Search size={13} className="bda-search-icon" />
        <input
          type="text"
          className="bda-input bda-input--search"
          placeholder="Search employee…"
          value={search}
          onChange={(e) => { const v = e.target.value; setSearch(v); setOpen(true); onChange(v); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (
        <div className="bda-emp-drop">
          {filtered.length === 0
            ? <div className="bda-emp-empty">No employees found</div>
            : filtered.map((e) => (
                <div
                  key={e.id}
                  className="bda-emp-item"
                  onMouseDown={() => { const n = `${e.firstName} ${e.lastName}`; setSearch(n); onChange(n); setOpen(false); }}
                >
                  {e.firstName} {e.lastName}
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

export default function BankDepositAdj() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { bankAccounts, fetchBankAccounts, linkedEmployees, fetchLinkedEmployees } = useAccountsStore();

  const [form, setForm]     = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [postedMatch, setPostedMatch]     = useState(null);
  const [postedLoading, setPostedLoading] = useState(false);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  useEffect(() => {
    fetchBankAccounts(entityType);
    fetchLinkedEmployees();
  }, [entityType]);

  // Auto-fill the POSTED column from the actual recorded Bank Deposit for this
  // bank + date, instead of making the user re-type numbers that already exist.
  useEffect(() => {
    if (!form.bankAccountId || !form.postedDepositOf) {
      setPostedMatch(null);
      set('postedDepositDate', ''); set('postedDepositSlipNo', ''); set('postedDepositedBy', ''); set('postedAmount', '');
      return;
    }
    setPostedLoading(true);
    const q = new URLSearchParams({ entityType, bankAccountId: form.bankAccountId, depositOf: form.postedDepositOf });
    fetch(`${API}/bank-deposits/for-date?${q}`)
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data || null;
        setPostedMatch(d);
        set('postedDepositDate',   d ? toDateInput(d.depositDate) : '');
        set('postedDepositSlipNo', d ? (d.depositSlipNo || '') : '');
        set('postedDepositedBy',   d ? (d.depositedBy || '') : '');
        set('postedAmount',        d ? Number(d.amount) : '');
      })
      .catch(() => setPostedMatch(null))
      .finally(() => setPostedLoading(false));
  }, [form.bankAccountId, form.postedDepositOf, entityType]);

  const handleSave = async () => {
    if (!form.bankAccountId)                              return toast.error('Please select a bank');
    if (!form.postedDepositOf)                            return toast.error('Posted Deposit Of is required');
    if (!postedMatch)                                     return toast.error('No recorded deposit found for this bank & date');
    if (!form.postedDepositDate)                          return toast.error('Posted Deposit Date is required');
    if (!form.postedAmount || Number(form.postedAmount) <= 0) return toast.error('Posted Amount must be greater than zero');
    if (!form.adjDepositDate)                             return toast.error('Adjustment Deposit Date is required');
    if (!form.adjAmount   || Number(form.adjAmount)   <= 0) return toast.error('Adjustment Amount must be greater than zero');

    setSaving(true);
    try {
      const r = await fetch(`${API}/bank-deposit-adjs?entityType=${entityType}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId:       Number(form.bankAccountId),
          postedDepositOf:     form.postedDepositOf,
          postedDepositDate:   form.postedDepositDate,
          postedDepositSlipNo: form.postedDepositSlipNo || null,
          postedDepositedBy:   form.postedDepositedBy   || null,
          postedAmount:        Number(form.postedAmount),
          adjDepositDate:      form.adjDepositDate,
          adjDepositSlipNo:    form.adjDepositSlipNo    || null,
          adjDepositedBy:      form.adjDepositedBy      || null,
          adjAmount:           Number(form.adjAmount),
          adjustedBy:          form.adjustedBy          || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message || 'Save failed');
      toast.success('Deposit adjustment saved');
      setForm(emptyForm());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bda-page">

      {/* Breadcrumb */}
      <div className="bda-breadcrumb">
        <button className="bda-back" onClick={() => navigate(`/accounts/${entityType}/transactions`)}>
          <ArrowLeft size={14} /> Back
        </button>
        <ChevronRight size={13} className="bda-bc-sep" />
        <span>Transactions</span>
        <ChevronRight size={13} className="bda-bc-sep" />
        <span className="bda-bc-active">Bank Deposit Adjustment</span>
      </div>

      {/* Card */}
      <div className="bda-card">
        <div className="bda-card-header">
          <SlidersHorizontal size={18} className="bda-card-icon" />
          <div>
            <div className="bda-card-title">Bank Deposit Adjustment</div>
            <div className="bda-card-sub">Adjust or correct a previously recorded bank deposit</div>
          </div>
        </div>

        <div className="bda-form">

          {/* SELECT BANK */}
          <div className="bda-field bda-field--full">
            <label className="bda-label">SELECT BANK</label>
            <select
              className="bda-select bda-select--full"
              value={form.bankAccountId}
              onChange={(e) => set('bankAccountId', e.target.value)}
            >
              <option value="">— Select Bank Account —</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>{b.bankName} ({b.accountNumber})</option>
              ))}
            </select>
          </div>

          {/* Two-column grid */}
          <div className="bda-grid">

            {/* Column headers */}
            <div className="bda-col-label" />
            <div className="bda-col-header">POSTED</div>
            <div className="bda-col-header">ADJUSTMENT</div>

            {/* DEPOSIT OF */}
            <div className="bda-row-label">DEPOSIT OF:</div>
            <div className="bda-cell">
              <input type="date" className="bda-input" value={form.postedDepositOf}
                onChange={(e) => set('postedDepositOf', e.target.value)} />
              {form.bankAccountId && form.postedDepositOf && (
                <div className={`bda-match-hint ${postedLoading ? '' : postedMatch ? 'bda-match-hint--ok' : 'bda-match-hint--none'}`}>
                  {postedLoading ? 'Looking up deposit…' : postedMatch ? '✓ Deposit found — auto-filled below' : '⚠ No recorded deposit for this bank & date'}
                </div>
              )}
            </div>
            <div className="bda-cell bda-cell--empty" />

            {/* DEPOSIT DATE */}
            <div className="bda-row-label">DEPOSIT DATE:</div>
            <div className="bda-cell">
              <input type="date" className="bda-input" value={form.postedDepositDate} readOnly disabled />
            </div>
            <div className="bda-cell">
              <input type="date" className="bda-input" value={form.adjDepositDate}
                onChange={(e) => set('adjDepositDate', e.target.value)} />
            </div>

            {/* DEPOSIT SLIP NUMBER */}
            <div className="bda-row-label">DEPOSIT SLIP NUMBER:</div>
            <div className="bda-cell">
              <input type="text" className="bda-input" placeholder="—"
                value={form.postedDepositSlipNo} readOnly disabled />
            </div>
            <div className="bda-cell">
              <input type="text" className="bda-input" placeholder="e.g. DS-001235"
                value={form.adjDepositSlipNo}
                onChange={(e) => set('adjDepositSlipNo', e.target.value)} />
            </div>

            {/* DEPOSITED BY */}
            <div className="bda-row-label">DEPOSITED BY:</div>
            <div className="bda-cell">
              <input type="text" className="bda-input" placeholder="—"
                value={form.postedDepositedBy} readOnly disabled />
            </div>
            <div className="bda-cell">
              <EmpSearch
                value={form.adjDepositedBy}
                employees={linkedEmployees}
                onChange={(v) => set('adjDepositedBy', v)}
              />
            </div>

            {/* AMOUNT */}
            <div className="bda-row-label">AMOUNT (PKR):</div>
            <div className="bda-cell">
              <input type="text" className="bda-input bda-input--amt" placeholder="—"
                value={form.postedAmount === '' ? '' : fmtA(form.postedAmount)} readOnly disabled />
            </div>
            <div className="bda-cell">
              <input type="number" className="bda-input bda-input--amt" placeholder="0.00"
                min="0" step="0.01" value={form.adjAmount}
                onChange={(e) => set('adjAmount', e.target.value)} />
            </div>

          </div>

          {/* ADJUSTED BY */}
          <div className="bda-field bda-field--full">
            <label className="bda-label">ADJUSTED BY</label>
            <EmpSearch
              value={form.adjustedBy}
              employees={linkedEmployees}
              onChange={(v) => set('adjustedBy', v)}
            />
          </div>

          {/* Actions */}
          <div className="bda-actions">
            <button className="bda-btn-cancel" onClick={() => setForm(emptyForm())}>Clear</button>
            <button className="bda-btn-save" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'SAVE'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
