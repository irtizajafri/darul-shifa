import AppRoutes from './routes/AppRoutes';
import { useInactivityLogout } from './hooks/useInactivityLogout';
import { useTabSessionGuard } from './hooks/useTabSessionGuard';
import UpdateNotice from './components/system/UpdateNotice';

function App() {
  useInactivityLogout();
  useTabSessionGuard();
  return (
    <>
      <AppRoutes />
      <UpdateNotice />
    </>
  );
}

export default App;
