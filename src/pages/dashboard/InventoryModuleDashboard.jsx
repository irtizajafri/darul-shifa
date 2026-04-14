import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Layers,
  Settings,
  ShoppingCart,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import { useModuleStore } from '../../store/useModuleStore';
import PageLoader from '../../components/ui/PageLoader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import './InventoryModuleDashboard.scss';

const subModules = [
  { title: 'Master Setup', icon: Settings, desc: 'Categories, Items, Vendors, Shelves', stat: 'Configure core data', path: '/inventory/master-setup' },
  { title: 'Purchase Orders (PO)', icon: ShoppingCart, desc: 'Generate & manage supplier POs', stat: '3 Active orders', path: '/inventory/po' },
  { title: 'Receiving (GRN)', icon: Truck, desc: 'Goods Receiving Note & inward stock', stat: 'Awaiting items', path: '/inventory/grn' },
  { title: 'Issuance (GIN)', icon: ArrowUpRight, desc: 'Issue goods to departments', stat: 'Routine outward', path: '/inventory/gin' },
  { title: 'Discard/Return (GDN)', icon: ArrowDownRight, desc: 'Discard expired/damaged stock', stat: 'Manage losses', path: '/inventory/gdn' },
  { title: 'Inventory Reports', icon: BarChart3, desc: 'Ledgers, stock positions, short expiry', stat: '12+ Custom reports', path: '/inventory/reports' },
];

export default function InventoryModuleDashboard() {
  const [loading, setLoading] = useState(true);
  const { setModule } = useModuleStore();
  const navigate = useNavigate();

  useEffect(() => {
    setModule('inventory');
    const init = setTimeout(() => {
      setLoading(false);
    }, 600);
    return () => clearTimeout(init);
  }, [setModule]);

  if (loading) return <PageLoader />;

  return (
    <div className="inventory-module-dashboard">
      <div className="breadcrumb">
        Main Dashboard <span className="sep">{'>'}</span> <span style={{ color: '#0F172A' }}>Inventory Dashboard</span>
      </div>

      <div className="dashboard-header">
        <h1>Inventory Management</h1>
        <p>Manage hospital stock, purchasing, issuance, and assets</p>
      </div>

      <div className="stats-row">
        <Card className="stat-card">
          <div className="stat-content">
            <div className="stat-icon blue">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="stat-value">1,248</div>
              <div className="stat-label">Total Items in Stock</div>
            </div>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="stat-content">
            <div className="stat-icon amber">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="stat-value">12</div>
              <div className="stat-label">Pending Deliveries (PO)</div>
            </div>
          </div>
        </Card>
        <Card className="stat-card">
          <div className="stat-content">
            <div className="stat-icon red">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="stat-value">8</div>
              <div className="stat-label">Low Stock Alerts</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="submodule-grid">
        {subModules.map((sm) => (
          <Card
            key={sm.title}
            className="submodule-card"
            onClick={() => navigate(sm.path)}
          >
            <div className="submodule-icon">
              <sm.icon className="w-7 h-7" />
            </div>
            <h3>{sm.title}</h3>
            <p>{sm.desc}</p>
            <div className="submodule-stat text-slate-500 font-medium">
              {sm.stat}
            </div>
            <Button
              label={`Open ${sm.title.split(' ')[0]} →`}
              variant="secondary"
              className="submodule-btn"
            />
          </Card>
        ))}
      </div>

      <Card className="recent-activity">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold m-0">Recent Low Stock Alerts</h2>
          <Button variant="outline" label="View All Stock" onClick={() => navigate('/inventory/reports')} />
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Reorder Level</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td>ITM-001</td>
                <td className="font-medium text-slate-900">Panadol 500mg</td>
                <td>Medicine</td>
                <td><span className="text-red-600 font-medium">50</span> tabs</td>
                <td>100 tabs</td>
                <td>
                  <span className="status-badge pending">Critical</span>
                </td>
              </tr>
              <tr>
                <td>ITM-089</td>
                <td className="font-medium text-slate-900">Nitrile Gloves Medium</td>
                <td>Surgical</td>
                <td><span className="text-orange-500 font-medium">120</span> pairs</td>
                <td>200 pairs</td>
                <td>
                  <span className="status-badge pending">Low Stock</span>
                </td>
              </tr>
              <tr>
                <td>ITM-112</td>
                <td className="font-medium text-slate-900">IV Set</td>
                <td>Surgical</td>
                <td><span className="text-red-600 font-medium">10</span> sets</td>
                <td>50 sets</td>
                <td>
                  <span className="status-badge pending">Critical</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
