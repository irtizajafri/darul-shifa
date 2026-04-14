const fs = require('fs');

const controllerPath = 'src/modules/attendance/attendance.controller.js';
let code = fs.readFileSync(controllerPath, 'utf8');

const regex = /module\.exports = \{ ping, list, create, fetchExternal, testPairing \};/;

const replacement = `// --- Sync Logic ---
async function syncAttendance(req, res, next) {
  try {
    const { startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    // 1. Fetch raw data from external machine
    const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';
    
    // Add ±1 day buffer for night shift logic
    const fetchStart = new Date(startDate);
    fetchStart.setDate(fetchStart.getDate() - 1);
    const fetchEnd = new Date(endDate);
    fetchEnd.setDate(fetchEnd.getDate() + 1);

    const fStartDate = fetchStart.toISOString().split('T')[0].replace(/-/g, '/');
    const fEndDate = fetchEnd.toISOString().split('T')[0].replace(/-/g, '/');

    const extRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Dates: fStartDate, DatesTo: fEndDate })
    });
    
    const extJson = await extRes.json();
    let rawRecords = extJson?.data || [];

    // Group logs by enrollid
    const logsByStaff = {};
    rawRecords.forEach(r => {
      const eId = r.enrollid || r.enrollId;
      if (!r.arrive_time || !eId) return;
      if (!logsByStaff[eId]) logsByStaff[eId] = [];
      const dateTime = new Date(r.arrive_time.replace(' ', 'T'));
      if (!isNaN(dateTime.getTime())) {
        logsByStaff[eId].push(dateTime);
      }
    });

    // Fetch employees from local DB to get Prisma ID and dutyType
    const employees = await prisma.employee.findMany();
    const empMap = {}; // Key: empCode, Value: entire employee object
    employees.forEach(e => {
      empMap[String(e.empCode)] = e;
    });

    const parsedData = [];
    const dStart = new Date(startDate);
    const dEnd = new Date(endDate);
    const logicalDates = [];
    
    for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
      logicalDates.push(new Date(d));
    }

    // --- APPLY SMART WINDOW LOGIC ---
    Object.keys(logsByStaff).forEach(staffId => {
      // Must exist in DB to be saved (skip unregistered external footprints)
      if (!empMap[staffId]) return;

      const logs = logsByStaff[staffId].sort((a, b) => a.getTime() - b.getTime());
      const emp = empMap[staffId];
      
      const isNight = (emp?.dutyType && emp.dutyType.toLowerCase() === 'night') || 
                      (logs.length > 0 && logs.filter(l => l.getHours() >= 16).length > logs.filter(l => l.getHours() < 12).length);
      const isAlternate = emp?.dutyType && emp.dutyType.toLowerCase() === 'alternate';

      logicalDates.forEach(date => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);

        let windowStart = new Date(dayStart);
        let windowEnd = new Date(dayStart);

        if (isNight) {
          windowStart.setHours(12, 0, 0, 0);
          windowEnd.setHours(35, 59, 59, 999);
        } else if (isAlternate) {
          windowStart.setHours(0, 0, 0, 0);
          windowEnd.setHours(35, 59, 59, 999); 
        } else {
          windowStart.setHours(0, 0, 0, 0);
          windowEnd.setHours(23, 59, 59, 999);
        }

        const punches = logs.filter(l => l >= windowStart && l <= windowEnd);
        
        if (punches.length > 0) {
          let timeIn = null;
          let timeOut = null;

          if (punches.length >= 2) {
            timeIn = punches[0];
            timeOut = punches[punches.length - 1];
          } else if (punches.length === 1) {
            const punch = punches[0];
            const hour = punch.getHours();
            if (isNight) {
              if (hour < 12) timeOut = punch;
              else timeIn = punch;
            } else {
              if (hour < 13) timeIn = punch;
              else timeOut = punch;
            }
          }

          // Force time to 24h ISO standard without modifying actual Date object hours
          parsedData.push({
            employeeId: emp.id,          // Prisma required Internal ID
            date: new Date(date),        // Logical date marking the day
            actualIn: timeIn ? new Date(timeIn) : null,
            actualOut: timeOut ? new Date(timeOut) : null,
            status: !timeOut ? "missed_out" : "present" // Use present or custom missed_out flag
          });
        }
      });
    });

    // 3. Upsert into DB. Safest way to avoid duplicate copies if user clicks 'Sync' repeatedly.
    let savedCount = 0;
    
    // Process sequentially to handle Prisma upsert correctly (Prisma transaction upserts inside loops can fail constraint)
    for (const record of parsedData) {
       await prisma.attendance.upsert({
         where: { 
           employeeId_date: { 
             employeeId: record.employeeId, 
             date: record.date 
           } 
         },
         update: {
           actualIn: record.actualIn,
           actualOut: record.actualOut,
           status: record.status // Refreshes missed_out back to present if machine updated it
         },
         create: {
           employeeId: record.employeeId,
           date: record.date,
           actualIn: record.actualIn,
           actualOut: record.actualOut,
           status: record.status
         }
       });
       savedCount++;
    }

    return res.json({ 
       success: true, 
       message: \`Operation Complete! Synchronized \${savedCount} distinct daily attendances into database.\`, 
       syncedCount: savedCount 
    });

  } catch (err) {
    next(err);
  }
}

module.exports = { ping, list, create, fetchExternal, testPairing, syncAttendance };`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.readFileSync(controllerPath, code, 'utf8');
}

fs.writeFileSync(controllerPath, code, 'utf8');
console.log("Successfully implemented sync route.");
