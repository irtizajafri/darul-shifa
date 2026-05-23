import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useModalKeys from '../../hooks/useModalKeys';
import hospitalLogo from '../../assets/download.png';
import {
  MasterSetupIllustration,
  PurchaseOrderIllustration,
  ReceivingGRNIllustration,
  IssuanceGINIllustration,
  SalesInvoiceIllustration,
  DiscardGDNIllustration,
  InventoryReportsIllustration,
} from '../../assets/InventoryIllustrations';
import {
  Settings,
  ShoppingCart,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useModuleStore } from '../../store/useModuleStore';
import PageLoader from '../../components/ui/PageLoader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useInventoryStore } from '../../store/useInventoryStore';
import './InventoryModuleDashboard.scss';

const subModules = [
  { title: 'Master Setup', icon: Settings, desc: 'Categories, Items, Vendors, Shelves', stat: 'Manage master data', path: '/inventory/master-setup', Illustration: MasterSetupIllustration },
  { title: 'Purchase Orders (PO)', icon: ShoppingCart, desc: 'Generate & manage supplier POs', stat: 'Create and track orders', path: '/inventory/po', state: { openCreate: true }, Illustration: PurchaseOrderIllustration },
  { title: 'Receiving (GRN)', icon: Truck, desc: 'Goods Receiving Note & inward stock', stat: 'Receive stock entries', path: '/inventory/grn', state: { openCreate: true }, Illustration: ReceivingGRNIllustration },
  { title: 'Issuance (GIN)', icon: ArrowUpRight, desc: 'Issue goods to departments', stat: 'Manage outward stock', path: '/inventory/gin', Illustration: IssuanceGINIllustration },
  { title: 'Sales Invoice', icon: FileText, desc: 'Fair Price Shop customer billing', stat: 'Generate invoice & PDF', path: '/inventory/sales-invoice', Illustration: SalesInvoiceIllustration },
  { title: 'Discard/Return (GDN)', icon: ArrowDownRight, desc: 'Discard expired/damaged stock', stat: 'Track wastage and return', path: '/inventory/gdn', Illustration: DiscardGDNIllustration },
  { title: 'Inventory Reports', icon: BarChart3, desc: 'Ledgers, stock positions, short expiry', stat: 'View stock reports', path: '/inventory/reports', Illustration: InventoryReportsIllustration },
];

export default function InventoryModuleDashboard() {
  const [loading, setLoading] = useState(true);
  const [showLowStockPopup, setShowLowStockPopup] = useState(false);
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

  useEffect(() => {
    if (!loading) {
      setShowLowStockPopup(true);
    }
  }, [loading]);

  useModalKeys({
    active: showLowStockPopup,
    onEsc: () => setShowLowStockPopup(false),
  });

  if (loading) return <PageLoader />;

  const totalStock = (items || []).reduce((sum, item) => sum + (Number(item.currentStock) || 0), 0);
  const openAlerts = reorderAlerts || [];

  return (
    <div className="inventory-module-dashboard">
      <div className="dashboard-header">
        <img src={hospitalLogo} alt="Darul Shifa Inventory" className="dashboard-header-logo" />
      </div>

      <div className="submodule-grid">
        {subModules.map((sm) => (
          <div
            key={sm.title}
            className="submodule-card"
            onClick={() => navigate(sm.path, sm.state ? { state: sm.state } : {})}
          >
            <div className="card-content">
              <div className="submodule-icon">
                <sm.icon className="w-5 h-5" />
              </div>
              <h3>{sm.title}</h3>
              <p>{sm.desc}</p>
              <p className="submodule-stat">{sm.stat}</p>
              <button
                className="submodule-btn"
                onClick={(e) => { e.stopPropagation(); navigate(sm.path, sm.state ? { state: sm.state } : {}); }}
              >
                Open {sm.title.split(' ')[0]} →
              </button>
            </div>
            <div className="card-illustration">
              <sm.Illustration />
            </div>
          </div>
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

      {showLowStockPopup && (
        <div className="low-stock-popup-overlay" role="dialog" aria-modal="true" aria-label="Recent Low Stocks">
          <div className="low-stock-popup-card">
            <div className="low-stock-popup-header">
              <div>
                <h2>Recent Low Stocks</h2>
                <p>{openAlerts.length} item(s) currently below reorder level</p>
              </div>
              <div className="low-stock-popup-actions">
                <Button
                  variant="outline"
                  label="View All Stock"
                  onClick={() => {
                    setShowLowStockPopup(false);
                    navigate('/inventory/reports');
                  }}
                />
                <Button
                  variant="secondary"
                  label="Close"
                  onClick={() => setShowLowStockPopup(false)}
                />
              </div>
            </div>

            <div className="low-stock-popup-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th>Current Stock</th>
                    <th>Reorder Level</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {openAlerts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-msg">No reorder alerts right now.</td>
                    </tr>
                  ) : (
                    openAlerts.map((alert) => (
                      <tr key={`popup-alert-${alert.id}`}>
                        <td>{alert.item?.code}</td>
                        <td className="item-name">{alert.item?.name}</td>
                        <td>{alert.item?.category?.name || '-'}</td>
                        <td><span className="stock-danger">{alert.currentQty}</span></td>
                        <td>{alert.thresholdQty}</td>
                        <td><span className="status-badge pending">Reorder Required</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
