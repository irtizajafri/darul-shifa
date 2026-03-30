import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle, Building2, Zap, Stethoscope, Package, FlaskConical, Wallet } from 'lucide-react';
import { useModuleStore } from '../../store/useModuleStore';
import PageLoader from '../../components/ui/PageLoader';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import './MainDashboard.scss';

const modules = [
  {
    id: 'employee',
    icon: Stethoscope,
    title: 'Employee Management',
    desc: 'Manage staff, attendance, payroll & HR operations',
    stats: '247 Employees  •  10 Departments',
    active: true,
    path: '/employee-module',
  },
  { id: 'lab', icon: FlaskConical, title: 'Laboratories', desc: 'Lab tests, results & reporting', active: false },
  { id: 'inventory', icon: Package, title: 'Inventory', desc: 'Stock, orders, suppliers & assets', active: false },
  { id: 'clinic', icon: Stethoscope, title: 'Clinic', desc: 'Patient visits, OPD & records', active: false },
  { id: 'accounts', icon: Wallet, title: 'Accounts', desc: 'Finance, billing & ledgers', active: false },
];

export default function MainDashboard() {
  const [loading, setLoading] = useState(true);
  const { clearModule, setModule } = useModuleStore();
  const navigate = useNavigate();

  useEffect(() => {
    clearModule();
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, [clearModule]);

  const handleModuleClick = (m) => {
    if (m.active) {
      setModule('employee');
      navigate('/employee-module');
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
              <m.icon className="w-10 h-10" />
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
