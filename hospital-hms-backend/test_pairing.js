const prisma = require('./src/config/db');

async function testIt() {
  const startDate = '2026-02-01';
  const endDate = '2026-02-05';
  const employeeId = '94181';

  const fetchStart = new Date(startDate);
  fetchStart.setDate(fetchStart.getDate() - 1);
  const fetchEnd = new Date(endDate);
  fetchEnd.setDate(fetchEnd.getDate() + 1);

  const formatSysDate = (d) => {
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('/');
  };

  const fStartDate = formatSysDate(fetchStart);
  const fEndDate = formatSysDate(fetchEnd);

  console.log("Calling external API mapped to:", fStartDate, fEndDate);
  
  const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
  const extRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Dates: fStartDate, DatesTo: fEndDate })
  });
  const extJson = await extRes.json();
  let rawRecords = extJson?.data || [];
  
  console.log("Total records from API:", rawRecords.length);

  if (employeeId) {
    rawRecords = rawRecords.filter(r => String(r.staff_id) === String(employeeId));
  }
  
  console.log("Records for employee:", rawRecords.length);

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

  const parsedData = [];
  const logicalDates = [];
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    logicalDates.push(new Date(d));
  }

  // MOCK EMPLOYEES for test
  const empMap = { "94181": { dutyType: "night" } };

  Object.keys(logsByStaff).forEach(staffId => {
    const logs = logsByStaff[staffId].sort((a, b) => a.getTime() - b.getTime());
    const emp = empMap[staffId];
    const isNight = emp?.dutyType === 'night';
    const isAlternate = emp?.dutyType === 'alternate';

    logicalDates.forEach(date => {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);

      let windowStart = new Date(dayStart);
      let windowEnd = new Date(dayStart);

      if (isNight) {
        windowStart.setHours(12, 0, 0, 0);
        windowEnd.setHours(36, 0, 0, 0);
      } else {
        windowStart.setHours(0, 0, 0, 0);
        windowEnd.setHours(23, 59, 59, 999);
      }

      console.log(`Window for ${date.toISOString()}: ${windowStart.toLocaleString()} -> ${windowEnd.toLocaleString()}`);
      
      const punches = logs.filter(l => l >= windowStart && l <= windowEnd);
      if (punches.length > 0) {
        parsedData.push({
          staff_id: staffId,
          logicalDate: date.toISOString().split('T')[0],
          timeIn: punches[0].toLocaleString(),
          timeOut: punches.length > 1 ? punches[punches.length - 1].toLocaleString() : null,
          punchesCount: punches.length
        });
      }
    });
  });

  console.log("Output Length:", parsedData.length);
  console.log("Output Data:", parsedData);
  process.exit(0);
}

testIt().catch(console.error);
