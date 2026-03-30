import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CheckCircle,
  Palmtree,
  UserPlus,
  Clock,
  DoorOpen,
  Timer,
  CreditCard,
  BarChart3,
} from 'lucide-react';
import { useModuleStore } from '../../store/useModuleStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import PageLoader from '../../components/ui/PageLoader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import './EmployeeModuleDashboard.scss';

const subModules = [
  { title: 'Employee Database', icon: Users, desc: 'Add, edit & manage all employee records', stat: '247 employees registered', path: '/employees' },
  { title: 'Attendance', icon: Clock, desc: 'Machine & editable attendance', path: '/attendance' },
  { title: 'Gate Pass', icon: DoorOpen, desc: 'Manage in/out permissions & nature of visit', path: '/gatepass' },
  { title: 'Short Leave', icon: Timer, desc: 'Track short leaves & permissions', path: '/shortleave' },
  { title: 'Advance & Loan', icon: CreditCard, desc: 'Employee loans & advances with auto deduction', path: '/advance' },
  { title: 'Reports', icon: BarChart3, desc: 'Payslips, payroll, attendance & CR reports', path: '/reports' },
];

export default function EmployeeModuleDashboard() {
  const [loading, setLoading] = useState(true);
  const [apiRowsMonth, setApiRowsMonth] = useState([]);
  const [apiRowsToday, setApiRowsToday] = useState([]);
  const { setModule } = useModuleStore();
  const { employees, fetchEmployees } = useEmployeeStore();
  const navigate = useNavigate();

  useEffect(() => {
    setModule('employee');
    const init = async () => {
      await fetchEmployees();
      const today = new Date();
      const year = String(today.getFullYear());
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const apiToday = `${year}/${month}/${day}`;
      const monthStart = `${year}/${month}/01`;
      const monthEnd = `${year}/${month}/${new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()}`;

      try {
        const [todayRes, monthRes] = await Promise.all([
          fetch('http://localhost:5001/api/attendance/external', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Dates: apiToday, DatesTo: apiToday })
          }),
          fetch('http://localhost:5001/api/attendance/external', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ Dates: monthStart, DatesTo: monthEnd })
          })
        ]);

        const todayJson = await todayRes.json();
        const monthJson = await monthRes.json();

        setApiRowsToday(todayJson.status === 200 && Array.isArray(todayJson.data) ? todayJson.data : []);
        setApiRowsMonth(monthJson.status === 200 && Array.isArray(monthJson.data) ? monthJson.data : []);
      } catch {
        setApiRowsToday([]);
        setApiRowsMonth([]);
      }
      setLoading(false);
    };
    init();
  }, [setModule, fetchEmployees]);

  const stats = useMemo(() => {
    const monthIds = new Set(
      apiRowsMonth
        .map((row) => String(row.enrollid || row.enrollId || '').trim())
        .filter(Boolean)
    );
    const punchMap = apiRowsMonth.reduce((acc, row) => {
      const enrollId = String(row.enrollid || row.enrollId || '').trim();
      if (!enrollId) return acc;
      const dateVal = String(row.arrive_date || row.date || '').split(' ')[0] || '';
      const timeRaw = String(row.arrive_time || row.time_in || '').trim();
      const timeVal = timeRaw.includes(' ') ? timeRaw.split(' ').pop() : timeRaw;
      if (!acc[enrollId]) acc[enrollId] = [];
      if (timeVal) acc[enrollId].push({ date: dateVal, time: timeVal });
      return acc;
    }, {});

    const totalStaff = monthIds.size || employees.length;
    const now = new Date();
    const presentNow = Object.values(punchMap).filter((entries) => {
      if (!entries.length) return false;
      const sorted = entries.slice().sort((a, b) => {
        const aKey = `${a.date} ${a.time}`;
        const bKey = `${b.date} ${b.time}`;
        return aKey.localeCompare(bKey);
      });
      if (sorted.length % 2 !== 1) return false;
      const last = sorted[sorted.length - 1];
      const lastTs = new Date(`${last.date}T${last.time}`);
      if (Number.isNaN(lastTs.getTime())) return false;
      return now - lastTs <= 24 * 60 * 60 * 1000;
    }).length;
    const onLeave = employees.filter((e) => String(e.status || '').toLowerCase().includes('leave')).length;

    return [
      { label: 'Total Staff', value: totalStaff, icon: Users, color: 'blue' },
  { label: 'Present Today', value: presentNow, icon: CheckCircle, color: 'green' },
      { label: 'On Leave', value: onLeave, icon: Palmtree, color: 'amber' },
    ];
  }, [employees, apiRowsMonth, apiRowsToday]);

  const recentActivity = useMemo(() => {
    const byId = apiRowsToday.reduce((acc, row) => {
      const enrollId = String(row.enrollid || row.enrollId || '').trim();
      if (!enrollId) return acc;
      const dateVal = String(row.arrive_date || row.date || '').split(' ')[0] || '--';
      const timeRaw = String(row.arrive_time || row.time_in || '').trim();
      const timeVal = timeRaw.includes(' ') ? timeRaw.split(' ').pop() : timeRaw;
      if (!acc[enrollId]) acc[enrollId] = [];
      if (timeVal) acc[enrollId].push({ time: timeVal, date: dateVal });
      return acc;
    }, {});

    return Object.entries(byId).slice(0, 10).map(([enrollId, entries]) => {
      const sorted = entries.slice().sort((a, b) => a.time.localeCompare(b.time));
      const timeIn = sorted[0]?.time || '--';
      const timeOut = sorted.length > 1 ? sorted[sorted.length - 1]?.time : '--';
      const dateVal = sorted[0]?.date || '--';
      const emp = employees.find((e) => String(e.empCode) === enrollId);
      return {
        id: enrollId,
        name: emp ? `${emp.firstName} ${emp.lastName}` : enrollId,
        date: dateVal,
        timeIn,
        timeOut,
        status: 'Present',
      };
    });
  }, [apiRowsToday, employees]);

  if (loading) return <PageLoader />;

  return (
    <div className="employee-module-dashboard">
      <nav className="breadcrumb">
        <span>Dashboard</span>
        <span className="sep">›</span>
        <span>Employee Management</span>
      </nav>
      <div className="stats-row">
        {stats.map((s) => (
          <Card key={s.label} className="stat-card">
            <div className="stat-content">
              <div className={`stat-icon ${s.color}`}>
                <s.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="stat-value">{s.value}</p>
                <p className="stat-label">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="dashboard-header">
        <h1>Employee Management</h1>
        <p>HR Module — Phase 1</p>
      </div>
      <div className="submodule-grid">
        {subModules.map((sm) => (
          <Card key={sm.title} className="submodule-card">
            <div className="submodule-icon">
              <sm.icon className="w-10 h-10" />
            </div>
            <h3>{sm.title}</h3>
            <p>{sm.desc}</p>
            {sm.stat && <p className="submodule-stat">{sm.stat}</p>}
            <Button
              label="Open →"
              variant="primary"
              onClick={() => navigate(sm.path)}
              className="submodule-btn"
            />
          </Card>
        ))}
      </div>
      <Card title="Recent Activity" className="recent-activity">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.date}</td>
                  <td>{a.timeIn || '--'}</td>
                  <td>{a.timeOut || '--'}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        a.status === 'Present' ? 'present' : a.status === 'Late' ? 'late' : 'absent'
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
