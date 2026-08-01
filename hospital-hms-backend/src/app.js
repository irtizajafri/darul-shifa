const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const authRoutes = require('./modules/auth/auth.routes');
const employeeRoutes = require('./modules/employees/employee.routes');
const attendanceRoutes = require('./modules/attendance/attendance.routes');
const gatepassRoutes = require('./modules/gatepass/gatepass.routes');
const shortleaveRoutes = require('./modules/shortleave/shortleave.routes');
const advanceRoutes = require('./modules/advance/advance.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const usersRoutes = require('./modules/users/users.routes');
const clinicRoutes = require('./modules/clinic/clinic.routes');
const leaveEncashmentRoutes = require('./modules/leave-encashment/leave-encashment.routes');
const accountsRoutes = require('./modules/accounts/accounts.routes');
const payslipSnapshotRoutes = require('./modules/payslip-snapshot/payslip-snapshot.routes');
const fuelRoutes = require('./modules/fuel/fuel.routes');
const { errorHandler } = require('./middleware/error.middleware');

const app = express();

app.use(cors());
app.use(compression()); // gzip large JSON responses (reports/lists can be several MB)
app.use(express.json({ limit: '10mb' })); // Increased limit to accept base64 photos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/gatepass', gatepassRoutes);
app.use('/api/shortleave', shortleaveRoutes);
app.use('/api/advance', advanceRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/clinic', clinicRoutes);
app.use('/api/leave-encashment', leaveEncashmentRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/payslip-snapshot', payslipSnapshotRoutes);
app.use('/api/fuel', fuelRoutes);

app.use(errorHandler);

module.exports = app;
