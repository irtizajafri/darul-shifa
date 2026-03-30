const fs = require('fs');

let content = fs.readFileSync('/Users/stride/Desktop/Darulshifa/hospital-hms/hospital-hms-backend/src/modules/attendance/attendance.service.js', 'utf8');

content = content.replace("const { parse, isValid, format, parseISO } = require('date-fns');", "const { parse, isValid, format, parseISO } = require('date-fns');\nconst { parseTime } = require('../../utils/excelParserHelper');");

content = content.replace("const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);", "const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });");

content = content.replace("const dateStr = row['Date'];", "const dateStr = row['Date'];\n      const rawTimeIn = row['Time In'] || row['TimeIn'] || row['In'];\n      const rawTimeOut = row['Time Out'] || row['TimeOut'] || row['Out'];");

content = content.replace(/\/\/ Format Actuals[\s\S]*?\/\/ Calculate/g, `// Format Actuals via Helper
      let actualIn = parseTime(rawTimeIn, todayStr);
      let actualOut = parseTime(rawTimeOut, todayStr);
      
      // Calculate`);

fs.writeFileSync('/Users/stride/Desktop/Darulshifa/hospital-hms/hospital-hms-backend/src/modules/attendance/attendance.service.js', content, 'utf8');
console.log("Updated!");
