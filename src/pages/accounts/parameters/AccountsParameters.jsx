import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Settings2, BookOpen, AlignLeft, Layers, Users, Landmark, FileDigit, Tag, ArrowLeft, Copy } from 'lucide-react';
import { useAccountsStore } from '../../../store/useAccountsStore';
import { confirmDialog } from '../../../components/ui/ConfirmDialog';
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
  const { copyChartToCorporate } = useAccountsStore();

  const label = entityType === 'corporate' ? 'Corporate' : 'Cash GL';

  // Corporate side only — copies whatever Non-Corporate has that Corporate
  // doesn't yet (accounts + List Attachments). Safe to press again any time.
  const [copying, setCopying] = useState(false);

  const handleCopyFromNonCorporate = async () => {
    if (!(await confirmDialog({
      title: 'Cash GL se Corporate mein copy',
      message: 'Cash GL ka Account Allocation (Main GL → Sub GL → Main Account → Sub Account) aur List Attachments (heads, un ki account linking aur names) Corporate mein copy ho jayenge. Jo Corporate mein pehle se hai woh waisa hi rahega — sirf jo kam hai woh banega. Kuch delete ya overwrite nahi hoga.',
      confirmLabel: 'Copy karo',
    }))) return;
    setCopying(true);
    try {
      const r = await copyChartToCorporate();
      const accounts = r.mainGL + r.subGL + r.mainAccount + r.subAccount;
      const attachments = r.heads + r.headAccounts + r.headMainAccounts + r.staffCategories + r.customHeadLinks + r.entries;
      toast.success(
        accounts + attachments === 0
          ? 'Corporate pehle se Cash GL jaisa hai — kuch naya copy karne ko nahi tha'
          : `Copy ho gaya — Accounts: ${r.mainGL} Main GL, ${r.subGL} Sub GL, ${r.mainAccount} Main Account, ${r.subAccount} Sub Account · List Attachments: ${r.heads} heads, ${r.headAccounts + r.headMainAccounts} account links, ${r.entries} names`,
        { duration: 7000 },
      );
    } catch (e) {
      toast.error(e.message || 'Copy failed');
    } finally {
      setCopying(false);
    }
  };

  const showCopyBanner = entityType === 'corporate';

  return (
    <div className="acc-parameters">
      <div className="acc-parameters__header">
        <button className="acc-parameters__back" onClick={() => navigate(`/accounts-module`)}>
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div>
          <h2>Parameters</h2>
          <p>{label}</p>
        </div>
      </div>

      {showCopyBanner && (
        <div className="acc-parameters__copy-banner">
          <div>
            <strong>Cash GL se copy</strong>
            <p>Cash GL ka Account Allocation (Main GL / Sub GL / Main Account / Sub Account) aur List Attachments Corporate mein copy karein. Sirf jo Corporate mein nahi hai woh banta hai — jitni dafa chahein dabayein, kuch delete ya overwrite nahi hota.</p>
          </div>
          <button className="acc-parameters__copy-btn" onClick={handleCopyFromNonCorporate} disabled={copying}>
            <Copy className="w-4 h-4" /> {copying ? 'Copying…' : 'Copy from Cash GL'}
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
