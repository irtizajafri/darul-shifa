import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import GdNotificationPopup from '../components/inventory/GdNotificationPopup';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import MainLayout from '../components/layout/MainLayout';
import Login from '../pages/auth/Login';
import Signup from '../pages/auth/Signup';

// The actual page-route table (Dashboard, Employee/Inventory/Accounts/Clinic
// modules, ~140 routes) lives in ProtectedRoutes.jsx now, not here — it's
// mounted once per open browser-style tab (see TabsContainer.jsx), each in
// its own isolated <MemoryRouter>.
//
// React Router does not allow nesting one <Router> (BrowserRouter,
// MemoryRouter, ...) inside another anywhere in the tree — it throws
// "You cannot render a <Router> inside another <Router>" the moment a
// second one mounts, which unmounts the whole app with no visible error
// unless you're watching the dev-server console. So once the user is
// authenticated, MainLayout (and every per-tab <MemoryRouter> inside it)
// must NOT be rendered underneath this outer <BrowserRouter> at all — the
// outer router here exists only to serve /login and /signup, which have no
// tabs and don't need isolation.
export default function AppRoutes() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <GdNotificationPopup />
      <MainLayout />
    </>
  );
}
