const dbEmps = ['104', '251', '2631', '2510', '242', '999', '2688', '7777', '128', '2341'];
const { Dates, DatesTo } = { Dates: "2025/01/01", DatesTo: "2026/12/31" };
const url = 'http://cloud.intellitech.com.pk:30565/API/Product/read.php?action=allempdaterange565';

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ Dates, DatesTo })
}).then(r => r.json()).then(d => {
  const records = d.data || [];
  console.log("Total API records:", records.length);
  const found = records.filter(r => dbEmps.includes(String(r.staff_id)));
  console.log("DB Emps found in API:", found.length);
  const uniqueFound = [...new Set(found.map(r => r.staff_id))];
  console.log("Unique DB Emps found:", uniqueFound);
}).catch(console.error);
