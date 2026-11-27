import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, PackageCheck, FileBarChart, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/shared/PageHeader';
import { useModuleStore } from '../../store/useModuleStore';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';
import { pharmacyApi, fmtAmt } from '../pharmacy/pharmacyApi';
import '../pharmacy/Pharmacy.scss';

const TILES = [
  { path: '/pharmacy/gd', subModule: 'gd', Icon: ClipboardList, title: 'Goods Demand (GD)', text: 'Demand medicines for a department or patient' },
  { path: '/pharmacy/gin', subModule: 'gin', Icon: PackageCheck, title: 'Goods Issuance (GIN)', text: 'Issue a GD\'s medicines' },
  { path: '/pharmacy/mrn', subModule: 'mrn', altSubModule: 'mrn-verify', Icon: Undo2, title: 'Medicine Return (MRN)', text: 'Return issued medicine — the pharmacy verifies' },
  { path: '/pharmacy/reports', subModule: 'reports', Icon: FileBarChart, title: 'Reports', text: 'GD, GIN and Summary reports' },
];

export default function PharmacyModuleDashboard() {
  const navigate = useNavigate();
  const { setModule } = useModuleStore();
  const { user } = useAuthStore();
  const [summary, setSummary] = useState(null);

  useEffect(() => { setModule('pharmacy'); }, [setModule]);
  useEffect(() => { pharmacyApi('/summary').then(setSummary).catch((e) => toast.error(e.message)); }, []);

  const tiles = TILES.filter((t) => user?.isSuperAdmin || hasPermission(user, 'pharmacy', t.subModule) || (t.altSubModule && hasPermission(user, 'pharmacy', t.altSubModule)));

  return (
    <div className="ph-page">
      <PageHeader breadcrumbs={[{ label: 'Dashboard', link: '/dashboard' }, { label: 'Al Shifa Hospital Pharmacy' }]} title="Al Shifa Hospital Pharmacy" subtitle="Goods Demand and Goods Issuance of medicines" />
      <div className="ph-stats">
        <div className="ph-stat"><span>GD today</span><b>{summary?.gdToday ?? '—'}</b></div>
        <div className="ph-stat"><span>GIN today</span><b>{summary?.ginToday ?? '—'}</b></div>
        <div className="ph-stat"><span>GD not fully issued</span><b>{summary?.pendingGDs ?? '—'}</b></div>
        <div className="ph-stat"><span>Issued today</span><b>{summary ? `Rs ${fmtAmt(summary.issuedTodayAmount)}` : '—'}</b></div>
      </div>
      <div className="ph-tiles">
        {tiles.map((t) => (
          <button type="button" key={t.path} className="ph-tile" onClick={() => navigate(t.path)}>
            <t.Icon />
            <b>{t.title}</b>
            <span>{t.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
