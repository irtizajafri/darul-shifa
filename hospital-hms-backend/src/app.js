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
const utilitiesRoutes = require('./modules/utilities/utilities.routes');
const labRoutes = require('./modules/laboratory/laboratory.routes');
const panelLabRoutes = require('./modules/panel-lab/panel-lab.routes');
const pharmacyRoutes = require('./modules/pharmacy/pharmacy.routes');
const { errorHandler } = require('./middleware/error.middleware');
const { authMiddleware } = require('./middleware/auth.middleware');
const { accountsBookGuard } = require('./middleware/accountsBook.middleware');
const { deviceGuard } = require('./modules/devices/devices.service');
const devicesRoutes = require('./modules/devices/devices.routes');
const printRoutes = require('./modules/print/print.routes');

const app = express();

app.use(cors({ exposedHeaders: ['x-new-token'] }));
app.use(compression()); // gzip large JSON responses (reports/lists can be several MB)
app.use(express.json({ limit: '10mb' })); // Increased limit to accept base64 photos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Which PC is calling, and is it allowed (Connected PCs — devices.service.js),
// then the login token on every /api call except the login (auth.middleware.js).
app.use('/api', deviceGuard);
app.use('/api', authMiddleware);
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
// Cash GL / Corporate each need their own permission (owner, 2026-11-23).
app.use('/api/accounts', accountsBookGuard, accountsRoutes);
app.use('/api/payslip-snapshot', payslipSnapshotRoutes);
app.use('/api/fuel', fuelRoutes);
app.use('/api/utilities', utilitiesRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/panel-lab', panelLabRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/print', printRoutes); // direct printing to the PC's thermal / normal printer

app.use(errorHandler);

module.exports = app;
