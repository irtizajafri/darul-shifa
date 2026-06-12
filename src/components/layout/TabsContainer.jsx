import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTabStore } from '../../store/useTabStore';

export default function TabsContainer() {
  const location = useLocation();
  const { activeTabId, updateTabPath } = useTabStore();

  useEffect(() => {
    updateTabPath(activeTabId, location.pathname);
  }, [location.pathname, activeTabId]);

  return (
    <main className="flex-1 p-4 lg:p-6 overflow-auto">
      <Outlet />
    </main>
  );
}
