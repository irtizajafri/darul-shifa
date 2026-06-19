import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import './VoucherExpense.scss';

export default function VoucherExpense() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const { bankAccounts, fetchBankAccounts } = useAccountsStore();

  const [mode, setMode] = useState(null); // 'cheque' | 'online' | 'cash'
  const [bankId, setBankId] = useState('');

  useEffect(() => {
    fetchBankAccounts(entityType);
  }, [entityType]);

  const needsBank = mode === 'cheque' || mode === 'online';

  const handleProceed = () => {
    if (!mode) return;
    if (needsBank && !bankId) return;
    navigate(`/accounts/${entityType}/transactions/voucher-expense/form`, {
      state: { mode, bankId },
    });
  };

  return (
    <div className="voucher-expense">
      <div className="voucher-expense__header">
        <button className="voucher-expense__back" onClick={() => navigate(`/accounts/${entityType}/transactions`)}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h2>Voucher Entry — Expense</h2>
          <p>Select payment method to proceed</p>
        </div>
      </div>

      <div className="voucher-expense__card">
        <div className="voucher-expense__title">SELECT PAYMENT METHOD</div>

        {/* Top 2 buttons */}
        <div className="voucher-expense__row">
          <button
            className={`voucher-expense__mode-btn ${mode === 'cheque' ? 'active' : ''}`}
            onClick={() => { setMode('cheque'); setBankId(''); }}
          >
            {mode === 'cheque' && <CheckCircle2 className="w-4 h-4" />}
            EXPENSE BY CHEQUE
          </button>
          <button
            className={`voucher-expense__mode-btn ${mode === 'online' ? 'active' : ''}`}
            onClick={() => { setMode('online'); setBankId(''); }}
          >
            {mode === 'online' && <CheckCircle2 className="w-4 h-4" />}
            EXPENSE ONLINE
          </button>
        </div>

        {/* Bank dropdown — shown for cheque / online */}
        {needsBank && (
          <div className="voucher-expense__bank-row">
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              className="voucher-expense__bank-select"
            >
              <option value="">SELECT BANK</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bankName} — {b.accountNumber}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Cash button */}
        <div className="voucher-expense__cash-row">
          <button
            className={`voucher-expense__cash-btn ${mode === 'cash' ? 'active' : ''}`}
            onClick={() => { setMode('cash'); setBankId(''); }}
          >
            {mode === 'cash' && <CheckCircle2 className="w-4 h-4" />}
            EXPENSE BY CASH
          </button>
        </div>

        {/* Proceed */}
        {mode && (
          <div className="voucher-expense__proceed-row">
            <button
              className="voucher-expense__proceed-btn"
              onClick={handleProceed}
              disabled={needsBank && !bankId}
            >
              Proceed →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
