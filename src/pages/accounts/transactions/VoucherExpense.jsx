import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Wifi, Banknote, ArrowRight, Building2 } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import './VoucherExpense.scss';

const METHODS = [
  { key: 'cheque', label: 'By Cheque',       Icon: FileText  },
  { key: 'online', label: 'Online Transfer',  Icon: Wifi      },
  { key: 'cash',   label: 'By Cash',          Icon: Banknote  },
];

export default function VoucherExpense() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { bankAccounts, fetchBankAccounts } = useAccountsStore();

  const [mode, setMode]     = useState(null);
  const [bankId, setBankId] = useState('');

  useEffect(() => { fetchBankAccounts(entityType); }, [entityType]);

  const needsBank = mode === 'cheque' || mode === 'online';

  const handleProceed = () => {
    if (!mode) return;
    if (needsBank && !bankId) return;
    navigate(`/accounts/${entityType}/transactions/voucher-expense/form`, {
      state: { mode, bankId },
    });
  };

  return (
    <div className="vex">
      <button className="vex__back" onClick={() => navigate(`/accounts/${entityType}/transactions`)}>
        <ArrowLeft size={15} /> Back
      </button>
      <div className="vex__wrap">
      {/* ── Left panel ── */}
      <div className="vex__left">
        <div className="vex__brand">
          <div className="vex__brand-icon"><Building2 size={28} /></div>
          <div className="vex__brand-name">Darul Shifa</div>
          <div className="vex__brand-sub">Accounts Module</div>
        </div>
        <div className="vex__left-footer">
          <div className="vex__left-label">Transaction Type</div>
          <div className="vex__left-type">Expense Voucher</div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="vex__right">
        <div className="vex__title">Select Payment Method</div>
        <p className="vex__sub">Choose how this expense will be paid</p>

        <div className="vex__methods">
          {METHODS.map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`vex__method ${mode === key ? 'active' : ''}`}
              onClick={() => { setMode(key); setBankId(''); }}
            >
              <div className="vex__method-icon"><Icon size={22} /></div>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {needsBank && (
          <div className="vex__bank">
            <label className="vex__bank-label">Select Bank Account</label>
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              className="vex__bank-select"
            >
              <option value="">— Choose bank —</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} — {b.accountNumber}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          className="vex__proceed"
          onClick={handleProceed}
          disabled={!mode || (needsBank && !bankId)}
        >
          <span>Proceed</span>
          <div className="vex__proceed-arrow"><ArrowRight size={18} /></div>
        </button>
      </div>
      </div>
    </div>
  );
}
