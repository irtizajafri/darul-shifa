const prisma = require('./src/config/db');
prisma.employee.findMany().then(e => console.log(e.map(x => x.empCode))).finally(() => process.exit(0));
