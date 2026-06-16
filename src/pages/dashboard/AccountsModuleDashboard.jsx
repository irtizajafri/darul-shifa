import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useModuleStore } from '../../store/useModuleStore';
import PageLoader from '../../components/ui/PageLoader';
import hospitalLogo from '../../assets/download.png';
import {
  Settings,
  FileText,
  Search,
  BarChart3,
  Building2,
  Users,
  ArrowLeft,
} from 'lucide-react';
import './AccountsModuleDashboard.scss';

const accountTypes = [
  {
    key: 'corporate',
    title: 'Accounting for Corporate',
    icon: Building2,
    desc: 'Corporate entity financials — company ledgers, profit centres & consolidated reporting',
  },
  {
    key: 'non-corporate',
    title: 'Accounting for Non-Corporate',
    icon: Users,
    desc: 'Trust, NGO or individual entity accounts — donations, funds & general ledger management',
  },
];

const subModules = [
  {
    title: 'Parameters',
    icon: Settings,
    desc: 'Chart of Accounts, cost centres & master configuration',
    path: (type) => `/accounts/${type}/parameters`,
  },
  {
    title: 'Transactions',
    icon: FileText,
    desc: 'Journal, payment & receipt vouchers, bank & cash entries',
    path: (type) => `/accounts/${type}/transactions`,
  },
  {
    title: 'Inquiry',
    icon: Search,
    desc: 'Account ledger, bank statement & transaction history',
    path: (type) => `/accounts/${type}/inquiry`,
  },
  {
    title: 'Reports',
    icon: BarChart3,
    desc: 'Trial Balance, Profit & Loss, Balance Sheet',
    path: (type) => `/accounts/${type}/reports`,
  },
];

export default function AccountsModuleDashboard() {
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const { setModule } = useModuleStore();
  const navigate = useNavigate();

  useEffect(() => {
    setModule('accounts');
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, [setModule]);

  if (loading) return <PageLoader />;

  if (selected) {
    const type = accountTypes.find((a) => a.key === selected);
    return (
      <div className="accounts-module-dashboard">
        <div className="dashboard-header">
          <img src={hospitalLogo} alt="Darul Shifa Accounts" className="dashboard-header-logo" />
        </div>

        <div className="section-header">
          <button className="back-btn" onClick={() => setSelected(null)}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="section-title">
            <type.icon className="w-5 h-5" />
            <h2>{type.title}</h2>
          </div>
        </div>

        <div className="submodule-grid">
          {subModules.map((sm) => (
            <div
              key={sm.title}
              className="submodule-card"
              onClick={() => navigate(sm.path(selected))}
            >
              <div className="submodule-icon">
                <sm.icon className="w-6 h-6" />
              </div>
              <h3>{sm.title}</h3>
              <p>{sm.desc}</p>
              <button
                className="submodule-btn"
                onClick={(e) => { e.stopPropagation(); navigate(sm.path(selected)); }}
              >
                Open {sm.title} →
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="accounts-module-dashboard">
      <div className="dashboard-header">
        <img src={hospitalLogo} alt="Darul Shifa Accounts" className="dashboard-header-logo" />
      </div>

      <div className="accounts-type-grid">
        {accountTypes.map((a) => (
          <div
            key={a.key}
            className="accounts-type-card"
            onClick={() => setSelected(a.key)}
          >
            <div className="type-icon">
              <a.icon className="w-8 h-8" />
            </div>
            <h3>{a.title}</h3>
            <p>{a.desc}</p>
            <button className="type-btn">
              Open {a.title.split(' ').slice(-1)[0]} →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
