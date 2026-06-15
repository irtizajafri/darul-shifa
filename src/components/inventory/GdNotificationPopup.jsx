import { useEffect, useRef, useState } from 'react';
import { Bell, PackageCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInventoryStore } from '../../store/useInventoryStore';
import { useAuthStore } from '../../store/useAuthStore';
import { hasPermission } from '../../utils/permissions';

const POLL_INTERVAL = 30000; // 30 seconds

export default function GdNotificationPopup() {
  const { user } = useAuthStore();
  const canSee = hasPermission(user, 'inventory', 'gd-notifications');

  const navigate = useNavigate();
  const { fetchUnreadGdNotifications, markGdNotificationsRead } = useInventoryStore();
  const [notifications, setNotifications] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const intervalRef = useRef(null);

  const poll = async () => {
    if (!canSee) return;
    const data = await fetchUnreadGdNotifications();
    if (data.length > 0) {
      setNotifications(data);
      setShowPopup(true);
    }
  };

  useEffect(() => {
    if (!canSee) return;
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [canSee]);

  const handleClose = async () => {
    const ids = notifications.map((n) => n.id);
    await markGdNotificationsRead(ids);
    setShowPopup(false);
    setNotifications([]);
  };

  const handleIssueGIN = async (notif) => {
    const ids = notifications.map((n) => n.id);
    await markGdNotificationsRead(ids);
    setShowPopup(false);
    setNotifications([]);
    navigate(`/inventory/gin?gdHeaderId=${notif.gdHeader?.id}`);
  };

  if (!showPopup || notifications.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">

        {/* Header */}
        <div className="bg-blue-50 border-b border-blue-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-blue-800">New Goods Demand</h2>
              <p className="text-xs text-blue-600 mt-0.5">{notifications.length} new GD request{notifications.length > 1 ? 's' : ''} pending</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-semibold">GD No</th>
                <th className="px-4 py-3 text-left font-semibold">Department</th>
                <th className="px-4 py-3 text-left font-semibold">Items</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notifications.map((notif) => (
                <tr key={notif.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{notif.gdHeader?.code || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{notif.gdHeader?.department?.name || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {(notif.gdHeader?.gdItems || []).map((gi) => gi.item?.name).filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {notif.createdAt ? new Date(notif.createdAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleIssueGIN(notif)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      Issue GIN
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Mark as Read & Close
          </button>
        </div>
      </div>
    </div>
  );
}
