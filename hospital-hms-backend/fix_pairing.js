const fs = require('fs');

const controllerPath = 'src/modules/attendance/attendance.controller.js';
let code = fs.readFileSync(controllerPath, 'utf8');

const regex = /const parsedData = \[\];[\s\S]*return res\.json\({ data: parsedData }\);/;

const replacement = `const parsedData = [];

    // Helper to get local date string YYYY-MM-DD
    const toLocalDateStr = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return \`\${year}-\${month}-\${day}\`;
    };

    const reqStartStr = toLocalDateStr(new Date(startDate));
    const reqEndStr = toLocalDateStr(new Date(endDate));

    Object.keys(logsByStaff).forEach(staffId => {
      const logs = logsByStaff[staffId].sort((a, b) => a.getTime() - b.getTime());
      const emp = empMap[staffId];
      const dutyType = emp?.dutyType || 'normal';
      
      let i = 0;
      while (i < logs.length) {
        const timeIn = logs[i];
        let timeOut = null;
        let punchesCount = 1;
        
        let j = i + 1;
        while (j < logs.length) {
          const diffMs = logs[j].getTime() - timeIn.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          // If punch is within 30 minutes, likely an accidental duplicate punch
          if (diffHours < 0.5) {
            punchesCount++;
            j++;
            continue;
          }

          // If punch is within 16 hours, consider it a valid Time Out
          if (diffHours <= 16) {
            timeOut = logs[j];
            punchesCount++;
            j++; 
            break;
          } else {
            // Gap > 16 hours. Must be a missed Time Out. Break to process next punch as Time In.
            break;
          }
        }
        
        // Determine Logical Date (use local date of Time In)
        let logicalDate = new Date(timeIn);
        
        // Optional Shift Adjustment: if a night shift employee's first punch is early morning (before 12 PM),
        // it likely means they missed last night's In punch and only punched Out in the morning.
        // So we assign this orphaned punch to yesterday's logical date.
        if (dutyType === 'night' && timeIn.getHours() < 12) {
           logicalDate.setDate(logicalDate.getDate() - 1);
        }
        const logicalDateStr = toLocalDateStr(logicalDate);

        // Only add to parsedData if it falls within requested range
        if (logicalDateStr >= reqStartStr && logicalDateStr <= reqEndStr) {
          parsedData.push({
            empCode: staffId,
            dutyType: dutyType,
            logicalDate: logicalDateStr,
            timeIn: timeIn.toLocaleString(),
            timeOut: timeOut ? timeOut.toLocaleString() : null, // null will show as blank or handle in UI
            punchesCount: punchesCount
          });
        }
        
        i = j; // Move pointer to next un-paired punch
      }
    });

    return res.json({ data: parsedData });`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(controllerPath, code, 'utf8');
  console.log("Successfully replaced threshold logic.");
} else {
  console.log("Could not find block to replace.");
}
