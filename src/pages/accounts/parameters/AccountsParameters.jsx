import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Settings2, BookOpen, AlignLeft, Layers, Users, Landmark, FileDigit, Tag, ArrowLeft, Copy } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
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
  const { mainGLs, fetchMainGLs, copyChartToCorporate } = useAccountsStore();

  const label = entityType === 'corporate' ? 'Corporate' : 'Non-Corporate';

  // Only relevant on the Corporate side — checks whether the Main GL /
  // Sub GL / Main Account / Sub Account tree has already been copied over
  // from Non-Corporate, so the one-time "Copy" button hides itself once
  // it's no longer needed.
  const [checkingCopy, setCheckingCopy] = useState(entityType === 'corporate');
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (entityType !== 'corporate') return;
    setCheckingCopy(true);
    fetchMainGLs('corporate').finally(() => setCheckingCopy(false));
  }, [entityType]);

  const handleCopyFromNonCorporate = async () => {
    if (!confirm('Copy the entire Non-Corporate Main GL / Sub GL / Main Account / Sub Account structure into Corporate? This creates brand-new, independent Corporate records — it only runs once.')) return;
    setCopying(true);
    try {
      const result = await copyChartToCorporate();
      toast.success(`Copied: ${result.mainGL} Main GL, ${result.subGL} Sub GL, ${result.mainAccount} Main Account, ${result.subAccount} Sub Account`);
      await fetchMainGLs('corporate');
    } catch (e) {
      toast.error(e.message || 'Copy failed');
    } finally {
      setCopying(false);
    }
  };

  const showCopyBanner = entityType === 'corporate' && !checkingCopy && mainGLs.length === 0;

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

      {showCopyBanner && (
        <div className="acc-parameters__copy-banner">
          <div>
            <strong>Corporate chart of accounts is empty.</strong>
            <p>Copy the Main GL / Sub GL / Main Account / Sub Account structure from Non-Corporate to start from the same setup — a one-time action, both sides stay fully independent afterwards.</p>
          </div>
          <button className="acc-parameters__copy-btn" onClick={handleCopyFromNonCorporate} disabled={copying}>
            <Copy className="w-4 h-4" /> {copying ? 'Copying…' : 'Copy from Non-Corporate'}
          </button>
        </div>
      )}

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
