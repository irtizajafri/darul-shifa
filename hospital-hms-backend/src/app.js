const express = require('express');
const cors = require('cors');
const authRoutes = require('./modules/auth/auth.routes');
const employeeRoutes = require('./modules/employees/employee.routes');
const attendanceRoutes = require('./modules/attendance/attendance.routes');
const gatepassRoutes = require('./modules/gatepass/gatepass.routes');
const shortleaveRoutes = require('./modules/shortleave/shortleave.routes');
const advanceRoutes = require('./modules/advance/advance.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const { errorHandler } = require('./middleware/error.middleware');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit to accept base64 photos

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

app.use(errorHandler);

module.exports = app;
