import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Printer, Landmark, Upload, SlidersHorizontal } from 'lucide-react';
import './AccountsTransactions.scss';

const ITEMS = [
  {
    key: 'voucher-income',
    label: 'Voucher Entry — Income',
    icon: TrendingUp,
    desc: 'Record income receipts against income categories and payee heads',
  },
  {
    key: 'voucher-expense',
    label: 'Voucher Entry — Expense',
    icon: TrendingDown,
    desc: 'Record expense payments against accounts and payee heads',
  },
  {
    key: 'cheque-printing',
    label: 'Cheque Printing',
    icon: Printer,
    desc: 'Print cheques from serial ranges linked to bank accounts',
  },
  {
    key: 'bank-deposit',
    label: 'Bank Deposit',
    icon: Landmark,
    desc: 'Record cash or cheque deposits into bank accounts',
  },
  {
    key: 'bank-statement',
    label: 'Upload Bank Statement',
    icon: Upload,
    desc: 'Import bank statement file to reconcile transactions',
  },
  {
    key: 'deposit-adjustment',
    label: 'Bank Deposit Adjustment',
    icon: SlidersHorizontal,
    desc: 'Adjust or correct previously recorded bank deposit entries',
  },
];

export default function AccountsTransactions() {
  const { entityType } = useParams();
  const navigate = useNavigate();

  const label = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';

  return (
    <div className="acc-transactions">
      <div className="acc-transactions__header">
        <button className="acc-transactions__back" onClick={() => navigate('/accounts-module')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h2>Transactions</h2>
          <p>Accounting for {label}</p>
        </div>
      </div>

      <div className="acc-transactions__grid">
        {ITEMS.map((item) => (
          <div
            key={item.key}
            className="acc-transactions__card"
            onClick={() => navigate(`/accounts/${entityType}/transactions/${item.key}`)}
          >
            <div className="acc-transactions__icon">
              <item.icon className="w-5 h-5" />
            </div>
            <h3>{item.label}</h3>
            <p>{item.desc}</p>
            <button
              className="acc-transactions__btn"
              onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${entityType}/transactions/${item.key}`); }}
            >
              Open →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
