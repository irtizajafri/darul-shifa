import { useNavigate, useParams } from 'react-router-dom';
import { Settings2, BookOpen, AlignLeft, Layers, Users, Landmark, FileDigit, Tag, ArrowLeft } from 'lucide-react';
import './AccountsParameters.scss';

const ITEMS = [
  { key: 'main-gl',         label: 'Main GL',                     icon: BookOpen,   desc: 'Level 1 — top-level general ledger groups (E-1, E-2 …)' },
  { key: 'sub-gl',          label: 'Sub GL',                      icon: AlignLeft,  desc: 'Level 2 — sub-groups under each Main GL (E-1.1, E-1.2 …)' },
  { key: 'main-account',    label: 'Main Account',                icon: Layers,     desc: 'Level 3 — main accounts under Sub GL (E-1.1.1 …)' },
  { key: 'sub-account',     label: 'Sub Account',                 icon: Settings2,  desc: 'Level 4 — detail accounts; entries roll up to all parent levels' },
  { key: 'list-attachments',label: 'List Attachments',            icon: Users,      desc: 'Payee heads — employees, vendors, doctors & custom lists' },
  { key: 'bank-accounts',   label: 'Bank Accounts',               icon: Landmark,   desc: 'Bank name & account number master' },
  { key: 'cheque-serial',   label: 'Cheque Serial',               icon: FileDigit,  desc: 'Cheque serial ranges linked to bank accounts' },
  { key: 'income-category', label: 'Account Category for Income', icon: Tag,        desc: 'Income category names used in transactions' },
];

export default function AccountsParameters() {
  const { entityType } = useParams();
  const navigate = useNavigate();

  const label = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';

  return (
    <div className="acc-parameters">
      <div className="acc-parameters__header">
        <button className="acc-parameters__back" onClick={() => navigate(`/accounts-module`)}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h2>Parameters</h2>
          <p>Accounting for {label}</p>
        </div>
      </div>

      <div className="acc-parameters__grid">
        {ITEMS.map((item) => (
          <div
            key={item.key}
            className="acc-parameters__card"
            onClick={() => navigate(`/accounts/${entityType}/parameters/${item.key}`)}
          >
            <div className="acc-parameters__icon">
              <item.icon className="w-5 h-5" />
            </div>
            <h3>{item.label}</h3>
            <p>{item.desc}</p>
            <button
              className="acc-parameters__btn"
              onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${entityType}/parameters/${item.key}`); }}
            >
              Open →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
