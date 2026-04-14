const fs = require('fs');

const routePath = 'src/modules/attendance/attendance.routes.js';
let code = fs.readFileSync(routePath, 'utf8');

const regex = /router\.post\('\/test-pairing', controller\.testPairing\);/;
if (regex.test(code) && !code.includes('/sync-external')) {
  code = code.replace(regex, "router.post('/test-pairing', controller.testPairing);\nrouter.post('/sync-external', controller.syncAttendance);");
  fs.writeFileSync(routePath, code, 'utf8');
}
