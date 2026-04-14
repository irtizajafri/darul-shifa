const fs = require('fs');

const uiPath = '../src/pages/attendance/TestAttendance.jsx';
let code = fs.readFileSync(uiPath, 'utf8');

// Replace standard {row.timeOut} with {row.timeOut || "Missed Out"}
code = code.replace(/<td className="px-6 py-4 whitespace-nowrap">{row\.timeOut}<\/td>/g, 
  '<td className={`px-6 py-4 whitespace-nowrap font-medium ${!row.timeOut ? "text-red-500" : ""}`}>{row.timeOut || "Missed Out"}</td>');

fs.writeFileSync(uiPath, code, 'utf8');
console.log("Updated UI to politely handle Missed Out.")
