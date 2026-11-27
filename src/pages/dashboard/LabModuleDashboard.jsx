import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderTree, FlaskConical, ListChecks, ClipboardPen, FileBarChart } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/shared/PageHeader';
import { useModuleStore } from '../../store/useModuleStore';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';
import { labApi } from '../lab/labApi';
import '../lab/Lab.scss';

const TILES = [
  { path: '/lab/result-entry', subModule: 'result-entry', Icon: ClipboardPen, title: 'Result Entry', text: 'Lab slips from Clinic — enter results and print reports' },
  { path: '/lab/categories', subModule: 'categories', Icon: FolderTree, title: 'Categories', text: 'Groups such as Haematology and Biochemistry' },
  { path: '/lab/tests', subModule: 'tests', Icon: FlaskConical, title: 'Sub Category (Tests)', text: 'Place Clinic lab tests in categories' },
  { path: '/lab/parameters', subModule: 'parameters', Icon: ListChecks, title: 'Parameters', text: 'Each test\'s report lines, units and reference ranges' },
  { path: '/lab/reports', subModule: 'reports', Icon: FileBarChart, title: 'Reports', text: 'Test-wise, panel / mode of payment and department-wise' },
];

export default function LabModuleDashboard() {
  const navigate = useNavigate();
  const { setModule } = useModuleStore();
  const { user } = useAuthStore();
  const [summary, setSummary] = useState(null);

  useEffect(() => { setModule('lab'); }, [setModule]);

  useEffect(() => {
    labApi('/summary').then(setSummary).catch((e) => toast.error(e.message));
  }, []);

  const tiles = TILES.filter((t) => user?.isSuperAdmin || hasPermission(user, 'lab', t.subModule));

  return (
    <div className="lab-page">
      <PageHeader breadcrumbs={[{ label: 'Dashboard', link: '/dashboard' }, { label: 'Laboratories' }]} title="Laboratories" subtitle="Lab tests, results and reports" />

      <div className="lab-stats">
        <div className="lab-stat"><span>Lab slips today</span><b>{summary?.todaySlips ?? '—'}</b></div>
        <div className="lab-stat"><span>Pending tests today</span><b>{summary?.todayPendingTests ?? '—'}</b></div>
        <div className="lab-stat"><span>Categories</span><b>{summary?.categories ?? '—'}</b></div>
        <div className="lab-stat"><span>Tests in a category</span><b>{summary ? `${summary.tests} / ${summary.clinicTests}` : '—'}</b></div>
        <div className="lab-stat"><span>Tests with lines</span><b>{summary?.testsWithParameters ?? '—'}</b></div>
      </div>

      <div className="lab-dash">
        {tiles.map((t) => (
          <button type="button" key={t.path} className="lab-tile" onClick={() => navigate(t.path)}>
            <t.Icon />
            <b>{t.title}</b>
            <span>{t.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
