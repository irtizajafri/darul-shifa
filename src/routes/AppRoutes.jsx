import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import PermissionGuard from '../components/auth/PermissionGuard';
import MainLayout from '../components/layout/MainLayout';
import Login from '../pages/auth/Login';
import Signup from '../pages/auth/Signup';
import MainDashboard from '../pages/dashboard/MainDashboard';
import EmployeeModuleDashboard from '../pages/dashboard/EmployeeModuleDashboard';
import InventoryModuleDashboard from '../pages/dashboard/InventoryModuleDashboard';
import EmployeeList from '../pages/employees/EmployeeList';
import AddEmployee from '../pages/employees/AddEmployee';
import EmployeeDetail from '../pages/employees/EmployeeDetail';
import AttendanceList from '../pages/attendance/AttendanceList';
import TempAttendanceApi from '../pages/attendance/TempAttendanceApi';
import TestAttendance from '../pages/attendance/TestAttendance';
import GatePass from '../pages/gatepass/GatePass';
import ShortLeave from '../pages/shortleave/ShortLeave';
import AdvanceLoan from '../pages/advance/AdvanceLoan';
import Reports from '../pages/reports/Reports';
import ComingSoon from '../pages/ComingSoon';
import MasterSetup from '../pages/inventory/MasterSetup';
import PurchaseOrder from '../pages/inventory/PurchaseOrder';
import GoodsReceipt from '../pages/inventory/GoodsReceipt';
import GoodsIssue from '../pages/inventory/GoodsIssue';
import GoodsDiscard from '../pages/inventory/GoodsDiscard';
import SalesInvoice from '../pages/inventory/SalesInvoice';
import InventoryReports from '../pages/inventory/InventoryReports';
import Maintenance from '../pages/inventory/Maintenance';
import UserManagement from '../pages/admin/UserManagement';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Only super admin can access this route — others see it blurred
function SuperAdminRoute({ children }) {
  const { user } = useAuthStore();
  if (user?.isSuperAdmin) return children;
  return <PermissionGuard module="__superadmin__">{children}</PermissionGuard>;
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

          {/* Super Admin only */}
          <Route path="admin/users" element={<SuperAdminRoute><UserManagement /></SuperAdminRoute>} />

          {/* Employee module — dashboard requires at least one employee sub-module */}
          <Route path="employee-module" element={
            <PermissionGuard module="employee">
              <EmployeeModuleDashboard />
            </PermissionGuard>
          } />

          {/* Employee sub-modules */}
          <Route path="employees" element={<PermissionGuard module="employee" subModule="employee-database"><EmployeeList /></PermissionGuard>} />
          <Route path="employees/add" element={<PermissionGuard module="employee" subModule="employee-database"><AddEmployee /></PermissionGuard>} />
          <Route path="employees/:id" element={<PermissionGuard module="employee" subModule="employee-database"><EmployeeDetail /></PermissionGuard>} />
          <Route path="employees/:id/edit" element={<PermissionGuard module="employee" subModule="employee-database"><AddEmployee edit /></PermissionGuard>} />
          <Route path="attendance" element={<PermissionGuard module="employee" subModule="attendance"><AttendanceList /></PermissionGuard>} />
          <Route path="attendance-temp" element={<PermissionGuard module="employee" subModule="attendance"><TempAttendanceApi /></PermissionGuard>} />
          <Route path="test-attendance" element={<PermissionGuard module="employee" subModule="attendance"><TestAttendance /></PermissionGuard>} />
          <Route path="gatepass" element={<PermissionGuard module="employee" subModule="gatepass"><GatePass /></PermissionGuard>} />
          <Route path="shortleave" element={<PermissionGuard module="employee" subModule="shortleave"><ShortLeave /></PermissionGuard>} />
          <Route path="advance" element={<PermissionGuard module="employee" subModule="advance"><AdvanceLoan /></PermissionGuard>} />
          <Route path="reports" element={<PermissionGuard module="employee" subModule="reports"><Reports /></PermissionGuard>} />

          {/* Inventory module — dashboard requires at least one inventory sub-module */}
          <Route path="inventory-module" element={
            <PermissionGuard module="inventory">
              <InventoryModuleDashboard />
            </PermissionGuard>
          } />

          {/* Inventory sub-modules */}
          <Route path="inventory/master-setup" element={<PermissionGuard module="inventory" subModule="master-setup"><MasterSetup /></PermissionGuard>} />
          <Route path="inventory/po" element={<PermissionGuard module="inventory" subModule="po"><PurchaseOrder /></PermissionGuard>} />
          <Route path="inventory/grn" element={<PermissionGuard module="inventory" subModule="grn"><GoodsReceipt /></PermissionGuard>} />
          <Route path="inventory/gin" element={<PermissionGuard module="inventory" subModule="gin"><GoodsIssue /></PermissionGuard>} />
          <Route path="inventory/sales-invoice" element={<PermissionGuard module="inventory" subModule="sales-invoice"><SalesInvoice /></PermissionGuard>} />
          <Route path="inventory/gdn" element={<PermissionGuard module="inventory" subModule="gdn"><GoodsDiscard /></PermissionGuard>} />
          <Route path="inventory/maintenance" element={<PermissionGuard module="inventory" subModule="maintenance"><Maintenance /></PermissionGuard>} />
          <Route path="inventory/reports" element={<PermissionGuard module="inventory" subModule="inventory-reports"><InventoryReports /></PermissionGuard>} />

          <Route path="coming-soon" element={<ComingSoon />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
