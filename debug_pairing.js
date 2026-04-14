const { PrismaClient } = require('./hospital-hms-backend/node_modules/@prisma/client');
const fetch = require('node-fetch'); // wait, node 18+ has fetch

async function run() {
  const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
  const fStartDate = '2026/02/01';
  const fEndDate = '2026/02/05';
  
  console.log("Fetching API...");
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Dates: fStartDate, DatesTo: fEndDate })
  });
  const json = await res.json();
  const rawRecords = json.data || [];
  
  console.log("Raw records count:", rawRecords.length);
  
  if(rawRecords.length > 0) {
     console.log("Sample raw:", rawRecords[0]);
  }
  
  const logsByStaff = {};
    rawRecords.forEach(r => {
      if (!r.arrive_date || !r.arrive_time) return;
      if (!logsByStaff[r.staff_id]) logsByStaff[r.staff_id] = [];
      const d = r.arrive_date.replace(/\//g, '-');
      const t = r.arrive_time.length === 5 ? `${r.arrive_time}:00` : r.arrive_time;
      const dateTime = new Date(`${d}T${t}`);
      if (!isNaN(dateTime.getTime())) {
        logsByStaff[r.staff_id].push(dateTime);
      }
    });
    
  console.log("Staff IDs grouped:", Object.keys(logsByStaff).length);
  
  const parsedData = [];
  const logicalDates = [new Date('2026-02-02')];
  
  Object.keys(logsByStaff).forEach(staffId => {
      const logs = logsByStaff[staffId].sort((a, b) => a.getTime() - b.getTime());
      const isNight = false;
      const isAlternate = false;

      logicalDates.forEach(date => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);

        let windowStart = new Date(dayStart);
        let windowEnd = new Date(dayStart);

        if (isNight) {
          windowStart.setHours(12, 0, 0, 0);
          windowEnd.setHours(36, 0, 0, 0);
        } else if (isAlternate) {
          windowStart.setHours(0, 0, 0, 0);
          windowEnd.setHours(36, 0, 0, 0);
        } else {
          windowStart.setHours(0, 0, 0, 0);
          windowEnd.setHours(23, 59, 59, 999);
        }

        const punches = logs.filter(l => l >= windowStart && l <= windowEnd);
        if (punches.length > 0) {
          parsedData.push({ staff_id: staffId });
        }
      });
  });
  console.log("Parsed result count:", parsedData.length);
}

run().catch(console.error);
