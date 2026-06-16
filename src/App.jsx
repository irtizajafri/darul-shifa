import AppRoutes from './routes/AppRoutes';
import { useInactivityLogout } from './hooks/useInactivityLogout';
import { useTabSessionGuard } from './hooks/useTabSessionGuard';

function App() {
  useInactivityLogout();
  useTabSessionGuard();
  return <AppRoutes />;
}

export default App;
