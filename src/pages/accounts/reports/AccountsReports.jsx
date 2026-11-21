import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Printer, FileText, LayoutList, CheckSquare,
  TrendingUp, BookOpen, CalendarDays, History, AlertCircle,
  ReceiptText, UserCheck, Workflow, Landmark, HandCoins,
  Building2, BarChart3, Scale,
} from 'lucide-react';
import './AccountsReports.scss';

const REPORTS = [
  { key: 'voucher-reprint',              label: 'Voucher Reprint',              icon: Printer,       desc: 'Reprint expense or income vouchers by number or date range' },
  { key: 'voucher-summary',              label: 'Voucher Summary',              icon: FileText,      desc: 'Summarised view of all vouchers in a date range' },
  { key: 'voucher-summary-matrix',       label: 'Expense Summary Matrix',       icon: LayoutList,    desc: 'Expense totals broken down by Main GL and period' },
  { key: 'cheque-wise-voucher-summary',  label: 'Cheque Wise Voucher Summary',  icon: CheckSquare,   desc: 'Vouchers grouped by cheque number' },
  { key: 'income-summary-matrix',        label: 'Income Summary Matrix',        icon: TrendingUp,    desc: 'Income totals broken down by category and period' },
  { key: 'gl-balance-report',            label: 'GL Balance Report',            icon: BookOpen,      desc: 'General ledger opening, movement and closing balances' },
  { key: 'date-wise-supplier-summary',   label: 'Date Wise Supplier Summary',   icon: CalendarDays,  desc: 'Supplier payments grouped by date' },
  { key: 'supplier-payment-history',     label: 'Supplier Payment History',     icon: History,       desc: 'Full payment history per supplier' },
  { key: 'un-presented-cheque-list',     label: 'Un-Presented Cheque List',     icon: AlertCircle,   desc: 'Cheques issued but not yet presented to the bank' },
  { key: 'slip-refund-statement',        label: 'Slip & Admission Refund Statement', icon: ReceiptText, desc: 'Every slip and admission refund with its voucher # — date, type and voucher filters' },
  { key: 'consultant-payment-history',   label: 'Consultant Payment History',   icon: UserCheck,     desc: 'Payment history for consultants / doctors' },
  { key: 'cash-flow-statement',          label: 'Cash Flow Statement',          icon: Workflow,      desc: 'Day-wise revenue (Patients List) and payments by Main GL — Cash / Online / Cheque' },
  { key: 'bank-reconciliation-statement',label: 'Bank Reconciliation Statement',icon: Landmark,      desc: 'Reconcile bank balances with book balances' },
  { key: 'cash-in-hand-statement',       label: 'Cash In Hand Statement',       icon: HandCoins,     desc: 'Day-wise cash still in hand — Revenue Cash − Paid Cash, less what Bank Deposit shows' },
  { key: 'bank-balance-statement',       label: 'Bank Balance Statement',       icon: Building2,     desc: 'One bank, one month — every deposit / cheque with Dr, Cr and balance, in colour categories' },
  { key: 'income-expense-summary',       label: 'Income & Expense Summary',     icon: BarChart3,     desc: 'Month: Receipts (income heads) and Payments (Main GL), Closing and Reconciliation' },
  { key: 'balance-sheet',               label: 'Balance Sheet',                icon: Scale,         desc: 'Assets, liabilities and equity at a point in time' },
];

export default function AccountsReports() {
  const { entityType } = useParams();
  const navigate = useNavigate();
  const label = entityType === 'corporate' ? 'Corporate' : 'Cash GL';

  return (
    <div className="acc-reports">
      <div className="acc-reports__header">
        <button className="acc-reports__back" onClick={() => navigate(-1)}>
          <ArrowLeft size={15} /> Back
        </button>
        <div>
          <h1 className="acc-reports__title">Reports</h1>
          <p className="acc-reports__sub">{label} · Select a report to open</p>
        </div>
      </div>

      <div className="acc-reports__grid">
        {REPORTS.map((r) => (
          <div
            key={r.key}
            className="acc-reports__card"
            onClick={() => navigate(`/accounts/${entityType}/reports/${r.key}`)}
          >
            <div className="acc-reports__icon">
              <r.icon size={26} />
            </div>
            <div className="acc-reports__info">
              <div className="acc-reports__name">{r.label}</div>
              <div className="acc-reports__desc">{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
