const { PrismaClient } = require('./src/config/db');

async function testPairing() {
  const startDate = '2026-02-01';
  const endDate = '2026-03-12';
  const employeeId = '94181';

  const fetchStart = new Date(startDate);
  fetchStart.setDate(fetchStart.getDate() - 1);
  const fetchEnd = new Date(endDate);
  fetchEnd.setDate(fetchEnd.getDate() + 1);

  const fStartDate = fetchStart.toISOString().split('T')[0].replace(/-/g, '/');
  const fEndDate = fetchEnd.toISOString().split('T')[0].replace(/-/g, '/');

  console.log("Fetching API with:", {fStartDate, fEndDate});
  const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
  
  const extRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Dates: fStartDate, DatesTo: fEndDate })
  });
  const extJson = await extRes.json();
  let rawRecords = extJson?.data || [];
  
  console.log("Raw API Total:", rawRecords.length);
  if (employeeId) {
    rawRecords = rawRecords.filter(r => String(r.staff_id) === String(employeeId));
  }
  console.log("Raw filtered for employee:", rawRecords.length);

  const logsByStaff = {};
  rawRecords.forEach(r => {
    if (!r.arrive_time) return;
    if (!logsByStaff[r.staff_id]) logsByStaff[r.staff_id] = [];
    const dateTime = new Date(r.arrive_time.replace(' ', 'T'));
    if (!isNaN(dateTime.getTime())) {
      logsByStaff[r.staff_id].push(dateTime);
    }
  });

  console.log("Grouped logs:", logsByStaff);
}

testPairing().catch(console.error);
