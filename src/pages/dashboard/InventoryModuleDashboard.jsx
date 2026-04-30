import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Settings,
  ShoppingCart,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  BarChart3,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useModuleStore } from '../../store/useModuleStore';
import PageLoader from '../../components/ui/PageLoader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useInventoryStore } from '../../store/useInventoryStore';
import './InventoryModuleDashboard.scss';

const subModules = [
  { title: 'Master Setup', icon: Settings, desc: 'Categories, Items, Vendors, Shelves', stat: 'Manage master data', path: '/inventory/master-setup' },
  { title: 'Purchase Orders (PO)', icon: ShoppingCart, desc: 'Generate & manage supplier POs', stat: 'Create and track orders', path: '/inventory/po' },
  { title: 'Receiving (GRN)', icon: Truck, desc: 'Goods Receiving Note & inward stock', stat: 'Receive stock entries', path: '/inventory/grn' },
  { title: 'Issuance (GIN)', icon: ArrowUpRight, desc: 'Issue goods to departments', stat: 'Manage outward stock', path: '/inventory/gin' },
  { title: 'Sales Invoice', icon: FileText, desc: 'Fair Price Shop customer billing', stat: 'Generate invoice & PDF', path: '/inventory/sales-invoice' },
  { title: 'Discard/Return (GDN)', icon: ArrowDownRight, desc: 'Discard expired/damaged stock', stat: 'Track wastage and return', path: '/inventory/gdn' },
  { title: 'Inventory Reports', icon: BarChart3, desc: 'Ledgers, stock positions, short expiry', stat: 'View stock reports', path: '/inventory/reports' },
];

export default function InventoryModuleDashboard() {
  const [loading, setLoading] = useState(true);
  const { setModule } = useModuleStore();
  const { items, reorderAlerts, fetchItems, fetchReorderAlerts } = useInventoryStore();
  const navigate = useNavigate();

  useEffect(() => {
    setModule('inventory');
    const init = setTimeout(async () => {
      try {
        await Promise.all([fetchItems(), fetchReorderAlerts()]);
      } catch (err) {
        toast.error(err.message || 'Failed to load inventory dashboard data');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(init);
  }, [setModule, fetchItems, fetchReorderAlerts]);

  if (loading) return <PageLoader />;

  const totalStock = (items || []).reduce((sum, item) => sum + (Number(item.currentStock) || 0), 0);
  const openAlerts = reorderAlerts || [];

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
              <div className="stat-value">{totalStock}</div>
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
              <div className="stat-value">{items.length}</div>
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
              <div className="stat-value">{openAlerts.length}</div>
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
              onClick={() => navigate(sm.path)}
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
              {openAlerts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-slate-500 py-6">No reorder alerts right now.</td>
                </tr>
              ) : (
                openAlerts.slice(0, 8).map((alert) => (
                  <tr key={alert.id}>
                    <td>{alert.item?.code}</td>
                    <td className="font-medium text-slate-900">{alert.item?.name}</td>
                    <td>{alert.item?.category?.name || '-'}</td>
                    <td><span className="text-red-600 font-medium">{alert.currentQty}</span></td>
                    <td>{alert.thresholdQty}</td>
                    <td>
                      <span className="status-badge pending">Reorder Required</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
