import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import MainLayout from '../components/layout/MainLayout';
import Login from '../pages/auth/Login';
import Signup from '../pages/auth/Signup';
import MainDashboard from '../pages/dashboard/MainDashboard';
import EmployeeModuleDashboard from '../pages/dashboard/EmployeeModuleDashboard';
import EmployeeList from '../pages/employees/EmployeeList';
import AddEmployee from '../pages/employees/AddEmployee';
import EmployeeDetail from '../pages/employees/EmployeeDetail';
import AttendanceList from '../pages/attendance/AttendanceList';
import TempAttendanceApi from '../pages/attendance/TempAttendanceApi';
import GatePass from '../pages/gatepass/GatePass';
import ShortLeave from '../pages/shortleave/ShortLeave';
import AdvanceLoan from '../pages/advance/AdvanceLoan';
import Reports from '../pages/reports/Reports';
import ComingSoon from '../pages/ComingSoon';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<MainDashboard />} />
          <Route path="employee-module" element={<EmployeeModuleDashboard />} />
          <Route path="employees" element={<EmployeeList />} />
          <Route path="employees/add" element={<AddEmployee />} />
          <Route path="employees/:id" element={<EmployeeDetail />} />
          <Route path="employees/:id/edit" element={<AddEmployee edit />} />
          <Route path="attendance" element={<AttendanceList />} />
          <Route path="attendance-temp" element={<TempAttendanceApi />} />
          <Route path="gatepass" element={<GatePass />} />
          <Route path="shortleave" element={<ShortLeave />} />
          <Route path="advance" element={<AdvanceLoan />} />
          <Route path="reports" element={<Reports />} />
          <Route path="coming-soon" element={<ComingSoon />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
