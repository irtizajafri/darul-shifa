import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Package, FlaskConical, Wallet } from 'lucide-react';
import { useModuleStore } from '../../store/useModuleStore';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';
import PageLoader from '../../components/ui/PageLoader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import './MainDashboard.scss';

const ALL_MODULES = [
  {
    id: 'employee',
    permModule: 'employee',          // key used in hasPermission()
    icon: Stethoscope,
    title: 'Employee Management',
    desc: 'Manage staff, attendance, payroll & HR operations',
    stats: '247 Employees  •  10 Departments',
    active: true,
    path: '/employee-module',
  },
  { id: 'lab', permModule: null, icon: FlaskConical, title: 'Laboratories', desc: 'Lab tests, results & reporting', active: false },
  {
    id: 'inventory',
    permModule: 'inventory',
    icon: Package,
    title: 'Inventory',
    desc: 'Stock, orders, suppliers & assets',
    active: true,
    path: '/inventory-module',
  },
  { id: 'clinic', permModule: 'clinic', icon: Stethoscope, title: 'Clinic', desc: 'Patient visits, OPD & records', active: true, path: '/clinic-module' },
  { id: 'accounts', permModule: 'accounts', icon: Wallet, title: 'Accounts', desc: 'Finance, billing & ledgers', active: true, path: '/accounts-module' },
];

export default function MainDashboard() {
  const [loading, setLoading] = useState(true);
  const { clearModule, setModule } = useModuleStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Sirf wahi modules dikho jis ki permission hai
  const modules = user?.isSuperAdmin
    ? ALL_MODULES
    : ALL_MODULES.filter((m) => !m.permModule || hasPermission(user, m.permModule));

  useEffect(() => {
    clearModule();
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, [clearModule]);

  const handleModuleClick = (m) => {
    if (m.active) {
      if (m.id === 'employee') {
        setModule('employee');
      } else if (m.id === 'inventory') {
        setModule('inventory');
      } else if (m.id === 'clinic') {
        setModule('clinic');
      } else if (m.id === 'accounts') {
        setModule('accounts');
      } else {
        clearModule();
      }
      navigate(m.path || '/dashboard');
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="main-dashboard">
      <div className="dashboard-header">
        <h1>Hospital Management System</h1>
        <p>Select a module to get started</p>
      </div>
      <div className="module-grid">
        {modules.map((m) => (
          <Card
            key={m.id}
            className={`module-card ${m.active ? 'active' : 'coming-soon'}`}
          >
            {!m.active && (
              <Badge label="Coming Soon" variant="warning" className="module-badge" />
            )}
            <div className="module-icon">
              <m.icon className="w-5 h-5" />
            </div>
            <h3>{m.title}</h3>
            <p>{m.desc}</p>
            {m.stats && <p className="module-stats">{m.stats}</p>}
            <Button
              label={m.active ? 'Open Module →' : 'Coming Soon'}
              variant={m.active ? 'primary' : 'secondary'}
              disabled={!m.active}
              onClick={() => handleModuleClick(m)}
              className="module-btn"
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
