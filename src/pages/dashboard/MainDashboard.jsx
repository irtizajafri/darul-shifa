import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Package, FlaskConical, Wallet } from 'lucide-react';
import { useModuleStore } from '../../store/useModuleStore';
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
  { id: 'clinic', permModule: null, icon: Stethoscope, title: 'Clinic', desc: 'Patient visits, OPD & records', active: false },
  { id: 'accounts', permModule: null, icon: Wallet, title: 'Accounts', desc: 'Finance, billing & ledgers', active: false },
];

export default function MainDashboard() {
  const [loading, setLoading] = useState(true);
  const { clearModule, setModule } = useModuleStore();
  const navigate = useNavigate();

  // All modules are always visible — permission check happens when opened
  const modules = ALL_MODULES;

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
