import AppRoutes from './routes/AppRoutes';
import GdNotificationPopup from './components/inventory/GdNotificationPopup';
import { useInactivityLogout } from './hooks/useInactivityLogout';

function App() {
  useInactivityLogout();
  return (
    <>
      <AppRoutes />
      <GdNotificationPopup />
    </>
  );
}

export default App;
