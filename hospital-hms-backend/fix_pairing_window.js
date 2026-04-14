const fs = require('fs');

const controllerPath = 'src/modules/attendance/attendance.controller.js';
let code = fs.readFileSync(controllerPath, 'utf8');

const regex = /const parsedData = \[\];[\s\S]*return res\.json\({ data: parsedData }\);/;

const replacement = `const parsedData = [];

    // Generate logical dates array to handle windows
    const dStart = new Date(startDate);
    const dEnd = new Date(endDate);
    const logicalDates = [];
    for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
      logicalDates.push(new Date(d));
    }

    Object.keys(logsByStaff).forEach(staffId => {
      const logs = logsByStaff[staffId].sort((a, b) => a.getTime() - b.getTime());
      const emp = empMap[staffId];
      
      // Auto-detect Night Shift if dutyType isn't strict, but first punch is evening PM >= 16:00 (4 PM)
      // Otherwise rely on DB dutyType
      const isNight = (emp?.dutyType && emp.dutyType.toLowerCase() === 'night') || 
                      (logs.length > 0 && logs.filter(l => l.getHours() >= 16).length > logs.filter(l => l.getHours() < 12).length);
      
      const isAlternate = emp?.dutyType && emp.dutyType.toLowerCase() === 'alternate';

      logicalDates.forEach(date => {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);

        let windowStart = new Date(dayStart);
        let windowEnd = new Date(dayStart);

        if (isNight) {
          // Night shift window: Today 12:00 PM (Noon) to Tomorrow 11:59 AM
          windowStart.setHours(12, 0, 0, 0);
          windowEnd.setHours(35, 59, 59, 999);
        } else if (isAlternate) {
          // E.g., 24hr shift
          windowStart.setHours(0, 0, 0, 0);
          windowEnd.setHours(35, 59, 59, 999); 
        } else {
          // Normal shift window: Today 00:00 to 23:59
          windowStart.setHours(0, 0, 0, 0);
          windowEnd.setHours(23, 59, 59, 999);
        }

        // Find punches within this window
        const punches = logs.filter(l => l >= windowStart && l <= windowEnd);
        
        if (punches.length > 0) {
          let timeIn = null;
          let timeOut = null;

          if (punches.length >= 2) {
            timeIn = punches[0];
            timeOut = punches[punches.length - 1];
          } else if (punches.length === 1) {
            // Single Punch Heuristic
            const punch = punches[0];
            const hour = punch.getHours();
            
            if (isNight) {
              // For night shifts: PM is Time In, AM is Time Out
              if (hour < 12) {
                timeOut = punch; // Logged in AM -> Missing In
              } else {
                timeIn = punch;  // Logged in PM -> Missing Out
              }
            } else {
              // For normal shifts: Early is In, Late is Out (Threshold: 1:00 PM)
              if (hour < 13) {
                timeIn = punch;
              } else {
                timeOut = punch;
              }
            }
          }

          parsedData.push({
            empCode: staffId,
            dutyType: emp?.dutyType || (isNight ? 'night (auto)' : 'normal'),
            logicalDate: date.toISOString().split('T')[0],
            timeIn: timeIn ? timeIn.toLocaleString() : null,
            timeOut: timeOut ? timeOut.toLocaleString() : null,
            punchesCount: punches.length
          });
        }
      });
    });

    return res.json({ data: parsedData });`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(controllerPath, code, 'utf8');
  console.log("Successfully replaced with Smart Window logic.");
} else {
  console.log("Could not find block to replace.");
}
