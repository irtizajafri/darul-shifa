import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import GdNotificationPopup from '../components/inventory/GdNotificationPopup';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';
import PermissionGuard from '../components/auth/PermissionGuard';
import MainLayout from '../components/layout/MainLayout';
import Login from '../pages/auth/Login';
import Signup from '../pages/auth/Signup';
import MainDashboard from '../pages/dashboard/MainDashboard';
import EmployeeModuleDashboard from '../pages/dashboard/EmployeeModuleDashboard';
import InventoryModuleDashboard from '../pages/dashboard/InventoryModuleDashboard';
import ClinicModuleDashboard from '../pages/dashboard/ClinicModuleDashboard';
import AccountsModuleDashboard from '../pages/dashboard/AccountsModuleDashboard';
import AccountsParameters from '../pages/accounts/parameters/AccountsParameters';
import MainGL from '../pages/accounts/parameters/MainGL';
import SubGL from '../pages/accounts/parameters/SubGL';
import MainAccount from '../pages/accounts/parameters/MainAccount';
import SubAccount from '../pages/accounts/parameters/SubAccount';
import ListAttachments from '../pages/accounts/parameters/ListAttachments';
import BankAccounts from '../pages/accounts/parameters/BankAccounts';
import ChequeSerial from '../pages/accounts/parameters/ChequeSerial';
import IncomeCategory from '../pages/accounts/parameters/IncomeCategory';
import AccountsTransactions from '../pages/accounts/transactions/AccountsTransactions';
import VoucherExpense from '../pages/accounts/transactions/VoucherExpense';
import VoucherExpenseForm from '../pages/accounts/transactions/VoucherExpenseForm';
import VoucherIncome from '../pages/accounts/transactions/VoucherIncome';
import VoucherIncomeForm from '../pages/accounts/transactions/VoucherIncomeForm';
import BankDeposit from '../pages/accounts/transactions/BankDeposit';
import BankDepositAdj from '../pages/accounts/transactions/BankDepositAdj';
import AccountsReports from '../pages/accounts/reports/AccountsReports';
import VoucherReprint from '../pages/accounts/reports/VoucherReprint';
import VoucherSummary from '../pages/accounts/reports/VoucherSummary';
import VoucherSummaryMatrix from '../pages/accounts/reports/VoucherSummaryMatrix';
import GeneralOPD from '../pages/clinic/GeneralOPD';
import Antenatal from '../pages/clinic/Antenatal';
import ClinicDepartmentPage from '../pages/clinic/parameters/ClinicDepartmentPage';
import ClinicSubDepartmentPage from '../pages/clinic/parameters/ClinicSubDepartmentPage';
import ClinicStaffCategoryPage from '../pages/clinic/parameters/ClinicStaffCategoryPage';
import ClinicDoctorPage from '../pages/clinic/parameters/ClinicDoctorPage';
import ClinicSurgeryTypePage from '../pages/clinic/parameters/ClinicSurgeryTypePage';
import Admission from '../pages/clinic/Admission';
import ClinicRoomCategoryPage from '../pages/clinic/parameters/ClinicRoomCategoryPage';
import ClinicBedPage from '../pages/clinic/parameters/ClinicBedPage';
import ClinicBillHeadListPage from '../pages/clinic/parameters/ClinicBillHeadListPage';
import ClinicBillHeadFormPage from '../pages/clinic/parameters/ClinicBillHeadFormPage';
import ClinicPanelCompanyListPage from '../pages/clinic/panels/ClinicPanelCompanyListPage';
import ClinicPanelCompanyFormPage from '../pages/clinic/panels/ClinicPanelCompanyFormPage';
import ClinicPanelEmployeeListPage from '../pages/clinic/panels/ClinicPanelEmployeeListPage';
import ClinicPanelEmployeeFormPage from '../pages/clinic/panels/ClinicPanelEmployeeFormPage';
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
import LeaveEncashment from '../pages/leave-encashment/LeaveEncashment';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function SuperAdminRoute({ children }) {
  const { user } = useAuthStore();
  if (user?.isSuperAdmin) return children;
  return <PermissionGuard module="__superadmin__">{children}</PermissionGuard>;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <GdNotificationPopup />
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

          <Route path="admin/users" element={<SuperAdminRoute><UserManagement /></SuperAdminRoute>} />

          <Route path="employee-module" element={<PermissionGuard module="employee"><EmployeeModuleDashboard /></PermissionGuard>} />
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
          <Route path="leave-encashment" element={<PermissionGuard module="employee" subModule="leave-encashment"><LeaveEncashment /></PermissionGuard>} />

          <Route path="inventory-module" element={<PermissionGuard module="inventory"><InventoryModuleDashboard /></PermissionGuard>} />
          <Route path="inventory/master-setup" element={<PermissionGuard module="inventory" subModule="master-setup"><MasterSetup /></PermissionGuard>} />
          <Route path="inventory/po" element={<PermissionGuard module="inventory" subModule="po"><PurchaseOrder /></PermissionGuard>} />
          <Route path="inventory/grn" element={<PermissionGuard module="inventory" subModule="grn"><GoodsReceipt /></PermissionGuard>} />
          <Route path="inventory/gin" element={<PermissionGuard module="inventory" subModules={['gd', 'gin']}><GoodsIssue /></PermissionGuard>} />
          <Route path="inventory/sales-invoice" element={<PermissionGuard module="inventory" subModule="sales-invoice"><SalesInvoice /></PermissionGuard>} />
          <Route path="inventory/gdn" element={<PermissionGuard module="inventory" subModule="gdn"><GoodsDiscard /></PermissionGuard>} />
          <Route path="inventory/maintenance" element={<PermissionGuard module="inventory" subModule="maintenance"><Maintenance /></PermissionGuard>} />
          <Route path="inventory/reports" element={<PermissionGuard module="inventory" subModule="inventory-reports"><InventoryReports /></PermissionGuard>} />

          <Route path="accounts-module" element={<PermissionGuard module="accounts"><AccountsModuleDashboard /></PermissionGuard>} />
          <Route path="accounts/:entityType/parameters" element={<PermissionGuard module="accounts"><AccountsParameters /></PermissionGuard>} />
          <Route path="accounts/:entityType/parameters/main-gl" element={<PermissionGuard module="accounts"><MainGL /></PermissionGuard>} />
          <Route path="accounts/:entityType/parameters/sub-gl" element={<PermissionGuard module="accounts"><SubGL /></PermissionGuard>} />
          <Route path="accounts/:entityType/parameters/main-account" element={<PermissionGuard module="accounts"><MainAccount /></PermissionGuard>} />
          <Route path="accounts/:entityType/parameters/sub-account" element={<PermissionGuard module="accounts"><SubAccount /></PermissionGuard>} />
          <Route path="accounts/:entityType/parameters/list-attachments" element={<PermissionGuard module="accounts"><ListAttachments /></PermissionGuard>} />
          <Route path="accounts/:entityType/parameters/bank-accounts" element={<PermissionGuard module="accounts"><BankAccounts /></PermissionGuard>} />
          <Route path="accounts/:entityType/parameters/cheque-serial" element={<PermissionGuard module="accounts"><ChequeSerial /></PermissionGuard>} />
          <Route path="accounts/:entityType/parameters/income-category" element={<PermissionGuard module="accounts"><IncomeCategory /></PermissionGuard>} />

          <Route path="accounts/:entityType/transactions" element={<PermissionGuard module="accounts"><AccountsTransactions /></PermissionGuard>} />
          <Route path="accounts/:entityType/transactions/voucher-expense" element={<PermissionGuard module="accounts"><VoucherExpense /></PermissionGuard>} />
          <Route path="accounts/:entityType/transactions/voucher-expense/form" element={<PermissionGuard module="accounts"><VoucherExpenseForm /></PermissionGuard>} />
          <Route path="accounts/:entityType/transactions/voucher-income" element={<PermissionGuard module="accounts"><VoucherIncome /></PermissionGuard>} />
          <Route path="accounts/:entityType/transactions/voucher-income/form" element={<PermissionGuard module="accounts"><VoucherIncomeForm /></PermissionGuard>} />
          <Route path="accounts/:entityType/transactions/bank-deposit" element={<PermissionGuard module="accounts"><BankDeposit /></PermissionGuard>} />
          <Route path="accounts/:entityType/transactions/deposit-adjustment" element={<PermissionGuard module="accounts"><BankDepositAdj /></PermissionGuard>} />
          <Route path="accounts/:entityType/reports" element={<PermissionGuard module="accounts"><AccountsReports /></PermissionGuard>} />
          <Route path="accounts/:entityType/reports/voucher-reprint" element={<PermissionGuard module="accounts"><VoucherReprint /></PermissionGuard>} />
          <Route path="accounts/:entityType/reports/voucher-summary" element={<PermissionGuard module="accounts"><VoucherSummary /></PermissionGuard>} />
          <Route path="accounts/:entityType/reports/voucher-summary-matrix" element={<PermissionGuard module="accounts"><VoucherSummaryMatrix /></PermissionGuard>} />
          <Route path="accounts/:entityType/reports/*" element={<PermissionGuard module="accounts"><ComingSoon /></PermissionGuard>} />

          <Route path="clinic-module" element={<PermissionGuard module="clinic"><ClinicModuleDashboard /></PermissionGuard>} />
          <Route path="clinic/general-opd" element={<PermissionGuard module="clinic" subModule="general-opd"><GeneralOPD departmentName="General OPD" /></PermissionGuard>} />
          <Route path="clinic/consultant-opd" element={<PermissionGuard module="clinic" subModule="general-opd"><GeneralOPD departmentName="Consultant OPD" /></PermissionGuard>} />
          <Route path="clinic/emergency-opd" element={<PermissionGuard module="clinic" subModule="general-opd"><GeneralOPD departmentName="Emergency & Chest Pain Clinic" /></PermissionGuard>} />
          <Route path="clinic/dental" element={<PermissionGuard module="clinic" subModule="general-opd"><GeneralOPD departmentName="Dental" layout="subdept" /></PermissionGuard>} />
          <Route path="clinic/therapy" element={<PermissionGuard module="clinic" subModule="general-opd"><GeneralOPD departmentName="Therapy" layout="subdept" /></PermissionGuard>} />
          <Route path="clinic/laboratory" element={<PermissionGuard module="clinic" subModule="general-opd"><GeneralOPD departmentName="Laboratory" layout="subdept" /></PermissionGuard>} />
          <Route path="clinic/ultrasound" element={<PermissionGuard module="clinic" subModule="general-opd"><GeneralOPD departmentName="Ultra Sound, Echo & Color Doppler" layout="subdept" /></PermissionGuard>} />
          <Route path="clinic/radiology" element={<PermissionGuard module="clinic" subModule="general-opd"><GeneralOPD departmentName="Radiology" layout="subdept" /></PermissionGuard>} />
          <Route path="clinic/blood-bank" element={<PermissionGuard module="clinic" subModule="general-opd"><GeneralOPD departmentName="Blood Bank" layout="subdept" /></PermissionGuard>} />
          <Route path="clinic/miscellaneous" element={<PermissionGuard module="clinic" subModule="general-opd"><GeneralOPD departmentName="Miscellaneous" /></PermissionGuard>} />
          <Route path="clinic/antenatal" element={<PermissionGuard module="clinic" subModule="antenatal"><Antenatal /></PermissionGuard>} />
          <Route path="clinic/admission" element={<PermissionGuard module="clinic" subModule="admission"><Admission /></PermissionGuard>} />
          <Route path="clinic/parameters/department" element={<PermissionGuard module="clinic" subModule="department"><ClinicDepartmentPage /></PermissionGuard>} />
          <Route path="clinic/parameters/sub-department" element={<PermissionGuard module="clinic" subModule="sub-department"><ClinicSubDepartmentPage /></PermissionGuard>} />
          <Route path="clinic/parameters/staff-category" element={<PermissionGuard module="clinic" subModule="staff-category"><ClinicStaffCategoryPage /></PermissionGuard>} />
          <Route path="clinic/parameters/doctors" element={<PermissionGuard module="clinic" subModule="doctors"><ClinicDoctorPage /></PermissionGuard>} />
          <Route path="clinic/parameters/surgery-types" element={<PermissionGuard module="clinic" subModule="surgery-types"><ClinicSurgeryTypePage /></PermissionGuard>} />
          <Route path="clinic/parameters/room-category" element={<PermissionGuard module="clinic" subModule="room-category"><ClinicRoomCategoryPage /></PermissionGuard>} />
          <Route path="clinic/parameters/bed" element={<PermissionGuard module="clinic" subModule="bed"><ClinicBedPage /></PermissionGuard>} />
          <Route path="clinic/parameters/bill-heads" element={<PermissionGuard module="clinic" subModule="bill-heads"><ClinicBillHeadListPage /></PermissionGuard>} />
          <Route path="clinic/parameters/bill-heads/new" element={<PermissionGuard module="clinic" subModule="bill-heads"><ClinicBillHeadFormPage /></PermissionGuard>} />
          <Route path="clinic/parameters/bill-heads/:id" element={<PermissionGuard module="clinic" subModule="bill-heads"><ClinicBillHeadFormPage /></PermissionGuard>} />
          <Route path="clinic/panels/companies" element={<ClinicPanelCompanyListPage />} />
          <Route path="clinic/panels/companies/new" element={<ClinicPanelCompanyFormPage />} />
          <Route path="clinic/panels/companies/:id" element={<ClinicPanelCompanyFormPage />} />
          <Route path="clinic/panels/employees" element={<ClinicPanelEmployeeListPage />} />
          <Route path="clinic/panels/employees/new" element={<ClinicPanelEmployeeFormPage />} />
          <Route path="clinic/panels/employees/:id" element={<ClinicPanelEmployeeFormPage />} />

          <Route path="coming-soon" element={<ComingSoon />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
