import AppRoutes from './routes/AppRoutes';
import { useInactivityLogout } from './hooks/useInactivityLogout';

function App() {
  useInactivityLogout();
  return <AppRoutes />;
}

export default App;
